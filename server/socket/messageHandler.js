// socket/messageHandler.js
const Conversation = require('../models/conversations');
const Message = require('../models/messages');

// Maps pour suivre les connexions actives
const activeUsers = new Map(); // userId -> socketId
const typingUsers = new Map(); // conversationId -> Set of userIds
const conversationRooms = new Map(); // conversationId -> Set of socketIds

const messageHandler = (io) => {
  console.log('[MessageHandler] Initialisation du gestionnaire de messagerie Socket.io');

  io.on('connection', (socket) => {
    console.log(`[MessageHandler] Utilisateur connecté: ${socket.userName} (${socket.userId})`);

    // Enregistrer l'utilisateur comme actif
    activeUsers.set(socket.userId, socket.id);

    // Rejoindre toutes les conversations de l'utilisateur
    socket.on('join_conversations', async () => {
      try {
        const conversations = await Conversation.find({
          participants: socket.userId
        }).select('_id');

        for (const conv of conversations) {
          const roomName = `conversation_${conv._id}`;
          socket.join(roomName);

          // Ajouter à notre map
          if (!conversationRooms.has(conv._id.toString())) {
            conversationRooms.set(conv._id.toString(), new Set());
          }
          conversationRooms.get(conv._id.toString()).add(socket.id);
        }

        console.log(`[MessageHandler] ${socket.userName} a rejoint ${conversations.length} conversations`);
        socket.emit('conversations_joined', { count: conversations.length });
      } catch (error) {
        console.error('[MessageHandler] Erreur rejoindre conversations:', error);
        socket.emit('error', { message: 'Erreur lors du join des conversations' });
      }
    });

    // Rejoindre une conversation spécifique
    socket.on('join_conversation', async (data) => {
      try {
        const { conversationId } = data;

        // Vérifier que l'utilisateur est participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.userId)) {
          return socket.emit('error', { message: 'Accès refusé à cette conversation' });
        }

        const roomName = `conversation_${conversationId}`;
        socket.join(roomName);

        // Ajouter à notre map
        if (!conversationRooms.has(conversationId)) {
          conversationRooms.set(conversationId, new Set());
        }
        conversationRooms.get(conversationId).add(socket.id);

        console.log(`[MessageHandler] ${socket.userName} a rejoint la conversation ${conversationId}`);
        socket.emit('conversation_joined', { conversationId });
      } catch (error) {
        console.error('[MessageHandler] Erreur join conversation:', error);
        socket.emit('error', { message: 'Erreur lors du join de la conversation' });
      }
    });

    // Quitter une conversation
    socket.on('leave_conversation', (data) => {
      const { conversationId } = data;
      const roomName = `conversation_${conversationId}`;
      socket.leave(roomName);

      // Retirer de notre map
      if (conversationRooms.has(conversationId)) {
        conversationRooms.get(conversationId).delete(socket.id);
        if (conversationRooms.get(conversationId).size === 0) {
          conversationRooms.delete(conversationId);
        }
      }

      console.log(`[MessageHandler] ${socket.userName} a quitté la conversation ${conversationId}`);
    });

    // Envoyer un message
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, type, text, mediaUrl, fileName, fileSize, mimeType } = data;

        // Vérifier la conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.userId)) {
          return socket.emit('error', { message: 'Accès refusé à cette conversation' });
        }

        // Créer le message
        const newMessage = new Message({
          conversationId,
          senderId: socket.userId,
          type,
          text: type === 'text' ? text : null,
          mediaUrl: type !== 'text' ? mediaUrl : null,
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
          mimeType: newMessage.mimeType,
          senderName: socket.userName
        };

        // Émettre le message à tous les participants de la conversation
        const roomName = `conversation_${conversationId}`;
        socket.to(roomName).emit('new_message', messageData);

        // Confirmer l'envoi à l'expéditeur
        socket.emit('message_sent', messageData);

        console.log(`[MessageHandler] Message envoyé par ${socket.userName} dans conversation ${conversationId}`);

        // Arrêter l'indicateur de frappe pour cet utilisateur
        stopTyping(conversationId, socket.userId, socket);

      } catch (error) {
        console.error('[MessageHandler] Erreur envoi message:', error);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Marquer les messages comme lus
    socket.on('mark_as_read', async (data) => {
      try {
        const { conversationId } = data;

        // Vérifier la conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.userId)) {
          return socket.emit('error', { message: 'Accès refusé à cette conversation' });
        }

        // Marquer tous les messages reçus comme lus
        await Message.updateMany({
          conversationId,
          senderId: { $ne: socket.userId },
          isRead: false
        }, { $set: { isRead: true } });

        // Informer les autres participants
        const roomName = `conversation_${conversationId}`;
        socket.to(roomName).emit('messages_read', {
          conversationId,
          readBy: socket.userId,
          readByName: socket.userName
        });

        console.log(`[MessageHandler] Messages marqués comme lus par ${socket.userName} dans conversation ${conversationId}`);

      } catch (error) {
        console.error('[MessageHandler] Erreur marquer comme lu:', error);
        socket.emit('error', { message: 'Erreur lors du marquage comme lu' });
      }
    });

    // Indicateur de frappe - début
    socket.on('start_typing', (data) => {
      const { conversationId } = data;
      startTyping(conversationId, socket.userId, socket);
    });

    // Indicateur de frappe - fin
    socket.on('stop_typing', (data) => {
      const { conversationId } = data;
      stopTyping(conversationId, socket.userId, socket);
    });

    // Statut utilisateur en ligne
    socket.on('user_online', () => {
      socket.broadcast.emit('user_status', {
        userId: socket.userId,
        userName: socket.userName,
        status: 'online'
      });
    });

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      console.log(`[MessageHandler] Utilisateur déconnecté: ${socket.userName} (${socket.userId})`);

      // Retirer l'utilisateur des utilisateurs actifs
      activeUsers.delete(socket.userId);

      // Retirer de toutes les conversations
      for (const [conversationId, socketIds] of conversationRooms.entries()) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          conversationRooms.delete(conversationId);
        }

        // Arrêter l'indicateur de frappe si actif
        stopTyping(conversationId, socket.userId, socket);
      }

      // Informer les autres utilisateurs du statut offline
      socket.broadcast.emit('user_status', {
        userId: socket.userId,
        userName: socket.userName,
        status: 'offline'
      });
    });
  });

  // Fonction helper pour gérer l'indicateur de frappe
  function startTyping(conversationId, userId, socket) {
    if (!typingUsers.has(conversationId)) {
      typingUsers.set(conversationId, new Set());
    }

    const wasTyping = typingUsers.get(conversationId).has(userId);
    typingUsers.get(conversationId).add(userId);

    if (!wasTyping) {
      const roomName = `conversation_${conversationId}`;
      socket.to(roomName).emit('user_typing', {
        conversationId,
        userId,
        userName: socket.userName,
        isTyping: true
      });
    }
  }

  function stopTyping(conversationId, userId, socket) {
    if (typingUsers.has(conversationId)) {
      const wasTyping = typingUsers.get(conversationId).has(userId);
      typingUsers.get(conversationId).delete(userId);

      if (typingUsers.get(conversationId).size === 0) {
        typingUsers.delete(conversationId);
      }

      if (wasTyping) {
        const roomName = `conversation_${conversationId}`;
        socket.to(roomName).emit('user_typing', {
          conversationId,
          userId,
          userName: socket.userName,
          isTyping: false
        });
      }
    }
  }

  // Exporter les maps pour le monitoring
  return {
    activeUsers,
    typingUsers,
    conversationRooms
  };
};

module.exports = messageHandler;