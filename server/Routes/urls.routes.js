/**
 * Routes/urls.routes.js CORRIGÉ
 * Debug ajouté pour identifier pourquoi l'app ne récupère pas les données
 */

const express = require('express');
const router = express.Router();
const Url = require('../models/urls');
const Famille = require('../models/familles');
const jwtToken = require('jsonwebtoken');

/**
 * Route deeplink avec debug complet
 * @route GET /u/:shortUrl
 */
router.get('/u/:shortUrl', async (req, res) => {
  try {
    console.log(`🔗 Processing deeplink: ${req.params.shortUrl}`);
    console.log(`📱 User-Agent: ${req.get('User-Agent')}`);
    
    const { shortUrl } = req.params;
    
    // Recherche URL courte
    const urlDoc = await Url.findOne({ shortUrl });
    if (!urlDoc) {
      console.log(`❌ Short URL not found: ${shortUrl}`);
      return res.status(404).send('Lien invalide');
    }

    console.log(`✅ Found URL: ${urlDoc.longUrl}`);

    // Vérifier si c'est un deeplink famille
    const familyIdMatch = urlDoc.longUrl.match(/\/joinFamilyByDeeplink\/([^\/\?]+)/);
    
    if (!familyIdMatch) {
      // URL normale
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
    console.log(`🔍 Family data check:`, {
      nom: famille.nom,
      description: famille.description,
      code_family: famille.code_family
    });

    // ⚠️ VÉRIFICATION: S'assurer que toutes les données existent
    if (!famille.nom || !famille.description || !famille.code_family) {
      console.error(`❌ Missing family data:`, {
        nom: !!famille.nom,
        description: !!famille.description,
        code_family: !!famille.code_family
      });
    }

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

    // ✅ FORMAT EXACT 
    const appData = {
      action: userAction,
      family: {
        nom: famille.nom,
        description: famille.description,
        code_family: famille.code_family
      }
    };

    // ⚠️ DEBUG COMPLET: Vérifier chaque étape
    console.log("🐛 === DEBUG DEEPLINK FORMAT ===");
    console.log("🐛 1. Raw appData:", appData);
    console.log("🐛 2. JSON.stringify:", JSON.stringify(appData));
    
    const jsonString = JSON.stringify(appData);
    console.log("🐛 3. JSON string length:", jsonString.length);
    
    const encodedData = encodeURIComponent(jsonString);
    console.log("🐛 4. Encoded data:", encodedData);
    console.log("🐛 5. Encoded length:", encodedData.length);
    
    const mobileDeeplink = `grandpaapp://?data=${encodedData}`;
    console.log("🐛 6. Final deeplink:", mobileDeeplink);
    console.log("🐛 7. Total length:", mobileDeeplink.length);

    // ⚠️ TEST DE DÉCODAGE pour s'assurer que ça marche
    try {
      const testDecode = decodeURIComponent(encodedData);
      const testParse = JSON.parse(testDecode);
      console.log("✅ Test décodage OK:", testParse);
      console.log("✅ Action récupérée:", testParse.action);
      console.log("✅ Code famille récupéré:", testParse.family?.code_family);
      
      // Vérifier structure exacte
      const hasRequiredFields = testParse.action && 
                               testParse.family && 
                               testParse.family.nom && 
                               testParse.family.description && 
                               testParse.family.code_family;
      console.log("✅ Structure complète:", hasRequiredFields);
      
    } catch (error) {
      console.error("❌ ERREUR test décodage:", error.message);
      console.error("❌ Données problématiques:", encodedData);
    }

    // ⚠️ COMPARAISON avec format attendu exact
    const expectedSample = {
      action: "need_login",
      family: {
        nom: "Family urgence",
        description: "famille d'urgence",
        code_family: "VF-zTLS"
      }
    };
    const expectedEncoded = encodeURIComponent(JSON.stringify(expectedSample));
    console.log("🎯 Format attendu exemple:", `grandpaapp://?data=${expectedEncoded}`);
    console.log("🎯 Format généré actuel:", mobileDeeplink);

    // ⚠️ VÉRIFICATION caractères spéciaux
    const hasSpecialChars = jsonString.includes('"') || 
                           jsonString.includes("'") || 
                           jsonString.includes('\\');
    console.log("🔍 Caractères spéciaux détectés:", hasSpecialChars);

    console.log(`📱 Redirecting - Action: ${userAction}`);
    console.log(`📊 RGPD Log - Family: ${famille.nom}, Action: ${userAction}, IP: ${req.ip}`);

    // ⚠️ POINT CRITIQUE: Redirection vers l'app
    console.log("🚀 REDIRECTION VERS L'APP...");
    return res.redirect(302, mobileDeeplink);

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
    console.error(`💥 Stack: ${error.stack}`);
    return res.status(500).send('Erreur serveur');
  }
});


module.exports = router;