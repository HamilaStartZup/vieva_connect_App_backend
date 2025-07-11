const Famille = require("../models/familles");
const Url = require("../models/urls");
const { validationResult } = require("express-validator");
const jwtToken = require("jsonwebtoken");
const Personne = require("../models/personnes");
const { createShortUrl } = require("../utils/urlShortener");
const { generateUniqueCode } = require("../utils/codeGenerator");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const NotificationInitializationService = require("../utils/notificationInitializationService");

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
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const createurId = decodedToken._id;
      console.log("Creator ID:", createurId);

      // Si urgence est définie sur true, désactiver l'urgence sur toutes les autres familles du créateur
      if (urgence === true) {
        console.log(
          "Family marked as urgent - deactivating other urgent families"
        );
        await Famille.updateMany(
          {
            createurId: createurId,
            urgence: true,
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
        urgence: urgence === true ? true : false, // Gérer explicitement le champ urgence
      });

      console.log("Creating family with data:", {
        nom: nouvelleFamille.nom,
        description: nouvelleFamille.description,
        urgence: nouvelleFamille.urgence,
        createurId: nouvelleFamille.createurId,
      });

      // Enregistrer la nouvelle famille dans la base de données
      const familleCréée = await nouvelleFamille.save();

      console.log(
        "Family created successfully with urgence:",
        familleCréée.urgence
      );

      // Gérer automatiquement la liste de notifications selon le statut d'urgence
      console.log(
        "Handling notification list initialization based on urgency status"
      );
      const notificationResult =
        await NotificationInitializationService.handleFamilyUrgencyChange(
          createurId,
          urgence === true
        );

      if (notificationResult.success) {
        console.log(
          "Notification list handling successful:",
          notificationResult.action
        );
        if (notificationResult.notificationListId) {
          console.log(
            "Notification list ID:",
            notificationResult.notificationListId
          );
        }
      } else {
        console.warn(
          "Notification list handling failed:",
          notificationResult.error
        );
        // Ne pas faire échouer la création de famille pour une erreur de liste de notification
      }

      // Répondre avec la famille créée
      res.status(201).json(familleCréée);
    } catch (error) {
      // Gérer les erreurs
      console.error("Error in createFamily controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la création de la famille",
        details: error.message,
      });
    }
  },

  addToFamily: async (req, res) => {
    try {
      console.log("Starting addToFamily process");

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({ error: errors.array()[0].msg });
      }

      const { code_family } = req.body;
      console.log("Family code received:", code_family);

      // Récupérer le UserId depuis le token de l'utilisateur
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res
          .status(401)
          .json({ error: "Token d'authentification manquant" });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res
          .status(401)
          .json({ error: "Token d'authentification invalide" });
      }

      const userId = decodedToken._id;
      console.log("User ID from token:", userId);

      // Cherche la famille par code_family
      const famille = await Famille.findOne({ code_family });
      if (!famille) {
        console.log("Family not found with code:", code_family);
        return res.status(404).json({ error: "Famille non trouvée" });
      }

      console.log("Found family:", famille.nom);

      // Cherche l'utilisateur par id
      const user = await Personne.findById(userId);
      if (!user) {
        console.log("User not found:", userId);
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      console.log("User found:", user.nom, user.prenom);

      // Verifie si l'utilisateur est deja dans la famille
      if (famille.listeFamily.includes(userId)) {
        console.log("User already in family");
        return res
          .status(400)
          .json({ error: "Utilisateur déjà membre de cette famille" });
      }

      // Ajout de l'utilisateur a la famille
      console.log("Adding user to family");
      famille.listeFamily.push(user._id);

      // Sauvegarde du changement
      await famille.save();

      console.log("User successfully added to family");
      console.log(
        `📊 RGPD Log - User ${user.nom} ${user.prenom} added to family ${famille.nom}, IP: ${req.ip}`
      );

      res.status(200).json({
        success: true,
        message: "Utilisateur ajouté à la famille avec succès",
        famille: {
          nom: famille.nom,
          description: famille.description,
        },
      });
    } catch (error) {
      console.error("Error in addToFamily:", error.message);
      res.status(500).json({ error: "Erreur lors de l'ajout à la famille" });
    }
  },

  getFamily: async (req, res) => {
    try {
      console.log("Getting family members");

      // Récupérer l'ID de l'utilisateur à partir du token
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res
          .status(401)
          .json({ error: "Token d'authentification manquant" });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res
          .status(401)
          .json({ error: "Token d'authentification invalide" });
      }

      const userId = decodedToken._id;
      console.log("User ID from token:", userId);

      // Trouver la famille à laquelle appartient l'utilisateur
      const famille = await Famille.findOne({ listeFamily: userId }).populate(
        "listeFamily"
      );

      if (!famille) {
        console.log("No family found for user");
        return res
          .status(404)
          .json({ error: "Aucune famille trouvée pour cet utilisateur" });
      }

      console.log("Found family:", famille.nom);

      // Récupérer la liste des membres de la famille (uniquement leurs IDs)
      const membresFamilleIds = famille.listeFamily.map((member) => member._id);

      console.log(
        `📊 RGPD Log - Family members retrieved for family ${famille.nom}, IP: ${req.ip}`
      );

      res.status(200).json({
        success: true,
        membresFamilleIds,
      });
    } catch (error) {
      console.error("Error in getFamily:", error.message);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération de la famille" });
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
        "_id nom description code_family urgence"
      );

      res.status(200).json(
        familles.map((famille) => ({
          familyId: famille._id,
          nom: famille.nom,
          description: famille.description,
          code_family: famille.code_family,
          urgence: famille.urgence,
        }))
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },


  generateDeeplink: async (req, res) => {
    try {
      console.log("Generating deeplink with /api prefix");

      const { familyId } = req.params;
      console.log("Family ID:", familyId);

      // Vérifications d'authentification et de propriété (inchangées)
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found:", familyId);
        return res.status(404).json({ error: "Famille non trouvée" });
      }

      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res
          .status(401)
          .json({ error: "Token d'authentification manquant" });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res
          .status(401)
          .json({ error: "Token d'authentification invalide" });
      }

      const createurId = decodedToken._id;

      if (famille.createurId.toString() !== createurId) {
        console.log("Access denied - not the creator");
        return res
          .status(403)
          .json({ error: "Seul le créateur peut générer un deeplink" });
      }

      console.log("Creator verified for family:", famille.nom);

      // ✅ MODIFIÉ: Vérifier si un deeplink existe déjà
      const existingUrl = await Url.findOne({
        longUrl: `${req.protocol}://${req.get(
          "host"
        )}/api/joinFamilyByDeeplink/${familyId}`,
      });

      if (existingUrl) {
        console.log("Existing deeplink found");
        console.log(
          `📊 RGPD Log - Existing deeplink retrieved for family ${famille.nom}, IP: ${req.ip}`
        );

        // ✅ CHANGEMENT PRINCIPAL: /api/u/ au lieu de /u/
        return res.status(200).json({
          success: true,
          deeplink: `${req.protocol}://${req.get("host")}/api/u/${
            existingUrl.shortUrl
          }`,
          message: "Deeplink existant récupéré",
        });
      }

      // ✅ GARDER: Le longUrl contient toujours /api pour la logique interne
      const longDeeplink = `${req.protocol}://${req.get(
        "host"
      )}/api/joinFamilyByDeeplink/${familyId}`;
      console.log("Generated long deeplink:", longDeeplink);

      // Raccourcir le deeplink
      const shortUrl = await createShortUrl(longDeeplink);
      console.log("Generated short URL:", shortUrl);

      console.log("Deeplink generated successfully");
      console.log(
        `📊 RGPD Log - New deeplink created for family ${famille.nom}, IP: ${req.ip}`
      );

      // ✅ CHANGEMENT PRINCIPAL: /api/u/ au lieu de /u/
      res.status(200).json({
        success: true,
        deeplink: `${req.protocol}://${req.get("host")}/api/u/${shortUrl}`,
        message: "Deeplink généré avec succès",
      });
    } catch (error) {
      console.error("Error in generateDeeplink:", error.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },

  /**
   * joinFamilyByDeeplink simplifié dans familles.controllers.js
   * Extrait code_family depuis JSON deeplink
   */

  joinFamilyByDeeplink: async (req, res) => {
    try {
      const { deeplink } = req.body;
      if (!deeplink || typeof deeplink !== "string") {
        return res.status(400).json({ message: "Missing or invalid deeplink" });
      }
      console.log("📩 joinFamilyByDeeplink body:", req.body);

      // Authentification
      const token = req.cookies.token;
      if (!token) {
        return res.status(401).json({ message: "Token manquant" });
      }
      let decoded;
      try {
        decoded = jwtToken.verify(token, "shhhhh");
      } catch {
        return res.status(401).json({ message: "Token invalide" });
      }
      const userId = decoded._id;

      // Extrait le shortUrl
      const shortUrlPart = deeplink.split("/").pop();
      console.log(`Extracted shortUrl part: ${shortUrlPart}`);

      // 1️⃣ Essaie la table Url
      let familyId;
      const urlDoc = await Url.findOne({ shortUrl: shortUrlPart });
      if (urlDoc) {
        console.log("✅ Short URL trouvée en base");
        const longDeeplink = urlDoc.longUrl;
        const m = longDeeplink.match(/\/joinFamilyByDeeplink\/([^\/]+)$/);
        familyId = m && m[1];
      } else {
        // 2️⃣ Fallback : cherche direct dans Famille via code_family
        console.log("⚠️ Short URL non trouvée, fallback sur code_family");
        const familleByCode = await Famille.findOne({
          code_family: shortUrlPart,
        });
        if (familleByCode) {
          console.log("✅ Famille trouvée par code_family");
          familyId = familleByCode._id.toString();
        }
      }

      if (!familyId) {
        console.log("❌ Aucun familyId déterminé");
        return res.status(400).json({ message: "Invalid deeplink format" });
      }

      // Vérification ObjectId
      if (!ObjectId.isValid(familyId)) {
        return res.status(400).json({ message: "Invalid family ID format" });
      }

      // Récupère la famille
      const famille = await Famille.findById(familyId);
      if (!famille) {
        return res.status(404).json({ message: "Family not found" });
      }

      // Vérifie si déjà membre
      if (famille.listeFamily.includes(userId)) {
        return res.status(400).json({ message: "User already in family" });
      }

      // Ajoute et sauve
      famille.listeFamily.push(userId);
      await famille.save();

      console.log("✅ User added to family");
      return res.status(200).json({ message: "User added to family" });
    } catch (error) {
      console.error("💥 joinFamilyByDeeplink error:", error);
      return res.status(500).json({ message: "Server error" });
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
      console.log("Update data:", { familyId, nom, description, urgence });

      // Récupération du token et vérification du créateur
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const createurId = decodedToken._id;

      // Vérification que la famille existe et appartient au créateur
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found:", familyId);
        return res.status(404).json({
          error: "Famille non trouvée",
        });
      }

      // Contrôle d'accès  - seul le créateur peut modifier
      if (famille.createurId.toString() !== createurId) {
        console.log("Access denied - not the creator");
        return res.status(403).json({
          error: "Seul le créateur peut modifier cette famille",
        });
      }

      console.log("Creator verified for family:", famille.nom);

      // Si urgence est définie sur true, désactiver l'urgence sur les autres familles du créateur
      if (urgence === true) {
        console.log("Setting urgence to true - deactivating others");
        await Famille.updateMany(
          {
            createurId: createurId,
            _id: { $ne: familyId }, // Exclure la famille actuelle
          },
          { $set: { urgence: false } }
        );
        console.log("Other urgent families deactivated");
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
      console.log(
        `📊 RGPD Log - Family ${familleModifiee.nom} updated, IP: ${req.ip}`
      );

      // Gérer la liste de notifications si le statut d'urgence a changé
      if (urgence !== undefined) {
        console.log("Urgency status changed, handling notification list");
        const notificationResult =
          await NotificationInitializationService.handleFamilyUrgencyChange(
            createurId,
            urgence === true
          );

        if (notificationResult.success) {
          console.log(
            "Notification list handling successful:",
            notificationResult.action
          );
        } else {
          console.warn(
            "Notification list handling failed:",
            notificationResult.error
          );
          // Ne pas faire échouer la mise à jour de famille
        }
      }

      res.status(200).json({
        success: true,
        message: "Famille modifiée avec succès",
        famille: familleModifiee,
      });
    } catch (error) {
      console.error("Error in updateFamily controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la modification de la famille",
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
      console.log("Family ID to delete:", familyId);

      // Récupération du token et vérification du créateur
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const createurId = decodedToken._id;

      // Vérification que la famille existe et appartient au créateur
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found:", familyId);
        return res.status(404).json({
          error: "Famille non trouvée",
        });
      }

      // Contrôle d'accès - seul le créateur peut supprimer
      if (famille.createurId.toString() !== createurId) {
        console.log("Access denied - not the creator");
        return res.status(403).json({
          error: "Seul le créateur peut supprimer cette famille",
        });
      }

      console.log("Creator verified for family:", famille.nom);

      // Vérification s'il y a d'autres membres dans la famille
      if (famille.listeFamily.length > 1) {
        console.log("Family has other members, cannot delete");
        return res.status(400).json({
          error:
            "Impossible de supprimer une famille contenant d'autres membres. Retirez d'abord tous les membres.",
        });
      }

      // Gérer les notifications lors de la suppression
      if (famille.urgence) {
        console.log("Deleting urgent family, handling notifications");
        const notificationResult =
          await NotificationInitializationService.handleFamilyUrgencyChange(
            createurId,
            false // Plus de famille d'urgence
          );

        if (notificationResult.success) {
          console.log(
            "Notification list deactivated for deleted urgent family"
          );
        } else {
          console.warn(
            "Failed to deactivate notifications for deleted family:",
            notificationResult.error
          );
        }
      }

      // Suppression des URL courtes associées à cette famille
      console.log("Cleaning up related URLs");
      const familyDeeplinkPattern = `/joinFamilyByDeeplink/${familyId}`;
      const deletedUrls = await Url.deleteMany({
        longUrl: { $regex: familyDeeplinkPattern },
      });
      console.log(`Deleted ${deletedUrls.deletedCount} related URLs`);

      // Suppression de la famille
      console.log("Deleting family from database");
      await Famille.findByIdAndDelete(familyId);

      console.log("Family deleted successfully");
      console.log(`📊 RGPD Log - Family ${famille.nom} deleted, IP: ${req.ip}`);

      res.status(200).json({
        success: true,
        message: "Famille supprimée avec succès",
      });
    } catch (error) {
      console.error("Error in deleteFamily controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la suppression de la famille",
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
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;
      console.log("User ID from token:", userId);

      // Recherche de la famille d'urgence active
      const familleUrgence = await Famille.findOne({
        createurId: userId,
        urgence: true,
      }).populate("listeFamily", "nom prenom email");

      if (!familleUrgence) {
        console.log("No emergency family found");
        return res.status(404).json({
          message: "Aucune famille d'urgence configurée",
        });
      }

      console.log("Emergency family found:", familleUrgence.nom);
      console.log(`📊 RGPD Log - Emergency family retrieved, IP: ${req.ip}`);

      res.status(200).json({
        success: true,
        message: "Famille d'urgence récupérée avec succès",
        famille: familleUrgence,
      });
    } catch (error) {
      console.error("Error in getFamilleUrgence controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération de la famille d'urgence",
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
      console.log("Family ID to set as emergency:", familyId);

      // Récupération du token
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const createurId = decodedToken._id;

      // Vérification que la famille existe et appartient au créateur
      const famille = await Famille.findById(familyId);
      if (!famille) {
        console.log("Family not found:", familyId);
        return res.status(404).json({
          error: "Famille non trouvée",
        });
      }

      // Contrôle d'accès
      if (famille.createurId.toString() !== createurId) {
        console.log("Access denied - not the creator");
        return res.status(403).json({
          error:
            "Seul le créateur peut définir cette famille comme famille d'urgence",
        });
      }

      console.log("Creator verified for family:", famille.nom);

      // Désactiver l'urgence sur toutes les autres familles du créateur
      console.log("Deactivating urgence on other families");
      await Famille.updateMany(
        {
          createurId: createurId,
          _id: { $ne: familyId },
        },
        { $set: { urgence: false } }
      );

      // Activer l'urgence sur la famille sélectionnée
      console.log("Activating urgence on selected family");
      famille.urgence = true;
      await famille.save();

      console.log("Emergency family set successfully");
      console.log(
        `📊 RGPD Log - Emergency family set to ${famille.nom}, IP: ${req.ip}`
      );

      // Gérer automatiquement la liste de notifications
      console.log("Handling notification list for new urgent family");
      const notificationResult =
        await NotificationInitializationService.handleFamilyUrgencyChange(
          createurId,
          true // Cette famille devient d'urgence
        );

      if (notificationResult.success) {
        console.log(
          "Notification list handling successful:",
          notificationResult.action
        );
        if (notificationResult.notificationListId) {
          console.log(
            "Notification list ID:",
            notificationResult.notificationListId
          );
        }
      } else {
        console.warn(
          "Notification list handling failed:",
          notificationResult.error
        );
        // Ne pas faire échouer l'activation de famille d'urgence
      }

      res.status(200).json({
        success: true,
        message: "Famille d'urgence définie avec succès",
        famille: famille,
      });
    } catch (error) {
      console.error("Error in setFamilleUrgence controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la définition de la famille d'urgence",
      });
    }
  },

  /**
   * Récupère les IDs des personnes âgées (créateurs) des familles d'urgence dont l'utilisateur fait partie
   */
  getElderlyFromUrgentFamilies: async (req, res) => {
    try {
      console.log("Starting getElderlyFromUrgentFamilies process");

      // Récupération et vérification du token
      const token = req.cookies.token;
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwtToken.verify(token, "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const userId = decodedToken._id;
      console.log("User ID from token:", userId);

      // Rechercher toutes les familles d'urgence dont l'utilisateur fait partie
      // MAIS où il n'est pas le créateur (car les créateurs sont les personnes âgées)
      const famillesUrgence = await Famille.find({
        listeFamily: userId,
        urgence: true,
        createurId: { $ne: userId }, // Exclure les familles créées par l'utilisateur
      }).populate("createurId", "nom prenom email");

      console.log(
        `Found ${famillesUrgence.length} urgent families where user is member`
      );

      // Extraire les informations des personnes âgées (créateurs)
      const personnesAgees = famillesUrgence.map((famille) => {
        console.log(
          `Processing family: ${famille.nom} with elderly: ${famille.createurId.nom} ${famille.createurId.prenom}`
        );
        return {
          personneAgeeId: famille.createurId._id,
          nom: famille.createurId.nom,
          prenom: famille.createurId.prenom,
          email: famille.createurId.email,
          familleNom: famille.nom,
          familleId: famille._id,
        };
      });

      // Éliminer les doublons au cas où une personne âgée aurait créé plusieurs familles d'urgence
      const personnesAgeesUniques = personnesAgees.reduce((acc, current) => {
        const exists = acc.find(
          (item) =>
            item.personneAgeeId.toString() === current.personneAgeeId.toString()
        );
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      console.log(
        `Returning ${personnesAgeesUniques.length} unique elderly people from urgent families`
      );
      console.log(
        `📊 RGPD Log - Elderly from urgent families retrieved for user, IP: ${req.ip}`
      );

      res.status(200).json({
        success: true,
        message:
          "Personnes âgées des familles d'urgence récupérées avec succès",
        personnesAgees: personnesAgeesUniques,
        count: personnesAgeesUniques.length,
      });
    } catch (error) {
      console.error("Error in getElderlyFromUrgentFamilies:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération des personnes âgées",
      });
    }
  },
};
