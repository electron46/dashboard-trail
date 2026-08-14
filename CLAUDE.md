# CLAUDE.md — Instructions du projet

## 1. Résumé du projet

Nom du projet : Dashboard personnel de préparation trail

Type de projet :
- [x] Application web

Objectif principal :
Créer une application web personnelle qui aide à se préparer au mieux pour plusieurs courses de trail sur une même saison, en distinguant les objectifs principaux des objectifs secondaires. L'application doit permettre de suivre l'entraînement en fonction de chaque échéance et d'ajuster la préparation en conséquence, sans coach ni support extérieur.

Résultat attendu :
Une application web déployée sur GitHub Pages (voir section 16), qui centralise : les courses à venir avec leur statut (objectif principal / secondaire), le plan d'entraînement associé, et le suivi de la progression par rapport à chaque échéance.

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

Fonctionnalités ajoutées après le MVP initial (à la demande de l'utilisateur) :
- Gestion des courses via l'interface (ajout/modification/suppression), plus besoin de modifier le code
- Profil traileur (infos perso, points de vigilance santé réutilisés dans le retour IA, records personnels, objectifs de course)
- Suivi d'usure des chaussures (km cumulés par paire, seuil d'alerte)
- Zones de fréquence cardiaque (méthode Karvonen) : calculées à partir de FC max / FC repos éditées en page Profil ; répartition du temps par zone consultable en lecture seule en page Accueil (résumé compact)
- Retour IA structuré par séance (persona coach trail : compare au plan, croise plusieurs métriques, distingue écart ponctuel/récurrent via l'historique, signale les alertes santé par niveau de gravité, tient compte du contexte du jour saisi par l'utilisateur)
- Estimation IA du temps de course (croise technicité du terrain, chaleur attendue, historique d'entraînement et profil physio ; peut être reprise comme temps visé)
- Plan d'entraînement CSV enrichi : zones FC cibles par phase de séance, D-, bloc/semaine, objectif détaillé — avec vue dépliable par semaine en page Paramètres (les deux formats, riche et simple, restent supportés)
- Synchronisation entre appareils : export/import JSON manuel, ou synchro automatique optionnelle via Supabase (page Paramètres)
- Site installable comme application (PWA) sur l'écran d'accueil du téléphone
- Mode sombre par défaut / clair en option (voir rebranding, section 14)
- Site à plusieurs pages plutôt qu'un fichier unique (voir section 6)
- Page Analyse : comparaison de séances de même distance dans le temps (progression), graphique allure/FC (efficacité)
- Détail de séance enrichi : carte du parcours GPS (Leaflet + fond OpenStreetMap) et graphiques allure/FC/altitude synchronisés (un curseur commun aux trois courbes + repère sur la carte)
- Refonte Activités + détail de séance (page dédiée `activite.html`, remplace l'ancienne modale) : profil altimétrique large en élément signature, onglets Résumé/Allure/FC/Zones/Montées/Splits, détection automatique des montées avec VAM (m/h), Insight ELEV déterministe propre à la séance, comparaison aux 5 dernières sorties du même type ; page Activités (`historique.html`) transformée en liste visuelle dense (mini-profil par séance) au lieu d'un tableau brut
- Profil de performance (page Profil) : radar à 6 axes (endurance, montée, descente, vitesse, résistance, régularité) calculé depuis l'historique des séances, sur des repères fixes documentés
- Indice de préparation détaillé par course (page Objectifs) : décomposé en 5 sous-scores (volume, dénivelé, sorties longues, intensité, régularité) avec point faible identifié automatiquement, remplace l'ancien pourcentage unique
- Page Plan en calendrier hebdomadaire : séances planifiées et réalisées côte à côte, jour par jour, avec écart de volume
- Page Accueil refaite en « cockpit de progression » (voir section 14) : 4 KPI (volume hebdo, dénivelé hebdo, tendance de charge qualitative, préparation de l'objectif principal), section « Cette semaine » fusionnée avec le graphique de tendance (volume/D+ togglable, 12 semaines), Insight ELEV (interprétation déterministe du volume récent, pas d'IA) suivi de la carte « Prochaine séance », carte « Dernière activité » cliquable avec aperçu du tracé GPS ou du profil altimétrique (bandeau horizontal), carte « Objectif principal » avec sous-scores de préparation en petites barres, cartes secondaires Charge/Intensité en bas — grille 2 colonnes alignée sur desktop (≥1024px) pour limiter le scroll
- Moteur FIT exhaustif + synchro Supabase par activité (version allégée, voir section 14) : le parser ne perd plus aucun message/champ silencieusement (événements, appareils, champs développeur résolus dynamiquement, messages Garmin propriétaires comme splits/ClimbPro conservés en champs génériques), table Supabase `activities` (une ligne par séance, RLS) + stockage privé du fichier `.fit` original en plus de la synchro globale existante, et FIT Import Inspector (`inspecteur.html`) pour diagnostiquer un fichier `.fit` (couverture des champs, intégrité CRC, messages inconnus)

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
Résolu : site déployé sur GitHub Pages, accessible depuis PC ou téléphone via navigateur, installable comme PWA sur l'écran d'accueil mobile. Les données restent locales à chaque appareil (`localStorage`), avec synchro Supabase optionnelle pour les retrouver sur un autre appareil.

Contraintes de design :
Identité de marque ELEV définie et appliquée à tout le site (voir section 14) : palette sombre « Mountain Performance Intelligence » (fond quasi noir `#0B0F0E`, surfaces `#121816`/`#18201D`) + vert de marque unique `#6B8E4E` en accent rare, typographies Raleway (titres) + Inter (texte, y compris les valeurs chiffrées via `tabular-nums`), thème sombre par défaut. La charte source vit dans `design-system/` (voir section 6) — ne pas la modifier à la main, sauf son fichier `readme.md` qui documente désormais la palette réellement appliquée (mis à jour à la demande de l'utilisateur après la refonte de l'Accueil).

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
- `index.html` — page d'accueil / cockpit de progression : 4 KPI (volume hebdo, dénivelé hebdo, tendance de charge, préparation objectif principal), Cette semaine + tendance 12 semaines, Insight ELEV + prochaine séance planifiée (colonne de droite), dernière activité, objectif principal, et en cartes secondaires plus discrètes : charge aiguë/chronique et répartition FC (lecture seule — édition FC max/repos en page Profil). **Connexion Supabase obligatoire** (voir `connexion.html` ci-dessous).
- `historique.html` — page "Activités" : import des séances .fit, graphiques de progression, liste visuelle des séances (mini-profil altimétrique/GPS par ligne, cliquable vers `activite.html`). Ne contient plus de détail de séance (déplacé, voir ci-dessous). **Connexion Supabase obligatoire.**
- `activite.html` — détail d'une séance (`?id=...`) : header + KPI, carte GPS (Leaflet) et résumé rapide côte à côte, profil altimétrique large synchronisé au curseur de la carte, onglets Résumé/Allure/Fréquence cardiaque/Zones/Montées/Splits, comparaison aux 5 dernières sorties du même type, chaussure utilisée, comparaison au plan, contexte du jour et retour IA structuré, Insight ELEV de la séance (déterministe). **Connexion Supabase obligatoire.**
- `connexion.html` — page de connexion (email/mot de passe Supabase, réutilise le même compte que Paramètres) : point d'entrée obligatoire pour `index.html`, `historique.html` et `activite.html` (voir `assets/authgate.js`). Redirige vers Paramètres si Supabase n'est pas encore configuré sur l'appareil.
- `analyse.html` — comparaison de séances de même distance dans le temps, graphique d'efficacité allure/FC
- `objectifs.html` — gestion des courses de la saison, frise chronologique, indice de préparation détaillé par course (5 sous-scores), estimation IA du temps de course
- `plan.html` — plan d'entraînement en calendrier hebdomadaire (séances planifiées vs réalisées, jour par jour)
- `profil.html` — profil traileur (infos perso, santé, records, objectifs de course, radar de performance à 6 axes)
- `equipements.html` — suivi d'usure des chaussures
- `parametres.html` — plan CSV (import + vue détaillée dépliable par semaine), clé API Claude, export/import des données, synchro Supabase, thème, réinitialisation
- `assets/style.css` — styles partagés par toutes les pages (identité ELEV : palette sombre par défaut + vert de marque, Raleway/Inter, sidebar de navigation compacte, grille 2 colonnes du cockpit Accueil sur desktop)
- `assets/app.js` — logique partagée : parsing des fichiers .fit (dont position GPS), parsing du plan CSV (deux formats), stockage (localStorage + sync Supabase), formatage, calcul de l'état de préparation / indice de préparation / profil de performance / tendance de charge (qualitative, ratio aiguë/chronique) / Insight ELEV de tendance (règles déterministes), rendu SVG partagé (courbes, barres, sparklines, aperçu de tracé GPS/altitude). Depuis la refonte Activités : détection de montées (`detectClimbs`, seuils documentés dans le code), répartition du temps par zone FC sur une séance (`computeSessionZoneDistribution`), comparaison aux séances précédentes (`computeSessionComparison`), Insight ELEV propre à une séance (`generateSessionInsight`, déterministe, distinct de l'Insight de tendance de l'Accueil). Depuis le moteur FIT exhaustif : le parser ne perd plus aucun champ/message silencieusement (champs non cartographiés conservés en `field_N`, résolution en 2 passes des champs développeur via `resolveDeveloperFields`), synchro par séance vers Supabase (`pushActivityRow`, `uploadFitFile`) en plus de la synchro globale existante, et générateur de rapport pour l'inspecteur (`buildFitInspectorReport`, CRC-16 FIT inclus). Depuis le passage à "Supabase = source de vérité" (Accueil + Activités) : lecture des séances depuis la table `activities` avec reconstruction du cache local (`syncActivitiesWithSupabase`, `activityRowToSession`) — pousse d'abord les séances locales non encore connues côté Supabase, puis recharge la liste complète.
- `assets/authgate.js` — garde d'accès (redirection vers `connexion.html` si aucune session Supabase active), utilisée uniquement sur les pages migrées vers le nouveau modèle (`index.html`, `historique.html`, `activite.html` — marquées `<html class="auth-pending">`). Les autres pages restent accessibles sans connexion tant qu'elles n'ont pas été refaites (voir décisions section 14).
- `assets/icon.svg`, `manifest.json` — icône et manifeste PWA (site installable sur écran d'accueil mobile)
- `assets/logo-full.png` — logo officiel ELEV, affiché dans la sidebar des 7 pages hors Accueil (sur `index.html`, la sidebar utilise une icône montagne + le mot « ELEV » en texte — voir question ouverte section 15)
- `dashboard-trail.html` — ancienne page unique, conservée uniquement comme redirection vers `index.html` (compatibilité d'anciens liens)
- `inspecteur.html` — FIT Import Inspector, outil de diagnostic (page non reliée à la sidebar principale, accessible depuis Paramètres > Développement) : radiographie d'un fichier .fit choisi localement (en-tête, intégrité CRC, inventaire complet des messages connus/inconnus, taux de couverture des champs, champs développeur, appareils). Lecture seule, n'importe et ne stocke rien.
- `supabase/migrations/` — scripts SQL versionnés (table `activities` avec RLS, bucket de stockage privé `fit-files`) à exécuter manuellement dans l'éditeur SQL du tableau de bord Supabase ; complète la table `trail_data` existante (synchro globale), ne la remplace pas.
- `fit_files/` — quelques fichiers `.fit` réels conservés dans le dépôt (antérieur à cette évolution), utiles comme jeu de test pour le parser et l'inspecteur.
- Toutes les données (séances, plan, courses, profil, équipements, clé API) sont stockées dans le navigateur (`localStorage`), rien n'est envoyé sur un serveur sauf appel volontaire à l'API Claude, synchro Supabase explicitement configurée (globale via `trail_data`, et désormais par séance via `activities` + fichier `.fit` original dans le stockage privé `fit-files`), ou chargement des fonds de carte OpenStreetMap (carte GPS d'une séance)

Fichiers à ne pas modifier sans me prévenir :
- Aucun pour l'instant.

Fichiers ou dossiers à ignorer :
- `design-system/` — bundle de la charte graphique ELEV (importé depuis un projet Claude Design System). Déjà décliné dans `assets/style.css` et le reste du site ; ne pas le modifier à la main, il sert de référence source.

Si Claude ne comprend pas la structure :
Claude doit commencer par explorer les fichiers principaux, identifier la structure, puis me faire un résumé simple avant toute modification importante.

## 7. Données, fichiers et contenus

Sources utilisées :
- Fichiers `.fit` exportés de la montre/appli (import en page Historique)
- Plan d'entraînement au format CSV (deux formats supportés — voir page Paramètres)

Emplacement des données :
`localStorage` du navigateur (par appareil), avec synchro optionnelle vers Supabase si configurée (page Paramètres).

Format d'entrée :
- Courses de la saison : date, distance, D+, statut (principal/secondaire/envisagé), technicité du terrain et chaleur attendue (optionnels, utilisés par l'estimation IA) — saisies dans l'application.
- Plan d'entraînement CSV : format détaillé (séparateur `;`, zones FC par phase, D-, bloc, objectif) recommandé, ou format simple (séparateur `,`) toujours supporté pour compatibilité.

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
- Accueil : cockpit de progression — KPI (volume/D+ hebdo, tendance de charge, préparation objectif principal), tendance de volume 12 semaines, Insight ELEV + prochaine séance, dernière activité, objectif principal avec sous-scores, plus en secondaire : charge aiguë/chronique et répartition FC en lecture seule
- Activités : import des séances, graphiques de progression, liste visuelle filtrable (recherche, période, type) avec mini-profil par séance ; chaque séance ouvre sa page de détail dédiée (`activite.html`) : carte GPS + profil altimétrique synchronisés, KPI, onglets Résumé/Allure/FC/Zones/Montées/Splits, comparaison aux sorties précédentes, comparaison au plan, retour IA structuré, contexte du jour, Insight ELEV de la séance
- Analyse : comparaison de séances de même distance dans le temps, graphique d'efficacité allure vs FC
- Objectifs : gestion des courses de la saison, frise chronologique, indice de préparation détaillé par course (volume, dénivelé, sorties longues, intensité, régularité), estimation IA du temps de course
- Plan : calendrier hebdomadaire du plan d'entraînement, séances planifiées vs réalisées jour par jour
- Profil : infos perso, points de vigilance santé, records personnels, objectifs de course, radar de performance à 6 axes, réglage FC max / FC repos (source unique de ces deux valeurs, réutilisées en lecture seule en page Accueil)
- Équipements : suivi d'usure des chaussures
- Paramètres : plan CSV (import + vue détaillée par semaine), clé API, export/import des données, synchro Supabase, thème

Contenus importants :
- Titre / marque : ELEV
- Signature courte : "SUIVEZ. ANALYSEZ. PROGRESSEZ."
- Baseline : "Votre aventure, vos données, votre progression."
- CTA principal : non applicable (usage personnel, pas de conversion)
- Sections obligatoires : liste des courses, détail par course
- Éléments de réassurance : non applicable

Style visuel souhaité :
Identité de marque ELEV (rebranding complet importé depuis un projet Claude Design System, affinée sur deux passes UX/UI depuis, voir section 14) : palette sombre « Mountain Performance Intelligence » — fond `#0B0F0E`, surfaces `#121816`/`#18201D`, texte `#F4F7F5`/`#8E9B95` — avec le vert de marque `#6B8E4E` conservé comme accent unique et rare, typographies Raleway (titres) + Inter (texte, y compris les valeurs chiffrées), thème sombre par défaut (le clair reste disponible via bascule iconique). Sidebar de navigation compacte sur desktop (logo réduit, groupes produit/compte), barre de navigation en bas d'écran sur mobile. Grille 2 colonnes sur desktop pour la page Accueil (limiter le scroll), hiérarchie visuelle entre cartes (KPI compactes, contenu principal, Insight distinctif, contenu secondaire discret).

Références ou inspirations :
- Projet "ELEV Design System" sur claude.ai/design (palette, typographies, logo, composants) — voir `design-system/readme.md` pour le détail des choix de marque.

Règles UX :
- Doit rester lisible et rapide à consulter, y compris depuis un téléphone
- Les échéances les plus proches et les objectifs principaux doivent ressortir immédiatement (objectif principal mis en avant en vert de marque)

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
- Synchronisation entre appareils : export/import JSON manuel par défaut, synchro automatique optionnelle via Supabase (compte + projet à configurer par l'utilisateur, reste gratuit sur le plan de base)
- Rebranding complet ELEV importé depuis un projet Claude Design System (claude.ai/design) et appliqué à tout le site : palette navy/cloud/vert, typographies Raleway/Inter, logo officiel, sidebar de navigation desktop + barre de navigation mobile (remplace l'ancien menu du haut avec sous-menu "Plus")
- Thème sombre choisi comme thème par défaut (c'est la surface réelle du produit selon la charte ELEV) ; le thème clair reste disponible via la bascule, utile en plein soleil
- Site installable comme PWA (icône + manifeste) pour un accès en un tap depuis l'écran d'accueil du téléphone
- Carte GPS du parcours via Leaflet + fond OpenStreetMap (gratuit, sans clé API) plutôt qu'un tracé SVG sans fond de carte — accepté que la zone géographique de la séance soit transmise aux serveurs OSM à chaque affichage (seule entorse au fonctionnement 100% local du site)
- Radar de performance et indice de préparation détaillé calculés sur des repères fixes documentés dans le code (ex. 60 km/semaine, 2200 m D+/semaine), pas sur une comparaison à d'autres coureurs ni sur un service externe — à ajuster si les repères se révèlent irréalistes à l'usage
- Site à 8 pages (Accueil, Activités, Analyse, Objectifs, Plan, Profil, Équipements, Paramètres), toutes reliées par la même sidebar / barre de navigation mobile
- Refonte de l'Accueil en « cockpit de progression » : la charge d'entraînement est affichée en tendance qualitative (Stable / En hausse / Hausse rapide / En baisse, seuils documentés dans `app.js`) plutôt qu'en score sur 100 — aucune donnée de récupération n'est suivie (pas de sommeil, pas de FC repos dans le temps), donc pas de métrique « récupération » sur le dashboard
- L'Insight ELEV est entièrement déterministe (règles explicites sur le ratio charge aiguë/chronique), sans appel IA ni réseau — à ne pas confondre avec le retour IA post-séance ou l'estimation IA de temps de course, qui restent de vrais appels à l'API Claude
- FC max / FC repos ne se règlent qu'en page Profil (source unique) ; la page Accueil n'affiche qu'une répartition Z1-Z5 en lecture seule sur les 30 derniers jours
- Palette resserrée vers un thème plus sombre et plus contrasté (« Mountain Performance Intelligence », voir section 8) en gardant le vert de marque existant `#6B8E4E`
- Aperçu visuel de la dernière activité basé sur les données réelles de la séance (tracé GPS simplifié ou profil altimétrique en SVG, en bandeau horizontal pleine largeur), jamais une photo générique de montagne
- `design-system/readme.md` documente la charte réellement appliquée (palette, typographies, décisions de couleur) plutôt que la proposition initiale, qui divergeait sur plusieurs points (accent, police) — le reste de `design-system/` sert uniquement de référence historique
- Détail de séance transformé en page dédiée (`activite.html?id=...`) plutôt que la modale précédente : le volume de contenu voulu (carte + profil large, 6 onglets, splits, analyse des montées) dépassait ce qu'une fenêtre modale peut raisonnablement porter ; cohérent avec l'architecture multi-pages déjà en place
- Détection des montées par segmentation simple et documentée (seuil de D+ minimum 40 m, pente moyenne minimum 3 %, tolérance de repli 8 m avant de clore un segment) — pas d'algorithme de lissage/filtrage avancé, volontairement simple et vérifiable
- VAM calculée uniquement sur les segments de montée détectés (jamais sur l'ensemble de la sortie), affichée en m/h
- Le tracé GPS ↔ profil altimétrique est synchronisé (survol du profil = repère déplacé sur la carte + tooltip distance/altitude/allure/FC) ; les courbes des onglets Allure et Fréquence cardiaque restent volontairement indépendantes (pas synchronisées à la carte), pour limiter la complexité de cette phase
- Puissance et température ne sont disponibles qu'en moyenne de séance dans les fichiers .fit traités (pas point par point) : pas de courbe dédiée à ces deux métriques, seulement une valeur moyenne si présente
- Correctif : `assets/logo-full.png` (1254×1254px) n'était limité par aucune règle CSS sur les 7 pages hors Accueil, s'affichait donc à sa taille native et cassait toute la mise en page de la sidebar — bug préexistant, révélé par la nouvelle page `activite.html` qui réutilise la même sidebar, corrigé par une règle `.sidebar-brand > img{width:100%;height:auto}`
- Moteur FIT/Supabase (2026-08-14) : proposition initiale reçue (architecture Supabase complète — dizaines de tables, files d'attente pgmq, Edge Functions, versionnement de métriques) jugée disproportionnée pour un usage strictement personnel ; version allégée retenue à la place, mais **en conservant Supabase Auth + RLS comme fondation multi-utilisateurs dès maintenant** (plutôt que tout en local) car l'utilisateur envisage une éventuelle ouverture du site à d'autres traileurs si l'usage s'avère utile — la séparation des données par utilisateur est difficile à ajouter après coup, contrairement aux fonctionnalités FIT avancées (files d'attente, métriques versionnées) qui peuvent être ajoutées plus tard sans réécriture. Concrètement : table `activities` (une ligne par séance, remplace progressivement le bloc JSON unique `trail_data` pour les séances) + fichier `.fit` original conservé en Storage privé, sans worker séparé ni queue asynchrone. Voir `supabase/migrations/`.
- Bascule "Supabase = source de vérité + cache local" (2026-08-14, suite) : l'utilisateur prévoit de refaire l'ensemble des pages progressivement ; décision de n'appliquer ce nouveau modèle qu'aux pages déjà terminées (Accueil) ou en cours avec Claude (Activités), pas aux 4 pages pas encore refaites (Plan, Objectifs, Profil, Équipements), pour éviter de refaire ce travail lors de leur refonte. Connexion Supabase rendue **obligatoire** sur `index.html`/`historique.html`/`activite.html` uniquement (garde d'accès `assets/authgate.js` + page `connexion.html`), volontairement pas sur les 5 autres pages : si la config Supabase a un souci un jour, l'utilisateur ne doit pas perdre l'accès aux pages dont il a besoin au quotidien (Plan, Profil) alors qu'elles n'ont même pas encore besoin de Supabase. À étendre page par page à mesure que chaque page est refaite. Périmètre visé à terme (pas encore fait) : tables Supabase dédiées aussi pour le plan, les courses, le profil et les chaussures (aujourd'hui encore uniquement dans le bloc `trail_data`).

Choix refusés :
- Métriques génériques « état de forme », « récupération », « charge sur 100 » vues sur des maquettes de référence : non implémentées telles quelles, faute de données réelles pour les calculer honnêtement (voir décisions ci-dessus)
- Vert d'accent plus fluorescent vu sur certaines maquettes de référence : jugé moins cohérent avec l'identité déjà en place, le vert de marque existant a été conservé
- Sélecteur de période décoratif dans le header ("7 derniers jours") et lien "Comprendre pourquoi" sur l'Insight : proposés par une maquette mais sans fonction réelle derrière, donc non ajoutés
- Analyse détaillée des descentes (distance, D-, allure, FC par segment de descente) : non implémentée dans cette phase — priorité plus basse indiquée dans la demande, et les segments de descente sont plus bruités que les montées sur des données GPS/baro grand public
- Égaliser la hauteur des cartes via des hacks (`margin-top`, hauteurs fixes, `position:absolute`) : l'alignement de grille sur l'Accueil utilise `CSS Grid` + `align-items: stretch` natif

Si une décision technique importante doit être prise :
Claude doit expliquer les options simplement, recommander une option, puis attendre validation si l'impact est important.

## 15. Questions ouvertes

Questions à clarifier :
- Synchronisation Supabase : disponible et fonctionnelle, mais à confirmer à l'usage si elle reste pertinente une fois testée sur plusieurs appareils, ou si l'export/import JSON manuel suffit dans la pratique.
- Logo `assets/logo-full.png` (800 Ko, 1254×1254px) : l'affichage est désormais correctement contraint en CSS (voir section 14), mais le poids du fichier reste élevé pour une icône de sidebar ; pourrait être recompressé/redimensionné si cela devient gênant en chargement mobile.
- `design-system/` reste un dossier non suivi par Git (comme avant la refonte), y compris son `readme.md` mis à jour : à confirmer si l'utilisateur souhaite l'inclure dans le dépôt maintenant qu'il documente la charte réelle.
- La sidebar de `index.html` a divergé des 7 autres pages lors de la refonte : icône montagne + texte « ELEV » au lieu de `logo-full.png`, séparateur visuel entre navigation produit/compte, bloc utilisateur (avatar + prénom) en bas — à harmoniser si une prochaine refonte touche ces pages.

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
