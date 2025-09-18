// socket/auth.js
const jwt = require('jsonwebtoken');
const Personne = require('../models/personnes');

const socketAuth = async (socket, next) => {
  try {
    console.log('[Socket Auth] Tentative d\'authentification');

    // Récupérer le token depuis les headers ou les query parameters
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      console.error('[Socket Auth] Token manquant');
      return next(new Error('Token d\'authentification manquant'));
    }

    // Vérifier et décoder le token JWT
    const decoded = jwt.verify(token, "shhhhh");
    console.log('[Socket Auth] Token décodé:', { userId: decoded._id });

    // Récupérer les informations de l'utilisateur
    const user = await Personne.findById(decoded._id);
    if (!user) {
      console.error('[Socket Auth] Utilisateur non trouvé:', decoded._id);
      return next(new Error('Utilisateur non trouvé'));
    }

    // Attacher les informations utilisateur au socket
    socket.userId = user._id.toString();
    socket.userName = `${user.prenom} ${user.nom}`;
    socket.userEmail = user.email;

    console.log(`[Socket Auth] Authentification réussie: ${socket.userName} (${socket.userId})`);
    next();
  } catch (error) {
    console.error('[Socket Auth] Erreur d\'authentification:', error.message);
    next(new Error('Token d\'authentification invalide'));
  }
};

module.exports = socketAuth;