// socket/webrtcSignalingHandler.js
// WebRTC Signaling Handler for video/audio calls

// Maps pour suivre les utilisateurs actifs et les appels en cours
const activeUsers = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> { initiator, receiver, state, isVideoCall, createdAt }

const webrtcSignalingHandler = (io) => {
  console.log('[WebRTC Signaling] Initialisation du gestionnaire de signalisation WebRTC');

  io.on('connection', (socket) => {
    console.log(`[WebRTC Signaling] Utilisateur connecté: ${socket.userName} (${socket.userId})`);

    // Enregistrer l'utilisateur comme actif pour les appels
    activeUsers.set(socket.userId, socket.id);

    // Émettre le statut en ligne
    socket.broadcast.emit('user_status_changed', {
      userId: socket.userId,
      userName: socket.userName,
      status: 'online',
      timestamp: new Date().toISOString()
    });

    // ============ CALL MANAGEMENT ============

    /**
     * call_request : Initier un appel
     * Data: { initiatorId, initiatorName, receiverId, callId, isVideoCall }
     */
    socket.on('call_request', (data) => {
      const { initiatorId, initiatorName, receiverId, callId, isVideoCall } = data;
      console.log(`[WebRTC] 📞 CALL_REQUEST: ${initiatorId} -> ${receiverId} (callId: ${callId}, video: ${isVideoCall})`);

      // Vérifier que le destinataire est en ligne
      const receiverSocketId = activeUsers.get(receiverId);
      if (!receiverSocketId) {
        console.log(`[WebRTC] ❌ Receiver ${receiverId} not online`);
        socket.emit('call_error', {
          callId,
          error: 'Receiver not online'
        });
        return;
      }

      // Stocker l'état de l'appel
      activeCalls.set(callId, {
        initiator: initiatorId,
        receiver: receiverId,
        state: 'calling',
        isVideoCall: isVideoCall !== false, // Par défaut true si non spécifié
        createdAt: new Date()
      });

      // Envoyer l'invitation d'appel au destinataire
      io.to(receiverSocketId).emit('incoming_call', {
        callId,
        initiatorId,
        initiatorName,
        isVideoCall: isVideoCall !== false,
        timestamp: new Date().toISOString()
      });

      console.log(`[WebRTC] ✅ Invitation sent to ${receiverId}`);
    });

    /**
     * call_accept : Accepter un appel
     * Data: { callId, receiverId }
     */
    socket.on('call_accept', (data) => {
      const { callId, receiverId } = data;
      console.log(`[WebRTC] ✅ CALL_ACCEPT: Call ${callId} accepted by ${receiverId}`);

      const call = activeCalls.get(callId);
      if (!call) {
        console.log(`[WebRTC] ⚠️ Call ${callId} not found`);
        return;
      }

      // Mettre à jour l'état de l'appel
      call.state = 'connecting';

      // Notifier l'initiateur que l'appel a été accepté
      const initiatorSocketId = activeUsers.get(call.initiator);
      if (initiatorSocketId) {
        io.to(initiatorSocketId).emit('call_accepted', {
          callId,
          receiverId,
          timestamp: new Date().toISOString()
        });
        console.log(`[WebRTC] ✅ Initiator ${call.initiator} notified of acceptance`);
      }
    });

    /**
     * call_reject : Refuser un appel
     * Data: { callId, receiverId, reason }
     */
    socket.on('call_reject', (data) => {
      const { callId, receiverId, reason } = data;
      console.log(`[WebRTC] ❌ CALL_REJECT: Call ${callId} rejected by ${receiverId} - Reason: ${reason}`);

      const call = activeCalls.get(callId);
      if (!call) {
        return;
      }

      // Notifier l'initiateur du refus
      const initiatorSocketId = activeUsers.get(call.initiator);
      if (initiatorSocketId) {
        io.to(initiatorSocketId).emit('call_rejected', {
          callId,
          receiverId,
          reason,
          timestamp: new Date().toISOString()
        });
      }

      // Supprimer l'appel
      activeCalls.delete(callId);
      console.log(`[WebRTC] 🗑️ Call ${callId} terminated`);
    });

    /**
     * call_end : Terminer l'appel
     * Data: { callId, userId }
     */
    socket.on('call_end', (data) => {
      const { callId, userId } = data;
      console.log(`[WebRTC] 🔴 CALL_END: Call ${callId} ended by ${userId}`);

      const call = activeCalls.get(callId);
      if (!call) {
        return;
      }

      // Notifier l'autre participant
      const otherId = userId === call.initiator ? call.receiver : call.initiator;
      const otherSocketId = activeUsers.get(otherId);

      if (otherSocketId) {
        io.to(otherSocketId).emit('call_ended', {
          callId,
          initiatorId: userId,
          timestamp: new Date().toISOString()
        });
      }

      // Supprimer l'appel
      activeCalls.delete(callId);
      console.log(`[WebRTC] 🗑️ Call ${callId} removed from active calls`);
    });

    // ============ WEBRTC SIGNALING ============

    /**
     * webrtc_offer : Envoyer l'offer SDP
     * Data: { callId, offer, senderId }
     */
    socket.on('webrtc_offer', (data) => {
      const { callId, offer, senderId } = data;
      console.log(`[WebRTC] 📨 WEBRTC_OFFER for call ${callId}`);

      const call = activeCalls.get(callId);
      if (!call) {
        console.log(`[WebRTC] ⚠️ Call ${callId} not found`);
        return;
      }

      // Déterminer le destinataire
      const receiverId = senderId === call.initiator ? call.receiver : call.initiator;
      const receiverSocketId = activeUsers.get(receiverId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('webrtc_offer', {
          callId,
          offer,
          senderId
        });
        console.log(`[WebRTC] ✅ Offer forwarded to ${receiverId}`);
      }
    });

    /**
     * webrtc_answer : Envoyer l'answer SDP
     * Data: { callId, answer, senderId }
     */
    socket.on('webrtc_answer', (data) => {
      const { callId, answer, senderId } = data;
      console.log(`[WebRTC] 📨 WEBRTC_ANSWER for call ${callId}`);

      const call = activeCalls.get(callId);
      if (!call) {
        console.log(`[WebRTC] ⚠️ Call ${callId} not found`);
        return;
      }

      // Mettre à jour l'état de l'appel
      call.state = 'active';

      // Déterminer le destinataire
      const receiverId = senderId === call.initiator ? call.receiver : call.initiator;
      const receiverSocketId = activeUsers.get(receiverId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('webrtc_answer', {
          callId,
          answer,
          senderId
        });
        console.log(`[WebRTC] ✅ Answer forwarded to ${receiverId}`);
      }
    });

    /**
     * webrtc_ice_candidate : Envoyer les ICE candidates
     * Data: { callId, candidate, senderId }
     */
    socket.on('webrtc_ice_candidate', (data) => {
      const { callId, candidate, senderId } = data;

      const call = activeCalls.get(callId);
      if (!call) {
        return;
      }

      // Déterminer le destinataire
      const receiverId = senderId === call.initiator ? call.receiver : call.initiator;
      const receiverSocketId = activeUsers.get(receiverId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('webrtc_ice_candidate', {
          callId,
          candidate,
          senderId
        });
      }
    });

    // ============ USER PRESENCE (Legacy events for backward compatibility) ============

    socket.on('user_online', () => {
      socket.broadcast.emit('user_status_changed', {
        userId: socket.userId,
        userName: socket.userName,
        status: 'online',
        timestamp: new Date().toISOString()
      });
    });

    socket.on('user_offline', () => {
      handleUserDisconnect(socket);
    });

    // ============ DISCONNECT HANDLING ============

    socket.on('disconnect', () => {
      console.log(`[WebRTC] ❌ Utilisateur déconnecté: ${socket.userName} (${socket.userId})`);
      handleUserDisconnect(socket);
    });

    socket.on('error', (error) => {
      console.error(`[WebRTC] ⚠️ Socket error:`, error);
    });
  });

  // ============ HELPER FUNCTIONS ============

  function handleUserDisconnect(socket) {
    // Retirer l'utilisateur des utilisateurs actifs
    activeUsers.delete(socket.userId);

    // Notifier tous les clients du statut offline
    socket.broadcast.emit('user_status_changed', {
      userId: socket.userId,
      userName: socket.userName,
      status: 'offline',
      timestamp: new Date().toISOString()
    });

    // Terminer tous les appels actifs pour cet utilisateur
    for (const [callId, call] of activeCalls.entries()) {
      if (call.initiator === socket.userId || call.receiver === socket.userId) {
        const otherId = call.initiator === socket.userId ? call.receiver : call.initiator;
        const otherSocketId = activeUsers.get(otherId);

        if (otherSocketId) {
          io.to(otherSocketId).emit('call_ended', {
            callId,
            reason: 'Peer disconnected',
            timestamp: new Date().toISOString()
          });
        }

        activeCalls.delete(callId);
        console.log(`[WebRTC] 🗑️ Call ${callId} terminated due to user disconnect`);
      }
    }
  }

  // Exporter les maps pour le monitoring
  return {
    activeUsers,
    activeCalls
  };
};

module.exports = webrtcSignalingHandler;
