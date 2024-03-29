const mongoose = require("mongoose");
const messages = require("./messages");

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
  },{ timestamps }
);

module.exports = mongoose.model("Conversation", conversationSchema);
