// services/fcmService.js
const admin = require('firebase-admin');

// Initialisation de Firebase Admin SDK
let fcmInitialized = false;

function initializeFCM() {
  if (fcmInitialized) return;

  try {
    // Vérifier si Firebase Admin est déjà initialisé
    if (admin.apps.length === 0) {
      // Pas encore initialisé, on l'initialise
      const serviceAccount = require('../.well-known/serviceAccountKey.json');

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });

      console.log('[FCM] Firebase Admin SDK initialisé avec succès');
    } else {
      // Déjà initialisé ailleurs, on réutilise l'instance existante
      console.log('[FCM] Firebase Admin SDK déjà initialisé, réutilisation de l\'instance existante');
    }

    fcmInitialized = true;
  } catch (error) {
    console.error('[FCM] Erreur lors de l\'initialisation de Firebase Admin:', error);
  }
}

// Initialiser FCM au démarrage
initializeFCM();

/**
 * Envoyer une notification push à un utilisateur
 * @param {string} fcmToken - Token FCM de l'utilisateur
 * @param {object} notification - Contenu de la notification
 * @param {object} data - Données supplémentaires
 */
// async function sendPushNotification(fcmToken, notification, data = {}) {
//   if (!fcmInitialized) {
//     console.warn('[FCM] Service non initialisé - notification ignorée');
//     return { success: false, error: 'FCM not initialized' };
//   }

//   if (!fcmToken) {
//     console.warn('[FCM] Token FCM manquant - notification ignorée');
//     return { success: false, error: 'No FCM token' };
//   }

//   try {
//     const message = {
//       token: fcmToken,
//       notification: {
//         title: notification.title || 'Vieva Connect',
//         body: notification.body || 'Nouveau message',
//       },
//       data: {
//         ...data,
//         // Ajouter des données pour la navigation
//         click_action: 'FLUTTER_NOTIFICATION_CLICK',
//       },
//       // Configuration Android
//       android: {
//         priority: 'high',
//         notification: {
//           sound: 'default',
//           channelId: 'messages', // Canal pour les messages
//         }
//       },
//       // Configuration iOS
//       apns: {
//         payload: {
//           aps: {
//             sound: 'default',
//             badge: 1,
//           }
//         }
//       }
//     };

//     const response = await admin.messaging().send(message);
//     console.log('[FCM] Notification envoyée avec succès:', response);
//     return { success: true, messageId: response };
//   } catch (error) {
//     console.error('[FCM] Erreur lors de l\'envoi de la notification:', error);

//     // Si le token est invalide, retourner un indicateur
//     if (error.code === 'messaging/invalid-registration-token' ||
//         error.code === 'messaging/registration-token-not-registered') {
//       return { success: false, error: 'Invalid token', invalidToken: true };
//     }

//     return { success: false, error: error.message };
//   }
// }
async function sendPushNotification(fcmToken, notification, data = {}, isDataOnly = false) {
  if (!fcmInitialized) {
    console.warn('[FCM] Service non initialisé - notification ignorée');
    return { success: false, error: 'FCM not initialized' };
  }
  if (!fcmToken) {
    console.warn('[FCM] Token FCM manquant - notification ignorée');
    return { success: false, error: 'No FCM token' };
  }

  try {
    const message = {
      token: fcmToken,
      // Ne pas inclure "notification" si isDataOnly est vrai
      ...(!isDataOnly && {
        notification: {
          title: notification.title || 'Vieva Connect',
          body: notification.body || 'Nouveau message',
        }
      }),
      data: {
        ...data,
        title: notification.title || 'Vieva Connect', // Inclure le titre dans data pour le client
        body: notification.body || 'Nouveau message', // Inclure le corps dans data pour le client
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        ...(!isDataOnly && {
          notification: {
            sound: 'default',
            channelId: 'messages',
          }
        })
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            ...(!isDataOnly && {
              alert: {
                title: notification.title || 'Vieva Connect',
                body: notification.body || 'Nouveau message',
              }
            })
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('[FCM] Notification envoyée avec succès:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('[FCM] Erreur lors de l\'envoi de la notification:', error);
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'Invalid token', invalidToken: true };
    }
    return { success: false, error: error.message };
  }
}


/**
 * Envoyer une notification à plusieurs utilisateurs
 * @param {Array<string>} fcmTokens - Liste des tokens FCM
 * @param {object} notification - Contenu de la notification
 * @param {object} data - Données supplémentaires
 */
// async function sendMulticastNotification(fcmTokens, notification, data = {}) {
//   if (!fcmInitialized) {
//     console.warn('[FCM] Service non initialisé - notifications ignorées');
//     return { success: false, error: 'FCM not initialized' };
//   }

//   if (!fcmTokens || fcmTokens.length === 0) {
//     console.warn('[FCM] Aucun token FCM - notifications ignorées');
//     return { success: false, error: 'No FCM tokens' };
//   }

//   try {
//     const message = {
//       tokens: fcmTokens,
//       notification: {
//         title: notification.title || 'Vieva Connect',
//         body: notification.body || 'Nouveau message',
//       },
//       data: {
//         ...data,
//         click_action: 'FLUTTER_NOTIFICATION_CLICK',
//       },
//       android: {
//         priority: 'high',
//         notification: {
//           sound: 'default',
//           channelId: 'messages',
//         }
//       },
//       apns: {
//         payload: {
//           aps: {
//             sound: 'default',
//             badge: 1,
//           }
//         }
//       }
//     };

//     const response = await admin.messaging().sendEachForMulticast(message);
//     console.log(`[FCM] ${response.successCount}/${fcmTokens.length} notifications envoyées`);

//     // Retourner les tokens invalides pour nettoyage
//     const invalidTokens = [];
//     response.responses.forEach((resp, idx) => {
//       if (!resp.success &&
//           (resp.error.code === 'messaging/invalid-registration-token' ||
//            resp.error.code === 'messaging/registration-token-not-registered')) {
//         invalidTokens.push(fcmTokens[idx]);
//       }
//     });

//     return {
//       success: true,
//       successCount: response.successCount,
//       failureCount: response.failureCount,
//       invalidTokens
//     };
//   } catch (error) {
//     console.error('[FCM] Erreur lors de l\'envoi des notifications multicast:', error);
//     return { success: false, error: error.message };
//   }
// }
async function sendMulticastNotification(fcmTokens, notification, data = {}, isDataOnly = false) {
  if (!fcmInitialized) {
    console.warn('[FCM] Service non initialisé - notifications ignorées');
    return { success: false, error: 'FCM not initialized' };
  }
  if (!fcmTokens || fcmTokens.length === 0) {
    console.warn('[FCM] Aucun token FCM - notifications ignorées');
    return { success: false, error: 'No FCM tokens' };
  }

  try {
    const message = {
      tokens: fcmTokens,
      ...(!isDataOnly && {
        notification: {
          title: notification.title || 'Vieva Connect',
          body: notification.body || 'Nouveau message',
        }
      }),
      data: {
        ...data,
        title: notification.title || 'Vieva Connect',
        body: notification.body || 'Nouveau message',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        ...(!isDataOnly && {
          notification: {
            sound: 'default',
            channelId: 'messages',
          }
        })
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            ...(!isDataOnly && {
              alert: {
                title: notification.title || 'Vieva Connect',
                body: notification.body || 'Nouveau message',
              }
            })
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] ${response.successCount}/${fcmTokens.length} notifications envoyées`);

    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success &&
          (resp.error.code === 'messaging/invalid-registration-token' ||
           resp.error.code === 'messaging/registration-token-not-registered')) {
        invalidTokens.push(fcmTokens[idx]);
      }
    });

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens
    };
  } catch (error) {
    console.error('[FCM] Erreur lors de l\'envoi des notifications multicast:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeFCM,
  sendPushNotification,
  sendMulticastNotification
};
