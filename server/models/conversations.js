const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Personne',
      },
    ],
    messages:[
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Message',
          default:[]
        },
      ],
  },{ timestamps: true }
);

// Virtual pour le dernier message (sera peuplé dynamiquement)
conversationSchema.virtual('lastMessage', {
  ref: 'Message',
  localField: 'messages',
  foreignField: '_id',
  justOne: true,
  options: { sort: { createdAt: -1 } }
});

// Virtual pour le nombre de messages non lus (sera calculé dynamiquement)
conversationSchema.virtual('unreadCount');

module.exports = mongoose.model("Conversation", conversationSchema);
