// Importing necessary modules and models
const Personne = require("../models/personnes");
const { check, validationResult } = require("express-validator");
const jwtToken = require("jsonwebtoken");
const { expressjwt: jwt } = require("express-jwt");

module.exports = {
  login: async (req, res) => {
    // Validation des inputs en utilisant express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        error: errors.array()[0].msg,
      });
    }
    // Verification des authentifiants de l'utilisateur et generation d'un  JWT token pour l'authentification
    const { email, mdp } = req.body;
    await Personne.findOne({ email: `${email}` }).then((personne) => {
      if (!personne) {
        return res.status(400).json({
          error: "User not found",
        });
      }

      // Vérification du mot de passe
      if (!personne.authenticate(mdp)) {
        return res.status(401).json({
          error: "Invalid  password",
        });
      }

      // Setting JWT token as a cookie in the browser
      const token = jwtToken.sign({ _id: personne._id }, "shhhhh");
      res.cookie("token", token, { expire: new Date() + 9999 });
      const { _id, nom, prenom, email } = personne;
      return res.json({ token, personne: { _id, nom, prenom, email } });
    });
  },

  create: async (req, res) => {
    // Validation des inputs en utilisant express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        error: errors.array()[0].msg,
      });
    }

    const { mdp, confirm_mdp } = req.body;
    if (mdp !== confirm_mdp) {
      return res.status(400).json({
        error: "Passwords do not match",
      });
    }

    // Creation d'un nouvel utilisateur et sa sauvegarde dans la DB
    const personne = new Personne(req.body);
    personne
      .save()
      .then((personne) => {
        res.json({
          nom: personne.nom,
          prenom: personne.prenom,
          adresse: personne.adresse,
          telephone: personne.telephone,
          email: personne.email,
          mdp: personne.mdp,
        });
      })
      .catch((err) => {
        let errorMessage = "Something went wrong.";
        if (err.code === 11000) {
          errorMessage = "User already exists, please signin";
        }
        return res.status(500).json({ error: errorMessage });
      });
  },

  // Middleware pour vérifier si l'utilisateur est connecté et a un jeton valide
  isSignedIn: jwt({
    secret: "shhhhh",
    userProperty: "auth",
    algorithms: ["HS256"],
  }),

  // Middleware pour vérifier si l'utilisateur est authentifié
  isAuthenticated: (req, res, next) => {
    let checker = req.profile && req.auth && req.profile._id == req.auth._id;
    if (!checker) {
      return res.status(403).json({
        error: "ACCESS DENIED",
      });
    }
    next();
  },
  
  profile: async (req, res) => {
    try {
      const personne = await Personne.findById(req.params.id)
        .select("-salt")
        .select("-encrypted_mdp");
      if (!personne) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      res.json(personne);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};
