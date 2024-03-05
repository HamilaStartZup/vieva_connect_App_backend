const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const PORT = process.env.PORT || 7000;
const MONGODB_URL = process.env.MONGODB_URL;

// Fonction pour se connecter à la base de données MongoDB
const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URL, { dbName: "vieva_Connect" });
    console.log("Connexion à la base de données MongoDB établie avec succès");
  } catch (error) {
    console.error(
      "Erreur lors de la connexion à la base de données MongoDB:",
      error
    );
  }
};

module.exports = connectToDatabase;
