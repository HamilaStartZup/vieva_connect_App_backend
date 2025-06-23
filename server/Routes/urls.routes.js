/**
 * Routes/urls.routes.js - Backend simplifié
 * Redirection deeplink vers app mobile
 */

const express = require('express');
const router = express.Router();
const Url = require('../models/urls');
const Famille = require('../models/familles');
const jwtToken = require('jsonwebtoken');

/**
 * Route deeplink - redirige vers l'app mobile
 * @route GET /u/:shortUrl
 */
router.get('/u/:shortUrl', async (req, res) => {
  try {
    console.log(`🔗 Processing deeplink: ${req.params.shortUrl}`);
    
    const { shortUrl } = req.params;
    
    // Recherche URL courte
    const urlDoc = await Url.findOne({ shortUrl });
    if (!urlDoc) {
      console.log(`❌ Short URL not found: ${shortUrl}`);
      return res.status(404).send('Lien invalide');
    }

    // Vérifier si c'est un deeplink famille
    const familyIdMatch = urlDoc.longUrl.match(/\/joinFamilyByDeeplink\/([^\/\?]+)/);
    
    if (!familyIdMatch) {
      // URL normale - redirection classique
      console.log(`🔗 Normal URL redirection`);
      return res.redirect(301, urlDoc.longUrl);
    }

    // Deeplink famille
    const familyId = familyIdMatch[1];
    console.log(`🏠 Family ID: ${familyId}`);

    // Recherche famille
    const famille = await Famille.findById(familyId);
    if (!famille) {
      console.log(`❌ Family not found: ${familyId}`);
      return res.status(404).send('Famille introuvable');
    }

    console.log(`✅ Found family: ${famille.nom}`);

    // Vérification token
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    let userAction = 'need_login';
    let userId = null;

    if (token) {
      try {
        console.log(`🔐 Verifying token`);
        const decoded = jwtToken.verify(token, "shhhhh");
        userId = decoded._id;
        
        if (famille.listeFamily.includes(userId)) {
          userAction = 'already_member';
          console.log(`👥 User already member`);
        } else {
          console.log(`➕ Adding user to family`);
          famille.listeFamily.push(userId);
          await famille.save();
          userAction = 'auto_joined';
          console.log(`✅ User added`);
        }
        
      } catch (error) {
        console.log(`❌ Token invalid: ${error.message}`);
        userAction = 'token_expired';
      }
    } else {
      console.log(`🔒 No token - need login`);
    }

    // Données pour l'app mobile
    const appData = {
      action: userAction,
      family: {
        nom: famille.nom,
        description: famille.description,
        code_family: famille.code_family
      }
    };

    // Redirection vers l'app
    const encodedData = encodeURIComponent(JSON.stringify(appData));
    const mobileDeeplink = `grandpaapp://?data=${encodedData}`;

    console.log(`📱 Redirecting - Action: ${userAction}`);
    console.log(`📊 RGPD Log - Family: ${famille.nom}, Action: ${userAction}, IP: ${req.ip}`);

    return res.redirect(302, mobileDeeplink);

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
    return res.status(500).send('Erreur serveur');
  }
});

module.exports = router;