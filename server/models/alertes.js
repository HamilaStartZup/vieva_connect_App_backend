const mongoose = require("mongoose");

const alerteSchema = new mongoose.Schema({
  nom: {
    type: String,
    trim: true,
    maxLength: 30,
    minLength: 2,
  },
  date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
  },
  coordonnees: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number],
      required: true,
      index: "2dsphere",
    },
  },
  // NOUVEAUX CHAMPS
  personneAgeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Personne',
    required: true
  },
  status: {
    type: String,
    enum: ['envoyée', 'prise_en_charge', 'résolue', 'annulée'],
    default: 'envoyée'
  },
  message: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model("Alerte", alerteSchema);