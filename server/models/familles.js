const mongoose = require("mongoose");

const familleSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
      maxLength: 30,
      minLength: 2,
    },
    description: {
      type: String,
      maxLength: 100, 
    },
    code_family: {
      type: String,
      required: true,
      unique: true,
      match: /^VF-[A-Za-z0-9]{4}$/ // Format VF-XXXX
    },
    createurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Personne",
      required: true
    },
    listeFamily: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Personne",
      },
    ],
    // Nouveau champ pour marquer une famille comme famille d'urgence
    urgence: {
      type: Boolean,
      default: false,
      index: true // Index pour améliorer les performances de recherche
    }
  },
  { 
    timestamps: true,
    // Index composé pour garantir qu'une seule famille d'urgence par créateur
    indexes: [
      { createurId: 1, urgence: 1 }
    ]
  }
);

// Index composé pour les requêtes fréquentes
familleSchema.index({ createurId: 1, urgence: 1 });
familleSchema.index({ code_family: 1 });

// Middleware pre-save pour s'assurer qu'une seule famille d'urgence par créateur
familleSchema.pre('save', async function(next) {
  console.log("Pre-save middleware - checking urgence constraint");
  
  // Si urgence est définie sur true
  if (this.urgence === true) {
    console.log("Family marked as urgent, checking for existing urgent families");
    
    // Désactiver l'urgence sur toutes les autres familles du même créateur
    await this.constructor.updateMany(
      { 
        createurId: this.createurId,
        _id: { $ne: this._id }, // Exclure la famille actuelle
        urgence: true
      },
      { $set: { urgence: false } }
    );
    
    console.log("Other urgent families deactivated");
  }
  
  next();
});

// Méthode statique pour obtenir la famille d'urgence d'un créateur
familleSchema.statics.getFamilleUrgence = function(createurId) {
  console.log("Getting emergency family for creator:", createurId);
  return this.findOne({ 
    createurId: createurId, 
    urgence: true 
  }).populate('listeFamily', 'nom prenom email telephone');
};

// Méthode d'instance pour vérifier si c'est une famille d'urgence
familleSchema.methods.isUrgence = function() {
  return this.urgence === true;
};

// Méthode d'instance pour définir comme famille d'urgence
familleSchema.methods.setAsUrgence = async function() {
  console.log("Setting family as emergency family");
  
  // Désactiver l'urgence sur les autres familles du créateur
  await this.constructor.updateMany(
    { 
      createurId: this.createurId,
      _id: { $ne: this._id }
    },
    { $set: { urgence: false } }
  );
  
  // Activer l'urgence sur cette famille
  this.urgence = true;
  return this.save();
};

// Méthode d'instance pour désactiver l'urgence
familleSchema.methods.unsetUrgence = function() {
  console.log("Unsetting emergency status for family");
  this.urgence = false;
  return this.save();
};

// Validation personnalisée pour s'assurer du respect de la contrainte d'urgence
familleSchema.post('save', async function(doc) {
  if (doc.urgence === true) {
    console.log("Post-save validation - verifying urgence constraint");
    
    // Vérifier qu'il n'y a qu'une seule famille d'urgence par créateur
    const urgentFamilies = await this.constructor.find({
      createurId: doc.createurId,
      urgence: true
    });
    
    if (urgentFamilies.length > 1) {
      console.error("CONSTRAINT VIOLATION: Multiple urgent families found for creator");
      // En production, vous pourriez vouloir déclencher une alerte ou corriger automatiquement
    }
  }
});

module.exports = mongoose.model("Famille", familleSchema);