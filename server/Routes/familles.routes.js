const express = require("express");
const router = express.Router();
const {
  createFamily,
  addToFamily,
  getFamily,
  generateDeeplink,
  joinFamilyByDeeplink,
  getFamilyIdByCreator,
  updateFamily,
  deleteFamily,
  getFamilleUrgence,
  setFamilleUrgence,
  getElderlyFromUrgentFamilies,
  getAllUserFamilies,
} = require("../Controllers/familles.controllers");
const { check } = require("express-validator");
const NotificationInitializationService = require("../utils/notificationInitializationService");
const jwtToken = require("jsonwebtoken");

/**
 * Routes pour la gestion des familles
 * RGPD: Toutes les routes nécessitent une authentification
 * et respectent le principe de moindre privilège
 */

// Route pour créer une famille
router.post(
  "/createFamily",
  [
    check("nom", "Le nom de famille est requis").notEmpty(),
    check("nom", "Le nom doit contenir entre 2 et 30 caractères").isLength({
      min: 2,
      max: 30,
    }),
    check("description", "La description est requise").optional(),
    check(
      "description",
      "La description ne peut pas dépasser 100 caractères"
    ).isLength({ max: 100 }),
  ],
  createFamily
);

// Route pour modifier une famille (nouvelle)
router.put(
  "/updateFamily/:familyId",
  [
    check("familyId", "ID de famille invalide").isMongoId(),
    check("nom", "Le nom doit contenir entre 2 et 30 caractères")
      .optional()
      .isLength({ min: 2, max: 30 }),
    check("description", "La description ne peut pas dépasser 100 caractères")
      .optional()
      .isLength({ max: 100 }),
    check("urgence", "Le champ urgence doit être un booléen")
      .optional()
      .isBoolean(),
  ],
  updateFamily
);

// Route pour supprimer une famille (nouvelle)
router.delete(
  "/deleteFamily/:familyId",
  [check("familyId", "ID de famille invalide").isMongoId()],
  deleteFamily
);

// Route pour ajouter un utilisateur à une famille
router.put(
  "/addToFamily",
  [
    check("code_family", "Le code famille est requis").notEmpty(),
    check("code_family", "Format de code famille invalide").matches(
      /^VF-[A-Za-z0-9]{4}$/
    ),
  ],
  addToFamily
);

// Route pour récupérer les IDs des membres d'une famille
router.get("/getFamily", getFamily);

// Route pour récupérer l'ID d'une famille grâce à l'ID du créateur
router.get("/getFamilyIdByCreator", getFamilyIdByCreator);

// Route pour obtenir la famille d'urgence (nouvelle)
router.get("/getFamilleUrgence", getFamilleUrgence);

// Route pour définir une famille comme famille d'urgence (nouvelle)
router.put(
  "/setFamilleUrgence/:familyId",
  [check("familyId", "ID de famille invalide").isMongoId()],
  setFamilleUrgence
);

// Route pour générer des deeplinks
router.get(
  "/generateDeeplink/:familyId",
  [check("familyId", "ID de famille invalide").isMongoId()],
  generateDeeplink
);

// Route pour rejoindre une famille via un deeplink
router.post(
  "/joinFamilyByDeeplink",
  [check("deeplink", "Le deeplink est requis").notEmpty()],
  joinFamilyByDeeplink
);

// Route pour récuperer les parents des familles dont l'utilisateur fait partie
router.get(
  "/getElderly",
  getElderlyFromUrgentFamilies
);


// ✅ NOUVELLE ROUTE: Vérifier le statut de la liste de notifications
router.get("/notificationStatus", async (req, res) => {
  try {
    console.log("Getting notification list status for user");

    // Récupération du token
    const token = req.cookies.token;
    if (!token) {
      console.log("Missing authentication token");
      return res.status(401).json({ 
        error: "Token d'authentification manquant" 
      });
    }

    let decodedToken;
    try {
      console.log("Verifying token...");
      decodedToken = jwtToken.verify(token, "shhhhh");
    } catch (error) {
      console.log("Invalid authentication token:", error.message);
      return res.status(401).json({ 
        error: "Token d'authentification invalide" 
      });
    }

    const userId = decodedToken._id;
    console.log("Getting notification status for user ID:", userId);

    // Obtenir le statut de la liste de notifications
    const status = await NotificationInitializationService.getNotificationListStatus(userId);
    
    console.log("Notification list status retrieved:", status);
    console.log(`📊 RGPD Log - Notification status checked for user, IP: ${req.ip}`);

    res.status(200).json({
      success: true,
      message: "Statut de la liste de notifications récupéré",
      status: status
    });

  } catch (error) {
    console.error("Error getting notification status:", error.message);
    res.status(500).json({
      error: "Erreur lors de la récupération du statut des notifications"
    });
  }
});

// Route pour récupérer toutes les familles dont l'utilisateur fait partie
router.get("/getAllUserFamilies", getAllUserFamilies);

module.exports = router;
