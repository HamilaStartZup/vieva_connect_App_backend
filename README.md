# Parents_App_backend

# <em>Creation du Logout endpoint </em> 

### 1. Creation du controller du <em>logout</em>
 - Creation d'une fonction <em>**logout**</em> comprenant plusieurs parties
   * Utilisation de la fonction **res.clearCookie** pour supprimer le cookie généré lors du  **login**
   * Retourne une réponse avec un message indiquant que l'utilisateur s'est déconnecté

    
 
### 2. Creation du route de <em>logout</em>
- Utilisation de la fonctionnalité ' **router** ' d' express pour creer les routes
  * la methode **GET** pour la route de **logout**
  * utilisation de la fonction <em> **logout** </em> du fichier **controller.js**

