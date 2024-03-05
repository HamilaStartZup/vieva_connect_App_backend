const mongoose = require ('mongoose');

const personneSchema = new mongoose.Schema({
    nom: String,
    prenom: String,
    adresse: String,
    telephone: Number,
    mail: String,
    mdp: String,
    role: String
});

module.exports = mongoose.model("Personne", personneSchema, "Personnes");

