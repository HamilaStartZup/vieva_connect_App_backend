// signal-server/controllers/appelsRoutes.js
const express = require("express");
const router = express.Router();
const appelsController = require("./appelsController");
const jwt = require("jsonwebtoken");
const config = require("../config");

// Middleware d'authentification simplifiée directement dans les routes
const authenticateToken = (req, res, next) => {
  try {
    console.log('[AppelsRoutes] Vérification du token d\'authentification');
    
    const token = req.headers["authorization"];
    if (!token) {
      console.error('[AppelsRoutes] Token d\'authentification manquant');
      return res.status(401).json({
        error: "Token d'authentification manquant",
      });
    }

    // Vérification simple du token, la validation complète est dans les contrôleurs
    if (!token.startsWith('Bearer ')) {
      console.error('[AppelsRoutes] Format de token invalide');
      return res.status(401).json({
        error: "Format de token invalide",
      });
    }

    // Continuer sans vérifier complètement le token ici
    next();
  } catch (error) {
    console.error("[AppelsRoutes] Erreur d'authentification:", error);
    return res.status(401).json({
      error: "Erreur d'authentification",
    });
  }
};

// Statistiques d'appels
router.get("/appels/stats", authenticateToken, appelsController.getAppelStats);

// Historique des appels
router.get("/appels/historique", authenticateToken, appelsController.getAppelHistory);

// Détails d'un appel
router.get("/appels/:appelId", authenticateToken, appelsController.getAppelDetails);

// Suppression de l'historique des appels (RGPD)
router.delete("/appels/historique", authenticateToken, appelsController.deleteAppelHistory);

console.log('[AppelsRoutes] Routes des appels configurées');

module.exports = router;