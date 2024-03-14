# Parents_App_backend 🖥️

# <em>Creation et connexion a la DB MongoDB</em> 
### 1. Installation des modules nécessaires ( <em>express, dotenv, mongoose, crypto, uuid </em>)

### 2. Lancement du server
- On crée un fichier en .env qui comprend le PORT utilisé et l'URI nécessaire pour se connecter à la DB MongoDB
- On démarre le server en utilisant " app.listen(PORT, ()=>{}) "

### 3. Connexion à la DB
- Creation d'un fichier ' connect.js '
- Creation d'une fonction de connexion  grace a ' mongoose ' et l'URI de notre fichier .env
- Utilisation de notre fonction de connexion dans le fichier ' index.js '

### 4. Creation d'un schema
- Creation d'un dossier ' models '
- Creation du fichier ' personnes.js ' qui contient le schema qui explique les infos que l'on va transmettre a la DB
