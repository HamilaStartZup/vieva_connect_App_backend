const Personne = require("../models/personnes");

module.exports = {
    AllUsers: async (req, res) =>{
        try{      
            const users = await Personne.find({}, 'id nom prenom ');
            return res.status(200).json(users);
        }catch(err){
            return res.status(500).json({
                error: err.message,
            });
        }
    }
}