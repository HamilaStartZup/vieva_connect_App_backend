const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const PORT = process.env.PORT || 7000;
const MONGODB_URI = process.env.MONGODB_URI;

// Fonction pour se connecter à la base de données MongoDB
const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connexion à la base de données MongoDB établie avec succès");
  } catch (error) {
    console.error(
      "Erreur lors de la connexion à la base de données MongoDB:",
      error
    );
  }
};

module.exports = connectToDatabase;
