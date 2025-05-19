// signal-server/handlers/socketAuth.js
const jwtToken = require('jsonwebtoken');
const Personne = require('../shared/personnes');
const config = require('../config');

module.exports = async (socket, next) => {
  try {
    console.log('[SocketAuth] Tentative d\'authentification d\'un socket');
    
    // Authentification via token JWT
    const token = socket.handshake.auth.token;
    if (!token) {
      console.error('[SocketAuth] Token manquant');
      return next(new Error("Token d'authentification manquant"));
    }
    
    console.log('[SocketAuth] Vérification du token JWT');
    const decodedToken = jwtToken.verify(token, config.jwtSecret);
    if (!decodedToken._id) {
      console.error('[SocketAuth] Token invalide: pas d\'ID utilisateur');
      return next(new Error("Token invalide"));
    }
    
    // Vérifier que l'utilisateur existe dans la base de données
    console.log(`[SocketAuth] Recherche de l'utilisateur avec ID: ${decodedToken._id}`);
    const utilisateur = await Personne.findById(decodedToken._id);
    if (!utilisateur) {
      console.error('[SocketAuth] Utilisateur non trouvé dans la base de données');
      return next(new Error("Utilisateur non trouvé"));
    }
    
    // Attacher les informations de l'utilisateur au socket
    socket.userId = decodedToken._id;
    socket.userName = utilisateur.prenom + " " + utilisateur.nom;
    
    // Logger la connexion si activé
    if (config.logging.connections) {
      console.log(`[SocketAuth] Utilisateur connecté: ${socket.userName} (${socket.userId})`);
    }
    
    console.log('[SocketAuth] Authentification réussie');
    next();
  } catch (error) {
    console.error("[SocketAuth] Erreur d'authentification:", error);
    next(new Error("Erreur d'authentification: " + error.message));
  }
};