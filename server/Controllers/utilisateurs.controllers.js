const jwtToken = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Personne = require('../models/personnes');

module.exports = {
    AllUsers: async (req, res) => {
        try {      
            const users = await Personne.find({}, 'id nom prenom');
            return res.status(200).json(users);
        } catch (err) {
            return res.status(500).json({
                error: err.message,
            });
        }
    },

    addRole: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({
                    error: errors.array()[0].msg,
                });
            }

            // Récupération du body de la requête
            const { role } = req.body;

            // Récupéraion de l'id de l'utilisateur
            const token = req.cookies.token;
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }
            
            let decodedToken;
            try {
                decodedToken = jwtToken.verify(token, 'shhhhh');
            } catch (error) {
                return res.status(401).json({ message: "Token invalide" });
            }

            const userId = decodedToken._id;
    

            // Ajout du rôle à l'utilisateur
            const personne = await Personne.findOneAndUpdate(
                { _id: userId },
                { $set: { role: role } },
                { new: true, useFindAndModify: false }
            );
    
            if (!personne) {
                return res.status(404).json({ message: "Utilisateur non trouvé" });
            }
    
            res.status(200).json({ message: "Rôle attribué avec succès"});
        } catch (error) {
            console.error("Erreur lors de l'attribution du rôle:", error);
            res.status(500).json({ message: "Erreur lors de l'attribution du rôle", error: error.message });
        }
    },

    getUsersWithRoleChild: async (req, res) => {
        // Recherche des utilisateur qui ont le role child
        try {
            const users = await Personne.find({ role: 'child' }, '_id');
    
            if (users.length === 0) {
                return res.status(404).json({ message: "Aucun utilisateur avec le rôle 'child' trouvé" });
            }
    
            const userIds = users.map(user => user._id);
    
            res.status(200).json(userIds);
        } catch (error) {
            console.error("Erreur lors de la récupération des utilisateurs:", error);
            res.status(500).json({
                message: "Erreur lors de la récupération des utilisateurs",
                error: error.message,
            });
        }
    },
}
