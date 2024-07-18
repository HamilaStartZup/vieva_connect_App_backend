// importation des modules et modeles nécesssaires
const Personne = require("../models/personnes");
const { validationResult } = require("express-validator");
const jwtToken = require("jsonwebtoken");
const { expressjwt: jwt } = require("express-jwt");
const bcrypt = require("bcrypt");

module.exports = {
  // Fonction pour se connecter et générer un token
  login: async (req, res) => {
    try {
      // Validation des inputs en utilisant express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      // Récupération des identifiants de connexion
      const { email, mdp } = req.body;
      // Recherche de l'utilisateur dans la base de données
      const personne = await Personne.findOne({ email });
      if (!personne) {
        return res.status(400).json({
          error: "User not found",
        });
      }
      // Vérification du mot de passe
      const isPasswordValid = await bcrypt.compare(mdp, personne.mdp);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: "Invalid password",
        });
      }

      // Génération du token JWT
      const expiresIn = 60*60*24*14; // temps d'expiration en seconde
      // const expiresIn = 60; // temps d'expiration en seconde

      const expirationTime = new Date().getTime() + expiresIn * 1000;

      const token = jwtToken.sign({ _id: personne._id }, "shhhhh", {
        expiresIn,
      });
      res.cookie("token", token, { expire: new Date() + expiresIn * 1000 });
      const { _id, nom, prenom } = personne;
      // Envoi de la réponse avec le token et les informations de l'utilisateur
      return res.json({ token, expirationTime, personne: { _id, nom, prenom, email } });
    } catch (error) {
      console.log("Error in login controller", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // Fonction pour créer un utilisateur dans la base de données
  create: async (req, res) => {
    try {
      // Validation des inputs en utilisant express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      const { nom, prenom, adresse, telephone, email, mdp, confirm_mdp } =
        req.body;
      // if (mdp !== confirm_mdp) {
      //   return res.status(400).json({
      //     error: "Passwords do not match",
      //   });
      // }

      const personne = await Personne.findOne({ email });
      if (personne) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hachage du mot de passe avec bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(mdp, salt);

      const newPersonne = new Personne({
        nom,
        prenom,
        adresse,
        telephone,
        email,
        mdp: hashedPassword,
      });

      // Ajout du nouveau utilisateur dans la base de données
      await newPersonne.save();

      // Génération du token JWT pour le nouvel utilisateur et placement dans un cookie
      const expiresIn = 60*10; // temps d'expiration en seconde
      const token = jwtToken.sign({ _id: newPersonne._id }, "shhhhh", {
        expiresIn,
      });
      res.cookie("token", token, { expire: new Date() + expiresIn * 1000 });
      // Retourne le nouvel utilisateur avec le token dans le cookie
      return res.json({ token, personne: newPersonne });
    } catch (error) {
      console.log("Error in signup controller", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // Middleware pour vérifier si l'utilisateur est connecté et a un jeton valide, et s'il est authentifié
  isAuthenticated: (req, res, next) => {
    jwt({
      secret: "shhhhh",
      userProperty: "auth",
      algorithms: ["HS256"],
    })(req, res, (err) => {
      if (err) {
        return res.status(401).json({
          error: "Unauthorized",
        });
      }
      if (!req.auth || !req.auth._id) {
        return res.status(403).json({
          error: "Access Denied",
        });
      }
      next();
    });
  },

  // Fonction pour récupérer le profil d'un utilisateur
  profile: async (req, res) => {
    try {
      const personne = await Personne.findById(req.params.userId);
      if (!personne) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      res.json(personne);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // Fonction pour se déconnecter en supprimant le cookie
  logout: async (req, res) => {
    try {
      res.clearCookie("Authtoken");
      res.json({
        message: "Utilisateur s'est déconnecté",
      });
    } catch (error) {
      console.log("Error in logout controller", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
  // Fonction pour vérifier la validité du  token 
  verifyToken: async (req, res) => {
    try {
      // Récupération du token dans le corps de la requête
      const token = req.body.token;

      // Vérification du token
      const decoded = jwtToken.verify(token, "shhhhh");
      const personne = await Personne.findById(decoded._id);
      if (!personne) {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Réponse avec le statut de vérification
      res.json({ valid: true });
    } catch (err) {
      // Gestion des erreurs de vérification
      res.status(401).json({ error: "Invalid token" });
    }
  },
  // Fonction pour vérifier le token avec ConnectyCube
  verify_user: async (req, res) => {
    const token = req.body.token;
    try {
      const decoded = jwtToken.verify(token, "shhhhh");
      const personne = await Personne.findById(decoded._id);
      if (!personne) {
        return res.status(401).json({ error: "Invalid token" });
      }
      res.json({ id: personne._id });
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  },
};
