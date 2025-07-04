const mongoose = require('mongoose');

const priseEnChargeSchema = new mongoose.Schema({
  alerteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alerte',
    required: true
  },
  helperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Personne',
    required: true
  },
  confirmedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['confirmed', 'arrived', 'completed', 'cancelled'],
    default: 'confirmed'
  },
  arrivedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

priseEnChargeSchema.index({ alerteId: 1, helperId: 1 }, { unique: true });

module.exports = mongoose.model('PriseEnCharge', priseEnChargeSchema);