// Importing necessary modules and models
const Personne = require("../models/personnes");
const { check, validationResult } = require("express-validator");
const jwtToken = require("jsonwebtoken");
const { expressjwt: jwt } = require("express-jwt");

module.exports = {
  login: async (req, res) => {
    // Validate user input using express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        error: errors.array()[0].msg,
      });
    }
    // Checking user credentials and generating JWT token for authentication
    const { email, password } = req.body;
    await Personne.findOne({ email: `${email}` }).then((personne) => {
      if (!personne) {
        return res.status(400).json({
          error: "User not found",
        });
      }
      //   if (!personne.authenticate(password)) {
      //       return res.status(401).json({
      //           error: "Email or Password does not exist"
      //       });
      //   }

      // Avec le mot de passe avant cryptage pour le test
      if (!personne.encrypted_mdp || password !== personne.encrypted_mdp) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Setting JWT token as a cookie in the browser
      const token = jwtToken.sign({ _id: personne._id }, "shhhhh");
      res.cookie("token", token, { expire: new Date() + 9999 });
      const { _id, nom, prenom, email } = personne;
      return res.json({ token, personne: { _id, nom, prenom, email } });
    });
  },
};
