const mongoose = require("mongoose");

const alerteSchema = new mongoose.Schema({
  nom: {
    type: String,
    // required: true,
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
      enum: ["Point"], // GeoJSON Point type
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: "2dsphere", // Enable spatial queries
    },
  },
}, { timestamps: true });

module.exports = mongoose.model("Alerte", alerteSchema);
