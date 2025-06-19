// routes/urls.js
const express = require('express');
const router = express.Router();
const Url = require('../models/urls');
const Famille = require('../models/familles');
const jwtToken = require('jsonwebtoken');

router.get('/:shortUrl', async (req, res) => {
  try {
    console.log(`🔗 Deeplink: ${req.params.shortUrl}`);
    
    const { shortUrl } = req.params;
    
    // Trouver l'URL
    const urlDoc = await Url.findOne({ shortUrl });
    if (!urlDoc) {
      return res.status(404).json({ 
        error: 'Lien invalide'
      });
    }

    // Extraire l'ID famille
    const familyIdMatch = urlDoc.longUrl.match(/\/joinFamilyByDeeplink\/([^\/\?]+)/);
    const familyId = familyIdMatch[1];

    // Trouver la famille
    const famille = await Famille.findById(familyId);
    if (!famille) {
      return res.status(404).json({ error: 'Famille non trouvée' });
    }

    // Vérifier le token
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // Pas connecté
      return res.status(401).json({
        action: 'need_login',
        family: {
          nom: famille.nom,
          description: famille.description
        }
      });
    }

    // Token présent
    let userId;
    try {
      const decoded = jwtToken.verify(token, "shhhhh");
      userId = decoded._id;
    } catch (error) {
      return res.status(401).json({
        action: 'token_expired',
        family: { nom: famille.nom }
      });
    }

    // Vérifier si déjà membre
    if (famille.listeFamily.includes(userId)) {
      return res.status(200).json({
        success: true,
        action: 'already_member',
        family: { nom: famille.nom }
      });
    }

    // Ajouter à la famille
    famille.listeFamily.push(userId);
    await famille.save();

    return res.status(200).json({
      success: true,
      action: 'added',
      message: `Ajouté à ${famille.nom}`,
      family: { nom: famille.nom }
    });

  } catch (error) {
    console.error('Erreur:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;