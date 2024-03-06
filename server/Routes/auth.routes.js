const express = require("express");
const router = express.Router();
const {login} = require("../Controllers/auth.controllers.js")
const { check } = require('express-validator');



//
router.get("/", async(req, res)=>{
  res.status(200).json({ mssg: "Voici la page landing" });

});

router.get("/login", async(req,res)=>{
  res.status(200).json({ mssg: "Coucou login" });
});

router.post("/login",[
  // Validation for email and password
  check("email", "Email is required").isEmail(),
  check("password", "Password is required").isLength({ min: 1 })
],
 login);



module.exports = router;
