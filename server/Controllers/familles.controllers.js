const Famille = require("../models/familles");
const Url = require("../models/urls");
const { validationResult } = require("express-validator");
const jwtToken = require("jsonwebtoken");
const Personne = require("../models/personnes");
const { createShortUrl } = require('../utils/urlShortener');
const { generateUniqueCode } = require('../utils/codeGenerator');
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

module.exports = {
  createFamily: async (req, res) => {
    try {
      console.log("Starting family creation process");

      // Validation des inputs en utilisant express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      // Récupérer les données de la requête - INCLURE URGENCE
      const { nom, description, urgence } = req.body;
      console.log("Request body:", { nom, description, urgence });

      // Récupérer le createurId depuis le token de l'utilisateur
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant"
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide"
        });
      }

      const createurId = decodedToken._id;
      console.log("Creator ID:", createurId);

      // Si urgence est définie sur true, désactiver l'urgence sur toutes les autres familles du créateur
      if (urgence === true) {
        console.log("Family marked as urgent - deactivating other urgent families");
        await Famille.updateMany(
          { 
            createurId: createurId,
            urgence: true
          },
          { $set: { urgence: false } }
        );
        console.log("Other urgent families deactivated");
      }

      let code_family;
      let familleExistante;

      // Générer un code_family unique
      do {
        code_family = generateUniqueCode();
        familleExistante = await Famille.findOne({ code_family });
      } while (familleExistante);

      console.log("Generated unique family code:", code_family);

      // Créer une nouvelle famille avec le champ urgence
      const nouvelleFamille = new Famille({
        nom,
        description,
        code_family,
        createurId,
        listeFamily: [createurId], // Ajouter le createurId à la liste des membres de la famille
        urgence: urgence === true ? true : false // Gérer explicitement le champ urgence
      });

      console.log("Creating family with data:", {
        nom: nouvelleFamille.nom,
        description: nouvelleFamille.description,
        urgence: nouvelleFamille.urgence,
        createurId: nouvelleFamille.createurId
      });

      // Enregistrer la nouvelle famille dans la base de données
      const familleCréée = await nouvelleFamille.save();
      
      console.log("Family created successfully with urgence:", familleCréée.urgence);

      // Répondre avec la famille créée
      res.status(201).json(familleCréée);

    } catch (error) {
      // Gérer les erreurs
      console.error("Error in createFamily controller:", error.message);
      res.status(500).json({ 
        error: "Erreur lors de la création de la famille",
        details: error.message 
      });
    }
  },
  addToFamily: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ error: errors.array()[0].msg });
      }

      const { code_family } = req.body;
      // Récupérer le UserId depuis le token de l'utilisateur
      const token = req.cookies.token; // Supposons que le token est stocké dans un cookie nommé "token"
      const decodedToken = jwtToken.verify(token, "shhhhh"); // Décode le token
      const userId = decodedToken._id; // Récupère l'ID de l'utilisateur à partir du token

      // Cherche la famille par code_family
      const famille = await Famille.findOne({ code_family });

      if (!famille) {
        return res.status(404).json({ message: "Family not found" });
      }

      // Cherche l'utilisateur par id
      const user = await Personne.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verifie si l'utilisateur est deja dans la famille
      if (famille.listeFamily.includes(userId)) {
        return res.status(400).json({ message: "User already in family" });
      }

      // Ajout de l'utilisateur a la famille
      famille.listeFamily.push(user._id);

      // Sauvegarde du changement
      await famille.save();

      res.status(200).json({ message: "User added to family" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error adding user to family" });
    }
  },
  getFamily: async (req, res) => {
    try {
      // Récupérer l'ID de l'utilisateur à partir du token
      const token = req.cookies.token;
      const decodedToken = jwtToken.verify(token, "shhhhh");
      const userId = decodedToken._id;

      // Trouver la famille à laquelle appartient l'utilisateur
      const famille = await Famille.findOne({ listeFamily: userId }).populate(
        "listeFamily"
      );

      if (!famille) {
        return res
          .status(404)
          .json({ message: "Aucune famille trouvée pour cet utilisateur" });
      }

      // Récupérer la liste des membres de la famille (uniquement leurs IDs)
      const membresFamilleIds = famille.listeFamily.map((member) => member._id);

      res.status(200).json({ membresFamilleIds });
    } catch (error) {
      // Gérer les erreurs
      console.error(error);
      res
        .status(500)
        .json({ message: "Erreur lors de la création de la famille" });
    }
  },
  getFamilyIdByCreator: async (req, res) => {
    try {
      const token = req.cookies.token;
      const decodedToken = jwtToken.verify(token, "shhhhh");
      const userId = decodedToken._id;

      // Rechercher les IDs, noms et descriptions des familles créées par l'utilisateur
      const familles = await Famille.find(
        { createurId: userId },
        "_id nom description code_family"
      );

      res.status(200).json(
        familles.map((famille) => ({
          familyId: famille._id,
          nom: famille.nom,
          description: famille.description,
          code_family: famille.code_family,
        }))
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  generateDeeplink: async (req, res) => {
    try {
      const { familyId } = req.params;

      // Vérifier si la famille existe et si l'utilisateur est le créateur de la famille
      const famille = await Famille.findById(familyId);
      if (!famille) {
        return res.status(404).json({ message: "Family not found" });
      }

      const token = req.cookies.token;
      const decodedToken = jwtToken.verify(token, "shhhhh");
      const createurId = decodedToken._id;

      if (famille.createurId.toString() !== createurId) {
        return res
          .status(403)
          .json({ message: "Only the creator can generate a deeplink" });
      }

      // Vérifier si un deeplink existe déjà pour cette famille
      const existingUrl = await Url.findOne({
        longUrl: `${req.protocol}://${req.get(
          "host"
        )}/api/joinFamilyByDeeplink/${familyId}`,
      });
      if (existingUrl) {
        console.log("Existing short URL found");
        return res
          .status(200)
          .json({
            deeplink: `${req.protocol}://${req.get("host")}/api/u/${
              existingUrl.shortUrl
            }`,
          });
      }

      // Générer le deeplink
      const longDeeplink = `${req.protocol}://${req.get(
        "host"
      )}/api/joinFamilyByDeeplink/${familyId}`;

      // Raccourcir le deeplink
      const shortUrl = await createShortUrl(longDeeplink);

      res
        .status(200)
        .json({
          deeplink: `${req.protocol}://${req.get("host")}/u/${shortUrl}`,
        });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },


  
  joinFamilyByDeeplink: async (req, res) => {
    try {
      const { deeplink } = req.body;
      const token = req.cookies.token;
      const decodedToken = jwtToken.verify(token, "shhhhh");
      const userId = decodedToken._id;

      // Extraire la partie de la deeplink à comparer (la fin)
      const shortUrlPart = deeplink.split("/").pop();
      console.log(`Extracted shortUrl part: ${shortUrlPart}`);

      // Rechercher la shortUrl dans la base de données
      const urlDoc = await Url.findOne({ shortUrl: shortUrlPart });
      if (!urlDoc) {
        console.log("Short URL not found");
        return res.status(400).json({ message: "Invalid deeplink format" });
      }

      const longDeeplink = urlDoc.longUrl;
      console.log(`Matched longDeeplink: ${longDeeplink}`);

      // Extraire l'identifiant de la famille à partir du longDeeplink
      const familyIdMatch = longDeeplink.match(/\/([^\/]+)$/);
      if (!familyIdMatch) {
        console.log("Invalid longDeeplink format");
        return res.status(400).json({ message: "Invalid longDeeplink format" });
      }
      const familyId = familyIdMatch[1];
      console.log(`Extracted family ID: ${familyId}`);

      // Vérifier si l'identifiant de la famille est un ObjectId valide
      if (!ObjectId.isValid(familyId)) {
        console.log("Invalid family ID format");
        return res.status(400).json({ message: "Invalid family ID" });
      }

      // Vérifier si la famille existe
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found");
        return res.status(404).json({ message: "Family not found" });
      }

      // Log the comparison values
      console.log(
        `Comparing familyId: ${familyId} with famille._id: ${famille._id}`
      );

      // Vérifier si l'utilisateur est déjà dans la famille
      if (famille.listeFamily.includes(userId)) {
        console.log("User already in family");
        return res.status(400).json({ message: "User already in family" });
      }

      // Ajouter l'utilisateur à la famille
      famille.listeFamily.push(userId);
      await famille.save();

      console.log("User added to family");
      res.status(200).json({ message: "User added to family" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

/**
   * Modifier une famille existante
   * Contrôle d'accès - seul le créateur peut modifier
   */
  updateFamily: async (req, res) => {
    try {
      console.log("Starting family update process");

      // Validation des entrées
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      const { familyId } = req.params;
      const { nom, description, urgence } = req.body;

      // Récupération du token et vérification du créateur
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ 
          error: "Token d'authentification manquant" 
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ 
          error: "Token d'authentification invalide" 
        });
      }

      const createurId = decodedToken._id;

      // Vérification que la famille existe et appartient au créateur
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found:", familyId);
        return res.status(404).json({ 
          error: "Famille non trouvée" 
        });
      }

      // Contrôle d'accès  - seul le créateur peut modifier
      if (famille.createurId.toString() !== createurId) {
        console.log("Access denied - not the creator");
        return res.status(403).json({ 
          error: "Seul le créateur peut modifier cette famille" 
        });
      }

      // Si urgence est définie sur true, désactiver l'urgence sur les autres familles du créateur
      if (urgence === true) {
        console.log("Setting urgence to true - deactivating others");
        await Famille.updateMany(
          { 
            createurId: createurId,
            _id: { $ne: familyId } // Exclure la famille actuelle
          },
          { $set: { urgence: false } }
        );
      }

      // Préparation des données à mettre à jour
      const updateData = {};
      if (nom !== undefined) updateData.nom = nom;
      if (description !== undefined) updateData.description = description;
      if (urgence !== undefined) updateData.urgence = urgence;

      console.log("Updating family with data:", updateData);

      // Mise à jour de la famille
      const familleModifiee = await Famille.findByIdAndUpdate(
        familyId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      console.log("Family updated successfully");

      res.status(200).json({
        message: "Famille modifiée avec succès",
        famille: familleModifiee
      });

    } catch (error) {
      console.error("Error in updateFamily controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la modification de la famille"
      });
    }
  },

  /**
   * Supprimer une famille
   * Suppression sécurisée avec vérification d'accès
   */
  deleteFamily: async (req, res) => {
    try {
      console.log("Starting family deletion process");

      const { familyId } = req.params;

      // Récupération du token et vérification du créateur
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ 
          error: "Token d'authentification manquant" 
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ 
          error: "Token d'authentification invalide" 
        });
      }

      const createurId = decodedToken._id;

      // Vérification que la famille existe et appartient au créateur
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found:", familyId);
        return res.status(404).json({ 
          error: "Famille non trouvée" 
        });
      }

      // Contrôle d'accès - seul le créateur peut supprimer
      if (famille.createurId.toString() !== createurId) {
        console.log("Access denied - not the creator");
        return res.status(403).json({ 
          error: "Seul le créateur peut supprimer cette famille" 
        });
      }

      // Vérification s'il y a d'autres membres dans la famille
      if (famille.listeFamily.length > 1) {
        console.log("Family has other members, cannot delete");
        return res.status(400).json({ 
          error: "Impossible de supprimer une famille contenant d'autres membres. Retirez d'abord tous les membres." 
        });
      }

      // Suppression des URL courtes associées à cette famille
      console.log("Cleaning up related URLs");
      const familyDeeplinkPattern = `/joinFamilyByDeeplink/${familyId}`;
      await Url.deleteMany({ 
        longUrl: { $regex: familyDeeplinkPattern } 
      });

      // Suppression de la famille
      console.log("Deleting family from database");
      await Famille.findByIdAndDelete(familyId);

      console.log("Family deleted successfully");

      res.status(200).json({
        message: "Famille supprimée avec succès"
      });

    } catch (error) {
      console.error("Error in deleteFamily controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la suppression de la famille"
      });
    }
  },

  /**
   * Obtenir la famille d'urgence active pour l'utilisateur connecté
   */
  getFamilleUrgence: async (req, res) => {
    try {
      console.log("Getting emergency family");

      // Récupération du token
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ 
          error: "Token d'authentification manquant" 
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ 
          error: "Token d'authentification invalide" 
        });
      }

      const userId = decodedToken._id;

      // Recherche de la famille d'urgence active
      const familleUrgence = await Famille.findOne({ 
        createurId: userId,
        urgence: true 
      }).populate('listeFamily', 'nom prenom email');

      if (!familleUrgence) {
        console.log("No emergency family found");
        return res.status(404).json({ 
          message: "Aucune famille d'urgence configurée" 
        });
      }

      console.log("Emergency family found");
      res.status(200).json({
        message: "Famille d'urgence récupérée avec succès",
        famille: familleUrgence
      });

    } catch (error) {
      console.error("Error in getFamilleUrgence controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération de la famille d'urgence"
      });
    }
  },

  /**
   * Définir une famille comme famille d'urgence
   */
  setFamilleUrgence: async (req, res) => {
    try {
      console.log("Setting emergency family");

      const { familyId } = req.params;

      // Récupération du token
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ 
          error: "Token d'authentification manquant" 
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ 
          error: "Token d'authentification invalide" 
        });
      }

      const createurId = decodedToken._id;

      // Vérification que la famille existe et appartient au créateur
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found:", familyId);
        return res.status(404).json({ 
          error: "Famille non trouvée" 
        });
      }

      // Contrôle d'accès
      if (famille.createurId.toString() !== createurId) {
        console.log("Access denied - not the creator");
        return res.status(403).json({ 
          error: "Seul le créateur peut définir cette famille comme famille d'urgence" 
        });
      }

      // Désactiver l'urgence sur toutes les autres familles du créateur
      console.log("Deactivating urgence on other families");
      await Famille.updateMany(
        { 
          createurId: createurId,
          _id: { $ne: familyId }
        },
        { $set: { urgence: false } }
      );

      // Activer l'urgence sur la famille sélectionnée
      console.log("Activating urgence on selected family");
      famille.urgence = true;
      await famille.save();

      console.log("Emergency family set successfully");

      res.status(200).json({
        message: "Famille d'urgence définie avec succès",
        famille: famille
      });

    } catch (error) {
      console.error("Error in setFamilleUrgence controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la définition de la famille d'urgence"
      });
    }
  },


  /**
   * Version améliorée du contrôleur POST existant
   * Maintient la compatibilité avec l'API existante
   */
  // joinFamilyByDeeplink: async (req, res) => {
  //   try {
  //     console.log("Processing POST deeplink join request");

  //     const errors = validationResult(req);
  //     if (!errors.isEmpty()) {
  //       console.log("Validation errors:", errors.array());
  //       return res.status(422).json({
  //         error: errors.array()[0].msg,
  //       });
  //     }

  //     const { deeplink } = req.body;
  //     console.log("Deeplink received:", deeplink);

  //     // Vérification de l'authentification
  //     const token = req.cookies.token;
  //     if (!token) {
  //       console.log("Missing authentication token");
  //       return res.status(401).json({
  //         error: "Token d'authentification manquant"
  //       });
  //     }

  //     let decodedToken;
  //     try {
  //       console.log("Verifying token");
  //       decodedToken = jwtToken.verify(token, process.env.JWT_SECRET || "shhhhh");
  //     } catch (error) {
  //       console.log("Invalid authentication token:", error.message);
  //       return res.status(401).json({
  //         error: "Token d'authentification invalide"
  //       });
  //     }

  //     const userId = decodedToken._id;
  //     console.log("User ID from token:", userId);

  //     // Extraire la partie shortUrl du deeplink
  //     const shortUrlPart = deeplink.split("/").pop();
  //     console.log(`Extracted shortUrl part: ${shortUrlPart}`);

  //     // Rechercher dans la base de données
  //     const urlDoc = await Url.findOne({ shortUrl: shortUrlPart });
  //     if (!urlDoc) {
  //       console.log("Short URL not found");
  //       return res.status(400).json({ 
  //         error: "Lien d'invitation invalide" 
  //       });
  //     }

  //     const longDeeplink = urlDoc.longUrl;
  //     console.log(`Matched longDeeplink: ${longDeeplink}`);

  //     // Extraire l'ID de famille
  //     const familyIdMatch = longDeeplink.match(/\/joinFamilyByDeeplink\/([^\/]+)$/);
  //     if (!familyIdMatch) {
  //       console.log("Invalid longDeeplink format");
  //       return res.status(400).json({ 
  //         error: "Format de lien invalide" 
  //       });
  //     }

  //     const familyId = familyIdMatch[1];
  //     console.log(`Extracted family ID: ${familyId}`);

  //     // Validation ObjectId
  //     if (!ObjectId.isValid(familyId)) {
  //       console.log("Invalid family ID format");
  //       return res.status(400).json({ 
  //         error: "Identifiant de famille invalide" 
  //       });
  //     }

  //     // Vérifier l'existence de la famille
  //     const famille = await Famille.findById(familyId);
  //     if (!famille) {
  //       console.log("Family not found");
  //       return res.status(404).json({ 
  //         error: "Famille non trouvée" 
  //       });
  //     }

  //     // Vérifier si l'utilisateur est déjà membre
  //     if (famille.listeFamily.includes(userId)) {
  //       console.log("User already in family");
  //       return res.status(400).json({ 
  //         message: "Vous êtes déjà membre de cette famille" 
  //       });
  //     }

  //     // Ajouter l'utilisateur à la famille
  //     console.log("Adding user to family");
  //     famille.listeFamily.push(userId);
  //     await famille.save();

  //     console.log("User added to family successfully");
      
  //     // RGPD: Réponse avec informations minimales
  //     res.status(200).json({ 
  //       success: true,
  //       message: "Vous avez rejoint la famille avec succès",
  //       famille: {
  //         nom: famille.nom,
  //         description: famille.description
  //       }
  //     });

  //   } catch (error) {
  //     console.error("Error in joinFamilyByDeeplink:", error.message);
  //     res.status(500).json({ 
  //       error: "Erreur serveur lors de l'ajout à la famille" 
  //     });
  //   }
  // },
};