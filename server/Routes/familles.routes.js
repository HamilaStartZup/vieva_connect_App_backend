const express = require("express");
const router = express.Router();
const {createFamily, addToFamily, getFamily} = require("../Controllers/familles.controllers");

// POST createFamily
router.post("/createFamily", createFamily);
// PUT addToFamily
router.put("/addToFamily", addToFamily);
// GET getFamily
router.get("/getFamily", getFamily);
module.exports = router;
