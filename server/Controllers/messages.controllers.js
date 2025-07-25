const Conversation = require("../models/conversations");
const Message = require("../models/messages");
const Personne = require("../models/personnes");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// Config Multer
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, basename + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

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
        mediaUrl: msg.type !== "text" ? msg.mediaUrl : null
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
      const { conversationId, type, text, mediaUrl } = req.body;
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
        isRead: false
      });
      await newMessage.save();
      // Ajouter le message à la conversation
      conversation.messages.push(newMessage._id);
      await conversation.save();
      res.status(201).json({
        id: newMessage._id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        timestamp: newMessage.createdAt,
        isRead: newMessage.isRead,
        type: newMessage.type,
        text: newMessage.text,
        mediaUrl: newMessage.mediaUrl
      });
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
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la mise à jour des messages" });
    }
  },

  // POST /upload
  uploadFile: [
    upload.single("file"),
    (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier envoyé" });
      }
      // Construire l'URL d'accès au fichier
      const fileUrl = `/uploads/${req.file.filename}`;
      res.status(201).json({ url: fileUrl });
    }
  ]
};
