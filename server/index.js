const express = require ("express");
const connectToDatabase = require ("./connect");
const dotenv = require('dotenv');
const authRoutes = require('./Routes/auth.routes.js');
const messagesRoutes = require('./Routes/messages.routes.js');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 7000;
dotenv.config();

// Middleware
// app.use(express.json());
// Body-parser to parse incoming request bodies as JSON
app.use(bodyParser.json());
// Cookie-parser for handling cookies
app.use(cookieParser());
// CORS for enabling Cross-Origin Resource Sharing
app.use(cors());
// Routing
app.use('/api', authRoutes);
app.use('/api', messagesRoutes);

// Connexion a la DB
connectToDatabase();

// Lancement du serveur
app.listen(PORT, ()=>{
    console.log(`server is listening on http://localhost:${PORT}`);
});


