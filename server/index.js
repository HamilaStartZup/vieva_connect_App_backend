const express = require ("express");
const connectToDatabase = require ("./connect");
const dotenv = require('dotenv');
const Personne = require ('./models/personnes.js')
const app = express();


connectToDatabase();

const PORT = process.env.PORT || 7000;
app.listen(PORT, ()=>{
    console.log(`server is listening on http://localhost:${PORT}`);
});

