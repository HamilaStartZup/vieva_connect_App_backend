// socket/messageHandler.js
const Conversation = require('../models/conversations');
const Message = require('../models/messages');
const Personne = require('../models/personnes');
const { sendPushNotification } = require('../services/fcmService');
// Maps pour suivre les connexions actives
const activeUsers = new Map(); // userId -> socketId
const typingUsers = new Map(); // conversationId -> Set of userIds
const conversationRooms = new Map(); // conversationId -> Set of socketIds
const activeConversationScreens = new Map(); // userId -> conversationId (utilisateur actuellement dans cette conversation)
const appForegroundUsers = new Set(); // Set of userIds dont l'app est en foreground

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

    // NOUVEAU: Entrer dans l'écran de conversation (anti-notification)
    socket.on('enter_conversation_screen', (data) => {
      const { conversationId } = data;
      activeConversationScreens.set(socket.userId, conversationId);
      console.log(`[MessageHandler] ${socket.userName} est maintenant dans l'écran de conversation ${conversationId}`);
    });

    // NOUVEAU: Quitter l'écran de conversation (réactiver notifications)
    socket.on('leave_conversation_screen', (data) => {
      const { conversationId } = data;
      if (activeConversationScreens.get(socket.userId) === conversationId) {
        activeConversationScreens.delete(socket.userId);
        console.log(`[MessageHandler] ${socket.userName} a quitté l'écran de conversation ${conversationId}`);
      }
    });

    // NOUVEAU: App en foreground
    socket.on('app_foreground', () => {
      appForegroundUsers.add(socket.userId);
      console.log(`[MessageHandler] ${socket.userName} - app en FOREGROUND`);
    });

    // NOUVEAU: App en background
    socket.on('app_background', () => {
      appForegroundUsers.delete(socket.userId);
      console.log(`[MessageHandler] ${socket.userName} - app en BACKGROUND`);
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
        // NOUVEAU: Envoyer push notifications aux participants hors de la conversation
        await sendPushNotificationsToOfflineParticipants(
          conversation,
          socket.userId,
          socket.userName,
          messageData
        );
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
      // NOUVEAU: Retirer de la map des écrans actifs
      activeConversationScreens.delete(socket.userId);
      // NOUVEAU: Retirer du set des apps en foreground
      appForegroundUsers.delete(socket.userId);
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

  // NOUVEAU: Fonction helper pour compter les messages non lus d'un utilisateur
  async function getUnreadMessagesCount(userId) {
    try {
      const count = await Message.countDocuments({
        senderId: { $ne: userId },
        isRead: false,
        conversationId: {
          $in: await Conversation.find({
            participants: userId
          }).distinct('_id')
        }
      });
      return count;
    } catch (error) {
      console.error('[MessageHandler] Erreur comptage messages non lus:', error);
      return 0;
    }
  }

  // NOUVEAU: Fonction pour envoyer push notifications aux participants non actifs
  async function sendPushNotificationsToOfflineParticipants(conversation, senderId, senderName, messageData) {
    try {
      // Obtenir tous les participants sauf l'expéditeur
      const recipients = conversation.participants.filter(
        participantId => participantId.toString() !== senderId.toString()
      );
      if (recipients.length === 0) {
        return;
      }
      console.log(`[MessageHandler] Vérification push notifications pour ${recipients.length} participants`);
      // Récupérer les informations des destinataires
      const users = await Personne.find({
        _id: { $in: recipients }
      }).select('_id prenom nom fcmToken');

      for (const user of users) {
        const userId = user._id.toString();

        // Vérifier si l'utilisateur est dans l'écran de conversation
        const isInConversationScreen = activeConversationScreens.get(userId) === conversation._id.toString();
        if (isInConversationScreen) {
          console.log(`[MessageHandler] ⏭️ Pas de notification pour ${user.prenom} ${user.nom} (dans la conversation)`);
          continue;
        }

        // NOUVEAU: Vérifier si l'app est en foreground ET l'utilisateur est actif (Socket.io connecté)
        // Si oui, le message sera géré par le banner in-app, pas besoin de notification push
        const isAppInForeground = appForegroundUsers.has(userId);
        const isSocketConnected = activeUsers.has(userId);

        if (isAppInForeground && isSocketConnected) {
          console.log(`[MessageHandler] ⏭️ Pas de notification push pour ${user.prenom} ${user.nom} (app en foreground, banner in-app suffit)`);
          continue;
        }

        // Vérifier si l'utilisateur a un token FCM
        if (!user.fcmToken) {
          console.log(`[MessageHandler] ⏭️ Pas de token FCM pour ${user.prenom} ${user.nom}`);
          continue;
        }

        // Construire le message de notification
        let notificationBody = '';
        switch (messageData.type) {
          case 'text':
            notificationBody = messageData.text;
            break;
          case 'image':
            notificationBody = '📷 Image envoyée';
            break;
          case 'audio':
            notificationBody = '🎵 Message vocal';
            break;
          case 'document':
            notificationBody = `📄 ${messageData.fileName || 'Document'}`;
            break;
          default:
            notificationBody = '📎 Nouveau message';
        }

        // Calculer le nombre de messages non lus pour le badge iOS
        const unreadCount = await getUnreadMessagesCount(userId);
        const badgeCount = Math.max(1, unreadCount); // Au moins 1 pour le nouveau message

        // Envoyer la notification push (toujours avec notification visible)
        console.log(`[MessageHandler] 📤 Envoi notification push à ${user.prenom} ${user.nom} (badge: ${badgeCount})`);
        const result = await sendPushNotification(
          user.fcmToken,
          {
            title: senderName,
            body: notificationBody
          },
          {
            conversationId: conversation._id.toString(),
            messageId: messageData.id.toString(),
            senderId: senderId.toString(),
            senderName: senderName,
            type: messageData.type || 'text'
          },
          badgeCount // Badge iOS
        );

        if (result.success) {
          console.log(`[MessageHandler] ✅ Notification envoyée à ${user.prenom} ${user.nom}`);
        } else if (result.invalidToken) {
          console.log(`[MessageHandler] ⚠️ Token FCM invalide pour ${user.prenom} ${user.nom}, suppression...`);
          // Supprimer le token invalide
          await Personne.findByIdAndUpdate(user._id, {
            $unset: { fcmToken: 1, fcmTokenUpdatedAt: 1 }
          });
        } else {
          console.log(`[MessageHandler] ❌ Erreur notification pour ${user.prenom} ${user.nom}: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('[MessageHandler] Erreur lors de l\'envoi des push notifications:', error);
    }
  }

  // Exporter les maps pour le monitoring
  return {
    activeUsers,
    typingUsers,
    conversationRooms,
    activeConversationScreens,
    appForegroundUsers
  };
};

module.exports = messageHandler;
