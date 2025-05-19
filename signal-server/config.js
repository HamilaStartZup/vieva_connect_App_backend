// signal-server/config.js
require('dotenv').config();

// Configuration par défaut
const config = {
  // Configuration des serveurs ICE pour WebRTC
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
    {
      urls: 'stun:stun1.l.google.com:19302',
    }
  ],
  
  // Délai d'expiration des appels non répondus (en millisecondes)
  callTimeout: parseInt(process.env.CALL_TIMEOUT || '30000'),
  
  // Période de rétention des données d'appel (en jours) - RGPD
  dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '30'),
  
  // Options de journalisation
  logging: {
    calls: process.env.LOG_CALLS !== 'false',
    connections: process.env.LOG_CONNECTIONS !== 'false',
    signaling: process.env.LOG_SIGNALING === 'true',
  },
  
  // Options de comportement
  behavior: {
    allowMultipleCalls: process.env.ALLOW_MULTIPLE_CALLS === 'true',
    autoCleanupCalls: process.env.AUTO_CLEANUP_CALLS !== 'false',
  },
  
  // Clé JWT (partagée avec le serveur principal)
  jwtSecret: process.env.JWT_SECRET || 'shhhhh'
};

// Log de la configuration chargée (en masquant les informations sensibles)
console.log('[Config] Configuration chargée:', {
  ...config,
  jwtSecret: '***' // Masquer la clé secrète
});

module.exports = config;