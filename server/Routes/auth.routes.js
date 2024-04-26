const express = require("express");
const router = express.Router();
const {login, create, profile, logout, isAuthenticated, verify_user} = require("../Controllers/auth.controllers.js")
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

module.exports = router;
