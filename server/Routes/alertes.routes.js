const express = require("express");
const router = express.Router();
const { createAlerte } = require("../Controllers/alertes.controllers");
const { isAuthenticated } = require("../Controllers/auth.controllers");
const Alerte = require("../models/alertes");
const PriseEnCharge = require("../models/priseEnCharge");

// Creation d'une alerte
router.post("/createAlerte", createAlerte);

// Nouvelle route pour récupérer les détails d'une alerte
router.get("/alertes/:alerteId", isAuthenticated, async (req, res) => {
  try {
    const { alerteId } = req.params;
    
    const alerte = await Alerte.findById(alerteId)
      .populate('personneAgeeId', 'nom prenom telephone');
    
    if (!alerte) {
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }
    
    const confirmations = await PriseEnCharge.find({ alerteId })
      .populate('helperId', 'nom prenom telephone')
      .sort({ confirmedAt: 1 });
    
    res.json({
      alerte: {
        id: alerte._id,
        date: alerte.date,
        type: alerte.type,
        coordonnees: alerte.coordonnees,
        status: alerte.status,
        personneAgee: alerte.personneAgeeId
      },
      confirmations: confirmations.map(c => ({
        helper: {
          id: c.helperId._id,
          nom: c.helperId.nom,
          prenom: c.helperId.prenom,
          telephone: c.helperId.telephone
        },
        confirmedAt: c.confirmedAt
      }))
    });
    
  } catch (error) {
    console.error('Erreur récupération alerte:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
