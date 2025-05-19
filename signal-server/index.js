const express = require("express");
const http = require("http");
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectToDatabase = require('./connect');
const appelsRoutes = require('./controllers/appelsRoutes');
const SignalManager = require('./signalManager');

// Initialisation
dotenv.config();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 7001;

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Routes API
app.use('/api', appelsRoutes);

// Connexion à la base de données
console.log('[SignalServer] Connexion à la base de données...');
connectToDatabase();

// Initialiser le service de signalisation
console.log('[SignalServer] Initialisation du service de signalisation...');
const signalManager = new SignalManager(server, {
  corsOrigin: process.env.CORS_ORIGIN || '*'
});
signalManager.initialize();

// Route de statut
app.get('/api/signalisation/status', (req, res) => {
  try {
    const status = signalManager.getConnectionsStatus();
    console.log('[SignalServer] Status demandé:', status);
    res.status(200).json({
      status: 'active',
      ...status
    });
  } catch (error) {
    console.error('[SignalServer] Erreur lors de la récupération du statut:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Démarrage du serveur
server.listen(PORT, () => {
  console.log(`[SignalServer] Serveur de signalisation démarré sur http://localhost:${PORT}`);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('[SignalServer] SIGTERM reçu, arrêt propre...');
  signalManager.shutdown();
  server.close(() => {
    console.log('[SignalServer] Serveur HTTP arrêté');
    process.exit(0);
  });
});