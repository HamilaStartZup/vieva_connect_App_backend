// signalisation/controllers/appelsRoutes.js
const express = require("express");
const router = express.Router();
const appelsController = require("./appelsController");
const { isAuthenticated } = require("../../Controllers/auth.controllers");

// Statistiques d'appels
router.get("/appels/stats", isAuthenticated, appelsController.getAppelStats);

// Historique des appels
router.get("/appels/historique", isAuthenticated, appelsController.getAppelHistory);

// Détails d'un appel
router.get("/appels/:appelId", isAuthenticated, appelsController.getAppelDetails);

// Suppression de l'historique des appels 
router.delete("/appels/historique", isAuthenticated, appelsController.deleteAppelHistory);

module.exports = router;