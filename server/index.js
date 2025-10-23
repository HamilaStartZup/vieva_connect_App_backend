const express = require("express");
const path = require('path');
const connectToDatabase = require("./connect");
const dotenv = require('dotenv');
const authRoutes = require('./Routes/auth.routes.js');
const messagesRoutes = require('./Routes/messages.routes.js');
const famillesRoutes = require('./Routes/familles.routes.js');
const utilisateursRoutes = require('./Routes/utilisateurs.routes.js');
const urlRoutes = require('./Routes/urls.routes.js');
const alertesRoutes = require('./Routes/alertes.routes.js');
const notificationsRoutes = require('./Routes/notifications.routes.js');
const contactRoutes = require('./Routes/contacts.routes.js');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const https = require('https');
const http = require('http');
const socketIo = require("socket.io");

// Chargement des variables d'environnement
dotenv.config();

// Initialisation de l'application Express
const app = express();
console.log("Starting server initialization...");

// Middlewares
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.use(fileUpload({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limite générale (sera validée par type après)
  abortOnLimit: true
}));

// Routes
app.use('/api', authRoutes);
app.use('/api', messagesRoutes);
app.use('/api', famillesRoutes);
app.use('/api', utilisateursRoutes);
app.use('/api', urlRoutes);
app.use('/api', alertesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/contacts', contactRoutes);

// =============================================
// CHOIX DU MODE : DEV ou PROD
// =============================================
// Pour basculer, commentez/décommentez UNE SEULE LIGNE ci-dessous :

// --- Pour la PRODUCTION (HTTPS) ---
const server = https.createServer({
  key: fs.readFileSync('/etc/letsencrypt/live/vievaconnectbackend.vievaconnect.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/vievaconnectbackend.vievaconnect.com/fullchain.pem')
}, app);

// --- Pour le DEVELOPPEMENT (HTTP) ---
// const server = http.createServer(app);

const PORT = process.env.PORT || (server instanceof https.Server ? 443 : 8080);

// =============================================
// Configuration Socket.io (commune aux deux modes)
// =============================================
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware d'authentification Socket.io
const socketAuth = require('./socket/auth');
io.use(socketAuth);

// Connexion à la base de données
connectToDatabase();

// Configuration Socket.io pour la messagerie
const messageSocketHandler = require('./socket/messageHandler');
messageSocketHandler(io);

// Configuration Socket.io pour la signalisation WebRTC
const webrtcSignalingHandler = require('./socket/webrtcSignalingHandler');
webrtcSignalingHandler(io);

// Rendre l'instance io disponible globalement pour les controllers
global.io = io;

// Démarrage du serveur
server.listen(PORT, () => {
  console.log(`Server is running on ${server instanceof https.Server ? 'HTTPS' : 'HTTP'}://localhost:${PORT}`);
  console.log('Socket.io ready for messaging and WebRTC signaling');
});

// Arrêt propre du serveur
process.on('SIGINT', () => {
  console.log('Arrêt du serveur...');
  server.close(() => {
    console.log('Serveur fermé');
    process.exit(0);
  });
});
