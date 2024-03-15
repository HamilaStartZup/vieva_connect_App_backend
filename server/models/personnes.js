const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const personneSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
      maxLength: 30,
      minLength: 2,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
      maxLength: 30,
      minLength: 2,
    },
    adresse: String,
    telephone: String,
    email: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    encrypted_mdp: {
      type: String,
      trim: true,
      required: true,
    },
    salt: String,
    role: String,
  },
  { timestamps: true }
);

//Creation d'un champ virtuel qui va prendre le mot de passe et le crypter
personneSchema
  .virtual("mdp")
  .set(function (mdp) {
    this._password = mdp;
    this.salt = bcrypt.genSaltSync(10);
    this.encrypted_mdp = this.securedPassword(mdp);
  })
  .get(function () {
    return this._password;
  });

//Definition de methodes associées avec personne schema
personneSchema.method({
  //Verification pour savoir si le mot de passe est correct
  authenticate: function (plainpassword) {
    return bcrypt.compareSync(plainpassword, this.encrypted_mdp);
  },

  //Cryptage du mot de passe
  securedPassword: function (plainpassword) {
    if (!plainpassword) return "";
    try {
      return bcrypt.hashSync(plainpassword, this.salt);
    } catch (err) {
      return "Error in hashing the password";
    }
  },
});

module.exports = mongoose.model("Personne", personneSchema);
