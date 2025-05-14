// signalisation/config.js
module.exports = {
  // Configuration des serveurs ICE pour WebRTC
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
    {
      urls: 'stun:stun1.l.google.com:19302',
    },
    // Vous pouvez ajouter un serveur TURN pour les réseaux restrictifs (recommandé en production)
    // {
    //   urls: 'turn:votre-serveur-turn.com:3478',
    //   username: 'username',
    //   credential: 'password'
    // }
  ],
  
  // Délai d'expiration des appels non répondus (en millisecondes)
  callTimeout: 30000,
  
  // Période de rétention des données d'appel (en jours)
  dataRetentionDays: 30,
  
  // Options de journalisation
  logging: {
    calls: true,         // Journaliser les appels
    connections: true,   // Journaliser les connexions/déconnexions
    signaling: false,    // Journaliser les messages de signalisation (volumineux)
  },
  
  // Options de comportement
  behavior: {
    allowMultipleCalls: false,  // Un utilisateur peut-il avoir plusieurs appels simultanés?
    autoCleanupCalls: true,     // Nettoyer automatiquement les appels abandonnés?
  }
};