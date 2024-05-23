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
      // Validation des inputs en utilisant express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      // Récupérer les données de la requête
      const { nom, description } = req.body;

      // Récupérer le createurId depuis le token de l'utilisateur
      const token = req.cookies.token; // Supposons que le token est stocké dans un cookie nommé "token"
      const decodedToken = jwtToken.verify(token, "shhhhh"); // Décode le token
      const createurId = decodedToken._id; // Récupère l'ID de l'utilisateur à partir du token

      let code_family;
      let familleExistante;

      do {
        // Générer le code_family unique
        code_family = generateUniqueCode();
        // Vérifier si le code_family existe déjà
        familleExistante = await Famille.findOne({ code_family });
      } while (familleExistante);

      // Créer une nouvelle famille
      const nouvelleFamille = new Famille({
        nom,
        description,
        code_family,
        createurId,
        listeFamily: [createurId], // Ajouter le createurId à la liste des membres de la famille
      });

      // Enregistrer la nouvelle famille dans la base de données
      const familleCréée = await nouvelleFamille.save();

      // Répondre avec la famille créée
      res.status(201).json(familleCréée);
    } catch (error) {
      // Gérer les erreurs
      console.error(error);
      res
        .status(500)
        .json({ message: "Erreur lors de la création de la famille" });
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

      // Rechercher uniquement les IDs des familles créées par l'utilisateur
      const familles = await Famille.find({ createurId: userId }, "_id");

      res.status(200).json(
        familles.map((famille) => ({
          familyId: famille._id,
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
            deeplink: `${req.protocol}://${req.get("host")}/u/${
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
};