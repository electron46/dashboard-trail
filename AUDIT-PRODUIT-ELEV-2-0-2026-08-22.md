# Audit produit ELEV 2.0 — expérience trail premium et différenciante

Date : 22 août 2026  
Périmètre : produit web ELEV, pages principales, logique de données, responsive, accessibilité, différenciation, système ELEV Insight et trajectoire ELEV 2.0.  
Statut : audit et recommandations uniquement. Aucun code produit n’a été modifié dans cette mission.

---

## Légende de preuve

- OBSERVÉ : vérifié dans le code, les tests, le navigateur ou les fichiers réellement présents.
- DÉDUIT : conclusion raisonnable tirée de plusieurs observations.
- RECOMMANDATION : proposition de produit, d’UX, de design ou d’architecture.
- À VALIDER : point qui demande des données utilisateur réelles, un choix produit ou une mesure complémentaire.

## Méthode et limites

L’audit combine :

- lecture de CLAUDE.md et de l’architecture réelle du dépôt ;
- inspection ciblée des calculs dans assets/app.js et des pages HTML ;
- exécution de la suite de tests : 56 tests sur 56 réussis ;
- lecture de trois fichiers FIT réels par le harnais existant, sans extrapoler de conclusion sportive personnelle ;
- vérification du CSV réel : 84 séances planifiées reconnues ;
- audit navigateur à 1440 × 900 et 390 × 844 ;
- vérification de neuf pages avec un jeu de test isolé, plus états vide et partiel ;
- contrôle de la version publique GitHub Pages ;
- benchmark sur des sources officielles actuelles et quelques publications scientifiques ;
- application des règles de la skill ui-ux-pro-max demandée.

Les données de navigateur servant à éprouver les états de l’interface sont des données de test isolées. Elles ne sont jamais présentées comme des données de l’utilisateur.

Limites :

- aucune étude utilisateur ni entretien qualitatif n’a été réalisé ;
- aucune mesure terrain avec protocole sportif contrôlé n’a été conduite ;
- les conclusions sur la valeur perçue restent donc À VALIDER avec des traileurs ;
- l’audit ne remplace pas une validation médicale ou scientifique des indicateurs physiologiques.

---

# 1. Résumé exécutif

## Verdict

OBSERVÉ — ELEV n’est plus un simple prototype fragile. La base est sérieuse : import FIT robuste, stockage local-first, sauvegarde, synchronisation optionnelle, navigation cohérente, design trail reconnaissable, états vides globalement honnêtes, responsive sans débordement général et 56 tests sur 56 réussis.

DÉDUIT — Le principal risque n’est plus la solidité technique. C’est désormais la confiance sémantique : certains intitulés et scores paraissent plus scientifiques et personnalisés que les calculs ne le permettent.

Verdict à deux niveaux :

- GO pour continuer ELEV comme tableau de bord trail local-first et pour faire évoluer son expérience ;
- NO-GO pour promouvoir comme fiables, en l’état, l’« excellente préparation », le « profil de performance » et certains conseils de charge sans garde-fous de couverture, de comparabilité et de confiance.

## Score global

**74 / 100**

Ce score est une appréciation d’audit, pas une mesure scientifique. Il récompense une base technique et visuelle solide, mais pénalise fortement les indicateurs qui peuvent surinterpréter les données.

## Les trois décisions les plus importantes

1. RECOMMANDATION — Faire de la confiance dans la donnée une fonctionnalité visible : source, période, couverture et niveau de confiance doivent accompagner tout insight important.
2. RECOMMANDATION — Recentrer la proposition de valeur sur ce que le terrain a changé dans l’effort, pas sur un nouveau tableau de scores génériques.
3. RECOMMANDATION — Recomposer l’Accueil et la page Activité autour d’un seul signal prioritaire et de « trois choses à retenir », puis reléguer l’analyse avancée derrière une exploration volontaire.

## La grande idée

**ELEV est l’intelligence du terrain : trois signaux fiables pour comprendre ce que le relief a changé dans ton effort et dans ta préparation.**

## Ce qu’il faut absolument préserver

- le modèle local-first et la possibilité d’utiliser ELEV sans compte ;
- le parsing FIT et les contrôles d’intégrité actuels ;
- la scène de terrain pleine largeur alimentée par le GPX réel ;
- l’identité sombre, minérale et calme ;
- la sobriété du langage actuel, qui évite déjà le diagnostic médical ;
- le socle HTML/CSS/JavaScript simple tant qu’il reste maintenable ;
- les états « donnée indisponible » plutôt qu’un chiffre inventé.

---

# 2. Scorecard

| Dimension | Score | Preuve principale | Verdict |
|---|---:|---|---|
| Robustesse et intégrité des données | 88 | 56/56 tests, trois FIT réels, sauvegarde et synchronisation protégées | Très solide |
| UI et identité visuelle | 83 | scène terrain distinctive, palette cohérente, rendu desktop et mobile stable | Premium, encore inégal |
| Accessibilité | 86 | structure, contraste et navigation déjà audités ; correctifs présents | Bonne base |
| UX générale | 73 | parcours clair, mais densité et répétitions sur Analyse, Objectifs et Plan | À simplifier |
| Mobile | 74 | aucun débordement global ; ordre du contenu et onglets horizontaux perfectibles | Fonctionnel, pas encore exemplaire |
| Spécificité trail | 79 | D+, profil, montées, VAM, locomotion, objectif trail | Réelle, mais mesures montée/descente à affiner |
| Architecture de l’information | 69 | navigation claire ; trop de blocs concurrents et de pages-cockpits | Manque de hiérarchie |
| Interprétation et confiance | 54 | score de préparation, radar et tendances sans couverture suffisante | Risque majeur |
| Différenciation produit | 72 | monde visuel fort et Insight existant ; promesse encore trop proche des dashboards sportifs | Potentiel élevé |
| Maintenabilité du code | 75 | stack simple, fonctions partagées, mais app.js très concentré | Correct, à découpler progressivement |

## Lecture synthétique

OBSERVÉ — ELEV est plus fort que sa note globale sur la fiabilité de l’import et la qualité de son monde visuel.

DÉDUIT — La note est tirée vers le bas parce que les éléments les plus visibles sont aussi ceux qui peuvent engager le plus la confiance : préparation, performance, progression et recommandations.

---

# 3. Top 10 des problèmes

## P0-1 — La préparation n’est pas réellement liée à chaque course

- Observation — computePrepStatus reçoit une date de course, mais ne l’utilise pas. Le calcul prend les 28 derniers jours et le même plan pour tous les objectifs.
- Diagnostic — la page donne l’apparence d’un cockpit par course alors que volume et D+ ne sont pas contextualisés par course.
- Conséquence — plusieurs objectifs peuvent partager artificiellement le même état de préparation.
- Recommandation — ajouter une liaison explicite plan ↔ objectif, puis calculer chaque état dans une fenêtre pertinente pour cette course. Sans liaison, afficher « préparation générale ».
- Impact — Très fort.
- Effort — Moyen.
- Priorité — P0 crédibilité.
- Preuve — assets/app.js, lignes 3076 à 3117.

## P0-2 — Un dépassement du plan peut améliorer le score global

- Observation — les ratios supérieurs à 100 % sont plafonnés à 100 avant la moyenne. Un volume à 152 % du plan peut donc contribuer comme une réussite parfaite, même si une autre zone de la page signale une surcharge.
- Diagnostic — le calcul confond accomplissement de la cible et dépassement potentiellement défavorable.
- Conséquence — ELEV peut afficher « Excellente préparation » et « dépasse nettement la cible » simultanément.
- Recommandation — séparer adéquation au plan et risque de divergence. Un intervalle cible vaut « aligné » ; au-dessus, le score d’adéquation doit redescendre ou devenir non scoré avec alerte.
- Impact — Très fort.
- Effort — Faible à moyen.
- Priorité — P0 crédibilité.
- Preuve — assets/app.js, lignes 3086 à 3093, 3114 à 3117 et 3178 à 3191.

## P0-3 — Le « profil de performance » mesure surtout de l’exposition

- Observation — « Montée » et « Descente » sont basées sur le D+ et D− hebdomadaire par rapport à 2 200 m. « Endurance » utilise le volume des seules semaines actives. « Résistance » compare uniquement la FC moyenne des deux moitiés d’une sortie longue.
- Diagnostic — volume de pratique, performance et résistance physiologique sont mélangés.
- Conséquence — le radar peut donner une note de capacité sans mesurer la vitesse à pente comparable, l’efficacité, la technique de descente ou une dérive contrôlée.
- Recommandation — à court terme, renommer « Profil d’exposition trail ». À moyen terme, remplacer les axes par des mesures comparables, avec disponibilité et confiance.
- Impact — Très fort.
- Effort — Faible pour le renommage, fort pour le nouveau calcul.
- Priorité — P0 crédibilité.
- Preuve — assets/app.js, lignes 3681 à 3751.

## P1-4 — Les comparaisons peuvent exploser quand la période précédente est incomplète

- Observation — dans le jeu de test isolé, la page Analyse affiche des variations supérieures à +400 %.
- Diagnostic — la durée calendaire est comparable, mais pas toujours la profondeur d’historique réellement disponible.
- Conséquence — les écarts spectaculaires dominent l’écran et donnent une fausse impression de progression.
- Recommandation — exiger une couverture minimale comparable ; sinon afficher une valeur brute et « historique précédent incomplet ».
- Impact — Fort.
- Effort — Moyen.
- Priorité — P1.

## P1-5 — Les insights de charge n’ont pas de seuil minimal d’historique

- Observation — getTrainingTrend accepte deux séances et compare la dernière fenêtre de sept jours à une moyenne de quatre fenêtres incluant la période aiguë. Dans l’état partiel à deux activités, ELEV conseille déjà de surveiller la récupération.
- Diagnostic — l’algorithme sait produire un ratio avant d’avoir une base stable.
- Conséquence — un nouvel utilisateur reçoit un conseil préoccupant à partir d’un historique trop court ; la page Plan peut le montrer même sans plan.
- Recommandation — quatre semaines réellement couvertes au minimum, trois semaines non vides recommandées, et aucun conseil de récupération si les données de récupération ne sont pas suivies.
- Impact — Fort.
- Effort — Faible.
- Priorité — P1.
- Preuve — assets/app.js, lignes 3468 à 3501 et 3565 à 3585.

## P1-6 — Le débrief d’activité commence par les données brutes, pas par l’essentiel

- Observation — sur desktop comme sur mobile, carte, profil et résumé occupent le premier écran ; Insight ELEV arrive plus bas.
- Diagnostic — la page répond d’abord « quelles valeurs ? » avant « qu’est-ce que je dois retenir ? ».
- Conséquence — l’utilisateur doit analyser lui-même la séance ; la promesse d’intelligence reste secondaire.
- Recommandation — placer immédiatement après le titre « 3 choses à retenir », puis le récit du terrain, puis les données avancées.
- Impact — Fort.
- Effort — Moyen.
- Priorité — P1.

## P1-7 — Le mobile est responsive mais pas assez hiérarchisé

- Observation — aucune page ne déborde globalement à 390 px, mais Analyse, Objectifs, Plan et Activité utilisent des barres d’onglets horizontales ; un scrollbar visible apparaît sous Analyse. Les grandes variations chiffrées occupent le premier écran.
- Diagnostic — la version mobile conserve trop fidèlement la structure desktop.
- Conséquence — effort de lecture élevé et contenu décisif repoussé.
- Recommandation — un résumé vertical prioritaire ; remplacer les onglets longs par un sélecteur compact ou des sections repliables.
- Impact — Fort.
- Effort — Moyen.
- Priorité — P1.

## P1-8 — Les pentes positives et négatives sont fusionnées sans l’expliquer

- Observation — la répartition par pente utilise la valeur absolue : montée et descente sont confondues. L’interface visible indique seulement « Répartition par pente ».
- Diagnostic — deux contraintes trail physiologiquement et biomécaniquement distinctes sont agrégées.
- Conséquence — « temps à plus de 15 % » est ambigu et le conseil de locomotion peut mélanger montée et descente.
- Recommandation — séparer montée, descente et plat ; lisser l’altitude avant la pente ; afficher la couverture et la méthode.
- Impact — Fort.
- Effort — Moyen à fort.
- Priorité — P1.
- Preuve — assets/app.js, lignes 2500 à 2562 ; analyse.html, lignes 132 à 136.

## P2-9 — Les cockpits se répètent au lieu de sélectionner

- Observation — Accueil, Analyse, Objectifs et Plan répètent volume, D+, charge et Insight sous plusieurs formes.
- Diagnostic — chaque page veut être exhaustive.
- Conséquence — le produit paraît plus lourd et moins sûr de son message.
- Recommandation — attribuer une question unique à chaque page et supprimer les doublons :
  - Accueil : « que dois-je regarder aujourd’hui ? »
  - Activité : « que s’est-il passé ? »
  - Analyse : « qu’est-ce qui change sur la durée ? »
  - Objectif : « suis-je aligné avec cette course ? »
  - Plan : « que dois-je exécuter maintenant ? »
- Impact — Moyen à fort.
- Effort — Moyen.
- Priorité — P2.

## P2-10 — L’application est installable mais pas réellement hors ligne

- Observation — un manifest est présent, mais aucun service worker ni cache hors ligne n’existe.
- Diagnostic — la coque PWA est incomplète.
- Conséquence — l’icône installée peut laisser attendre une disponibilité sans réseau que le produit ne garantit pas.
- Recommandation — soit livrer un mode hors ligne explicite, soit éviter toute promesse « application hors ligne ».
- Impact — Moyen.
- Effort — Moyen.
- Priorité — P2.
- Preuve — test OK-6 de la suite actuelle.

---

# 4. Audit UX/UI complet

## 4.1 Architecture de l’information

OBSERVÉ — La navigation principale est stable : Aujourd’hui, Activités, Progression, Objectif, Plan, Profil, Équipements, Paramètres. Sur mobile, cinq destinations restent directement accessibles et les secondaires passent dans « Plus ».

Points forts :

- les noms sont compréhensibles sans jargon ;
- le rail desktop et la barre mobile restent cohérents entre les pages ;
- la page Activité est accessible par URL ;
- le skip-link et la hiérarchie principale ont déjà été corrigés.

Faiblesses :

- Progression, Objectif et Plan contiennent chacun plusieurs niveaux d’analyse similaires ;
- l’Accueil est à la fois scène d’objectif, dashboard hebdomadaire, charge, intensité, matériel et dernière sortie ;
- les onglets transforment des pages déjà longues en mini-applications.

RECOMMANDATION — Conserver les pages mais réduire leur mandat, sans changer d’architecture technique :

| Page | Question principale | Contenu secondaire |
|---|---|---|
| Aujourd’hui | Que dois-je regarder maintenant ? | Explorer la semaine |
| Activités | Quelle sortie ouvrir ? | Filtres et repères |
| Activité | Qu’est-ce que le terrain a changé ? | Données détaillées |
| Progression | Qu’est-ce qui évolue réellement ? | Analyse avancée |
| Objectif | Suis-je aligné avec cette course ? | Construction de la préparation |
| Plan | Quelle séance exécuter et où en suis-je ? | Historique du plan |

## 4.2 Accueil

OBSERVÉ — La scène de l’objectif pleine largeur est le composant le plus différenciant du produit. Le profil réel, le point culminant et la préparation composent une entrée plus émotionnelle qu’un dashboard classique.

OBSERVÉ — Avec des données complètes, le 97 % de préparation attire davantage l’attention que le reste. Avec peu de données, la charge peut produire un signal fort trop tôt. Sans séances, les états restent honnêtes.

DÉDUIT — L’Accueil possède déjà le bon monde visuel, mais pas encore la bonne hiérarchie décisionnelle.

RECOMMANDATION — Au-dessus de la ligne de flottaison :

1. objectif principal et compte à rebours ;
2. une phrase d’état ;
3. une seule action ou attention ;
4. un aperçu de la semaine ;
5. ensuite seulement les détails.

À réduire :

- double affichage du score ;
- charge et intensité quand aucun signal n’est réellement actionnable ;
- alertes équipement dans le flux principal, sauf urgence réelle.

## 4.3 Analyse globale

OBSERVÉ — La page est riche et techniquement cohérente : KPIs, progression, D+/D−, VAM, locomotion, pente, zones, repères. Sur desktop, cinq cartes apparaissent sur la première ligne et « séances » tombe seule sur la seconde. Sur mobile, les grandes variations chiffrées remplissent l’écran.

DÉDUIT — La page répond à trop de questions simultanément et donne autant d’importance à des variations fragiles qu’à des tendances robustes.

RECOMMANDATION — Nouvelle hiérarchie :

1. une tendance fiable avec couverture ;
2. trois changements classés par importance ;
3. un choix « Volume / Terrain / Effort » ;
4. détail avancé.

Supprimer le radar de performance de la surface principale tant qu’il n’est pas redéfini.

## 4.4 Objectifs

OBSERVÉ — La page présente une scène d’objectif forte, des sous-scores lisibles et des recommandations. Elle peut toutefois montrer un score excellent malgré un dépassement significatif du plan.

DÉDUIT — La page mélange trois concepts :

- disponibilité des données ;
- alignement avec le plan ;
- capacité sportive supposée.

RECOMMANDATION — Afficher séparément :

- Couverture : « 10 semaines sur 12 disponibles » ;
- Alignement au plan : distance, D+, séances clés ;
- Spécificité objectif : sortie longue, verticalité et terrain comparable ;
- Incertitude : ce qu’ELEV ne peut pas conclure.

## 4.5 Plan

OBSERVÉ — Le calendrier, la semaine en cours et la prochaine séance sont utiles. Mais une dynamique de charge peut être affichée même sans plan.

RECOMMANDATION — Le premier écran doit contenir uniquement :

- séance du jour ;
- progression de la semaine ;
- prochain jalon ;
- une alerte de divergence si elle est fondée.

Tout le reste peut vivre dans « Explorer le plan ».

## 4.6 Activité

OBSERVÉ — Carte, profil altimétrique, résumé, zones, montées, onglets détaillés et Coach ELEV sont présents. La carte OpenStreetMap claire rompt avec la direction sombre et minérale.

RECOMMANDATION — Recomposition décrite en section 8. La carte doit adopter un fond cohérent ou être visuellement subordonnée au profil.

## 4.7 États vide, partiel et erreur

OBSERVÉ — Les états sans données sont globalement de bonne qualité :

- Historique et Analyse proposent une action d’import claire ;
- Équipements explique l’absence ;
- Accueil ne fabrique pas de valeur.

Points à corriger :

- Objectifs et Plan laissent encore voir des onglets et des structures vides ;
- un historique partiel peut déclencher trop tôt un jugement ou un conseil ;
- l’état « données insuffisantes » doit être distinct de « résultat faible ».

## 4.8 Onboarding

OBSERVÉ — Le choix « Sur cet appareil » / « Avec synchronisation » est clair et rassurant. L’import de la première activité est direct.

Point mineur :

- l’indication « Étape 2 sur 3 » et « Étape 3 sur 3 » est répétée visuellement.

RECOMMANDATION — Ajouter une phrase de valeur avant l’import : « ELEV transforme ta sortie en trois signaux liés au terrain. »

## 4.9 Accessibilité et interaction

OBSERVÉ — La structure principale et le contraste sont solides. Le rail mobile actif atteint 10,05:1 dans le test actuel.

À VALIDER ou corriger :

- certains liens textuels observés ont une hauteur visuelle inférieure à 24 px ;
- les attributions de la carte sont petites, même si elles proviennent du composant tiers ;
- le scrollbar horizontal des onglets Analyse dégrade la perception de finition ;
- les graphiques doivent tous garder un résumé textuel et une lecture sans couleur.

---

# 5. Audit de la donnée et des calculs

## 5.1 Ce qui est fiable aujourd’hui

OBSERVÉ :

- import FIT avec contrôle CRC et refus explicite d’un fichier altéré ;
- trois FIT réels analysés sans régression ;
- dates civiles respectant le fuseau de la séance ;
- identité stable et détection des doublons ;
- écriture stockage séance puis index, avec retour arrière en cas d’échec ;
- export/import canonique ;
- synchronisation qui conserve les données locales en cas d’échec ;
- données sensibles non stockées dans le navigateur ;
- absence d’appel direct à Anthropic depuis le client ;
- 84 lignes de plan réelles reconnues.

## 5.2 Données réellement disponibles dans un FIT ELEV

OBSERVÉ — Le parseur peut exploiter, selon le fichier :

- horodatage ;
- distance ;
- altitude et altitude améliorée ;
- fréquence cardiaque ;
- cadence ;
- vitesse et vitesse améliorée ;
- puissance ;
- température ;
- latitude et longitude ;
- résumé de séance ;
- tours ;
- événements ;
- informations d’appareil ;
- inventaire de champs développeur ou inconnus.

RECOMMANDATION — Construire une matrice de couverture par activité :

| Signal | Couverture | Qualité | Usage autorisé |
|---|---:|---|---|
| Altitude | % de points valides | baro / GPS / inconnue | profil, D+, pente |
| FC | % du temps valide | ceinture / poignet / inconnue | zones, effort |
| Cadence | % du temps valide | source FIT | course/marche |
| GPS | % du tracé | continuité | carte, segments comparables |
| Puissance | % du temps valide | native / estimée / inconnue | seulement si source explicite |

## 5.3 Calculs à conserver

- détection déterministe des montées, avec seuils documentés ;
- non-affichage course/marche si la cadence couvre moins de 60 % de la séance ;
- absence de delta quand la période de référence vaut zéro ;
- distinction entre période partielle et semaine complète ;
- repères de période nommés « repères » plutôt que « records ».

## 5.4 Calculs à corriger

### Préparation

- le paramètre de date de course n’est pas utilisé ;
- le plan n’est pas explicitement relié à une course ;
- les ratios sont plafonnés avant agrégation ;
- les repères génériques 60 km/semaine, 2 200 m D+/semaine et 15 % de Z3+ deviennent des notes personnalisées ;
- seules les semaines actives entrent dans certaines moyennes ;
- la moyenne globale ignore le nombre de dimensions disponibles et leur confiance.

### Charge

- la moyenne chronique inclut la période aiguë ;
- deux séances suffisent ;
- le ratio est une observation de volume, mais le texte peut suggérer une récupération à surveiller ;
- aucune donnée sommeil, HRV quotidienne, FC de repos temporelle ou ressenti n’est disponible.

RECOMMANDATION — Ne jamais transformer ce ratio en prédiction de blessure ou de récupération. La littérature sur l’acute:chronic workload ratio demeure discutée ; ELEV doit rester descriptif.

### Radar

- montée et descente mesurent du volume vertical, pas une aptitude ;
- vitesse repose sur le meilleur tour roulant disponible ;
- résistance repose sur deux moyennes de FC, sans contrôle de vitesse, puissance, pente, chaleur ou hydratation ;
- régularité mesure la présence d’une séance par semaine.

### Pente et locomotion

- pente calculée point à point ;
- pas de lissage explicite avant classement ;
- montée et descente fusionnées par valeur absolue ;
- l’agrégat course/marche par pente ne publie pas sa couverture globale.

## 5.5 Principe de confiance recommandé

Chaque résultat interprété doit transporter :

- source ;
- fenêtre ;
- population de comparaison ;
- couverture ;
- méthode ;
- confiance ;
- limites ;
- action éventuelle.

Exemple :

> Montées raides — marche majoritaire à partir de 15–20 %. Comparaison sur 6 sorties avec cadence couvrant 87 % du temps. Confiance : moyenne. Les descentes sont exclues.

---

# 6. ELEV Insight 2.0

## 6.1 Rôle

RECOMMANDATION — ELEV Insight ne doit pas être un texte décoratif sous un dashboard. Il doit être le système de hiérarchisation de tout le produit.

Sa mission :

1. détecter un fait ;
2. vérifier qu’il est comparable ;
3. estimer sa fiabilité ;
4. expliquer pourquoi il compte ;
5. proposer une action uniquement si elle est justifiée.

## 6.2 Contrat de donnée

Chaque insight devrait contenir :

| Champ | Rôle |
|---|---|
| id | stabilité et test |
| famille | terrain, effort, charge, objectif, donnée |
| observation | fait mesuré |
| référence | activité, période ou segment comparable |
| delta | écart, si pertinent |
| couverture | quantité de données utilisables |
| confiance | haute, moyenne, faible |
| importance | critique, attention, notable, contexte |
| pourquoi | conséquence pour la lecture |
| action | optionnelle |
| limites | ce qui n’est pas mesuré |
| preuves | identifiants d’activités et champs sources |

## 6.3 Garde-fous

- aucune tendance avec moins de quatre semaines couvertes ;
- aucune comparaison d’activité avec moins de trois activités réellement comparables ;
- aucune dérive cardiaque sur une sortie dont l’effort externe varie fortement ;
- aucune aptitude « montée » ou « descente » à partir du seul D+/D− ;
- aucun conseil de récupération sans données de récupération ;
- aucun score global si moins de trois dimensions fiables sont disponibles ;
- toute estimation porte le mot « estimation » ;
- toute donnée absente reste indisponible ;
- une alerte de qualité de donnée passe avant une recommandation sportive.

## 6.4 Priorisation

Ordre recommandé :

1. qualité ou intégrité de la donnée ;
2. divergence importante avec l’objectif ou le plan ;
3. changement significatif sur un repère comparable ;
4. point fort ou progrès ;
5. contexte descriptif.

Maximum :

- un insight principal ;
- deux insights secondaires ;
- jamais deux messages de la même famille sur le même écran.

## 6.5 Familles d’insights

| Famille | Exemple | Données minimales | Confiance |
|---|---|---|---|
| Signature terrain | 32 % du temps en montée de 10–20 % | altitude + distance lissées | selon couverture |
| Locomotion en montée | marche majoritaire au-delà de 15 % | cadence + pente positive | moyenne à haute |
| Montée comparable | VAM +6 % sur une montée comparable | segments proches en pente, durée et longueur | moyenne |
| Descente comparable | vitesse stable à pente similaire | GPS/altitude de qualité | moyenne |
| Gestion d’effort | départ plus intense que les sorties comparables | FC + effort externe comparable | moyenne |
| Dérive contrôlée | FC/effort externe se découple en fin de segment stable | FC + vitesse ou puissance + pente stable | moyenne |
| Alignement au plan | D+ réalisé sous la plage visée | plan lié + activité | haute |
| Spécificité objectif | longues montées encore peu représentées | GPX objectif + historique | moyenne |
| Qualité de donnée | cadence trop incomplète | inventaire FIT | haute |

## 6.6 Exemple de rendu

Insight principal :

> **Le terrain raide est devenu ton principal facteur de ralentissement.**  
> Sur 5 sorties comparables, la marche devient majoritaire entre 15 et 20 % de pente positive. Couverture cadence : 84 %. Confiance : moyenne.  
> À explorer : comparer une montée de durée proche sur les quatre dernières semaines.

Ce rendu est préférable à une note opaque, car il expose le fait, la référence et la limite.

---

# 7. Dashboard 2.0

## Objectif

Répondre en dix secondes à : « Où j’en suis, qu’est-ce qui compte et quelle est la prochaine étape ? »

## Structure recommandée

### Écran 1 — Aujourd’hui

- objectif principal avec profil réel ;
- phrase d’état unique ;
- insight prioritaire ;
- prochaine séance ou prochaine action ;
- progression de la semaine en trois valeurs maximum.

### Écran 2 — Trajectoire

- volume et D+ sur quatre à six semaines ;
- plage cible du plan si elle existe ;
- historique incomplet clairement hachuré ou nommé ;
- bascule « distance / dénivelé », pas deux graphiques concurrents.

### Écran 3 — Dernière activité

- identité de la sortie ;
- une phrase de débrief ;
- accès à l’activité ;
- pas de duplication complète des métriques.

### Écran 4 — À surveiller

- matériel seulement si seuil réellement franchi ;
- qualité de donnée ;
- synchronisation ;
- aucune carte sans signal.

## Ce qui disparaît de l’Accueil principal

- radar ;
- grille de six KPIs ;
- zones FC détaillées ;
- comparaison multi-périodes ;
- plusieurs insights de même niveau ;
- cartes vides conservées pour remplir.

## Wireframe textuel

    [OBJECTIF + TERRAIN RÉEL]
    Mafate Trail — J-68
    État : préparation générale alignée, D+ récent au-dessus du plan

    [INSIGHT PRIORITAIRE]
    Le D+ dépasse la plage prévue depuis 2 semaines
    Confiance haute · voir le calcul

    [CETTE SEMAINE]
    36 km · 1 850 m D+ · 3/4 séances
    Prochaine séance : endurance 1 h 15

    [TRAJECTOIRE] [DERNIÈRE ACTIVITÉ]
    Puis « Explorer »

---

# 8. Page Activité 2.0

## Promesse

« Je comprends ma sortie avant de parcourir mes graphiques. »

## Ordre recommandé

### 1. Identité de la sortie

- titre, date, lieu si réellement disponible ;
- trace compacte ;
- distance, durée, D+, effort ;
- qualité des capteurs.

### 2. Trois choses à retenir

Exemples de familles, jamais de phrases inventées :

- terrain ;
- gestion de l’effort ;
- comparaison pertinente.

Si une seule observation est solide, en afficher une seule.

### 3. Récit du terrain

- profil altimétrique dominant ;
- carte synchronisée au profil ;
- montée, descente et roulant séparés ;
- montées principales ;
- points de bascule course/marche.

### 4. Effort

- FC et zones ;
- cadence ;
- puissance si source fiable ;
- chronologie, pas seulement agrégats.

### 5. Comparaisons

- activités du même type ;
- segments de terrain comparables ;
- historique et critères visibles.

### 6. Analyse avancée

- tours ;
- données brutes ;
- événements ;
- Coach ELEV ;
- export.

## Direction visuelle

RECOMMANDATION — Faire du profil la scène centrale et de la carte une couche de contexte. Une carte sombre ou désaturée évitera la rupture visuelle actuelle avec OpenStreetMap.

---

# 9. Expérience WOW et direction artistique

## Direction 1 — Terrain Intelligence — recommandée

Concept : le terrain réel devient l’interface.

- grandes lignes de crête ;
- profils GPX comme signature ;
- cartographie discrète ;
- données qui apparaissent au point du parcours concerné ;
- vert lumineux réservé aux données réelles et aux éléments actifs ;
- surfaces charbon neutres ;
- mouvement lent de lecture, jamais décoratif.

Pourquoi : c’est la direction la plus propre à ELEV et la plus compatible avec l’existant.

## Direction 2 — Instrument d’expédition

Concept : un outil de terrain précis, presque topographique.

- grilles, repères, coordonnées, altitude ;
- typographie numérique plus présente ;
- palette froide et minérale ;
- interaction dense mais méthodique.

Risque : peut devenir trop technique et impersonnel.

## Direction 3 — Éditorial alpin

Concept : raconter la sortie comme un article de montagne.

- titres amples ;
- alternance de grandes scènes et de données ;
- légendes détaillées ;
- synthèses très lisibles ;
- peu de cartes.

Risque : moins efficace pour une consultation quotidienne rapide.

## Règles anti-cliché

- pas de montagne décorative sans rapport avec la donnée ;
- pas de vert néon sur tous les graphiques ;
- pas de cartes superposées dans des cartes ;
- pas de rangées infinies de KPIs ;
- pas de score circulaire si la cible n’est pas scientifiquement fondée ;
- pas d’animation sans cause fonctionnelle.

---

# 10. Design system recommandé

## Conserver

OBSERVÉ — Le système actuel est déjà riche et documenté :

- canvas #0C0F0E ;
- surfaces #181D1B, #202622 et #242B27 ;
- accent de marque #6B8E4E ;
- vert de signal #62F58C ;
- Raleway pour les titres ;
- Inter pour le texte ;
- IBM Plex Mono pour les données ;
- échelles d’espacement, de rayon, de texte et de couleur.

RECOMMANDATION — Ne pas remplacer ce système. L’étendre avec des rôles de confiance et de terrain.

## Tokens sémantiques à ajouter

| Token | Rôle |
|---|---|
| signal-primary | donnée réelle la plus importante |
| signal-secondary | série secondaire |
| confidence-high | preuve suffisante |
| confidence-medium | estimation utilisable avec réserve |
| confidence-low | contexte seulement |
| data-observed | mesure directe |
| data-inferred | calcul ou estimation |
| data-unavailable | absence honnête |
| terrain-up | montée |
| terrain-down | descente |
| terrain-flat | roulant |
| baseline-known | comparaison complète |
| baseline-partial | comparaison incomplète |

Ne pas dépendre de la couleur seule : texte, motif ou forme doivent porter le statut.

## Composants

### InsightCard

- priorité ;
- titre ;
- observation ;
- référence ;
- confiance ;
- « Pourquoi ? » ;
- accès aux preuves.

### MetricWithBaseline

- valeur ;
- unité ;
- période ;
- référence ;
- delta ;
- état de couverture.

### DataQualityBadge

- mesure directe / estimation ;
- couverture ;
- source ;
- détail accessible.

### TerrainSegment

- montée / descente / roulant ;
- longueur ;
- pente moyenne ;
- D+ ou D− ;
- temps ;
- effort ;
- comparabilité.

### EmptyState

- ce qui manque ;
- pourquoi ;
- action ;
- aucune structure analytique vide derrière.

## Responsive

- 375 px : résumé prioritaire, sections verticales, aucun onglet horizontal obligatoire ;
- 768 px : deux colonnes maximum ;
- 1024 px et plus : scène + panneau de décision ;
- les analyses denses passent derrière « Explorer ».

---

# 11. Benchmark

## Strava

OBSERVÉ — Athlete Intelligence génère un résumé personnalisé à partir de l’activité et d’activités passées pertinentes, puis propose « Say More » pour approfondir. Strava n’utilise pas l’IA pour certaines données estimées et permet un retour utilisateur sur la qualité du résumé.  
Source : [Strava — Athlete Intelligence](https://support.strava.com/en-us/articles/15401629-athlete-intelligence-on-strava)

À retenir :

- résumé d’abord, détail ensuite ;
- contexte d’objectif ;
- boucle de feedback ;
- limites explicites sur certaines métriques.

À ne pas copier :

- le texte génératif opaque comme preuve ;
- la dépendance à un abonnement ou à un cloud.

## Garmin

OBSERVÉ — Garmin conditionne ses métriques avancées à des prérequis explicites : historique de VO2 max, fréquence cardiaque et matériel compatible. Quand l’historique manque, le produit affiche « No Status ». ClimbPro sépare montées et descentes et montre pente, distance et dénivelé restant. Le widget de course principale personnalise le suivi autour d’un objectif déclaré.  
Sources : [Garmin — Training Status](https://support.garmin.com/sv-SE/?faq=VxKazDQ2mkAmDoQbJriEBA&productID=125677&tab=), [Garmin — Performance Condition](https://support.garmin.com/en-IE/?faq=A28UA4k16v1qjjGuvSFgo8), [Garmin — ClimbPro](https://support.garmin.com/en-GB/?faq=b31oDQ7QEH6QP5wNaywkYA&identifier=621922&tab=topics), [Garmin — Primary Race](https://support.garmin.com/en-IN/?faq=TW359dqkIVAI0OGRpakmT6)

À retenir :

- seuils d’éligibilité ;
- objectif principal explicite ;
- montée et descente distinctes ;
- indisponibilité assumée.

## COROS

OBSERVÉ — EvoLab sépare charge à sept jours et base à quarante-deux jours, expose ses fenêtres et précise que l’outil apprend avec l’historique. COROS avertit aussi que le minuteur de récupération a des limites, notamment après un ultra.  
Source : [COROS — EvoLab](https://support.coros.com/hc/en-us/articles/38180411247892-EvoLab)

À retenir :

- fenêtres visibles ;
- limite du modèle affichée ;
- ne pas transformer une estimation en vérité universelle.

## TrainingPeaks

OBSERVÉ — Le Performance Management Chart rend fitness et fatigue configurables et attribue les valeurs extrêmes à de mauvaises données ou de mauvais réglages dans sa documentation.  
Sources : [TrainingPeaks — PMC](https://help.trainingpeaks.com/hc/en-us/articles/204071874-Performance-Management-Chart-PMC), [TrainingPeaks — problèmes de PMC](https://help.trainingpeaks.com/hc/en-us/articles/115004969547-What-is-wrong-with-my-Performance-Management-Chart)

À retenir :

- les métriques de charge ont besoin d’un diagnostic de qualité ;
- une valeur extrême doit d’abord déclencher une vérification.

## Runalyze

OBSERVÉ — Runalyze nomme explicitement son VO2 max « estimation », permet d’exclure des activités et ignore par défaut les trails pour cette estimation, car le ratio allure/FC y devient peu fiable.  
Sources : [Runalyze — VO2max](https://runalyze.com/help/article/vo2max?_locale=en), [Runalyze — trails exclus](https://runalyze.com/help/article/effective-vo2max-values-grayed-out?_locale=en)

À retenir :

- le terrain casse la comparabilité des métriques routières ;
- l’exclusion est parfois plus fiable qu’un chiffre.

## Suunto

OBSERVÉ — ZoneSense repose sur une donnée spécifique, la HRV issue d’une ceinture, et explique son protocole au lieu d’inférer l’intensité depuis une simple moyenne de FC.  
Source : [Suunto — ZoneSense](https://www.suunto.com/Content-pages/suunto-zonesense/)

À retenir :

- une promesse physiologique forte nécessite un signal et un protocole adaptés.

## Komoot et AllTrails

OBSERVÉ — Les deux produits font du parcours un objet central : profil, surfaces, difficulté, points d’intérêt et visualisation 3D. AllTrails permet des variantes « réduire le dénivelé » ou « plus pittoresque » ; Komoot relie profil, surfaces et carte.  
Sources : [Komoot — planifier un parcours](https://support.komoot.com/hc/en-us/articles/4403138423066), [AllTrails — parcours personnalisés](https://support.alltrails.com/hc/en-gb/articles/37270479773204-How-to-create-custom-routes)

À retenir :

- le terrain n’est pas un décor ; c’est la structure de l’expérience.

## Conclusion benchmark

DÉDUIT — Le territoire différenciant d’ELEV n’est pas :

- le réseau social de Strava ;
- la profondeur physiologique de Garmin ou Suunto ;
- le coaching de TrainingPeaks ;
- la planification cartographique de Komoot ou AllTrails.

Il est à l’intersection :

**débrief trail explicable + objectif personnel + données locales + terrain réel.**

## Appui scientifique

Les recherches disponibles confirment que montée et descente imposent des demandes biomécaniques et physiologiques distinctes ; les fusionner réduit la valeur de l’analyse.  
Sources : [revue montée/descente](https://pmc.ncbi.nlm.nih.gov/articles/PMC12592170/), [déterminants montée vs descente](https://www.sciencedirect.com/science/article/pii/S1440244020306642)

La dérive FC peut être informative, mais elle dépend notamment de l’effort externe, de la chaleur et de l’hydratation ; une simple différence de FC entre deux moitiés ne suffit pas à établir une « résistance ».  
Sources : [résilience en endurance](https://physoc.onlinelibrary.wiley.com/doi/full/10.1113/JP284205), [cardiovascular drift](https://doi.org/10.1152/physrev.00038.2020)

---

# 12. Audit code et architecture

## Forces

OBSERVÉ :

- pas de framework ni de chaîne de compilation à maintenir ;
- logique partagée dans assets/app.js ;
- navigation commune ;
- stockage local et synchronisation séparés ;
- fonctions déterministes testables ;
- icônes servies localement ;
- tokens CSS documentés ;
- sauvegarde, intégrité et sécurité couvertes par tests.

## Faiblesses

- assets/app.js dépasse 325 Ko et porte import, stockage, calculs, UI, graphiques et synchronisation ;
- assets/style.css dépasse 180 Ko ;
- certaines règles métier vivent près du rendu et gagnent une autorité visuelle sans contrat de confiance ;
- les moteurs Insight sont dispersés : séance, analyse, accueil, objectif et plan ;
- les seuils sont documentés dans le code, mais pas toujours dans l’interface ;
- certains commentaires annoncent une convention visible qui ne l’est pas réellement.

## Recommandation d’architecture

Ne pas migrer vers un framework.

Découpage progressif, après tests :

1. data-fit : parsing et inventaire ;
2. data-store : stockage, sauvegarde, synchronisation ;
3. metrics-terrain : profil, pente, montée, locomotion ;
4. metrics-training : agrégats temporels et plan ;
5. insight-engine : contrat, garde-fous, priorité ;
6. charts : SVG partagés ;
7. page controllers : rendu par page.

Chaque extraction doit être petite, couverte par tests et sans réécriture globale.

## Tests à ajouter

- deux courses ne partagent pas automatiquement la même préparation ;
- un dépassement de plan ne produit pas une préparation parfaite ;
- deux séances ne suffisent pas pour une tendance ;
- période précédente incomplète → aucun delta ;
- montée et descente sont séparées ;
- couverture cadence insuffisante → aucun insight de locomotion ;
- « Résistance » n’est jamais produite sans effort externe comparable ;
- un plan vide n’affiche aucun insight de plan ;
- états vide et partiel masquent les onglets inutiles ;
- tous les insights exposent source, fenêtre et confiance.

---

# 13. Simplification

## À supprimer ou masquer à court terme

- le nom « Profil de performance » ;
- la note globale de préparation si le plan n’est pas lié ou la couverture insuffisante ;
- les deltas de période si la référence est incomplète ;
- la dynamique de charge sur un compte récent ;
- l’insight de charge sur la page Plan quand aucun plan n’existe ;
- les onglets sous les états vides ;
- les KPIs répétés sur plusieurs pages.

## À fusionner

- Insight Accueil + trajectoire en un seul bloc décisionnel ;
- progression Objectif + progression Plan en partageant la même source ;
- volume et D+ dans un composant avec bascule ;
- carte et profil dans une seule lecture synchronisée.

## À conserver mais déplacer

- zones FC vers Effort ;
- tours et inventaire FIT vers Analyse avancée ;
- équipement vers « À surveiller » seulement si alerte ;
- radar renommé vers une zone expérimentale, si le produit veut le tester.

---

# 14. Différenciation

## Proposition de valeur

**ELEV aide le traileur autonome à comprendre ce que le terrain a changé dans son effort et ce qui mérite son attention, à partir de ses propres activités et de son objectif.**

## Trois piliers

### 1. Terrain first

Le profil, les montées, les descentes et les transitions de locomotion sont la structure du produit.

### 2. Explicable by design

Chaque conclusion montre :

- ce qui a été mesuré ;
- à quoi cela est comparé ;
- la qualité de la donnée ;
- ce qu’ELEV ne sait pas.

### 3. Private by default

L’utilisateur peut importer, analyser et comprendre sans envoyer ses données sportives à un cloud.

## Moat produit potentiel

DÉDUIT — La différenciation durable ne viendra pas d’un style seul. Elle peut venir d’une bibliothèque de comparaisons trail explicables :

- même montée ;
- même plage de pente ;
- même durée ;
- même type de terrain ;
- même phase de préparation ;
- même niveau de couverture.

À VALIDER — La reconnaissance de segments comparables doit être éprouvée sur plusieurs qualités de GPS et d’altitude avant d’être présentée comme fiable.

---

# 15. Matrice impact / effort

| Action | Impact | Effort | Priorité |
|---|---|---|---|
| Bloquer les scores sans couverture suffisante | Très fort | Faible | Immédiat |
| Corriger dépassement du plan dans le score | Très fort | Faible à moyen | Immédiat |
| Lier plan et objectif | Très fort | Moyen | Immédiat |
| Renommer le radar | Fort | Très faible | Immédiat |
| Supprimer les deltas à référence partielle | Fort | Moyen | Immédiat |
| Placer « 3 choses à retenir » en haut de l’Activité | Très fort | Moyen | Prochaine vague |
| Unifier le contrat Insight | Très fort | Moyen à fort | Prochaine vague |
| Séparer montée et descente | Fort | Moyen à fort | Prochaine vague |
| Recomposer Dashboard 2.0 | Très fort | Fort | 6–12 semaines |
| Synchroniser profil et carte | Fort | Fort | 6–12 semaines |
| Découper app.js sans framework | Moyen | Moyen | Progressif |
| Service worker et mode hors ligne | Moyen | Moyen | Après clarification de promesse |

---

# 16. Top 10 des actions

1. Ajouter les règles de couverture et de confiance avant tout nouveau design.
2. Empêcher « Excellente préparation » en cas de dépassement ou de données partielles.
3. Lier explicitement un plan à un objectif ; sinon parler de préparation générale.
4. Renommer immédiatement « Profil de performance » en « Profil d’exposition trail ».
5. Retirer les deltas si la période précédente n’est pas complète.
6. Faire remonter le débrief en trois points au-dessus des graphiques d’une activité.
7. Unifier tous les insights sous un contrat commun et une priorité unique.
8. Séparer montée, descente et roulant dans les analyses de pente.
9. Simplifier les états vide et partiel en masquant les structures inutiles.
10. Recomposer l’Accueil autour d’une décision, d’une semaine et d’une activité.

---

# 17. Roadmap

## Quick wins — 1 à 2 semaines

- garde-fous d’historique ;
- suppression des deltas non comparables ;
- renommage du radar ;
- correction du plafonnement des scores ;
- aucun insight Plan sans plan ;
- masquage des onglets dans les états vides ;
- libellés de méthode visibles ;
- nettoyage du scrollbar mobile ;
- tests de non-régression associés.

Critère de sortie :

- aucun écran ne présente une absence de données comme un mauvais résultat ;
- aucune alerte forte n’apparaît à partir de deux séances ;
- aucun score excellent ne masque une divergence au plan.

## Prochaine version — 3 à 6 semaines

- contrat ELEV Insight 2.0 ;
- liaison plan ↔ objectif ;
- couverture par signal ;
- activité « trois choses à retenir » ;
- montée et descente séparées ;
- progressive disclosure mobile ;
- synthèse Analyse en trois changements ;
- retours utilisateur sur la pertinence des insights.

Critère de sortie :

- chaque insight affiche référence et confiance ;
- les utilisateurs comprennent la conclusion sans ouvrir le graphique ;
- un insight peut être contesté ou marqué inutile.

## Vision — 6 à 12 semaines

- Dashboard 2.0 ;
- page Activité 2.0 ;
- segments de terrain comparables ;
- carte et profil synchronisés ;
- spécificité objectif fondée sur le GPX de course ;
- architecture Insight centralisée ;
- mode hors ligne clarifié ;
- validation avec un panel de traileurs.

Critère de sortie :

- ELEV est spontanément décrit comme un débrief du terrain, pas comme un clone de Garmin ou Strava.

---

# 18. Vision ELEV 2.0

## Expérience cible

L’utilisateur importe une activité. ELEV ne l’accueille pas avec vingt graphiques.

Il voit :

1. la trace et le profil de sa sortie ;
2. trois observations au maximum ;
3. une explication de la référence ;
4. le niveau de confiance ;
5. le lien avec son objectif ;
6. la possibilité d’explorer les preuves.

## Exemple de parcours

### Après une sortie

> « Les montées de 10 à 15 minutes ont été parcourues à un effort similaire à tes sorties comparables, mais avec une VAM légèrement supérieure. Confiance moyenne : 4 montées comparables, FC disponible sur 91 % du temps. »

L’utilisateur peut ouvrir :

- les quatre montées comparées ;
- les critères de comparabilité ;
- le profil ;
- les limites.

### Avant une course

> « Ton volume est aligné avec le plan. Le terrain raide est encore peu représenté : 22 % du D+ récent vient de pentes supérieures à 15 %, contre 38 % sur le parcours objectif. »

Cette conclusion n’est affichée que si :

- le GPX de l’objectif est disponible ;
- le plan est lié à cet objectif ;
- l’altitude des activités est exploitable ;
- la méthode de pente est stable.

## Positionnement final

ELEV ne doit pas prétendre connaître le corps mieux qu’une montre ni planifier le monde mieux qu’une plateforme cartographique.

ELEV doit devenir le produit qui répond le mieux à cette question :

**« Qu’est-ce que ce terrain a réellement changé dans ma sortie et dans ma préparation ? »**

---

# Outils, skills et connecteurs recommandés

## Utilisés pendant cet audit

- Navigateur : audit visuel et comportemental de la version publique et des états locaux isolés.
- ui-ux-pro-max : règles de hiérarchie, responsive, accessibilité et visualisation de données.
- GitHub : vérification en lecture du dépôt distant et de la branche ; aucune publication.
- Recherche web : benchmark actuel sur sources officielles et scientifiques.

## À utiliser pour la suite

- GitHub : ouvrir une branche puis une pull request par vague, après validation de la roadmap.
- Navigateur : tests visuels à chaque vague, avec états normal, vide, partiel, sombre et clair.
- ui-ux-pro-max : cadrage des composants Dashboard 2.0 et Activité 2.0.
- AllTrails, Komoot ou COROS : seulement comme sources optionnelles ou connecteurs explicitement autorisés, jamais comme source silencieuse de vérité.

## Sites

OBSERVÉ — Le dépôt ne contient pas .openai/hosting.json et le produit est actuellement publié sur GitHub Pages.

RECOMMANDATION — Ne pas introduire Sites dans cette phase. Il deviendrait pertinent uniquement si une décision de migration d’hébergement est prise séparément. Cette décision est hors périmètre et demanderait une validation explicite.

---

# Conclusion

ELEV possède déjà trois actifs rares : une base technique fiable, un monde visuel trail reconnaissable et une intention d’interprétation.

Le prochain saut de qualité ne vient pas de davantage de métriques. Il vient d’un contrat plus exigeant :

**moins de signaux, plus de preuves, une vraie hiérarchie et le terrain comme langage central.**
