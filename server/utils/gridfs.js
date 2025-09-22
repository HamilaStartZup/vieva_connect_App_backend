const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let bucket;

// Initialiser GridFS une fois la connexion MongoDB établie
const initGridFS = () => {
  const db = mongoose.connection.db;
  bucket = new GridFSBucket(db, {
    bucketName: 'uploads' // Collection prefix: uploads.files et uploads.chunks
  });
  console.log('GridFS bucket initialized');
  return bucket;
};

// Obtenir le bucket GridFS
const getGridFSBucket = () => {
  if (!bucket) {
    return initGridFS();
  }
  return bucket;
};

// Limites de taille par type de fichier (en bytes)
const FILE_SIZE_LIMITS = {
  'image/jpeg': 5 * 1024 * 1024,      // 5MB
  'image/png': 5 * 1024 * 1024,       // 5MB
  'image/gif': 5 * 1024 * 1024,       // 5MB
  'image/webp': 5 * 1024 * 1024,      // 5MB
  'application/pdf': 10 * 1024 * 1024, // 10MB
  'application/msword': 10 * 1024 * 1024, // 10MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10 * 1024 * 1024, // 10MB
  'text/plain': 10 * 1024 * 1024,     // 10MB
  'audio/mpeg': 20 * 1024 * 1024,     // 20MB
  'audio/wav': 20 * 1024 * 1024,      // 20MB
  'audio/ogg': 20 * 1024 * 1024,      // 20MB
  'audio/mp4': 20 * 1024 * 1024       // 20MB
};

// Types de fichiers autorisés
const ALLOWED_MIME_TYPES = Object.keys(FILE_SIZE_LIMITS);

// Fonction pour valider le fichier
const validateFile = (mimetype, size) => {
  // Vérifier si le type MIME est autorisé
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new Error(`Type de fichier non autorisé: ${mimetype}`);
  }

  // Vérifier la taille selon le type
  const maxSize = FILE_SIZE_LIMITS[mimetype];
  if (size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    throw new Error(`Fichier trop volumineux. Taille max pour ce type: ${maxSizeMB}MB`);
  }

  return true;
};

// Déterminer le type de message basé sur le MIME type
const getMessageType = (mimetype) => {
  if (mimetype.startsWith('image/')) {
    return 'image';
  } else if (mimetype.startsWith('audio/')) {
    return 'audio';
  } else {
    return 'document';
  }
};

module.exports = {
  initGridFS,
  getGridFSBucket,
  validateFile,
  getMessageType,
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES
};