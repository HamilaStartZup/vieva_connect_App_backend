const express = require("express");
const router = express.Router();
const { 
  createFamily, 
  addToFamily, 
  getFamily, 
  generateDeeplink, 
  joinFamilyByDeeplink,
  getFamilyIdByCreator,
  updateFamily,        // Nouvelle méthode
  deleteFamily,        // Nouvelle méthode
  getFamilleUrgence,   // Nouvelle méthode
  setFamilleUrgence    // Nouvelle méthode
} = require("../Controllers/familles.controllers");
const { check } = require("express-validator");

/**
 * Routes pour la gestion des familles
 * RGPD: Toutes les routes nécessitent une authentification
 * et respectent le principe de moindre privilège
 */

// Route pour créer une famille
router.post("/createFamily", [
  check("nom", "Le nom de famille est requis").notEmpty(),
  check("nom", "Le nom doit contenir entre 2 et 30 caractères").isLength({ min: 2, max: 30 }),
  check("description", "La description est requise").optional(),
  check("description", "La description ne peut pas dépasser 100 caractères").isLength({ max: 100 })
], createFamily);

// Route pour modifier une famille (nouvelle)
router.put("/updateFamily/:familyId", [
  check("familyId", "ID de famille invalide").isMongoId(),
  check("nom", "Le nom doit contenir entre 2 et 30 caractères").optional().isLength({ min: 2, max: 30 }),
  check("description", "La description ne peut pas dépasser 100 caractères").optional().isLength({ max: 100 }),
  check("urgence", "Le champ urgence doit être un booléen").optional().isBoolean()
], updateFamily);

// Route pour supprimer une famille (nouvelle)
router.delete("/deleteFamily/:familyId", [
  check("familyId", "ID de famille invalide").isMongoId()
], deleteFamily);

// Route pour ajouter un utilisateur à une famille
router.put("/addToFamily", [
  check("code_family", "Le code famille est requis").notEmpty(),
  check("code_family", "Format de code famille invalide").matches(/^VF-[A-Za-z0-9]{4}$/)
], addToFamily);

// Route pour récupérer les IDs des membres d'une famille
router.get("/getFamily", getFamily);

// Route pour récupérer l'ID d'une famille grâce à l'ID du créateur
router.get("/getFamilyIdByCreator", getFamilyIdByCreator);

// Route pour obtenir la famille d'urgence (nouvelle)
router.get("/getFamilleUrgence", getFamilleUrgence);

// Route pour définir une famille comme famille d'urgence (nouvelle)
router.put("/setFamilleUrgence/:familyId", [
  check("familyId", "ID de famille invalide").isMongoId()
], setFamilleUrgence);

// Route pour générer des deeplinks
router.get("/generateDeeplink/:familyId", [
  check("familyId", "ID de famille invalide").isMongoId()
], generateDeeplink);

// Route pour rejoindre une famille via un deeplink
router.post("/joinFamilyByDeeplink", [
  check("deeplink", "Le deeplink est requis").notEmpty(),
], joinFamilyByDeeplink);

module.exports = router;