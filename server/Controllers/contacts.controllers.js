const Contact = require("../models/contacts");
const Personne = require("../models/personnes");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

/**
 * Contrôleur pour la gestion des contacts 
 */
module.exports = {
  /**
   * Créer un nouveau contact pour une personne âgée
   * POST /api/contacts/creer
   */
  creerContact: async (req, res) => {
    try {
      console.log("Starting contact creation process");

      // Validation des entrées
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      // Récupération et vérification du token JWT
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const personneAgeeId = decodedToken._id;

      // Vérification que l'utilisateur existe
      const personneAgee = await Personne.findById(personneAgeeId);
      if (!personneAgee) {
        console.log("User not found for ID:", personneAgeeId);
        return res.status(404).json({
          error: "Utilisateur non trouvé",
        });
      }

      // Récupération des données du contact
      const { nomComplet, telephone, email } = req.body;

      console.log("Creating contact with data:", { nomComplet, telephone, email });

      // Vérification que le contact n'existe pas déjà (même email)
      const contactExistant = await Contact.findOne({
        personneAgeeId,
        email: email.trim(),
        actif: true
      });

      if (contactExistant) {
        console.log("Contact already exists");
        return res.status(409).json({
          error: "Un contact avec cette adresse e-mail existe déjà",
        });
      }

      // Création du nouveau contact
      const nouveauContact = new Contact({
        personneAgeeId,
        nomComplet: nomComplet.trim(),
        telephone: telephone.trim(),
        email: email.trim()
      });

      // Sauvegarde en base de données
      const contactSauvegarde = await nouveauContact.save();
      console.log("Contact saved successfully with ID:", contactSauvegarde._id);

      // Réponse avec le contact créé
      res.status(201).json({
        message: "Contact créé avec succès",
        contact: contactSauvegarde.toDisplayFormat()
      });

    } catch (error) {
      console.error("Error in creerContact controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la création du contact",
      });
    }
  },

  /**
   * Modifier un contact existant
   * PUT /api/contacts/modifier/:contactId
   */
  modifierContact: async (req, res) => {
    try {
      console.log("Starting contact modification process");

      const { contactId } = req.params;

      // Validation des entrées
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(422).json({
          error: errors.array()[0].msg,
        });
      }

      // Récupération et vérification du token JWT
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const personneAgeeId = decodedToken._id;

      // Vérification que le contact existe et appartient à l'utilisateur
      const contact = await Contact.findOne({
        _id: contactId,
        personneAgeeId,
        actif: true
      });

      if (!contact) {
        console.log("Contact not found or unauthorized");
        return res.status(404).json({
          error: "Contact non trouvé",
        });
      }

      // Récupération des données à modifier
      const { nomComplet, telephone, email } = req.body;

      console.log("Modifying contact with new data:", { nomComplet, telephone, email });

      // Vérification des doublons si email modifié
      if (email) {
        const contactExistant = await Contact.findOne({
          _id: { $ne: contactId }, // Exclure le contact actuel
          personneAgeeId,
          email: email.trim(),
          actif: true
        });

        if (contactExistant) {
          console.log("Duplicate contact would be created");
          return res.status(409).json({
            error: "Un contact avec cette adresse e-mail existe déjà",
          });
        }
      }

      // Mise à jour des champs modifiés
      if (nomComplet) contact.nomComplet = nomComplet.trim();
      if (telephone) contact.telephone = telephone.trim();
      if (email) contact.email = email.trim();

      // Sauvegarde des modifications
      const contactModifie = await contact.save();
      console.log("Contact modified successfully");

      res.status(200).json({
        message: "Contact modifié avec succès",
        contact: contactModifie.toDisplayFormat()
      });

    } catch (error) {
      console.error("Error in modifierContact controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la modification du contact",
      });
    }
  },

  /**
   * Récupérer tous les contacts d'une personne âgée
   * GET /api/contacts/liste
   */
  obtenirContacts: async (req, res) => {
    try {
      console.log("Getting contacts list");

      // Récupération et vérification du token JWT
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const personneAgeeId = decodedToken._id;

      // Récupération des contacts triés alphabétiquement
      console.log("Fetching contacts for user:", personneAgeeId);
      const contacts = await Contact.getContactsActifs(personneAgeeId);

      const contactsFormates = contacts.map(contact => contact.toDisplayFormat());

      console.log("Found", contacts.length, "contacts");

      res.status(200).json({
        message: "Contacts récupérés avec succès",
        nombreContacts: contacts.length,
        contacts: contactsFormates
      });

    } catch (error) {
      console.error("Error in obtenirContacts controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération des contacts",
      });
    }
  },

  /**
   * Supprimer un contact (désactivation)
   * DELETE /api/contacts/supprimer/:contactId
   */
  supprimerContact: async (req, res) => {
    try {
      console.log("Starting contact deletion process");

      const { contactId } = req.params;

      // Récupération et vérification du token JWT
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const personneAgeeId = decodedToken._id;

      // Vérification que le contact existe et appartient à l'utilisateur
      const contact = await Contact.findOne({
        _id: contactId,
        personneAgeeId,
        actif: true
      });

      if (!contact) {
        console.log("Contact not found or unauthorized");
        return res.status(404).json({
          error: "Contact non trouvé",
        });
      }

      // Désactivation du contact (soft delete pour conformité RGPD)
      contact.actif = false;
      await contact.save();

      console.log("Contact deactivated successfully");

      res.status(200).json({
        message: "Contact supprimé avec succès"
      });

    } catch (error) {
      console.error("Error in supprimerContact controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la suppression du contact",
      });
    }
  },

  /**
   * Obtenir un contact spécifique par son ID
   * GET /api/contacts/:contactId
   */
  obtenirContact: async (req, res) => {
    try {
      console.log("Getting specific contact");

      const { contactId } = req.params;

      // Récupération et vérification du token JWT
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      const personneAgeeId = decodedToken._id;

      // Récupération du contact
      const contact = await Contact.findOne({
        _id: contactId,
        personneAgeeId,
        actif: true
      });

      if (!contact) {
        console.log("Contact not found");
        return res.status(404).json({
          error: "Contact non trouvé",
        });
      }

      console.log("Contact found and returned");

      res.status(200).json({
        message: "Contact récupéré avec succès",
        contact: contact.toDisplayFormat()
      });

    } catch (error) {
      console.error("Error in obtenirContact controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la récupération du contact",
      });
    }
  },

  /**
   * Vérifier quels numéros de téléphone correspondent à des utilisateurs de l'app
   * POST /api/contacts/verifier-utilisateurs
   */
  verifierUtilisateursParTelephone: async (req, res) => {
    try {
      console.log("Starting phone number verification process");

      // Récupération et vérification du token JWT
      const token = req.headers["authorization"];
      if (!token) {
        console.log("Missing authentication token");
        return res.status(401).json({
          error: "Token d'authentification manquant",
        });
      }

      let decodedToken;
      try {
        console.log("Verifying token...");
        decodedToken = jwt.verify(token.split(' ')[1], "shhhhh");
      } catch (error) {
        console.log("Invalid authentication token:", error.message);
        return res.status(401).json({
          error: "Token d'authentification invalide",
        });
      }

      // Récupération des numéros de téléphone à vérifier
      const { numeros } = req.body;

      if (!numeros || !Array.isArray(numeros) || numeros.length === 0) {
        return res.status(400).json({
          error: "Liste de numéros de téléphone requise",
        });
      }

      console.log("Verifying phone numbers:", numeros);

      // Nettoyer et normaliser les numéros de téléphone
      const numerosNettoyes = numeros.map(numero => {
        // Supprimer espaces, tirets, parenthèses et autres caractères
        return numero.replace(/\s+/g, '').replace(/[-().]/g, '');
      });

      // Rechercher les utilisateurs correspondant aux numéros
      const utilisateursCorrespondants = await Personne.find({
        telephone: { $in: numerosNettoyes }
      }).select('_id nom prenom telephone');

      console.log(`Found ${utilisateursCorrespondants.length} matching users`);

      // Formater la réponse
      const resultats = utilisateursCorrespondants.map(user => ({
        id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone
      }));

      res.status(200).json({
        message: "Vérification terminée",
        nombreCorrespondances: resultats.length,
        utilisateurs: resultats
      });

    } catch (error) {
      console.error("Error in verifierUtilisateursParTelephone controller:", error.message);
      res.status(500).json({
        error: "Erreur lors de la vérification des utilisateurs",
      });
    }
  }
};
