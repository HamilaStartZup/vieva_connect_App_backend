// utils/notificationInitializationService.js
const NotificationList = require('../models/notificationLists');

/**
 * Service pour gérer l'initialisation automatique des listes de notifications
 * lors de la création ou modification de familles d'urgence
 */
class NotificationInitializationService {
  
  /**
   * Initialise une liste de notifications pour une personne âgée
   * @param {String} personneAgeeId - ID de la personne âgée
   * @param {Object} options - Options d'initialisation
   * @returns {Promise<Object|null>} Liste créée ou null si erreur
   */
  static async initializeNotificationList(personneAgeeId, options = {}) {
    try {
      console.log("NotificationService: Initializing notification list for user:", personneAgeeId);
      
      const {
        coordinates = [0, 0], // Coordonnées par défaut
        rayonNotification = 30, // 30km par défaut
        forceCreate = false // Force la création même si une liste existe
      } = options;

      // Vérifier s'il existe déjà une liste active
      const existingList = await NotificationList.findOne({
        personneAgeeId,
        active: true
      });

      if (existingList && !forceCreate) {
        console.log("NotificationService: Active notification list already exists, skipping creation");
        return existingList;
      }

      if (existingList && forceCreate) {
        console.log("NotificationService: Force creating new list, deactivating existing one");
        existingList.active = false;
        await existingList.save();
      }

      // Créer une nouvelle liste de notifications
      const nouvelleListeNotification = new NotificationList({
        personneAgeeId,
        coordonneesPersonneAgee: {
          type: "Point",
          coordinates
        },
        rayonNotification,
        personnesANotifier: [],
        active: true
      });

      const listeSauvegardee = await nouvelleListeNotification.save();
      console.log("NotificationService: Notification list created successfully:", listeSauvegardee._id);
      
      return listeSauvegardee;

    } catch (error) {
      console.error("NotificationService: Error initializing notification list:", error.message);
      return null;
    }
  }

  /**
   * Désactive toutes les listes de notifications actives pour un utilisateur
   * @param {String} personneAgeeId - ID de la personne âgée
   * @returns {Promise<Number>} Nombre de listes désactivées
   */
  static async deactivateAllNotificationLists(personneAgeeId) {
    try {
      console.log("NotificationService: Deactivating all notification lists for user:", personneAgeeId);
      
      const result = await NotificationList.updateMany(
        { 
          personneAgeeId, 
          active: true 
        },
        { 
          $set: { 
            active: false,
            personnesANotifier: [] // Reset de la liste des personnes à notifier
          } 
        }
      );

      console.log("NotificationService: Deactivated", result.modifiedCount, "notification lists");
      return result.modifiedCount;

    } catch (error) {
      console.error("NotificationService: Error deactivating notification lists:", error.message);
      return 0;
    }
  }

  /**
   * Réactive une liste de notifications existante ou en crée une nouvelle
   * @param {String} personneAgeeId - ID de la personne âgée
   * @param {Object} options - Options de réactivation
   * @returns {Promise<Object|null>} Liste réactivée/créée ou null si erreur
   */
  static async reactivateOrCreateNotificationList(personneAgeeId, options = {}) {
    try {
      console.log("NotificationService: Reactivating or creating notification list for user:", personneAgeeId);
      
      // D'abord désactiver toutes les listes existantes
      await this.deactivateAllNotificationLists(personneAgeeId);

      // Chercher une liste existante (même inactive) pour la réactiver
      const existingList = await NotificationList.findOne({
        personneAgeeId
      }).sort({ updatedAt: -1 }); // La plus récente

      if (existingList) {
        console.log("NotificationService: Reactivating existing notification list:", existingList._id);
        
        existingList.active = true;
        existingList.personnesANotifier = []; // Reset de la liste
        existingList.rayonNotification = options.rayonNotification || existingList.rayonNotification;
        
        // Mettre à jour les coordonnées si fournies
        if (options.coordinates) {
          existingList.coordonneesPersonneAgee.coordinates = options.coordinates;
        }
        
        const listeReactivee = await existingList.save();
        console.log("NotificationService: Notification list reactivated successfully");
        return listeReactivee;
      }

      // Aucune liste existante, en créer une nouvelle
      console.log("NotificationService: No existing list found, creating new one");
      return await this.initializeNotificationList(personneAgeeId, options);

    } catch (error) {
      console.error("NotificationService: Error reactivating/creating notification list:", error.message);
      return null;
    }
  }

  /**
   * Vérifie et initialise la liste de notifications pour une famille d'urgence
   * Utilisé lors de la création/modification de familles
   * @param {String} createurId - ID du créateur de la famille
   * @param {Boolean} isUrgentFamily - Si c'est une famille d'urgence
   * @returns {Promise<Object>} Résultat de l'opération
   */
  static async handleFamilyUrgencyChange(createurId, isUrgentFamily) {
    const result = {
      success: false,
      action: null,
      notificationListId: null,
      error: null
    };

    try {
      console.log("NotificationService: Handling family urgency change for user:", createurId);
      console.log("NotificationService: Is urgent family:", isUrgentFamily);

      if (isUrgentFamily) {
        // C'est une famille d'urgence, initialiser/réactiver la liste
        const liste = await this.reactivateOrCreateNotificationList(createurId, {
          coordinates: [0, 0], // Coordonnées par défaut, seront mises à jour lors de la première alerte
          rayonNotification: 30
        });

        if (liste) {
          result.success = true;
          result.action = 'created_or_reactivated';
          result.notificationListId = liste._id;
          console.log("NotificationService: Notification list successfully handled for urgent family");
        } else {
          result.error = "Failed to create/reactivate notification list";
          console.error("NotificationService: Failed to handle notification list for urgent family");
        }
      } else {
        // Ce n'est plus une famille d'urgence, désactiver les listes
        const deactivatedCount = await this.deactivateAllNotificationLists(createurId);
        result.success = true;
        result.action = 'deactivated';
        result.deactivatedCount = deactivatedCount;
        console.log("NotificationService: Notification lists deactivated for non-urgent family");
      }

    } catch (error) {
      console.error("NotificationService: Error handling family urgency change:", error.message);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Obtient le statut de la liste de notifications pour un utilisateur
   * @param {String} personneAgeeId - ID de la personne âgée
   * @returns {Promise<Object>} Statut de la liste
   */
  static async getNotificationListStatus(personneAgeeId) {
    try {
      console.log("NotificationService: Getting notification list status for user:", personneAgeeId);
      
      const activeList = await NotificationList.findOne({
        personneAgeeId,
        active: true
      });

      const totalLists = await NotificationList.countDocuments({ personneAgeeId });

      const status = {
        hasActiveList: !!activeList,
        activeListId: activeList?._id || null,
        totalLists,
        rayonNotification: activeList?.rayonNotification || null,
        personnesANotifier: activeList?.personnesANotifier?.length || 0,
        lastUpdate: activeList?.updatedAt || null
      };

      console.log("NotificationService: Notification list status:", status);
      return status;

    } catch (error) {
      console.error("NotificationService: Error getting notification list status:", error.message);
      return {
        hasActiveList: false,
        error: error.message
      };
    }
  }
}

module.exports = NotificationInitializationService;