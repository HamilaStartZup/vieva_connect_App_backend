const mongoose = require("mongoose");

const familleSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
      maxLength: 30,
      minLength: 2,
    },
    description: {
      type: String,
      maxLength: 30,
    },
    code_family: String,
    createurId: String,
    listeFamily: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Personne",
      },
    ],
  },
  { timestamps: true }
);
module.exports = mongoose.model("Famille", familleSchema);
