const NotificationList = require("../models/notificationLists");
const Personne = require("../models/personnes");
const Famille = require("../models/familles");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

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
      const { typeAlerte, message } = req.body;

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
      }).populate('personnesANotifier.personneId', 'nom prenom email');

      if (!notificationList || notificationList.personnesANotifier.length === 0) {
        console.log("No people to notify found");
        return res.status(200).json({ 
          message: "Alerte enregistrée mais aucune personne à proximité à notifier",
          personnesNotifiees: 0
        });
      }

      // TODO: Ici vous pourrez intégrer votre système de notifications push
      // Pour l'instant, on simule l'envoi des notifications
      console.log("Simulating emergency notifications to", notificationList.personnesANotifier.length, "people");
      
      const personnesNotifiees = notificationList.personnesANotifier.map(p => ({
        id: p.personneId._id,
        nom: p.personneId.nom,
        prenom: p.personneId.prenom
      }));

      // Enregistrer l'alerte dans la base de données
      const Alerte = require("../models/alertes");
      const nouvelleAlerte = new Alerte({
        nom: `${personneAgee.prenom} ${personneAgee.nom}`,
        date: new Date(),
        type: typeAlerte || "urgence",
        coordonnees: notificationList.coordonneesPersonneAgee
      });

      await nouvelleAlerte.save();
      console.log("Emergency alert saved to database");

      res.status(200).json({
        message: "Alerte d'urgence déclenchée avec succès",
        personnesNotifiees: personnesNotifiees.length,
        details: personnesNotifiees,
        alerteId: nouvelleAlerte._id
      });

    } catch (error) {
      console.error("Error in declencherAlerteUrgence:", error.message);
      res.status(500).json({ error: "Erreur lors du déclenchement de l'alerte" });
    }
  }
};