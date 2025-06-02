const mongoose = require("mongoose");

/**
 * Schéma pour gérer les listes de notifications de proximité
 * Chaque personne âgée aura une liste des personnes à notifier
 * en fonction de leur proximité géographique
 * 
 * RGPD: Les coordonnées sont temporaires et utilisées uniquement 
 * pour le calcul de proximité, pas de stockage permanent des positions
 */
const notificationListSchema = new mongoose.Schema({
  // ID de la personne âgée (propriétaire de la liste)
  personneAgeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Personne",
    required: true,
    unique: true // Une seule liste par personne âgée
  },
  
  // Coordonnées actuelles de la personne âgée (temporaires, RGPD compliant)
  coordonneesPersonneAgee: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: "2dsphere"
    }
  },
  
  // Liste des personnes actuellement dans le rayon de 30km
  personnesANotifier: [{
    personneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Personne",
      required: true
    },
    // Timestamp de l'ajout dans la liste pour tracking
    ajouteLe: {
      type: Date,
      default: Date.now
    },
    // Dernière vérification de proximité
    derniereVerification: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Rayon de notification en kilomètres (par défaut 30km)
  rayonNotification: {
    type: Number,
    default: 30,
    min: 1,
    max: 100
  },
  
  // Statut de la liste (active/inactive)
  active: {
    type: Boolean,
    default: true
  },
  
  // Dernière mise à jour de la position de la personne âgée
  derniereMiseAJourPosition: {
    type: Date,
    default: Date.now
  }
  
}, { 
  timestamps: true,
  // Index TTL pour supprimer automatiquement les anciennes données (RGPD)
  index: { "updatedAt": 1 },
  expireAfterSeconds: 30 * 24 * 60 * 60 // 30 jours
});

// Index composé pour les requêtes de proximité
notificationListSchema.index({ 
  "coordonneesPersonneAgee": "2dsphere",
  "personneAgeeId": 1,
  "active": 1 
});

// Méthode pour calculer la distance entre deux points
notificationListSchema.methods.calculerDistance = function(coord1, coord2) {
  console.log("Calculating distance between coordinates:", coord1, coord2);
  
  const R = 6371; // Rayon de la Terre en km
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  console.log("Calculated distance:", distance, "km");
  return distance;
};

// Méthode pour vérifier si une personne est dans le rayon
notificationListSchema.methods.estDansLeRayon = function(coordonneesPersonne) {
  console.log("Checking if person is within radius");
  const distance = this.calculerDistance(
    this.coordonneesPersonneAgee.coordinates,
    coordonneesPersonne
  );
  return distance <= this.rayonNotification;
};

module.exports = mongoose.model("NotificationList", notificationListSchema);