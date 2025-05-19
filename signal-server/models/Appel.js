const mongoose = require("mongoose");

const appelSchema = new mongoose.Schema({
  appelId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  initiateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Personne',
    required: true,
  },
  destinataire: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Personne',
    required: true,
  },
  debut: {
    type: Date,
    default: Date.now,
  },
  fin: {
    type: Date,
  },
  duree: {
    type: Number, // en secondes
  },
  statut: {
    type: String,
    enum: ['initié', 'en_cours', 'terminé', 'manqué', 'refusé'],
    default: 'initié',
  },
  avecVideo: {
    type: Boolean,
    default: true,
  },
  consentementDonnées: {
    type: Boolean,
    default: false,
  },
  qualiteConnexion: {
    type: String,
    enum: ['excellente', 'bonne', 'moyenne', 'mauvaise'],
  },
  metadata: {
    type: Map,
    of: String,
  }
}, { 
  timestamps: true,
  // Index pour faciliter les requêtes par utilisateur
  indexes: [
    { initiateur: 1 },
    { destinataire: 1 },
    { createdAt: -1 }
  ]
});

// Méthode pour calculer automatiquement la durée
appelSchema.pre('save', function(next) {
  if (this.fin && this.debut) {
    this.duree = Math.round((this.fin - this.debut) / 1000);
  }
  next();
});

// Méthode de nettoyage RGPD - supprimer les données non essentielles
appelSchema.methods.sanitizeForGDPR = function() {
  // Conserver uniquement les données statistiques minimales
  this.metadata = undefined;
  return this;
};

// Méthode statique pour supprimer les appels plus anciens que la période de rétention
appelSchema.statics.cleanupOldCalls = async function(retentionDays) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate }
  });
};

module.exports = mongoose.model("Appel", appelSchema);