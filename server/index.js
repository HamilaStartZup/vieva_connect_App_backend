const express = require("express");
const connectToDatabase = require("./connect");
const dotenv = require('dotenv');
const authRoutes = require('./Routes/auth.routes.js');
const messagesRoutes = require('./Routes/messages.routes.js');
const famillesRoutes = require('./Routes/familles.routes.js');
const utilisateursRoutes = require('./Routes/utilisateurs.routes.js');
const urlRoutes = require('./Routes/urls.routes.js');
const alertesRoutes = require('./Routes/alertes.routes.js');
const notificationsRoutes = require('./Routes/notifications.routes.js'); // Nouvelle route
const contactRoutes = require('./Routes/contacts.routes.js')
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 7000;
dotenv.config();

console.log("Starting server initialization...");

// Middlewares
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());

// Routes
app.use('/api', authRoutes);
app.use('/api', messagesRoutes);
app.use('/api', famillesRoutes);
app.use('/api', utilisateursRoutes);
app.use('/api', urlRoutes);
app.use('/api', alertesRoutes);
app.use('/api/notifications', notificationsRoutes); // Route pour les notifications de proximité
app.use('/api/contacts', contactRoutes);

// Connexion à la base de données
connectToDatabase();

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});