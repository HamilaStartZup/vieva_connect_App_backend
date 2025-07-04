var admin = require("firebase-admin");

var serviceAccount = require("../.well-known/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('✅ Firebase Admin SDK initialisé avec succès');

module.exports = admin;