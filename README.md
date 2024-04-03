# Parents_App_backend

# <em>Création de l'endpoint sendMessage</em>

## 1- Création du controller de <em>sendMessage</em>
 * Création d'un fichier ' messages.controllers.js ' dans le dossier ' Controllers '
 * Création de la fonction ' sendMessage ' dans ' messages.controllers.js '
    - Definition de <em>message</em>, <em>senderId</em> et <em>receiverId</em>
    - Recherche de conversation en utilisant la methode <em>findOne</em> et le senderId et receiverId
    - Si il n'y a pas de conversation , on en crée une avec la methode <em>create</em>
    - Definition de newMessage pour le message envoyé avec <em>senderId</em>, <em>receiverId</em> et <em>message</em>
    - On ajoute l'Id du nouveau message dans le tableau <em>message</em> de <em>conversation</em>
    - On sauvegarde newMessage et conversation dans la DB grace a la methode <em>save</em>

## 2- Création de la route de <em>messagesRoutes</em>
 * Création d'un fichier ' mesages.routes.js ' dans le dossier ' Routes '
 * Importation des modules ' sendMessage ' et ' isAuthenticated '
 * Utilisation de la méthode POST pour le routage
   - "/send/:id" est l' URI de la route avec :id comme parametre
   - isAuthenticated est un middleware qui verifie l'utilisateur
   - sendMessage est le controller qui traite la demande


## 3- Utilisation de la route <em>messagesRoutes</em>
 * Importation de la route dans le fichier ' index.js '
 * Utilisation dans la partie routing du fichier ' index.js '
     

    
