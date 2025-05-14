// signalisation/signalManager.js
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
  }

  // Initialiser Socket.IO avec authentification
  initialize() {
    this.io = socketIo(this.server, {
      cors: {
        origin: this.options.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: this.options.path
    });
    
    // Appliquer le middleware d'authentification
    this.io.use(socketAuth);
    
    // Initialiser les gestionnaires d'événements
    this.handlers = appelsHandler(this.io);
    
    console.log('[SignalManager] Service de signalisation initialisé');
    
    return this.io;
  }
  
  // Obtenir des informations sur les connexions actives
  getConnectionsStatus() {
    if (!this.io) {
      throw new Error("Le service de signalisation n'est pas initialisé");
    }
    
    return {
      connectionsCount: this.handlers.activeUsers.size,
      activeCallsCount: this.handlers.activeAppels.size
    };
  }
  
  // Arrêter proprement le service
  shutdown() {
    if (this.io) {
      this.io.close();
      console.log('[SignalManager] Service de signalisation arrêté');
    }
  }
}

module.exports = SignalManager;