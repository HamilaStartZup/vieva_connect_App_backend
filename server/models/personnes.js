const mongoose = require("mongoose");
var crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const personneSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true,
    maxLength: 30,
    minLength: 2,
  },
  prenom:  {
    type: String,
    required: true,
    trim: true,
    maxLength: 30,
    minLength: 2,
  },
  adresse: String,
  telephone: Number,
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
{timestamps: true}
);

//Creating a "virtua" field that will take in password and encrypt it
personneSchema
  .virtual("password")
  .set(function (password) {
    this._password = password;
    this.salt = uuidv4();
    this.encrypted_mdp = this.securedPassword(password);
  })
  .get(function () {
    return this._password;
  });
//Defining some methods associated with user schema
personneSchema.method({
  //To check if the password is correct
  authenticate: function (plainpassword) {
    return this.securedPassword(plainpassword) === this.encrypted_mdp;
  },

  //To encrpty the password
  securedPassword: function (plainpassword) {
    if (!plainpassword) return "";
    try {
      return crypto
        .createHmac("sha256", this.salt)
        .update(plainpassword)
        .digest("hex");
    } catch (err) {
      return "Error in hashing the password";
    }
  },
});
// module.exports = mongoose.model("Personnes", personneSchema);
module.exports = mongoose.model("Personne", personneSchema);
