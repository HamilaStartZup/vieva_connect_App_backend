const NotificationList = require("../models/notificationLists");
const Personne = require("../models/personnes");
const Famille = require("../models/familles");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const admin = require('../config/firebase-admin'); 
const PriseEnCharge = require('../models/priseEnCharge'); // ✅ DÉCOMMENTER

module.exports = {
  /**
   * Initialise ou met à jour la liste de notifications pour une personne âgée
   */
  initialiserListeNotifications: async (req, res) => {
    try {
      console.log("Starting notification list initialization");
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({ error: errors.array()[0].msg });
      }

      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ error: "Token d'authentification manquant" });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ error: "Token d'authentification invalide" });
      }

      const personneAgeeId = decodedToken._id;
      const { coordinates, rayonNotification } = req.body;

      // Validation des coordonnées
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        console.log("Invalid coordinates format:", coordinates);
        return res.status(422).json({ error: "Format de coordonnées invalide" });
      }

      console.log("Searching for existing notification list for user:", personneAgeeId);
      
      // Vérifier si une liste existe déjà
      let notificationList = await NotificationList.findOne({ personneAgeeId });
      
      if (notificationList) {
        console.log("Updating existing notification list");
        // Mettre à jour les coordonnées existantes
        notificationList.coordonneesPersonneAgee.coordinates = coordinates;
        notificationList.derniereMiseAJourPosition = new Date();
        if (rayonNotification) {
          notificationList.rayonNotification = rayonNotification;
        }
      } else {
        console.log("Creating new notification list");
        // Créer une nouvelle liste
        notificationList = new NotificationList({
          personneAgeeId,
          coordonneesPersonneAgee: {
            type: "Point",
            coordinates
          },
          rayonNotification: rayonNotification || 30,
          personnesANotifier: []
        });
      }

      await notificationList.save();
      console.log("Notification list saved successfully");
      
      res.status(200).json({ 
        message: "Liste de notifications initialisée avec succès",
        listId: notificationList._id
      });

    } catch (error) {
      console.error("Error in initialiserListeNotifications:", error.message);
      res.status(500).json({ error: "Erreur lors de l'initialisation de la liste" });
    }
  },

  /**
   * Vérifie la proximité d'une personne et met à jour la liste de notifications
   */
  verifierProximite: async (req, res) => {
    try {
      console.log("Starting proximity verification");
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({ error: errors.array()[0].msg });
      }

      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ error: "Token d'authentification manquant" });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ error: "Token d'authentification invalide" });
      }

      const personneId = decodedToken._id;
      const { coordinates, personneAgeeId } = req.body;

      // Validation des coordonnées
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        console.log("Invalid coordinates format:", coordinates);
        return res.status(422).json({ error: "Format de coordonnées invalide" });
      }

      console.log("Finding notification list for elderly person:", personneAgeeId);
      
      // Trouver la liste de notifications de la personne âgée
      const notificationList = await NotificationList.findOne({ 
        personneAgeeId,
        active: true 
      });

      if (!notificationList) {
        console.log("Notification list not found for elderly person:", personneAgeeId);
        return res.status(404).json({ error: "Liste de notifications non trouvée" });
      }

      // Vérifier si les personnes sont dans la même famille
      console.log("Checking family relationship");
      const famille = await Famille.findOne({
        listeFamily: { $all: [personneId, personneAgeeId] }
      });

      if (!famille) {
        console.log("Family relationship not found");
        return res.status(403).json({ error: "Relation familiale non trouvée" });
      }

      // Vérifier la proximité
      console.log("Checking proximity with elderly person coordinates");
      const estDansLeRayon = notificationList.estDansLeRayon(coordinates);
      const etaitDansLaListe = notificationList.personnesANotifier.some(
        p => p.personneId.toString() === personneId
      );

      console.log("Is within radius:", estDansLeRayon);
      console.log("Was in list:", etaitDansLaListe);

      let action = "aucune";
      
      if (estDansLeRayon && !etaitDansLaListe) {
        // Ajouter à la liste
        console.log("Adding person to notification list");
        notificationList.personnesANotifier.push({
          personneId,
          ajouteLe: new Date(),
          derniereVerification: new Date()
        });
        action = "ajoute";
      } else if (!estDansLeRayon && etaitDansLaListe) {
        // Retirer de la liste
        console.log("Removing person from notification list");
        notificationList.personnesANotifier = notificationList.personnesANotifier.filter(
          p => p.personneId.toString() !== personneId
        );
        action = "retire";
      } else if (estDansLeRayon && etaitDansLaListe) {
        // Mettre à jour la dernière vérification
        console.log("Updating last verification time");
        const personne = notificationList.personnesANotifier.find(
          p => p.personneId.toString() === personneId
        );
        if (personne) {
          personne.derniereVerification = new Date();
        }
        action = "maintenu";
      }

      await notificationList.save();
      console.log("Notification list updated, action:", action);

      res.status(200).json({
        message: "Vérification de proximité effectuée",
        action,
        dansLeRayon: estDansLeRayon,
        nombrePersonnesANotifier: notificationList.personnesANotifier.length
      });

    } catch (error) {
      console.error("Error in verifierProximite:", error.message);
      res.status(500).json({ error: "Erreur lors de la vérification de proximité" });
    }
  },

  /**
   * Récupère la liste des personnes à notifier pour une personne âgée
   */
  getPersonnesANotifier: async (req, res) => {
    try {
      console.log("Getting notification list");
      
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ error: "Token d'authentification manquant" });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ error: "Token d'authentification invalide" });
      }

      const personneAgeeId = decodedToken._id;
      
      console.log("Finding notification list for user:", personneAgeeId);
      
      const notificationList = await NotificationList.findOne({ 
        personneAgeeId,
        active: true 
      }).populate('personnesANotifier.personneId', 'nom prenom');

      if (!notificationList) {
        console.log("No notification list found");
        return res.status(200).json({ 
          personnesANotifier: [],
          message: "Aucune liste de notifications trouvée"
        });
      }

      console.log("Found notification list with", notificationList.personnesANotifier.length, "people");

      res.status(200).json({
        personnesANotifier: notificationList.personnesANotifier.map(p => ({
          personneId: p.personneId._id,
          nom: p.personneId.nom,
          prenom: p.personneId.prenom,
          ajouteLe: p.ajouteLe,
          derniereVerification: p.derniereVerification
        })),
        rayonNotification: notificationList.rayonNotification,
        derniereMiseAJourPosition: notificationList.derniereMiseAJourPosition
      });

    } catch (error) {
      console.error("Error in getPersonnesANotifier:", error.message);
      res.status(500).json({ error: "Erreur lors de la récupération de la liste" });
    }
  },

  /**
   * Déclenche une alerte d'urgence aux personnes dans la liste de notifications
   * ✅ MISE À JOUR AVEC FCM
   */
  declencherAlerteUrgence: async (req, res) => {
    try {
      console.log("Starting emergency alert");
      
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({ error: "Token d'authentification manquant" });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({ error: "Token d'authentification invalide" });
      }

      const personneAgeeId = decodedToken._id;
      const { typeAlerte, message, coordinates } = req.body; // ✅ AJOUT coordinates

      console.log("Finding notification list and elderly person info");
      
      // Récupérer les informations de la personne âgée
      const personneAgee = await Personne.findById(personneAgeeId);
      if (!personneAgee) {
        console.log("Elderly person not found");
        return res.status(404).json({ error: "Personne âgée non trouvée" });
      }

      // Récupérer la liste de notifications
      const notificationList = await NotificationList.findOne({ 
        personneAgeeId,
        active: true 
      }).populate('personnesANotifier.personneId', 'nom prenom email fcmToken'); // ✅ AJOUT fcmToken

      if (!notificationList || notificationList.personnesANotifier.length === 0) {
        console.log("No people to notify found");
        return res.status(200).json({ 
          message: "Alerte enregistrée mais aucune personne à proximité à notifier",
          personnesNotifiees: 0
        });
      }

      // ✅ ENREGISTRER L'ALERTE D'ABORD
      const Alerte = require("../models/alertes");
      const nouvelleAlerte = new Alerte({
        nom: `${personneAgee.prenom} ${personneAgee.nom}`,
        date: new Date(),
        type: typeAlerte || "urgence",
        personneAgeeId: personneAgeeId, // ✅ AJOUT du champ manquant
        coordonnees: coordinates ? {
          type: "Point", 
          coordinates: coordinates
        } : notificationList.coordonneesPersonneAgee
      });

      await nouvelleAlerte.save();
      console.log("Emergency alert saved to database with ID:", nouvelleAlerte._id);

      // ✅ ENVOYER LES NOTIFICATIONS FCM
      console.log("Sending FCM notifications to", notificationList.personnesANotifier.length, "people");
      
      let notificationsSent = 0;
      const personnesNotifiees = [];

      for (const personne of notificationList.personnesANotifier) {
        const user = personne.personneId;
        
        // Ajouter aux personnes notifiées
        personnesNotifiees.push({
          id: user._id,
          nom: user.nom,
          prenom: user.prenom
        });

        // Envoyer notification FCM si token disponible
        if (user.fcmToken) {
          try {
            console.log(`📱 Envoi notification FCM à ${user.prenom} ${user.nom}`);
            
            await admin.messaging().send({
              token: user.fcmToken,
              notification: {
                title: '🚨 Demande d\'aide urgente !',
                body: `${personneAgee.prenom} ${personneAgee.nom} a besoin d'aide`
              },
              data: {
                type: 'help_request',
                alerteId: nouvelleAlerte._id.toString(),
                elderlyName: `${personneAgee.prenom} ${personneAgee.nom}`,
                elderlyId: personneAgeeId.toString(),
                coordinates: JSON.stringify(nouvelleAlerte.coordonnees.coordinates),
                timestamp: new Date().toISOString()
              },
              android: {
                priority: 'high',
                notification: {
                  channelId: 'emergency_channel',
                  priority: 'high',
                  sound: 'default',
                  icon: 'ic_notification',
                  color: '#FFB84D'
                }
              },
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1,
                    alert: {
                      title: '🚨 Demande d\'aide urgente !',
                      body: `${personneAgee.prenom} ${personneAgee.nom} a besoin d'aide`
                    }
                  }
                }
              }
            });
            
            notificationsSent++;
            console.log(`✅ Notification FCM envoyée à ${user.prenom} ${user.nom}`);
            
          } catch (fcmError) {
            console.error(`❌ Erreur envoi FCM à ${user.prenom}:`, fcmError.message);
            
            // Si le token est invalide, le supprimer
            if (fcmError.code === 'messaging/registration-token-not-registered') {
              console.log(`🧹 Suppression du token FCM invalide pour ${user.prenom}`);
              await Personne.findByIdAndUpdate(user._id, { 
                $unset: { fcmToken: 1 } 
              });
            }
          }
        } else {
          console.log(`⚠️ Pas de token FCM pour ${user.prenom} ${user.nom}`);
        }
      }

      console.log(`📊 Résultat: ${notificationsSent}/${personnesNotifiees.length} notifications FCM envoyées`);
      console.log(`📊 RGPD Log - Emergency alert sent by ${personneAgee.prenom} ${personneAgee.nom}, IP: ${req.ip}`);

      res.status(200).json({
        message: "Alerte d'urgence déclenchée avec succès",
        personnesNotifiees: personnesNotifiees.length,
        notificationsFcmEnvoyees: notificationsSent,
        details: personnesNotifiees,
        alerteId: nouvelleAlerte._id
      });

    } catch (error) {
      console.error("Error in declencherAlerteUrgence:", error.message);
      res.status(500).json({ error: "Erreur lors du déclenchement de l'alerte" });
    }
  },

  /**
   * ✅ MISE À JOUR FCM TOKEN
   */
  updateFcmToken: async (req, res) => {
    try {
      const { fcmToken, platform, version } = req.body;
      
      const token = req.headers["authorization"];
      if (!token) {
        return res.status(401).json({ error: 'Token d\'authentification manquant' });
      }

      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        return res.status(401).json({ error: 'Token d\'authentification invalide' });
      }

      const userId = decodedToken._id;
      
      console.log(`🔔 Mise à jour du token FCM pour l'utilisateur ${userId}`);
      console.log(`📱 Platform: ${platform}, Token: ${fcmToken ? fcmToken.substring(0, 20) + '...' : 'null'}`);
      
      if (!fcmToken) {
        return res.status(422).json({ error: 'Token FCM requis' });
      }
      
      const user = await Personne.findByIdAndUpdate(
        userId,
        { 
          fcmToken: fcmToken,
          fcmTokenUpdatedAt: new Date(),
          deviceInfo: {
            platform: platform || null,
            version: version || null
          }
        },
        { new: true }
      );
      
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      console.log(`✅ Token FCM mis à jour avec succès pour ${user.prenom} ${user.nom}`);
      console.log(`📊 RGPD Log - FCM token updated for user ${user.prenom} ${user.nom}, IP: ${req.ip}`);
      
      res.json({ 
        message: 'Token FCM mis à jour avec succès',
        tokenUpdatedAt: user.fcmTokenUpdatedAt 
      });
      
    } catch (error) {
      console.error('❌ Erreur updateFcmToken:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * ✅ CONFIRMATION PRISE EN CHARGE
   */
  confirmerPriseEnCharge: async (req, res) => {
    try {
      const { alerteId, timestamp } = req.body;
      
      const token = req.headers["authorization"];
      if (!token) {
        return res.status(401).json({ error: 'Token d\'authentification manquant' });
      }

      let decodedToken;
      try {
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        return res.status(401).json({ error: 'Token d\'authentification invalide' });
      }

      const helperId = decodedToken._id;
      
      console.log(`✅ Confirmation de prise en charge par ${helperId} pour l'alerte ${alerteId}`);
      
      const Alerte = require("../models/alertes");
      const alerte = await Alerte.findById(alerteId);
      if (!alerte) {
        return res.status(404).json({ error: 'Alerte non trouvée' });
      }
      
      const existingConfirmation = await PriseEnCharge.findOne({
        alerteId: alerteId,
        helperId: helperId
      });
      
      if (existingConfirmation) {
        return res.status(400).json({ 
          error: 'Vous avez déjà confirmé votre prise en charge' 
        });
      }
      
      const confirmation = new PriseEnCharge({
        alerteId: alerteId,
        helperId: helperId,
        confirmedAt: timestamp || new Date(),
        status: 'confirmed'
      });
      
      await confirmation.save();
      console.log(`💾 Confirmation sauvegardée en base de données`);
      
      const helper = await Personne.findById(helperId);
      
      // ✅ NOTIFIER LA PERSONNE ÂGÉE VIA FCM
      const elderlyPerson = await Personne.findById(alerte.personneAgeeId);
      if (elderlyPerson && elderlyPerson.fcmToken) {
        try {
          console.log(`📱 Envoi notification de confirmation à ${elderlyPerson.prenom} ${elderlyPerson.nom}`);
          
          await admin.messaging().send({
            token: elderlyPerson.fcmToken,
            notification: {
              title: '✅ Aide en route !',
              body: `${helper.prenom} ${helper.nom} arrive pour vous aider`
            },
            data: {
              type: 'help_confirmed',
              alerteId: alerteId.toString(),
              helperName: `${helper.prenom} ${helper.nom}`,
              helperId: helperId.toString(),
              timestamp: new Date().toISOString()
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'emergency_channel',
                priority: 'high',
                sound: 'default',
                icon: 'ic_notification',
                color: '#28a745'
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            }
          });
          
          console.log(`✅ Notification de confirmation envoyée à la personne âgée`);
          
        } catch (fcmError) {
          console.error(`❌ Erreur envoi notification confirmation:`, fcmError.message);
        }
      } else {
        console.log(`⚠️ Pas de token FCM pour la personne âgée ${elderlyPerson?.prenom}`);
      }
      
      console.log(`📊 RGPD Log - Help confirmed by ${helper.prenom} ${helper.nom} for alert ${alerteId}, IP: ${req.ip}`);
      
      res.json({
        message: 'Prise en charge confirmée',
        alerteId: alerteId,
        helper: {
          id: helper._id,
          nom: helper.nom,
          prenom: helper.prenom
        },
        confirmedAt: confirmation.confirmedAt
      });
      
    } catch (error) {
      console.error('❌ Erreur confirmation:', error);
      res.status(500).json({ error: 'Erreur lors de la confirmation' });
    }
  }
};