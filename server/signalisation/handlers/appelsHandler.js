// signalisation/handlers/appelsHandler.js
const { v4: uuidv4 } = require('uuid');
const Appel = require('../models/Appel');
const Personne = require('../../models/personnes'); // Ajustez le chemin
const config = require('../config');

// Maps pour suivre les connexions et appels actifs
const activeUsers = new Map(); // userId -> socketId
const activeAppels = new Map(); // appelId -> { initiateur, destinataire, statut, etc. }

// Fonction pour nettoyer un appel abandonné
const cleanupCall = async (appelId) => {
  try {
    const appel = activeAppels.get(appelId);
    if (!appel) return;
    
    // Mettre à jour la base de données
    await Appel.findOneAndUpdate(
      { appelId },
      { 
        statut: 'manqué',
        fin: new Date()
      },
      { new: true }
    );
    
    // Supprimer l'appel des appels actifs
    activeAppels.delete(appelId);
    
    if (config.logging.calls) {
      console.log(`[Appel] Nettoyage automatique de l'appel ${appelId}`);
    }
  } catch (error) {
    console.error("Erreur lors du nettoyage de l'appel:", error);
  }
};

// Fonction pour vérifier si un utilisateur est déjà en appel
const isUserInCall = (userId) => {
  for (const [, appel] of activeAppels.entries()) {
    if ((appel.initiateur === userId || appel.destinataire === userId) && 
        (appel.statut === 'en_cours' || appel.statut === 'initié')) {
      return true;
    }
  }
  return false;
};

// Gestionnaire principal des événements Socket.IO
module.exports = (io) => {
  // Configurer les événements sur la connexion
  io.on('connection', (socket) => {
    // Enregistrer l'utilisateur comme actif
    activeUsers.set(socket.userId, socket.id);
    
    // Gérer l'initiation d'un appel
    socket.on('initiateCall', async (data) => {
      try {
        const { destinataireId, avecVideo } = data;
        
        // Vérifier si l'initiateur est déjà en appel
        if (!config.behavior.allowMultipleCalls && isUserInCall(socket.userId)) {
          return socket.emit('callError', { 
            message: "Vous êtes déjà en appel" 
          });
        }
        
        // Vérifier si le destinataire est connecté
        if (!activeUsers.has(destinataireId)) {
          return socket.emit('callError', { 
            message: "Le destinataire n'est pas en ligne" 
          });
        }
        
        // Vérifier si le destinataire est déjà en appel
        if (!config.behavior.allowMultipleCalls && isUserInCall(destinataireId)) {
          return socket.emit('callError', { 
            message: "Le destinataire est déjà en appel" 
          });
        }
        
        // Créer un ID d'appel unique
        const appelId = uuidv4();
        
        // Obtenir les informations du destinataire
        const destinataire = await Personne.findById(destinataireId);
        if (!destinataire) {
          return socket.emit('callError', { 
            message: "Destinataire non trouvé" 
          });
        }
        
        // Enregistrer l'appel dans la base de données
        const nouvelAppel = new Appel({
          appelId,
          initiateur: socket.userId,
          destinataire: destinataireId,
          statut: 'initié',
          avecVideo,
        });
        
        await nouvelAppel.save();
        
        if (config.logging.calls) {
          console.log(`[Appel] Nouvel appel initié: ${appelId} - De: ${socket.userId} À: ${destinataireId}`);
        }
        
        // Stocker l'appel actif
        activeAppels.set(appelId, {
          appelId,
          initiateur: socket.userId,
          destinataire: destinataireId,
          avecVideo,
          statut: 'initié',
          timestamp: Date.now()
        });
        
        // Envoyer la notification d'appel au destinataire
        const destinataireSocketId = activeUsers.get(destinataireId);
        io.to(destinataireSocketId).emit('incomingCall', {
          appelId,
          initiateur: {
            id: socket.userId,
            nom: socket.userName.split(' ')[1], // Supposant que userName est "prenom nom"
            prenom: socket.userName.split(' ')[0]
          },
          avecVideo
        });
        
        // Confirmer à l'initiateur que l'appel a été envoyé
        socket.emit('callInitiated', { appelId });
        
        // Définir un délai pour l'appel non répondu
        setTimeout(() => {
          const appel = activeAppels.get(appelId);
          if (appel && appel.statut === 'initié') {
            // Mettre à jour le statut de l'appel
            Appel.findOneAndUpdate(
              { appelId },
              { statut: 'manqué' },
              { new: true }
            ).catch(err => console.error("Erreur lors de la mise à jour de l'appel:", err));
            
            // Informer l'initiateur que l'appel a été manqué
            io.to(socket.id).emit('callMissed', { appelId });
            
            // Supprimer l'appel des appels actifs
            activeAppels.delete(appelId);
            
            if (config.logging.calls) {
              console.log(`[Appel] Appel manqué: ${appelId}`);
            }
          }
        }, config.callTimeout);
      } catch (error) {
        console.error("Erreur lors de l'initiation de l'appel:", error);
        socket.emit('callError', { 
          message: "Erreur lors de l'initiation de l'appel" 
        });
      }
    });
    
    // Gérer l'acceptation d'un appel
    socket.on('acceptCall', async (data) => {
      try {
        const { appelId, consentementDonnées } = data;
        
        const appel = activeAppels.get(appelId);
        if (!appel) {
          return socket.emit('callError', { 
            message: "Appel non trouvé ou expiré" 
          });
        }
        
        // Vérifier que l'utilisateur est bien le destinataire
        if (appel.destinataire !== socket.userId) {
          return socket.emit('callError', { 
            message: "Vous n'êtes pas le destinataire de cet appel" 
          });
        }
        
        if (config.logging.calls) {
          console.log(`[Appel] Appel accepté: ${appelId} - Par: ${socket.userId}`);
        }
        
        // Mettre à jour le statut de l'appel
        appel.statut = 'en_cours';
        appel.consentementDonnées = consentementDonnées;
        activeAppels.set(appelId, appel);
        
        // Mettre à jour dans la base de données
        await Appel.findOneAndUpdate(
          { appelId },
          { 
            statut: 'en_cours',
            consentementDonnées
          },
          { new: true }
        );
        
        // Informer l'initiateur que l'appel a été accepté
        const initiateurSocketId = activeUsers.get(appel.initiateur);
        io.to(initiateurSocketId).emit('callAccepted', { 
          appelId,
          consentementDonnées
        });
      } catch (error) {
        console.error("Erreur lors de l'acceptation de l'appel:", error);
        socket.emit('callError', { 
          message: "Erreur lors de l'acceptation de l'appel" 
        });
      }
    });
    
    // Gérer le refus d'un appel
    socket.on('rejectCall', async (data) => {
      try {
        const { appelId } = data;
        
        const appel = activeAppels.get(appelId);
        if (!appel) {
          return socket.emit('callError', { 
            message: "Appel non trouvé ou expiré" 
          });
        }
        
        if (config.logging.calls) {
          console.log(`[Appel] Appel refusé: ${appelId} - Par: ${socket.userId}`);
        }
        
        // Mettre à jour le statut de l'appel
        await Appel.findOneAndUpdate(
          { appelId },
          { 
            statut: 'refusé',
            fin: new Date()
          },
          { new: true }
        );
        
        // Informer l'initiateur que l'appel a été refusé
        const initiateurSocketId = activeUsers.get(appel.initiateur);
        io.to(initiateurSocketId).emit('callRejected', { appelId });
        
        // Supprimer l'appel des appels actifs
        activeAppels.delete(appelId);
      } catch (error) {
        console.error("Erreur lors du refus de l'appel:", error);
        socket.emit('callError', { 
          message: "Erreur lors du refus de l'appel" 
        });
      }
    });
    
    // Gérer les offres WebRTC
    socket.on('rtcOffer', (data) => {
      const { appelId, offer } = data;
      
      if (config.logging.signaling) {
        console.log(`[Signalisation] Offre RTC reçue pour l'appel: ${appelId}`);
      }
      
      const appel = activeAppels.get(appelId);
      if (!appel) {
        return socket.emit('callError', { 
          message: "Appel non trouvé ou expiré" 
        });
      }
      
      // S'assurer que l'offre vient de l'initiateur
      if (socket.userId !== appel.initiateur) {
        return socket.emit('callError', { 
          message: "Vous n'êtes pas autorisé à envoyer une offre pour cet appel" 
        });
      }
      
      // Transmettre l'offre au destinataire
      const destinataireSocketId = activeUsers.get(appel.destinataire);
      io.to(destinataireSocketId).emit('rtcOffer', { appelId, offer });
    });
    
    // Gérer les réponses WebRTC
    socket.on('rtcAnswer', (data) => {
      const { appelId, answer } = data;
      
      if (config.logging.signaling) {
        console.log(`[Signalisation] Réponse RTC reçue pour l'appel: ${appelId}`);
      }
      
      const appel = activeAppels.get(appelId);
      if (!appel) {
        return socket.emit('callError', { 
          message: "Appel non trouvé ou expiré" 
        });
      }
      
      // S'assurer que la réponse vient du destinataire
      if (socket.userId !== appel.destinataire) {
        return socket.emit('callError', { 
          message: "Vous n'êtes pas autorisé à envoyer une réponse pour cet appel" 
        });
      }
      
      // Transmettre la réponse à l'initiateur
      const initiateurSocketId = activeUsers.get(appel.initiateur);
      io.to(initiateurSocketId).emit('rtcAnswer', { appelId, answer });
    });
    
    // Gérer les candidats ICE
    socket.on('iceCandidate', (data) => {
      const { appelId, candidate, destinationId } = data;
      
      if (config.logging.signaling) {
        console.log(`[Signalisation] Candidat ICE reçu pour l'appel: ${appelId}`);
      }
      
      const appel = activeAppels.get(appelId);
      if (!appel) {
        return socket.emit('callError', { 
          message: "Appel non trouvé ou expiré" 
        });
      }
      
      // Vérifier que l'utilisateur participe à l'appel
      if (socket.userId !== appel.initiateur && socket.userId !== appel.destinataire) {
        return socket.emit('callError', { 
          message: "Vous ne participez pas à cet appel" 
        });
      }
      
      // Transmettre le candidat ICE à l'autre participant
      const destinationSocketId = activeUsers.get(destinationId);
      if (destinationSocketId) {
        io.to(destinationSocketId).emit('iceCandidate', { 
          appelId, 
          candidate,
          fromId: socket.userId
        });
      }
    });
    
    // Gérer la fin d'un appel
    socket.on('endCall', async (data) => {
      try {
        const { appelId } = data;
        
        const appel = activeAppels.get(appelId);
        if (!appel) {
          return socket.emit('callError', { 
            message: "Appel non trouvé ou déjà terminé" 
          });
        }
        
        // Vérifier que l'utilisateur participe à l'appel
        if (socket.userId !== appel.initiateur && socket.userId !== appel.destinataire) {
          return socket.emit('callError', { 
            message: "Vous ne participez pas à cet appel" 
          });
        }
        
        if (config.logging.calls) {
          console.log(`[Appel] Appel terminé: ${appelId} - Par: ${socket.userId}`);
        }
        
        // Mettre à jour le statut de l'appel
        await Appel.findOneAndUpdate(
          { appelId },
          { 
            statut: 'terminé',
            fin: new Date()
          },
          { new: true }
        );
        
        // Informer les deux participants que l'appel est terminé
        const otherParticipantId = socket.userId === appel.initiateur 
          ? appel.destinataire 
          : appel.initiateur;
        
        const otherParticipantSocketId = activeUsers.get(otherParticipantId);
        if (otherParticipantSocketId) {
          io.to(otherParticipantSocketId).emit('callEnded', { appelId });
        }
        
        socket.emit('callEnded', { appelId });
        
        // Supprimer l'appel des appels actifs
        activeAppels.delete(appelId);
      } catch (error) {
        console.error("Erreur lors de la fin de l'appel:", error);
        socket.emit('callError', { 
          message: "Erreur lors de la fin de l'appel" 
        });
      }
    });
    
    // Signaler l'état de la connexion (pour les métriques de qualité)
    socket.on('connectionStateReport', async (data) => {
      try {
        const { appelId, state, metrics } = data;
        
        if (!appelId || !activeAppels.has(appelId)) return;
        
        // Enregistrer la qualité de connexion
        if (state === 'connected' || state === 'completed') {
          let qualiteConnexion = 'moyenne';
          
          // Calculer la qualité en fonction des métriques WebRTC
          if (metrics) {
            if (metrics.packetsLost > 50 || metrics.jitter > 100) {
              qualiteConnexion = 'mauvaise';
            } else if (metrics.packetsLost < 10 && metrics.jitter < 30) {
              qualiteConnexion = 'excellente';
            } else {
              qualiteConnexion = 'bonne';
            }
          }
          
          // Mettre à jour la qualité dans la base de données
          await Appel.findOneAndUpdate(
            { appelId },
            { qualiteConnexion },
            { new: true }
          );
        }
      } catch (error) {
        console.error("Erreur lors du rapport d'état de connexion:", error);
      }
    });
    
    // Gérer la déconnexion
    socket.on('disconnect', async () => {
      if (config.logging.connections) {
        console.log(`[Socket] Utilisateur déconnecté: ${socket.userName} (${socket.userId})`);
      }
      
      // Terminer automatiquement les appels en cours de cet utilisateur
      for (const [appelId, appel] of activeAppels.entries()) {
        if (appel.initiateur === socket.userId || appel.destinataire === socket.userId) {
          try {
            if (config.logging.calls) {
              console.log(`[Appel] Terminaison d'appel suite à déconnexion: ${appelId}`);
            }
            
            // Mettre à jour le statut de l'appel
            await Appel.findOneAndUpdate(
              { appelId },
              { 
                statut: 'terminé',
                fin: new Date()
              },
              { new: true }
            );
            
            // Informer l'autre participant que l'appel est terminé
            const otherParticipantId = socket.userId === appel.initiateur 
              ? appel.destinataire 
              : appel.initiateur;
            
            const otherParticipantSocketId = activeUsers.get(otherParticipantId);
            if (otherParticipantSocketId) {
              io.to(otherParticipantSocketId).emit('callEnded', { 
                appelId,
                raison: "Participant déconnecté"
              });
            }
            
            // Supprimer l'appel des appels actifs
            activeAppels.delete(appelId);
          } catch (error) {
            console.error("Erreur lors de la terminaison d'appel à la déconnexion:", error);
          }
        }
      }
      
      // Supprimer l'utilisateur des utilisateurs actifs
      activeUsers.delete(socket.userId);
    });
  });
  
  // Nettoyer périodiquement les appels abandonnés si l'option est activée
  if (config.behavior.autoCleanupCalls) {
    setInterval(() => {
      const now = Date.now();
      for (const [appelId, appel] of activeAppels.entries()) {
        if (appel.statut === 'initié' && now - appel.timestamp > config.callTimeout) {
          cleanupCall(appelId);
        }
      }
    }, 60000); // Vérifier toutes les minutes
  }
  
  // Nettoyer périodiquement les données anciennes pour RGPD
  setInterval(async () => {
    try {
      const result = await Appel.cleanupOldCalls(config.dataRetentionDays);
      if (result.deletedCount > 0 && config.logging.calls) {
        console.log(`[RGPD] ${result.deletedCount} anciens appels supprimés`);
      }
    } catch (error) {
      console.error("Erreur lors du nettoyage des anciens appels:", error);
    }
  }, 24 * 60 * 60 * 1000); // Une fois par jour
  
  return {
    activeUsers,
    activeAppels
  };
};