const express = require("express");
const router = express.Router();
const {createFamily} = require("../Controllers/familles.controllers");

// POST createFamily
router.post("/createFamily", createFamily);

module.exports = router;
