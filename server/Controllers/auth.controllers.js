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
        return res.status(409).json({ error: "User already exists" });
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

  // Fonction pour modifier le profil d'un utilisateur 
updateProfile: async (req, res) => {
  try {
    console.log("=== Début updateProfile ===");
    console.log("User ID from params:", req.params.userId);
    console.log("Authenticated user ID:", req.auth._id);
    console.log("Request body:", req.body);

    // Validation des inputs en utilisant express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(422).json({
        error: errors.array()[0].msg,
      });
    }

    // Vérifier que l'utilisateur modifie son propre profil
    if (req.params.userId !== req.auth._id) {
      console.log("Access denied: user trying to modify another profile");
      return res.status(403).json({
        error: "Vous ne pouvez modifier que votre propre profil",
      });
    }

    // Recherche de l'utilisateur dans la base de données
    const personne = await Personne.findById(req.params.userId);
    if (!personne) {
      console.log("User not found with ID:", req.params.userId);
      return res.status(404).json({
        error: "Utilisateur non trouvé",
      });
    }

    console.log("User found:", personne.email);

    // Récupération des champs à modifier
    const { nom, prenom, adresse, telephone, email, mdp, ancienMdp } = req.body;
    
    // Objet pour stocker les champs à mettre à jour
    const updateFields = {};

    // Mise à jour conditionnelle des champs
    if (nom !== undefined) {
      updateFields.nom = nom;
      console.log("Updating nom to:", nom);
    }
    if (prenom !== undefined) {
      updateFields.prenom = prenom;
      console.log("Updating prenom to:", prenom);
    }
    if (adresse !== undefined) {
      updateFields.adresse = adresse;
      console.log("Updating adresse to:", adresse);
    }
    if (telephone !== undefined) {
      updateFields.telephone = telephone;
      console.log("Updating telephone to:", telephone);
    }

    // Gestion spéciale pour l'email (vérification d'unicité)
    if (email !== undefined && email !== personne.email) {
      console.log("Checking email uniqueness for:", email);
      const existingUser = await Personne.findOne({ email, _id: { $ne: req.params.userId } });
      if (existingUser) {
        console.log("Email already exists:", email);
        return res.status(409).json({
          error: "Cette adresse email est déjà utilisée",
        });
      }
      updateFields.email = email;
      console.log("Email can be updated to:", email);
    }

    // Gestion sécurisée pour le mot de passe
    if (mdp !== undefined && mdp.trim() !== "") {
      console.log("Password change requested");
      
      // Vérifier que l'ancien mot de passe est fourni
      if (!ancienMdp || ancienMdp.trim() === "") {
        console.log("Old password not provided");
        return res.status(400).json({
          error: "L'ancien mot de passe est requis pour modifier le mot de passe",
        });
      }

      // Vérifier l'ancien mot de passe
      console.log("Verifying old password");
      const isOldPasswordValid = await bcrypt.compare(ancienMdp, personne.mdp);
      if (!isOldPasswordValid) {
        console.log("Old password is invalid");
        return res.status(401).json({
          error: "L'ancien mot de passe est incorrect",
        });
      }

      // Vérifier que le nouveau mot de passe est différent de l'ancien
      const isSamePassword = await bcrypt.compare(mdp, personne.mdp);
      if (isSamePassword) {
        console.log("New password is same as old password");
        return res.status(400).json({
          error: "Le nouveau mot de passe doit être différent de l'ancien",
        });
      }

      console.log("Hashing new password");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(mdp, salt);
      updateFields.mdp = hashedPassword;
      console.log("Password hashed successfully");
    }

    // Vérification qu'au moins un champ est fourni pour la modification
    if (Object.keys(updateFields).length === 0) {
      console.log("No fields to update");
      return res.status(400).json({
        error: "Aucun champ valide fourni pour la modification",
      });
    }

    console.log("Fields to update:", Object.keys(updateFields));

    // Mise à jour de l'utilisateur
    const updatedPersonne = await Personne.findByIdAndUpdate(
      req.params.userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-mdp'); // Exclure le mot de passe de la réponse

    console.log("User updated successfully");

    // Message spécial si le mot de passe a été modifié
    const message = updateFields.mdp 
      ? "Profil modifié avec succès. Mot de passe mis à jour." 
      : "Profil modifié avec succès";

    // Envoi de la réponse avec les informations mises à jour
    return res.json({
      message: message,
      personne: updatedPersonne
    });

  } catch (error) {
    console.log("Error in updateProfile controller:", error.message);
    console.log("Error stack:", error.stack);
    return res.status(500).json({ 
      error: "Erreur serveur lors de la modification du profil" 
    });
  }
},
};
