const express = require("express");
const router = express.Router();
const { getConversations, getMessages, sendMessage, markAsRead, uploadFile } = require("../Controllers/messages.controllers.js");
const { isAuthenticated } = require("../Controllers/auth.controllers.js");

// Liste des conversations de l'utilisateur connecté
router.get("/conversations", isAuthenticated, getConversations);
// Liste des messages d'une conversation
router.get("/conversations/:id/messages", isAuthenticated, getMessages);
// Envoyer un message (texte, image, audio)
router.post("/messages", isAuthenticated, sendMessage);
// Marquer tous les messages comme lus
router.patch("/conversations/:id/read", isAuthenticated, markAsRead);
// Upload de fichiers (image/audio)
router.post("/upload", isAuthenticated, uploadFile);

module.exports = router;
