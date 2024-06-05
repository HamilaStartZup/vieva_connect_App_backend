const express = require("express");
const router = express.Router();
const {AllUsers,addRole,getUsersWithRoleChild} = require("../Controllers/utilisateurs.controllers");

// Route pour récupérer tous les utilisateurs
router.get("/AllUsers", AllUsers);
// Route pour ajouter un role à l'utilisateur
router.put("/addRole", addRole);
// Route pour récupérer les utilisateurs avec un role enfant
router.get("/getUsersWithRoleChild", getUsersWithRoleChild)
module.exports = router;
