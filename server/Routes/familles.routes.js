const express = require("express");
const router = express.Router();
const {createFamily, addToFamily} = require("../Controllers/familles.controllers");

// POST createFamily
router.post("/createFamily", createFamily);
// PUT addToFamily
router.put("/addToFamily", addToFamily);
module.exports = router;
