const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personne',
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "audio", "document"],
      required: true,
    },
    text: {
      type: String,
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
