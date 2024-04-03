const express = require("express");
const router = express.Router();
const {sendMessage} = require("../Controllers/messages.controllers.js")
const {isAuthenticated} = require("../Controllers/auth.controllers.js") 



router.post("/send/:id", isAuthenticated,sendMessage);
module.exports = router;
