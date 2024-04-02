const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personne',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personne',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },{ timestamp: true });

module.exports = mongoose.model("Message", messageSchema);
