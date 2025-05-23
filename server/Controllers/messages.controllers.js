const Conversation = require("../models/conversations");
const Message = require("../models/messages");
const Personne = require("../models/personnes");

module.exports = {
  sendMessage: async (req, res) => {
    try {
      const { message } = req.body;
      const { id: receiverId } = req.params;
      const senderId = req.auth._id;

      // Vérifier si le destinataire existe dans la base de données des utilisateurs
      const receiverExists = await Personne.exists({ _id: receiverId });
      if (!receiverExists) {
        return res
          .status(400)
          .json({
            error:
              "Le destinataire n'existe pas dans la base de données des utilisateurs",
          });
      }

      let conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId],
        });
      }

      const newMessage = new Message({
        senderId,
        receiverId,
        message,
      });

      if (newMessage) {
        conversation.messages.push(newMessage._id);
      }

      // await conversation.save();
      // await newMessage.save();

      // this will run in parallel
      await Promise.all([conversation.save(), newMessage.save()]);

      // SOCKET IO FUNCTIONALITY WILL GO HERE
      // const receiverSocketId = getReceiverSocketId(receiverId);
      // if (receiverSocketId) {
      //     // io.to(<socket_id>).emit() used to send events to specific client
      //     io.to(receiverSocketId).emit("newMessage", newMessage);
      // }

      res.status(201).json(newMessage);
    } catch (error) {
      console.log("Error in sendMessage controller: ", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
