const mongoose = require("mongoose");

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
    mdp: {
      type: String,
      trim: true,
      required: true,
    },
    role: String,
  },
  { timestamps: true }
);
module.exports = mongoose.model("Personne", personneSchema);
