# Parents_App_backend

# <em>Creation du endpoint login</em> 
### 1. Installation des modules nécessaires ( <em>body-parser, cookie-parser, express-jwt, express-validator, jsonwebtoken </em>)

### 2. Creation du controller du login
- Creation d'un dossier ' Controllers ' puis du fichier ' controller.js '
- Creation d'une fonction <em>login</em> comprenant plusieurs parties
  * une partie validation des inputs
  * une partie vérification des authentifiants de l'utilisateur
  * une partie vérification du mot de passe
  * une partie generation d'un  JWT token pour l'authentification
 
### 3. Creation du route de login
- Creation d'un dossier ' Routes ' puis du fichier ' route.js '
- Utilisation de la fonctionnalité ' router ' d' express pour creer les routes
  * la methode POST pour la route de login
  * utilisation de la fonction login du fichier controller.js
  * verification de la validité des inputs avec ' check'
 
### 4. Utilisation des routes
- Chargement des routes exportés dans le fichier ' routes.js ' grace a <em>" app.use('/api', authRoutes) " </em>
