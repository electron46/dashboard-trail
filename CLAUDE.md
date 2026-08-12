# CLAUDE.md — Instructions du projet

## 1. Résumé du projet

Nom du projet : Dashboard personnel de préparation trail

Type de projet :
- [x] Application web

Objectif principal :
Créer une application web personnelle qui aide à se préparer au mieux pour plusieurs courses de trail sur une même saison, en distinguant les objectifs principaux des objectifs secondaires. L'application doit permettre de suivre l'entraînement en fonction de chaque échéance et d'ajuster la préparation en conséquence, sans coach ni support extérieur.

Résultat attendu :
Une application web utilisable en local (ou déployée, à trancher — voir section 16), qui centralise : les courses à venir avec leur statut (objectif principal / secondaire), le plan d'entraînement associé, et le suivi de la progression par rapport à chaque échéance.

## 2. Contexte métier

Pourquoi ce projet existe :
Traileur solo, sans coach, préparant plusieurs courses sur la même période avec des niveaux d'enjeu différents (ex. le Mafate Trail Tour — 55 km / 3500 m D+ — le 28 novembre 2026 est l'objectif principal ; le Trail des Cascades — 31 km / 1700 m D+ — le 12 septembre 2026 est un objectif secondaire traité comme sortie longue de préparation). Besoin d'un outil pour objectiver la préparation de chaque course selon son importance, plutôt que de tout traiter au même niveau.

Qui va utiliser le résultat :
- [x] Moi uniquement

Niveau technique des utilisateurs finaux :
- [x] Avancé

Ce qui compte le plus :
- [x] Simplicité
- [x] Fiabilité
- [x] Facilité de maintenance

## 3. Périmètre du projet

Ce que le projet doit faire :
- Lister les courses de la saison avec leurs caractéristiques (distance, D+, date) et leur statut (objectif principal / secondaire / sortie d'entraînement)
- Suivre le plan d'entraînement en cours et son avancement par rapport à chaque échéance
- Mettre en évidence les priorités selon l'importance de chaque course (ex. plus de marge d'ajustement autour d'un objectif secondaire qu'autour de l'objectif principal)
- Projet indépendant du dashboard .FIT existant (`journal_entrainement.html`) : pas d'intégration prévue entre les deux

Ce que le projet ne doit pas faire pour l'instant :
- Gestion multi-utilisateurs (usage strictement personnel)
- Fonctionnalités sociales (partage, comparaison avec d'autres coureurs)
- Synchronisation automatique entre appareils (PC / téléphone) — se fait pour l'instant par export/import manuel d'un fichier JSON (voir section 15)

Fonctionnalités ajoutées après le MVP initial (à la demande de l'utilisateur) :
- Gestion des courses via l'interface (ajout/modification/suppression), plus besoin de modifier le code
- Profil traileur (infos perso, points de vigilance santé réutilisés dans le retour IA, records personnels)
- Suivi d'usure des chaussures (km cumulés par paire, seuil d'alerte)
- Mode sombre
- Site à plusieurs pages plutôt qu'un fichier unique (voir section 6)

Version souhaitée :
- [x] MVP simple mais utilisable

Priorité principale :
Vue claire des échéances à venir avec leur statut d'importance, avant tout affinage du suivi détaillé des séances.

## 4. Contraintes importantes

Contraintes de temps :
Aucune échéance stricte communiquée. ⚠️ Hypothèse : utile d'avoir une première version fonctionnelle avant la prochaine course (Trail des Cascades, 12 septembre 2026) — à confirmer.

Contraintes de budget :
Non précisé. Claude doit privilégier des solutions gratuites par défaut (usage strictement personnel, pas d'hébergement payant nécessaire a priori).

Contraintes techniques :
Usage principalement local (PC). Doit aussi pouvoir être consulté depuis un téléphone lors de déplacements (ex. vacances) — donc prévoir un accès à distance simple (ex. hébergement léger ou synchronisation), sans que ce soit la contrainte prioritaire du MVP. ⚠️ Hypothèse : une solution qui fonctionne d'abord en local puis qui peut être exposée simplement (ex. via un petit hébergement gratuit/peu coûteux) est suffisante — à confirmer avec Claude Code lors du choix technique.

Contraintes de design :
Non précisé. Priorité à la lisibilité plutôt qu'au design soigné, usage strictement personnel.

Contraintes légales, données ou confidentialité :
Aucune contrainte particulière (usage personnel, aucune donnée de tiers).

Contraintes d'usage :
Doit rester simple à mettre à jour soi-même (ajout d'une course, ajustement du plan) sans repasser par un développement complet à chaque fois.

## 5. Outils, plateformes et technologies

Outils ou plateformes imposés :
- Aucun à ce jour.

Outils ou plateformes préférés :
- Aucun exprimé à ce jour. Claude propose une solution simple et explique son choix.

Outils ou plateformes à éviter :
- Aucun à ce jour.

Si aucune technologie n'est imposée :
Claude doit proposer une solution simple et adaptée au besoin, en expliquant brièvement pourquoi cette solution est pertinente.

## 6. Structure du projet

Dossiers ou fichiers importants :
- `index.html` — page d'accueil (échéances de la saison + état de préparation)
- `historique.html` — import des séances .fit, historique, graphiques, détail de séance + retour IA
- `profil.html` — profil traileur (infos perso, santé, records)
- `equipements.html` — suivi d'usure des chaussures
- `parametres.html` — plan CSV, clé API Claude, export/import des données, réinitialisation
- `assets/style.css` — styles partagés par toutes les pages (charte ELEV, mode clair/sombre)
- `assets/app.js` — logique partagée : parsing des fichiers .fit, stockage (localStorage), formatage, calcul de l'état de préparation
- `dashboard-trail.html` — ancienne page unique, conservée uniquement comme redirection vers `index.html` (compatibilité d'anciens liens)
- Toutes les données (séances, plan, courses, profil, équipements, clé API) sont stockées dans le navigateur (`localStorage`), rien n'est envoyé sur un serveur sauf appel volontaire à l'API Claude

Fichiers à ne pas modifier sans me prévenir :
- Aucun pour l'instant.

Fichiers ou dossiers à ignorer :
- `design-system/` — bundle de la charte graphique généré par un outil Claude, non destiné à être modifié à la main.

Si Claude ne comprend pas la structure :
Claude doit commencer par explorer les fichiers principaux, identifier la structure, puis me faire un résumé simple avant toute modification importante.

## 7. Données, fichiers et contenus

Sources utilisées :
- [ ] À définir (voir hypothèse section 3 sur l'import .FIT)

Emplacement des données :
Non précisé — à définir selon la solution technique retenue.

Format d'entrée :
Liste des courses de la saison avec date, distance, D+, statut (principal/secondaire) — à fournir ou saisir dans l'application.

Format de sortie attendu :
Vue synthétique des échéances et de l'état de préparation par rapport à chacune.

Règles de traitement :
- Une course "objectif principal" doit être mise en avant différemment d'une course "objectif secondaire" dans l'interface
- ⚠️ Hypothèse : le statut de chaque course (principal/secondaire) est modifiable manuellement, la saison pouvant évoluer

Données sensibles :
Aucune (usage strictement personnel, pas de données de tiers).

## 8. Site web, page web ou application

Objectif de l'interface :
Donner une vue d'ensemble claire de la saison de courses et de l'état de préparation par rapport à chaque échéance, en priorisant visuellement les objectifs principaux.

Pages ou écrans nécessaires :
- Accueil : vue d'ensemble de la saison (liste des courses avec statut, échéance, état de préparation), gestion des courses
- Historique : import des séances, historique filtrable, graphiques de progression, détail de séance (comparaison au plan + retour IA)
- Profil : infos perso, points de vigilance santé, records personnels
- Équipements : suivi d'usure des chaussures
- Paramètres : plan CSV, clé API, export/import des données, mode sombre

Contenus importants :
- Titre principal : à définir
- Promesse : à définir
- CTA principal : non applicable (usage personnel, pas de conversion)
- Sections obligatoires : liste des courses, détail par course
- Éléments de réassurance : non applicable

Style visuel souhaité :
Non précisé. Priorité à la clarté plutôt qu'à l'esthétique.

Références ou inspirations :
- Non fourni.

Règles UX :
- Doit rester lisible et rapide à consulter, y compris depuis un téléphone
- Les échéances les plus proches et les objectifs principaux doivent ressortir immédiatement

## 9. Commandes utiles

Si les commandes ne sont pas connues :
Claude doit inspecter les fichiers du projet, notamment README, package.json, pyproject.toml, requirements.txt, Makefile ou équivalents, puis proposer les commandes pertinentes.

## 10. Règles de travail pour Claude dans ce projet

Avant de modifier :
- Comprendre l'objectif de la tâche.
- Identifier les fichiers concernés.
- Expliquer brièvement le plan d'action si la modification est importante.
- Demander validation avant toute action risquée ou difficile à annuler.

Pendant la modification :
- Privilégier la solution la plus simple qui répond au besoin.
- Éviter la sur-ingénierie.
- Ne pas ajouter de dépendances inutiles.
- Ne pas modifier des fichiers sans rapport avec la tâche.

Après la modification :
- Résumer ce qui a été changé.
- Indiquer les fichiers modifiés.
- Expliquer comment vérifier que tout fonctionne.
- Signaler les limites, risques ou points à améliorer.
- Proposer une prochaine étape claire.

## 11. Tests et vérification

Méthode de vérification attendue :
Test manuel avec quelques courses fictives couvrant les deux statuts (principal/secondaire) et des échéances à différentes distances dans le temps.

Exemples :
- L'application se lance sans erreur
- La liste des courses s'affiche avec le bon statut
- Les échéances proches et les objectifs principaux sont visuellement mis en avant

Données ou scénario de test :
Jeu de test basé sur les courses réelles de la saison : Mafate Trail Tour (55 km / 3500 m D+, 28/11/2026, objectif principal) et Trail des Cascades (31 km / 1700 m D+, 12/09/2026, objectif secondaire).

Critères de réussite :
- Les deux courses réelles s'affichent correctement avec leur statut respectif
- L'interface distingue clairement objectif principal et secondaire au premier coup d'œil
- L'ajout d'une nouvelle course se fait facilement sans intervention technique lourde

## 12. Sécurité et points de vigilance

Claude doit faire attention à :
- Ne pas exposer de clés API, tokens ou mots de passe.
- Ne pas écrire de secrets dans le code.
- Ne pas supprimer de fichiers sans validation.
- Ne pas écraser un fichier important sans validation.
- Signaler les risques liés aux coûts d'API, quotas ou limites d'outils si des services externes sont utilisés.
- Prévenir avant toute modification structurelle importante.

Informations sensibles à ne jamais inclure dans le projet :
- Clés API
- Mots de passe

## 13. Documentation attendue

Documentation utile :
- Comment lancer ou utiliser le projet
- Comment ajouter ou modifier une course
- Comment tester le projet
- Où se trouvent les fichiers importants
- Quelles sont les limites connues

Emplacement souhaité :
- [x] Dans README.md

## 14. Décisions déjà prises

Décisions importantes :
- Distinction claire objectif principal / objectif secondaire dans l'interface
- Usage strictement personnel, pas de gestion multi-utilisateurs
- Site à plusieurs pages HTML (plutôt qu'un fichier unique à onglets), avec CSS/JS partagés dans `assets/` — choisi pour rester lisible et facile à faire évoluer sans outil de build
- Publication sur GitHub Pages (dépôt `electron46/dashboard-trail`)
- Suivi d'usure des chaussures limité aux chaussures (pas d'inventaire matériel complet ni de checklist de course, non demandés)
- Synchronisation entre appareils traitée par export/import JSON manuel (pas de backend, pour rester gratuit et simple)

Choix refusés :
- Aucun à ce jour.

Si une décision technique importante doit être prise :
Claude doit expliquer les options simplement, recommander une option, puis attendre validation si l'impact est important.

## 15. Questions ouvertes

Questions à clarifier :
- Synchronisation entre appareils : traitée pour l'instant par export/import JSON manuel (voir page Paramètres). Si c'est trop contraignant à l'usage, une synchronisation plus automatique (fichier partagé type Drive, ou petit backend gratuit type Supabase/Firebase) pourra être envisagée plus tard.

Si une information manque :
Claude doit faire une hypothèse raisonnable, l'indiquer clairement, puis avancer si le risque est faible. Si le risque est élevé, Claude doit demander validation avant d'agir.

## 16. Définition de terminé

La tâche ou le projet est considéré comme terminé quand :
- [x] La saison de courses est visible avec le statut de chaque échéance (principal/secondaire)
- [x] L'état de préparation par rapport à chaque échéance est consultable
- [x] L'ajout ou la modification d'une course est possible sans intervention technique lourde (formulaire en page Accueil)

Livrables attendus :
- Code source de l'application
- Application utilisable, publiée sur GitHub Pages (dépôt `electron46/dashboard-trail`)

Dernière vérification :
Claude doit vérifier que le résultat correspond bien à l'objectif initial, puis fournir un résumé final simple avec les prochaines étapes recommandées.
