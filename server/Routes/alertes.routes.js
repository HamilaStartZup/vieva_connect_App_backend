const express = require("express");
const router = express.Router();
const {createAlerte} = require("../Controllers/alertes.controllers"); // Assuming 'alertesController.js' is in the same directory

// Creation d'une alerte
router.post("/createAlerte", createAlerte);

module.exports = router;
