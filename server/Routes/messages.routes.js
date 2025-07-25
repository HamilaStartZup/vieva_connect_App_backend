const express = require("express");
const router = express.Router();
const { getConversations, getMessages, sendMessage, markAsRead, uploadFile } = require("../Controllers/messages.controllers.js");
const { isAuthenticated } = require("../Controllers/auth.controllers.js");
const Conversation = require("../models/conversations.js");

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

// POST /api/conversations/start
router.post("/conversations/start", isAuthenticated, async (req, res) => {
    const userId = req.auth._id;
    const { participantId } = req.body;

    try {
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId], $size: 2 },
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [userId, participantId],
                messages: [],
            });
            await conversation.save();
        }
       console.log("Conversation créée/trouvée :", conversation);
console.log("Envoyé conversationId :", conversation._id);

        res.json({ conversationId: conversation._id, currentUserId: userId });


    } catch (error) {
        console.error("Erreur création conversation:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});


module.exports = router;
