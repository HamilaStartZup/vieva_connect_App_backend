const express = require("express");
const router = express.Router();
const {AllUsers} = require("../Controllers/utilisateurs.controllers");

// Route pour récupérer tous les utilisateurs
router.get("/AllUsers", AllUsers);
module.exports = router;
