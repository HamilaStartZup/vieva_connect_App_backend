const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const { 
  initialiserListeNotifications, 
  verifierProximite, 
  getPersonnesANotifier,
  declencherAlerteUrgence 
} = require("../Controllers/notifications.controllers");

/**
 * Routes pour la gestion des notifications de proximité
 * RGPD: Toutes les routes traitent des données de géolocalisation
 * avec le consentement implicite de l'utilisateur pour la sécurité
 */

/**
 * POST /api/notifications/initialiser
 * Initialise ou met à jour la liste de notifications pour une personne âgée
 * Body: { coordinates: [longitude, latitude], rayonNotification?: number }
 */
router.post("/initialiser", [
  check("coordinates", "Les coordonnées sont requises")
    .isArray({ min: 2, max: 2 })
    .withMessage("Les coordonnées doivent être un tableau de 2 nombres"),
  check("coordinates.*", "Les coordonnées doivent être des nombres")
    .isNumeric(),
  check("rayonNotification", "Le rayon doit être un nombre entre 1 et 100")
    .optional()
    .isInt({ min: 1, max: 100 })
], initialiserListeNotifications);

/**
 * POST /api/notifications/verifier-proximite
 * Vérifie la proximité d'une personne avec une personne âgée
 * Body: { coordinates: [longitude, latitude], personneAgeeId: string }
 */
router.post("/verifier-proximite", [
  check("coordinates", "Les coordonnées sont requises")
    .isArray({ min: 2, max: 2 })
    .withMessage("Les coordonnées doivent être un tableau de 2 nombres"),
  check("coordinates.*", "Les coordonnées doivent être des nombres")
    .isNumeric(),
  check("personneAgeeId", "L'ID de la personne âgée est requis")
    .notEmpty()
    .withMessage("L'ID de la personne âgée ne peut pas être vide")
], verifierProximite);

/**
 * GET /api/notifications/liste
 * Récupère la liste des personnes à notifier pour la personne âgée connectée
 */
router.get("/liste", getPersonnesANotifier);

/**
 * POST /api/notifications/alerte-urgence
 * Déclenche une alerte d'urgence aux personnes dans la liste de notifications
 * Body: { typeAlerte?: string, message?: string }
 */
router.post("/alerte-urgence", [
  check("typeAlerte", "Le type d'alerte doit être une chaîne de caractères")
    .optional()
    .isString()
    .isLength({ max: 50 }),
  check("message", "Le message doit être une chaîne de caractères")
    .optional()
    .isString()
    .isLength({ max: 500 })
], declencherAlerteUrgence);

module.exports = router;