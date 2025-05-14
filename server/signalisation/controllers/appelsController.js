// signalisation/controllers/appelsController.js
const Appel = require('../models/Appel');
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const config = require('../config');

module.exports = {
  // Obtenir des statistiques sur les appels
  getAppelStats: async (req, res) => {
    try {
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;

      // Obtenir les statistiques d'appels
      const stats = await Appel.aggregate([
        {
          $match: {
            $or: [
              { initiateur: userId },
              { destinataire: userId }
            ]
          }
        },
        {
          $group: {
            _id: "$statut",
            count: { $sum: 1 },
            dureeTotal: {
              $sum: {
                $cond: [
                  { $eq: ["$statut", "terminé"] },
                  { $ifNull: ["$duree", 0] },
                  0
                ]
              }
            }
          }
        }
      ]);

      // Statistiques par jour (30 derniers jours)
      const dateDebut = new Date();
      dateDebut.setDate(dateDebut.getDate() - 30);
      
      const statsByDay = await Appel.aggregate([
        {
          $match: {
            $or: [
              { initiateur: userId },
              { destinataire: userId }
            ],
            createdAt: { $gte: dateDebut }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" }
            },
            count: { $sum: 1 },
            dureeTotal: {
              $sum: {
                $cond: [
                  { $eq: ["$statut", "terminé"] },
                  { $ifNull: ["$duree", 0] },
                  0
                ]
              }
            }
          }
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
            "_id.day": 1
          }
        }
      ]);

      res.status(200).json({
        stats: stats,
        statsByDay: statsByDay,
        message: "Statistiques d'appels récupérées avec succès"
      });
    } catch (error) {
      console.error("Error in getAppelStats controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération des statistiques d'appels",
      });
    }
  },

  // Obtenir l'historique des appels
  getAppelHistory: async (req, res) => {
    try {
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;

      // Obtenir l'historique des appels avec pagination
      const historique = await Appel.find({
        $or: [
          { initiateur: userId },
          { destinataire: userId }
        ]
      })
      .select('appelId statut debut fin duree avecVideo')
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit)
      .populate('initiateur', 'nom prenom')
      .populate('destinataire', 'nom prenom');

      // Compter le nombre total d'appels pour la pagination
      const totalCount = await Appel.countDocuments({
        $or: [
          { initiateur: userId },
          { destinataire: userId }
        ]
      });

      res.status(200).json({
        historique,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        message: "Historique des appels récupéré avec succès"
      });
    } catch (error) {
      console.error("Error in getAppelHistory controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération de l'historique des appels",
      });
    }
  },

  // Supprimer l'historique des appels (droit à l'oubli RGPD)
  deleteAppelHistory: async (req, res) => {
    try {
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;

      // Supprimer tous les appels de l'utilisateur
      const result = await Appel.deleteMany({
        $or: [
          { initiateur: userId },
          { destinataire: userId }
        ]
      });

      res.status(200).json({
        message: `${result.deletedCount} appels supprimés avec succès.`,
        info: "Conformément au RGPD, toutes vos données d'appels ont été supprimées."
      });
    } catch (error) {
      console.error("Error in deleteAppelHistory controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la suppression de l'historique des appels",
      });
    }
  },

  // Obtenir les détails d'un appel spécifique
  getAppelDetails: async (req, res) => {
    try {
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;
      const { appelId } = req.params;

      // Trouver l'appel
      const appel = await Appel.findOne({
        appelId,
        $or: [
          { initiateur: userId },
          { destinataire: userId }
        ]
      })
      .populate('initiateur', 'nom prenom')
      .populate('destinataire', 'nom prenom');

      if (!appel) {
        return res.status(404).json({
          error: "Appel non trouvé ou vous n'êtes pas autorisé à y accéder"
        });
      }

      res.status(200).json({
        appel,
        message: "Détails de l'appel récupérés avec succès"
      });
    } catch (error) {
      console.error("Error in getAppelDetails controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération des détails de l'appel",
      });
    }
  }
};