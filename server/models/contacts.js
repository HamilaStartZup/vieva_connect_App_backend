const mongoose = require("mongoose");

/**
 * Schéma pour les contacts d'urgence liés aux personnes âgées
 * Un contact peut être une personne qui n'a pas de compte dans l'application
 * mais qui doit être joignable en cas d'urgence
 */
const contactSchema = new mongoose.Schema({
  // Référence vers la personne âgée qui possède ce contact
  personneAgeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Personne",
    required: true,
    index: true // Index pour optimiser les requêtes par personne âgée
  },
  
  // Nom complet du contact
  nomComplet: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100,
    minLength: 2
  },
  
  // Numéro de téléphone (obligatoire)
  telephone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Validation basique pour les numéros français et internationaux
        return /^[\+]?[0-9\s\-\(\)]{10,20}$/.test(v);
      },
      message: "Numéro de téléphone invalide"
    }
  },
  
  // Adresse e-mail (obligatoire)
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: "Adresse e-mail invalide"
    }
  },
  
  // Statut actif/inactif du contact
  actif: {
    type: Boolean,
    default: true
  }
  
}, { 
  timestamps: true 
});

// Index composé pour optimiser les requêtes
contactSchema.index({ personneAgeeId: 1, actif: 1 });

// Méthode statique pour récupérer les contacts actifs
contactSchema.statics.getContactsActifs = function(personneAgeeId) {
  console.log("Getting active contacts for person:", personneAgeeId);
  return this.find({ 
    personneAgeeId, 
    actif: true 
  }).sort({ 
    nomComplet: 1 // Tri alphabétique par nom
  });
};

// Méthode pour formater le contact pour l'affichage
contactSchema.methods.toDisplayFormat = function() {
  return {
    id: this._id,
    nomComplet: this.nomComplet,
    telephone: this.telephone,
    email: this.email,
    actif: this.actif,
    dateCreation: this.createdAt,
    derniereMiseAJour: this.updatedAt
  };
};

module.exports = mongoose.model("Contact", contactSchema);
