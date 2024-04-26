# Parents_App_backend

# <em>Creation du endpoint verify_user </em> 

### 1. Creation du controller du <em>verify_user</em>
  - récupération du token dans le query de la requête
  - décodage du token pour récupérer l'objet "decoded" ayant les propriétés utilsées lors du chiffrement
  - creation d'un objet "personn" si le "decoded.id" a un equivalent dans la base de données
  - si l'objet"personne" existe , alors on envoie <em> res.json({ id: personne._id }) </em>

### 2. Creation du route de <em>verify_user</em>
- Utilisation de la fonctionnalité ' router ' d' express pour creer les routes
  * la methode GET pour la route de 'verify_user'
  * utilisation de la fonction <em> verify_user </em> du fichier controller.js 
  

