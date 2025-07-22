const express = require("express");
const router = express.Router();
const {login, create, profile, logout, isAuthenticated, verify_user, verifyToken, updateProfile } = require("../Controllers/auth.controllers.js")
const { check } = require('express-validator');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../openapi.json');


// documentation api
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerDocument));

// 
router.get("/", async(req, res)=>{
  res.status(200).json({ mssg: "Voici la page landing" });

});
// 
router.get("/login", async(req,res)=>{
  res.status(200).json({ mssg: "Coucou login" });
});

// POST Login 
router.post("/login",[
  // Validation pour l'email et le mot de passe
  check("email", "Email is required").isEmail(),
  check("mdp", "Password is required").isLength({ min: 1 })
],
 login);

// POST Create
router.post("/create",[
// Validation pour l'email et le mot de passe et le nom
check("nom", "LastName must be 3+ chars long").isLength({ min: 3 }),
check("prenom", "FirstName must be 3+ chars long").isLength({ min: 3 }),
check("adresse", "Address must be 3+ chars long").isLength({ min: 10 }),
check("telephone", "Phone must be 10+ chars long").isLength({ min: 10 }),
check("email", "Email is required").isEmail(),
check("mdp", "Password must contain 8+ chars").isLength({ min: 8 })
],
create);

// Route test pour tester la protection des routes
router.get("/testroute", isAuthenticated, (req, res) => {
  res.send("A protected route");
});

// Route protégée pour le profil
router.get("/profile/:userId",isAuthenticated, profile);

// Route de logout
router.get("/logout", logout);

// Route de verification pour ConnectyCube
router.post('/verify_user', verify_user);

router.post('/verifyToken', verifyToken);

// Route PUT pour modifier le profil utilisateur 
router.put("/profile/:userId", [
  // Validations optionnelles - seuls les champs fournis sont validés
  check("nom")
    .optional()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le nom doit contenir entre 2 et 30 caractères")
    .trim(),
  check("prenom")
    .optional()
    .isLength({ min: 2, max: 30 })
    .withMessage("Le prénom doit contenir entre 2 et 30 caractères")
    .trim(),
  check("adresse")
    .optional()
    .isLength({ min: 10 })
    .withMessage("L'adresse doit contenir au moins 10 caractères")
    .trim(),
  check("telephone")
    .optional()
    .isLength({ min: 10 })
    .withMessage("Le téléphone doit contenir au moins 10 caractères")
    .trim(),
  check("email")
    .optional()
    .isEmail()
    .withMessage("Format d'email invalide"),
  check("mdp")
    .optional()
    .isLength({ min: 8 })
    .withMessage("Le nouveau mot de passe doit contenir au moins 8 caractères"),
  check("ancienMdp")
    .optional()
    .custom((value, { req }) => {
      // Si mdp est fourni, ancienMdp est obligatoire
      if (req.body.mdp && (!value || value.trim() === "")) {
        throw new Error("L'ancien mot de passe est requis pour modifier le mot de passe");
      }
      return true;
    })
], 
isAuthenticated, 
updateProfile);

module.exports = router;
