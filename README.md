# Parents_App_backend

# <em>Creation du endpoint profile </em> 

### 1. Creation du controller du <em>profile</em>
 Creation d'une fonction <em>profile</em> comprenant plusieurs parties
  - Utilisation de la methode ' findById ' pour trouver dans la DB l'Id mentionné dans le parametre de la requete
    * utilisation de la méthode ' select ' pour exclure des infos dans la reponse
    * si l'Id ne correspond pas a un Id de la DB, il renvoie un message
    * si il y a un probleme, il renvoie un message d'erreur
 
### 2. Creation du route de <em>profile</em>
- Utilisation de la fonctionnalité ' router ' d' express pour creer les routes
  * la methode GET pour la route de profile
  * utilisation de la fonction <em> profile </em> du fichier controller.js 
  * restriction de la route avec l'utilisation de ' isSignedIn '
