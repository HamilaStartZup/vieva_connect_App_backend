// signal-server/controllers/appelsController.js
const Appel = require('../models/Appel');
const jwt = require("jsonwebtoken");
const config = require('../config');

module.exports = {
  // Obtenir des statistiques sur les appels
  getAppelStats: async (req, res) => {
    try {
      console.log('[AppelsController] Demande de statistiques d\'appels');
      
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        console.error('[AppelsController] Token d\'authentification manquant');
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        // Utiliser le secret depuis la configuration
        decodedToken = jwt.verify(token.split(' ')[1], config.jwtSecret);
      } catch (error) {
        console.error('[AppelsController] Token d\'authentification invalide:', error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;
      console.log(`[AppelsController] Récupération des statistiques pour l'utilisateur: ${userId}`);

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

      console.log(`[AppelsController] Statistiques par statut obtenues: ${stats.length} enregistrements`);

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

      console.log(`[AppelsController] Statistiques par jour obtenues: ${statsByDay.length} jours`);

      res.status(200).json({
        stats: stats,
        statsByDay: statsByDay,
        message: "Statistiques d'appels récupérées avec succès"
      });
    } catch (error) {
      console.error("[AppelsController] Erreur dans getAppelStats:", error);
      res.status(500).json({
        error: "Erreur lors de la récupération des statistiques d'appels",
      });
    }
  },

  // Obtenir l'historique des appels
  getAppelHistory: async (req, res) => {
    try {
      console.log('[AppelsController] Demande d\'historique d\'appels');
      
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        console.error('[AppelsController] Token d\'authentification manquant');
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], config.jwtSecret);
      } catch (error) {
        console.error('[AppelsController] Token d\'authentification invalide:', error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;

      console.log(`[AppelsController] Récupération de l'historique pour l'utilisateur: ${userId}, page: ${page}, limit: ${limit}`);

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

      console.log(`[AppelsController] Historique récupéré: ${historique.length} appels sur ${totalCount} au total`);

      res.status(200).json({
        historique,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        message: "Historique des appels récupéré avec succès"
      });
    } catch (error) {
      console.error("[AppelsController] Erreur dans getAppelHistory:", error);
      res.status(500).json({
        error: "Erreur lors de la récupération de l'historique des appels",
      });
    }
  },

  // Supprimer l'historique des appels (droit à l'oubli RGPD)
  deleteAppelHistory: async (req, res) => {
    try {
      console.log('[AppelsController] Demande de suppression d\'historique d\'appels (RGPD)');
      
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        console.error('[AppelsController] Token d\'authentification manquant');
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], config.jwtSecret);
      } catch (error) {
        console.error('[AppelsController] Token d\'authentification invalide:', error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;
      console.log(`[AppelsController] Suppression des appels pour l'utilisateur: ${userId}`);

      // Supprimer tous les appels de l'utilisateur
      const result = await Appel.deleteMany({
        $or: [
          { initiateur: userId },
          { destinataire: userId }
        ]
      });

      console.log(`[AppelsController] ${result.deletedCount} appels supprimés`);

      res.status(200).json({
        message: `${result.deletedCount} appels supprimés avec succès.`,
        info: "Conformément au RGPD, toutes vos données d'appels ont été supprimées."
      });
    } catch (error) {
      console.error("[AppelsController] Erreur dans deleteAppelHistory:", error);
      res.status(500).json({
        error: "Erreur lors de la suppression de l'historique des appels",
      });
    }
  },

  // Obtenir les détails d'un appel spécifique
  getAppelDetails: async (req, res) => {
    try {
      const { appelId } = req.params;
      console.log(`[AppelsController] Demande de détails pour l'appel: ${appelId}`);
      
      // Validation du token
      const token = req.headers["authorization"];
      if (!token) {
        console.error('[AppelsController] Token d\'authentification manquant');
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], config.jwtSecret);
      } catch (error) {
        console.error('[AppelsController] Token d\'authentification invalide:', error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;

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
        console.error(`[AppelsController] Appel non trouvé ou accès non autorisé: ${appelId}`);
        return res.status(404).json({
          error: "Appel non trouvé ou vous n'êtes pas autorisé à y accéder"
        });
      }

      console.log(`[AppelsController] Détails de l'appel ${appelId} récupérés avec succès`);

      res.status(200).json({
        appel,
        message: "Détails de l'appel récupérés avec succès"
      });
    } catch (error) {
      console.error("[AppelsController] Erreur dans getAppelDetails:", error);
      res.status(500).json({
        error: "Erreur lors de la récupération des détails de l'appel",
      });
    }
  }
};