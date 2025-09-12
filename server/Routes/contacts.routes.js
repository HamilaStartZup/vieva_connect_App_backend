const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const { 
  creerContact, 
  modifierContact, 
  obtenirContacts, 
  supprimerContact,
  obtenirContact,
  verifierUtilisateursParTelephone 
} = require("../Controllers/contacts.controllers");

/**
 * Routes pour la gestion des contacts d'urgence
 * Chaque personne âgée peut gérer sa liste de contacts
 */

/**
 * POST /api/contacts/creer
 * Créer un nouveau contact pour la personne âgée connectée
 * Body: { 
 *   nomComplet: string, 
 *   telephone: string, 
 *   email: string
 * }
 */
router.post("/creer", [
  check("nomComplet", "Le nom complet est requis")
    .notEmpty()
    .withMessage("Le nom complet ne peut pas être vide")
    .isLength({ min: 2, max: 100 })
    .withMessage("Le nom complet doit contenir entre 2 et 100 caractères")
    .trim(),
  
  check("telephone", "Le numéro de téléphone est requis")
    .notEmpty()
    .withMessage("Le numéro de téléphone ne peut pas être vide")
    .matches(/^[\+]?[0-9\s\-\(\)]{10,20}$/)
    .withMessage("Format de numéro de téléphone invalide"),
  
  check("email", "L'adresse e-mail est requise")
    .notEmpty()
    .withMessage("L'adresse e-mail ne peut pas être vide")
    .isEmail()
    .withMessage("Format d'adresse e-mail invalide")
    .normalizeEmail()
], creerContact);

/**
 * PUT /api/contacts/modifier/:contactId
 * Modifier un contact existant
 * Params: contactId (string)
 * Body: { nomComplet?, telephone?, email? }
 */
router.put("/modifier/:contactId", [
  check("contactId", "ID de contact invalide")
    .isMongoId()
    .withMessage("L'ID du contact doit être un ObjectId MongoDB valide"),
  
  check("nomComplet", "Le nom complet doit contenir entre 2 et 100 caractères")
    .optional()
    .isLength({ min: 2, max: 100 })
    .trim(),
  
  check("telephone", "Format de numéro de téléphone invalide")
    .optional()
    .matches(/^[\+]?[0-9\s\-\(\)]{10,20}$/),
  
  check("email", "Format d'adresse e-mail invalide")
    .optional()
    .isEmail()
    .normalizeEmail()
], modifierContact);

/**
 * GET /api/contacts/liste
 * Récupérer tous les contacts actifs de la personne âgée connectée
 * Triés par ordre alphabétique
 */
router.get("/liste", obtenirContacts);

/**
 * GET /api/contacts/:contactId
 * Récupérer un contact spécifique par son ID
 * Params: contactId (string)
 */
router.get("/:contactId", [
  check("contactId", "ID de contact invalide")
    .isMongoId()
    .withMessage("L'ID du contact doit être un ObjectId MongoDB valide")
], obtenirContact);

/**
 * DELETE /api/contacts/supprimer/:contactId
 * Supprimer (désactiver) un contact existant
 * Params: contactId (string)
 * Note: Utilise une suppression soft (désactivation) pour la conformité RGPD
 */
router.delete("/supprimer/:contactId", [
  check("contactId", "ID de contact invalide")
    .isMongoId()
    .withMessage("L'ID du contact doit être un ObjectId MongoDB valide")
], supprimerContact);

/**
 * POST /api/contacts/verifier-utilisateurs
 * Vérifier quels numéros de téléphone correspondent à des utilisateurs de l'app
 * Body: { numeros: ["0123456789", "0987654321"] }
 */
router.post("/verifier-utilisateurs", [
  check("numeros", "Liste de numéros de téléphone requise")
    .isArray({ min: 1 })
    .withMessage("Au moins un numéro de téléphone est requis"),
  
  check("numeros.*", "Format de numéro de téléphone invalide")
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage("Chaque numéro doit être au format valide")
], verifierUtilisateursParTelephone);

module.exports = router;
