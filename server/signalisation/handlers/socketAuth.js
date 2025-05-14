// signalisation/handlers/socketAuth.js
const jwtToken = require('jsonwebtoken');
const Personne = require('../../models/personnes'); 

module.exports = async (socket, next) => {
  try {
    // Authentification via token JWT
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Token d'authentification manquant"));
    }
    
    const decodedToken = jwtToken.verify(token, "shhhhh"); // Utilisez votre clé secrète
    if (!decodedToken._id) {
      return next(new Error("Token invalide"));
    }
    
    // Vérifier que l'utilisateur existe dans la base de données
    const utilisateur = await Personne.findById(decodedToken._id);
    if (!utilisateur) {
      return next(new Error("Utilisateur non trouvé"));
    }
    
    // Attacher les informations de l'utilisateur au socket
    socket.userId = decodedToken._id;
    socket.userName = utilisateur.prenom + " " + utilisateur.nom;
    
    // Logger la connexion si activé
    if (require('../config').logging.connections) {
      console.log(`[Socket] Utilisateur connecté: ${socket.userName} (${socket.userId})`);
    }
    
    next();
  } catch (error) {
    console.error("Erreur d'authentification Socket.IO:", error);
    next(new Error("Erreur d'authentification: " + error.message));
  }
};