const Conversation = require("../models/conversations");
const Message = require("../models/messages");
const Personne = require("../models/personnes");
const mongoose = require("mongoose");
const { getGridFSBucket, validateFile, getMessageType } = require("../utils/gridfs");

// Helper pour upload de fichier vers GridFS
const uploadToGridFS = (buffer, filename, mimetype) => {
  return new Promise((resolve, reject) => {
    // Valider le fichier avant upload
    try {
      validateFile(mimetype, buffer.length);
    } catch (error) {
      return reject(error);
    }

    const bucket = getGridFSBucket();
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        originalName: filename,
        mimetype: mimetype,
        uploadDate: new Date()
      }
    });

    uploadStream.on('error', (error) => {
      reject(error);
    });

    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id,
        filename: filename,
        length: buffer.length,
        uploadDate: new Date(),
        mimetype: mimetype
      });
    });

    uploadStream.end(buffer);
  });
};

module.exports = {
  // GET /conversations
  getConversations: async (req, res) => {
    try {
      const userId = req.auth._id;
      // Récupérer toutes les conversations où l'utilisateur est participant
      const conversations = await Conversation.find({
        participants: userId
      })
        .populate({
          path: "participants",
          select: "_id nom prenom"
        })
        .populate({
          path: "messages",
          options: { sort: { createdAt: -1 }, limit: 1 },
        });

      // Pour chaque conversation, formater la réponse
      const formatted = await Promise.all(conversations.map(async (conv) => {
        // Trouver le contact (l'autre participant)
        const contact = conv.participants.find(p => p._id.toString() !== userId.toString());
        // Récupérer le dernier message
        const lastMessage = conv.messages[0];
        // Compter les messages non lus pour l'utilisateur
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          isRead: false,
          senderId: { $ne: userId }
        });
        return {
          conversationId: conv._id,
          contact: contact ? {
            id: contact._id,
            name: contact.prenom + ' ' + contact.nom,
            avatar: null // Pas de champ avatar pour l'instant
          } : null,
          lastMessage: lastMessage ? {
            text: lastMessage.type === "text" ? lastMessage.text : null,
            timestamp: lastMessage.createdAt,
            type: lastMessage.type
          } : null,
          unreadCount
        };
      }));
      res.json(formatted);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la récupération des conversations" });
    }
  },

  // GET /conversations/:id/messages
  getMessages: async (req, res) => {
    try {
      const userId = req.auth._id;
      const conversationId = req.params.id;
      // Vérifier que l'utilisateur est bien participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        return res.status(403).json({ error: "Accès refusé à cette conversation" });
      }
      // Récupérer les messages
      const messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 });
      // Formater la réponse
      const formatted = messages.map(msg => ({
        id: msg._id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        timestamp: msg.createdAt,
        isRead: msg.isRead,
        type: msg.type,
        text: msg.type === "text" ? msg.text : null,
        mediaUrl: msg.type !== "text" ? msg.mediaUrl : null,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        mimeType: msg.mimeType
      }));
      res.json(formatted);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la récupération des messages" });
    }
  },

  // POST /messages
  sendMessage: async (req, res) => {
    try {
      const userId = req.auth._id;
      const { conversationId, type, text, mediaUrl, fileName, fileSize, mimeType } = req.body;
      // Vérifier que la conversation existe et que l'utilisateur est participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        return res.status(403).json({ error: "Accès refusé à cette conversation" });
      }
      // Créer le message
      const newMessage = new Message({
        conversationId,
        senderId: userId,
        type,
        text: type === "text" ? text : null,
        mediaUrl: type !== "text" ? mediaUrl : null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        isRead: false
      });
      await newMessage.save();
      // Ajouter le message à la conversation
      conversation.messages.push(newMessage._id);
      await conversation.save();

      const messageData = {
        id: newMessage._id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        timestamp: newMessage.createdAt,
        isRead: newMessage.isRead,
        type: newMessage.type,
        text: newMessage.text,
        mediaUrl: newMessage.mediaUrl,
        fileName: newMessage.fileName,
        fileSize: newMessage.fileSize,
        mimeType: newMessage.mimeType
      };

      // Émettre l'événement Socket.io si disponible
      if (global.io) {
        const roomName = `conversation_${conversationId}`;
        global.io.to(roomName).emit('new_message_rest', messageData);
        console.log(`[REST API] Message émis via Socket.io pour conversation ${conversationId}`);
      }

      res.status(201).json(messageData);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de l'envoi du message" });
    }
  },

  // PATCH /conversations/:id/read
  markAsRead: async (req, res) => {
    try {
      const userId = req.auth._id;
      const conversationId = req.params.id;
      // Vérifier que l'utilisateur est bien participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        return res.status(403).json({ error: "Accès refusé à cette conversation" });
      }
      // Marquer tous les messages reçus comme lus
      await Message.updateMany({
        conversationId,
        senderId: { $ne: userId },
        isRead: false
      }, { $set: { isRead: true } });

      // Émettre l'événement Socket.io si disponible
      if (global.io) {
        const roomName = `conversation_${conversationId}`;
        global.io.to(roomName).emit('messages_read_rest', {
          conversationId,
          readBy: userId
        });
        console.log(`[REST API] Messages marqués comme lus via Socket.io pour conversation ${conversationId}`);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la mise à jour des messages" });
    }
  },

  // POST /upload - Upload vers GridFS
  uploadFile: async (req, res) => {
    try {
      // Vérifier qu'un fichier est fourni
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: "Aucun fichier envoyé" });
      }

      const file = req.files.file;
      const { originalname, mimetype, data } = file;

      // Upload vers GridFS
      const uploadResult = await uploadToGridFS(data, originalname, mimetype);

      // Déterminer le type de message
      const messageType = getMessageType(mimetype);

      // Retourner les métadonnées avec l'ID GridFS
      res.status(201).json({
        fileId: uploadResult.fileId,
        url: `/api/files/${uploadResult.fileId}`,
        fileName: originalname,
        fileSize: uploadResult.length,
        mimeType: mimetype,
        messageType: messageType
      });

    } catch (error) {
      console.error('Erreur upload GridFS:', error);
      res.status(500).json({
        error: error.message || "Erreur lors de l'upload du fichier"
      });
    }
  },

  // GET /files/:id - Servir les fichiers depuis GridFS
  getFile: async (req, res) => {
    try {
      const fileId = req.params.id;

      // Valider l'ObjectId
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return res.status(400).json({ error: "ID de fichier invalide" });
      }

      const bucket = getGridFSBucket();

      // Vérifier que le fichier existe
      const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();

      if (files.length === 0) {
        return res.status(404).json({ error: "Fichier non trouvé" });
      }

      const file = files[0];

      // Définir les headers appropriés
      res.set({
        'Content-Type': file.metadata?.mimetype || 'application/octet-stream',
        'Content-Length': file.length,
        'Content-Disposition': `inline; filename="${file.filename}"`,
        'Cache-Control': 'public, max-age=31536000' // Cache 1 an
      });

      // Stream le fichier
      const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));

      downloadStream.on('error', (error) => {
        console.error('Erreur téléchargement GridFS:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Erreur lors du téléchargement" });
        }
      });

      downloadStream.pipe(res);

    } catch (error) {
      console.error('Erreur récupération fichier:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
};
