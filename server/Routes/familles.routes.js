const express = require("express");
const router = express.Router();
const { createFamily, addToFamily, getFamily, generateDeeplink, joinFamilyByDeeplink,getFamilyIdByCreator } = require("../Controllers/familles.controllers");
const { check } = require("express-validator");

// Route pour créer une famille
router.post("/createFamily", [
  check("nom", "Family name is required").notEmpty(),
  // check("description", "Description is required").notEmpty()
], createFamily);

// Route pour ajouter un utilisateur à une famille
router.put("/addToFamily", [
  check("code_family", "Family code is required").notEmpty()
], addToFamily);

// Route pour récupérer les Ids des membres d'une famille
router.get("/getFamily", getFamily);

// Route pour récupérer l'Id d'une famille grâce à l'id du créateur'
router.get("/getFamilyIdByCreator", getFamilyIdByCreator)

// Route pour générer des deeplinks
router.get("/generateDeeplink/:familyId", generateDeeplink);

// Route pour rejoindre une famille via un deeplink
router.post("/joinFamilyByDeeplink", joinFamilyByDeeplink);

module.exports = router;
