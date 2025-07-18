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
    console.log("🔧 NotificationService: Initializing notification list for user:", personneAgeeId);
    console.log("🔧 Options received:", options);
    
    const {
      coordinates,
      rayonNotification = 30,
      forceCreate = false
    } = options;

    // ✅ VALIDATION OBLIGATOIRE des coordonnées
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      console.error("❌ NotificationService: Missing or invalid coordinates:", coordinates);
      throw new Error('Coordonnées GPS valides requises pour initialiser la liste de notifications');
    }

    const [longitude, latitude] = coordinates;
    
    if (isNaN(longitude) || isNaN(latitude)) {
      console.error("❌ NotificationService: Invalid coordinate values:", coordinates);
      throw new Error('Coordonnées GPS invalides');
    }

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      console.error("❌ NotificationService: Coordinates out of geographic range:", coordinates);
      throw new Error('Coordonnées GPS hors de la plage géographique valide');
    }

    console.log("✅ NotificationService: Valid coordinates confirmed:", coordinates);

    // Vérifier s'il existe déjà une liste active
    const existingList = await NotificationList.findOne({
      personneAgeeId,
      active: true
    });

    if (existingList && !forceCreate) {
      console.log("📋 NotificationService: Active notification list already exists, updating coordinates");
      existingList.coordonneesPersonneAgee.coordinates = coordinates;
      existingList.derniereMiseAJourPosition = new Date();
      await existingList.save();
      console.log("✅ NotificationService: Existing list updated with new coordinates");
      return existingList;
    }

    if (existingList && forceCreate) {
      console.log("🔄 NotificationService: Force creating new list, deactivating existing one");
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
    console.log("✅ NotificationService: New notification list created successfully:");
    console.log("✅ List ID:", listeSauvegardee._id);
    console.log("✅ List coordinates:", listeSauvegardee.coordonneesPersonneAgee.coordinates);
    console.log("✅ List radius:", listeSauvegardee.rayonNotification, "km");
    
    return listeSauvegardee;

  } catch (error) {
    console.error("❌ NotificationService: Error initializing notification list:", error.message);
    throw error;
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
  static async handleFamilyUrgencyChange(createurId, isUrgentFamily, coordinates = null) {
  console.log("🔧 NotificationService: Starting handleFamilyUrgencyChange");
  console.log("🔧 Params:", { createurId, isUrgentFamily, coordinates });
  
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
      // ✅ OBLIGATOIRE : Coordonnées requises pour créer une liste de notifications
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        console.error("❌ NotificationService: Cannot create urgent family notification list without coordinates");
        result.error = "Coordonnées GPS requises pour créer une liste de notifications d'urgence";
        return result;
      }

      const [longitude, latitude] = coordinates;
      
      // Validation des coordonnées
      if (isNaN(longitude) || isNaN(latitude)) {
        console.error("❌ NotificationService: Invalid coordinate values:", coordinates);
        result.error = "Coordonnées GPS invalides";
        return result;
      }

      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        console.error("❌ NotificationService: Coordinates out of geographic range:", coordinates);
        result.error = "Coordonnées GPS hors de la plage géographique valide";
        return result;
      }

      console.log("✅ NotificationService: Creating urgent family notification list with coordinates:", coordinates);
      
      // Créer/réactiver la liste avec les coordonnées fournies
      const liste = await this.reactivateOrCreateNotificationList(createurId, {
        coordinates: coordinates,
        rayonNotification: 30
      });

      if (liste) {
        result.success = true;
        result.action = 'created_or_reactivated';
        result.notificationListId = liste._id;
        console.log("✅ NotificationService: Notification list created successfully with ID:", liste._id);
        console.log("✅ NotificationService: List coordinates:", liste.coordonneesPersonneAgee.coordinates);
      } else {
        result.error = "Échec de la création de la liste de notifications";
        console.error("❌ NotificationService: Failed to create notification list");
      }
    } else {
      // Ce n'est plus une famille d'urgence, désactiver les listes
      console.log("🔄 NotificationService: Deactivating notification lists for non-urgent family");
      const deactivatedCount = await this.deactivateAllNotificationLists(createurId);
      result.success = true;
      result.action = 'deactivated';
      result.deactivatedCount = deactivatedCount;
      console.log("✅ NotificationService: Notification lists deactivated:", deactivatedCount);
    }

  } catch (error) {
    console.error("❌ NotificationService: Error handling family urgency change:", error.message);
    result.error = error.message;
  }

  console.log("🔧 NotificationService: handleFamilyUrgencyChange result:", result);
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