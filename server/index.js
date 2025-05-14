// const express = require ("express");
// const connectToDatabase = require ("./connect");
// const dotenv = require('dotenv');
// const authRoutes = require('./Routes/auth.routes.js');
// const messagesRoutes = require('./Routes/messages.routes.js');
// const famillesRoutes = require('./Routes/familles.routes.js');
// const utilisateursRoutes = require ('./Routes/utilisateurs.routes.js');
// const urlRoutes = require('./Routes/urls.routes.js');
// const alertesRoutes = require('./Routes/alertes.routes.js');
// const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
// const cors = require('cors');
// const app = express();
// const PORT = process.env.PORT || 7000;
// dotenv.config();

// // Middleware
// // app.use(express.json());
// // Body-parser to parse incoming request bodies as JSON
// app.use(bodyParser.json());
// // Cookie-parser for handling cookies
// app.use(cookieParser());
// // CORS for enabling Cross-Origin Resource Sharing
// app.use(cors());
// // Routing
// app.use('/api', authRoutes);
// app.use('/api', messagesRoutes);
// app.use('/api', famillesRoutes);
// app.use('/api', utilisateursRoutes);
// app.use('/api', urlRoutes);
// app.use('/api', alertesRoutes);

// // Connexion a la DB
// connectToDatabase();

// // Lancement du serveur
// app.listen(PORT, ()=>{
//     console.log(`server is listening on http://localhost:${PORT}`);
// });

















const express = require("express");
const http = require("http");
const connectToDatabase = require("./connect");
const dotenv = require('dotenv');
const authRoutes = require('./Routes/auth.routes.js');
const messagesRoutes = require('./Routes/messages.routes.js');
const famillesRoutes = require('./Routes/familles.routes.js');
const utilisateursRoutes = require('./Routes/utilisateurs.routes.js');
const urlRoutes = require('./Routes/urls.routes.js');
const alertesRoutes = require('./Routes/alertes.routes.js');
// Nouvelle importation
const appelsRoutes = require('./signalisation/controllers/appelsRoutes');
const SignalManager = require('./signalisation/signalManager');

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 7000;

dotenv.config();

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());

// Routing
app.use('/api', authRoutes);
app.use('/api', messagesRoutes);
app.use('/api', famillesRoutes);
app.use('/api', utilisateursRoutes);
app.use('/api', urlRoutes);
app.use('/api', alertesRoutes);
// Nouvelle route
app.use('/api', appelsRoutes);

// Initialiser le service de signalisation
const signalManager = new SignalManager(server, {
  corsOrigin: process.env.CORS_ORIGIN || '*'
});
signalManager.initialize();

// Route de statut pour le service de signalisation
app.get('/api/signalisation/status', (req, res) => {
  try {
    const status = signalManager.getConnectionsStatus();
    res.status(200).json({
      status: 'active',
      ...status
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Connexion à la DB
connectToDatabase();

// Lancement du serveur
server.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt propre...');
  signalManager.shutdown();
  server.close(() => {
    console.log('Serveur HTTP arrêté');
    process.exit(0);
  });
});