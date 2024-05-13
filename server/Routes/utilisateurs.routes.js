const express = require("express");
const router = express.Router();
const {AllUsers} = require("../Controllers/utilisateurs.controllers");



router.get("/AllUsers", AllUsers);
module.exports = router;
