const Famille = require("../models/familles");
const { validationResult } = require("express-validator");
const jwtToken = require("jsonwebtoken");
const Personne = require("../models/personnes");

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
    const famille = await Famille.findOne({ listeFamily: userId }).populate("listeFamily");

    if (!famille) {
      return res.status(404).json({ message: "Aucune famille trouvée pour cet utilisateur" });
    }

    // Récupérer la liste des membres de la famille (uniquement leurs IDs)
    const membresFamilleIds = famille.listeFamily.map(member => member._id);

    res.status(200).json({ membresFamilleIds });
    }catch (error) {
        // Gérer les erreurs
        console.error(error);
        res
          .status(500)
          .json({ message: "Erreur lors de la création de la famille" });
      }
    }
};

// Fonction pour générer un code_family unique
function generateUniqueCode() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "VF-";
  for (let i = 0; i < 4; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}
