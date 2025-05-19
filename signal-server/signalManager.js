// signal-server/signalManager.js
const socketIo = require('socket.io');
const socketAuth = require('./handlers/socketAuth');
const appelsHandler = require('./handlers/appelsHandler');

class SignalManager {
  constructor(server, options = {}) {
    this.server = server;
    this.options = {
      corsOrigin: options.corsOrigin || '*',
      path: options.path || '/socket.io',
      ...options
    };
    
    this.io = null;
    this.handlers = {};
    
    console.log('[SignalManager] Création avec options:', {
      corsOrigin: this.options.corsOrigin,
      path: this.options.path
    });
  }

  // Initialiser Socket.IO avec authentification
  initialize() {
    console.log('[SignalManager] Initialisation du service Socket.IO...');
    this.io = socketIo(this.server, {
      cors: {
        origin: this.options.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: this.options.path
    });
    
    // Appliquer le middleware d'authentification
    this.io.use((socket, next) => {
      console.log('[SignalManager] Nouvelle tentative de connexion socket');
      socketAuth(socket, next);
    });
    
    // Initialiser les gestionnaires d'événements
    console.log('[SignalManager] Configuration des gestionnaires d\'événements');
    this.handlers = appelsHandler(this.io);
    
    console.log('[SignalManager] Service de signalisation initialisé avec succès');
    
    return this.io;
  }
  
  // Obtenir des informations sur les connexions actives
  getConnectionsStatus() {
    if (!this.io) {
      console.error('[SignalManager] Tentative d\'obtention du statut avant initialisation');
      throw new Error("Le service de signalisation n'est pas initialisé");
    }
    
    const status = {
      connectionsCount: this.handlers.activeUsers.size,
      activeCallsCount: this.handlers.activeAppels.size
    };
    
    console.log('[SignalManager] Statut actuel:', status);
    return status;
  }
  
  // Arrêter proprement le service
  shutdown() {
    if (this.io) {
      console.log('[SignalManager] Fermeture des connexions socket...');
      this.io.close();
      console.log('[SignalManager] Service de signalisation arrêté');
    } else {
      console.log('[SignalManager] Aucun service à arrêter');
    }
  }
}

module.exports = SignalManager;