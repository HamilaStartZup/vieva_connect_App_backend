const Alerte = require("../models/alertes");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");


const Personne = require("../models/personnes"); // Ensure this path is correct

module.exports = {
  createAlerte: async (req, res) => {
    try {
      console.log("Starting createAlerte process");

      // Validation des entrées en utilisant express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      // Récupération du token JWT
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Missing authentication token",
        });
      }

      // Décodage du token JWT
      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh"); // Utiliser la clé secrète JWT depuis les variables d'environnement
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Invalid authentication token",
        });
      }

      // Récupération de l'ID utilisateur à partir du token décodé
      const userId = decodedToken._id;

      // Récupération du nom d'utilisateur de la base de données
      const utilisateur = await Personne.findById(userId);
      if (!utilisateur) {
        console.log("User not found for ID:", userId);
        return res.status(404).json({
          error: "User not found",
        });
      }

      const nomUser = utilisateur.nom;
      const prenomUser = utilisateur.prenom; // Assurez-vous que "prenom" est le nom du champ approprié dans votre modèle


      // Combinaison du prénom et du nom
      const nom = prenomUser + " " + nomUser;

      // Récupération des autres données d'alerte
      const { date, type, coordinates } = req.body;

      // Vérification des coordonnées
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        console.log("Invalid coordinates:", coordinates);
        return res.status(422).json({
          error: "Invalid coordinates",
        });
      }

      // Ajout du nom d'utilisateur et des autres données à l'objet alerte
      const newAlerte = new Alerte({
        nom,
        date,
        type,
        coordonnees: {
          type: "Point",
          coordinates,
        },
      });

      // Enregistrement de l'alerte dans la base de données
      await newAlerte.save();
      console.log("Alert saved to database");

      // Envoi de la réponse avec le message de succès
      res.status(201).json({
        message: "Alerte créée avec succès",
      });
    } catch (error) {
      console.error("Error in createAlerte controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la création de l'alerte",
      });
    }
  },
};


