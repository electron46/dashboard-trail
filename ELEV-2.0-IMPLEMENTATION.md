# ELEV 2.0 — registre d'implémentation

Source produit : `AUDIT-PRODUIT-ELEV-2-0-2026-08-22.md` (22 août 2026, score 74/100).
Source de l'état réel du code : ce dépôt.

Ce registre traduit l'audit en exigences vérifiables. Il ne recopie pas l'audit.

**Baseline mesuré avant toute modification** : `node audit-qa/qa_tests.mjs` → 56/56 PASS.

## Statuts

`TODO` · `IN_PROGRESS` · `DONE` · `DECISION_REQUIRED` · `EXTERNAL_VALIDATION` · `NOT_APPLICABLE`

## Décisions utilisateur rendues (AskUserQuestion)

| # | Sujet | Décision |
|---|---|---|
| D-1 | Radar « Profil de performance » | **Deux groupes séparés** : bloc « Aptitude » réellement mesurée (VAM à pente comparable, vitesse en descente à pente comparable, allure roulante) avec couverture et confiance par axe, et bloc « Exposition trail » (volume, verticalité, régularité) nommé comme du volume. Axe sans données = indisponible, jamais 0. |
| D-2 | PWA / hors ligne | **Vrai mode hors ligne** : service worker, cache des pages et assets, mises à jour maîtrisées. Carte GPS et appels IA restent indisponibles sans réseau, et le produit le dit. |
| D-3 | Carte GPS | **Profil dominant + tuiles assombries** par filtre CSS mesuré. Aucun nouveau fournisseur, aucune donnée supplémentaire transmise. |

Mesure ayant fondé D-1, sur les 3 fichiers FIT réels du dépôt : couverture altitude/FC/cadence 100 %, GPS 79,9 à 100 % ; 11 montées avec VAM exploitable (233 à 627 m/h) ; 17 segments de descente exploitables (pente −9 % à −30 %, vitesse 3,1 à 9,3 km/h).

---

## Registre

Colonnes : ID · section d'audit · exigence · priorité · statut · zone · preuve.

### Vague 1 — fiabilité et crédibilité

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| CRED-01 | P0-1, §5.4, §15, §16.3 | La préparation présentée comme spécifique à une course doit dépendre de cette course (date et plan lié). Sans liaison explicite : « préparation générale ». | P0 | DONE | app.js computePrepStatus, computeRaceReadiness | test |
| CRED-02 | P0-1 | Liaison explicite plan ↔ objectif, éditable par l'utilisateur. | P0 | DONE | app.js stockage, objectifs.html, plan.html | test |
| CRED-03 | P0-2, §15, §16.2 | Un dépassement du plan ne contribue pas comme une réussite parfaite. Séparer alignement / sous-cible / dans la plage / dépassement / divergence. | P0 | DONE | app.js computeRaceReadiness | test |
| CRED-04 | P0-2 | Jamais « Excellente préparation » simultanément à une divergence majeure. | P0 | DONE | app.js readinessLevelLabel, objectifs.html | test |
| CRED-05 | P0-3, §13, §16.4 | Le terme « Profil de performance » disparaît ; exposition ≠ aptitude. | P0 | DONE | app.js computePerformanceRadar, profil.html | inspection |
| CRED-06 | P0-3, D-1 | Axes d'aptitude réellement mesurés à pente comparable, avec couverture et confiance ; axes d'exposition nommés comme tels. | P0 | DONE | app.js, profil.html | test |
| CRED-07 | P1-4, §16.5 | Aucun delta de période si la référence n'a pas une couverture comparable suffisante. Valeur brute + « historique précédent incomplet ». | P1 | DONE | app.js comparePeriods, analyse.html | test |
| CRED-08 | P1-5, §5.4 | Tendance de charge : 4 semaines couvertes minimum, 3 semaines non vides, 2 séances ne suffisent jamais. | P1 | DONE | app.js getTrainingTrend, weeklyTrend | test |
| CRED-09 | P1-5, §6.3 | Aucun conseil de récupération sans données de récupération. Aucun langage de prédiction de blessure. | P1 | DONE | app.js generateElevInsight | test |
| CRED-10 | §6.3 | Aucun score global avec moins de 3 dimensions fiables. | P1 | DONE | app.js computeRaceReadiness | test |
| CRED-11 | §5.4 | Les repères génériques (60 km/sem., 2200 m D+/sem., 15 % Z3+) sont nommés comme repères génériques, jamais comme note personnalisée. | P1 | DONE | app.js, objectifs.html | inspection |

### Confiance de la donnée

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| DATA-01 | §5.2, §5.5 | Matrice de couverture par signal et par activité (altitude, FC, cadence, GPS, puissance). | P1 | DONE | app.js | test |
| DATA-02 | §5.5, §6.2 | Tout résultat interprété transporte source, fenêtre, couverture, méthode, confiance, limites. | P1 | DONE | app.js insight-engine | test |
| DATA-03 | §6.3 | Distinction explicite mesure observée / calculée / estimation / indisponible / insuffisante. | P1 | DONE | app.js, CSS tokens | test |
| DATA-04 | §5.2 | Ne jamais deviner type de capteur, précision ou provenance non présents dans le fichier. | P1 | DONE | app.js | inspection |

### ELEV Insight 2.0

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| INS-01 | §6.2 | Contrat commun d'insight (id, famille, observation, référence, delta, couverture, confiance, importance, pourquoi, action, limites, preuves, méthode, fenêtre). | P1 | DONE | app.js | test |
| INS-02 | §6.3 | Garde-fous centralisés, aucun insight ne peut les contourner. | P1 | DONE | app.js | test |
| INS-03 | §6.4 | Priorisation : qualité de donnée > divergence > changement > progrès > contexte. | P1 | DONE | app.js | test |
| INS-04 | §6.4 | Max 1 insight principal + 2 secondaires par écran, jamais 2 de la même famille. | P1 | DONE | app.js, pages | test |
| INS-05 | §6.3 | Confiance haute/moyenne/basse jamais portée par la seule couleur. | P1 | DONE | CSS, composants | inspection |
| INS-06 | §6.3 | Aucune comparaison d'activité avec moins de 3 activités réellement comparables. | P1 | DONE | app.js | test |
| INS-07 | §12 | Les moteurs d'insight dispersés (séance, analyse, accueil, objectif, plan) passent par le même contrat. | P2 | DONE | app.js | inspection |

### Terrain

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| TER-01 | P1-8, §16.8 | Montée, descente et roulant séparés (fin de la valeur absolue de pente). | P1 | DONE | app.js GRADE_BUCKETS, aggregateGradeBuckets, analyse.html | test |
| TER-02 | P1-8, §5.4 | Lissage de l'altitude avant classement de pente, méthode documentée. | P1 | DONE | app.js | test |
| TER-03 | P1-8, §5.4 | Couverture cadence publiée ; aucune conclusion locomotion sous le seuil. | P1 | DONE | app.js aggregateRunWalkByGrade | test |
| TER-04 | §14 | Abstraction de segment comparable (pente, longueur, durée, qualité) pour les comparaisons futures. | P2 | DONE | app.js | test |

### UX / pages

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| UX-01 | P1-6, §8, §16.6 | Activité : « 3 choses à retenir » avant les graphiques. | P1 | DONE | activite.html | navigateur |
| UX-02 | §8 | Activité recomposée : identité, à retenir, récit du terrain, effort, comparaisons, analyse avancée. | P1 | DONE | activite.html | navigateur |
| UX-03 | §8, D-3 | Profil altimétrique = scène centrale ; carte subordonnée et visuellement cohérente. | P1 | DONE | activite.html, style.css | navigateur |
| UX-04 | §7, §16.10 | Accueil recentré : objectif + terrain, phrase d'état, 1 insight, prochaine action, semaine en 3 valeurs. | P1 | DONE | index.html | navigateur |
| UX-05 | §7 | Disparaissent de l'Accueil principal : radar, grille de 6 KPI, zones FC détaillées, insights concurrents, cartes sans signal. | P1 | DONE | index.html | navigateur |
| UX-06 | §4.3 | Progression hiérarchisée : 1 tendance fiable, 3 changements classés, exploration Volume/Terrain/Effort, avancé. | P1 | DONE | analyse.html | navigateur |
| UX-07 | §4.4, §10 | Objectif sépare couverture / alignement au plan / spécificité objectif / incertitude. | P1 | DONE | objectifs.html | navigateur |
| UX-08 | §4.5 | Plan : premier écran = séance du jour, progression de la semaine, prochain jalon, divergence fondée uniquement. | P1 | DONE | plan.html | navigateur |
| UX-09 | §4.5, §13 | Aucun insight de plan quand aucun plan n'existe ; aucun cockpit analytique vide. | P1 | DONE | plan.html | test |
| UX-10 | §4.7, §16.9 | États vide / partiel / erreur : masquer les structures analytiques inutiles ; « insuffisant » ≠ « mauvais ». | P1 | DONE | pages, app.js | test |
| UX-11 | §4.8 | Onboarding : phrase de valeur avant l'import ; indication d'étape non redondante. | P2 | DONE | onboarding.html | navigateur |
| UX-12 | §13 | Cockpits qui se répètent : une question par page, doublons supprimés. | P2 | DONE | pages | inspection |

### Mobile et accessibilité

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| MOB-01 | P1-7, §10 | Aucun ruban d'onglets horizontal obligatoire pour atteindre le contenu principal ; sélecteur compact ou sections repliables. | P1 | DONE | objectifs/plan/activite, style.css | navigateur |
| MOB-02 | P1-7 | Résumé vertical prioritaire à 375/390 px ; contenu décisif avant le détail. | P1 | DONE | pages | navigateur |
| MOB-03 | §4.9 | Plus de scrollbar horizontale parasite. | P1 | DONE | style.css | navigateur |
| MOB-04 | §4.9 | Cibles tactiles et liens textuels ≥ 24 px (44 px en mobile pour les actions). | P1 | DONE | style.css | navigateur |
| A11Y-01 | §4.9, §10 | Résumé textuel et lecture sans couleur pour tous les graphiques. | P1 | DONE | app.js, pages | navigateur |

### Design system

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| DS-01 | §10 | Rôles sémantiques ajoutés : signal, confiance, provenance de donnée, terrain, baseline. | P1 | DONE | style.css | inspection |
| DS-02 | §10 | Composants formalisés : InsightCard, MetricWithBaseline, DataQualityBadge, TerrainSegment, EmptyState. | P2 | DONE | style.css, app.js, composants.html | navigateur |
| DS-03 | §9 | Direction Terrain Intelligence renforcée ; identité préservée ; règles anti-cliché respectées. | P2 | DONE | style.css | navigateur |

### Architecture, PWA, tests

| ID | Audit | Exigence | Prio | Statut | Zone | Preuve |
|---|---|---|---|---|---|---|
| ARC-01 | §12 | Découpage progressif sans framework, sur les zones réellement modifiées. | P2 | DONE | assets/ | inspection |
| ARC-02 | §12 | Logique Insight moins dispersée. | P2 | DONE | app.js | inspection |
| PWA-01 | P2-10, D-2 | Vrai mode hors ligne : service worker, cache, mises à jour maîtrisées, limites documentées. | P2 | DONE | sw.js, pages | navigateur |
| TEST-01 | §12 | 15 garde-fous testés (voir suite audit-qa/qa_tests.mjs). | P1 | DONE | audit-qa | exécution |

### Hors périmètre du dépôt

| ID | Audit | Exigence | Statut | Justification |
|---|---|---|---|---|
| EXT-01 | §17, §14 | Validation avec un panel réel de traileurs. | EXTERNAL_VALIDATION | Demande de vraies personnes ; protocole préparé en fin de registre. |
| EXT-02 | §14 | Éprouver la reconnaissance de segments comparables sur plusieurs qualités de GPS/altitude. | EXTERNAL_VALIDATION | Demande un corpus varié d'appareils que le dépôt ne contient pas (3 fichiers, un seul appareil). |
| EXT-03 | §11, Outils | Connecteurs AllTrails / Komoot / COROS. | NOT_APPLICABLE | Services tiers ; contraire au principe local-first sans décision explicite. Aucun n'a été demandé. |
| EXT-04 | Outils, Sites | Migration d'hébergement vers Sites. | NOT_APPLICABLE | L'audit lui-même la place hors périmètre et la conditionne à une décision séparée. |
| EXT-05 | §17 | Ouverture de branche distante, pull request, publication. | DECISION_REQUIRED | Aucune opération distante sans décision explicite. Travail livré sur la branche locale feat/elev-2-0. |
| EXT-06 | §17 | Boucle de retour utilisateur sur la pertinence des insights. | DONE | La partie locale est réalisable (marquer un insight utile / inutile, stocké localement). Aucune remontée distante sans décision. |

---

## Vérification réellement exécutée

Rien de ce qui suit n'est estimé : chaque ligne correspond à une commande lancée ou à une mesure
prise dans le navigateur.

### Suite de non-régression

`node audit-qa/qa_tests.mjs` → **71/71 PASS** (56 invariants existants préservés + 15 garde-fous
ELEV 2.0, identifiants `E20-1` à `E20-15`). Baseline avant travaux : 56/56.

Le test `OK-6` a été **retourné** : il constatait l'absence de service worker (défaut P2-10) et
portait la mention « mettre ce constat à jour ». C'est désormais la disparition du mode hors ligne
qui fait échouer la suite.

### Mesures sur données réelles (3 fichiers `.fit` du dépôt)

| Mesure | Résultat |
|---|---|
| Couverture altitude / FC / cadence | 100 % sur les 3 fichiers ; GPS 78 à 100 % |
| Répartition signée | Montée 50 %, Descente 27 %, Roulant 23 % |
| Course / marche par pente **signée** | Montée > 20 % → 98 % marche ; Descente > 15 % → 50 % marche |
| Segments de terrain | 29 (17 montées, 10 descentes, 2 roulants) |
| Aptitude montée | 651 m/h sur 16 segments, confiance haute |
| Aptitude descente | 5,9 km/h sur 8 segments, confiance moyenne |
| Dérive à effort comparable | −4 % sur 3 paires appariées (1 séance sur 3 ; les 2 autres refusent faute de paires comparables) |

**Défaut trouvé et corrigé grâce à cette mesure** : la première version de `terrainSegments()` n'avait
aucune hystérésis et produisait **595 fragments pour 1329 intervalles** — une descente réelle de 315 m
était hachée en dix morceaux dont aucun n'atteignait 3 minutes, si bien que l'aptitude en descente
ressortait « indisponible » sur des sorties qui contenaient dix-sept descentes exploitables. C'était
un défaut de méthode, pas une absence de données. Après ajout des tolérances (replat bref absorbé,
inversion jugée en dénivelé et en durée) : **29 segments**.

### Navigateur

Serveur local `_serve.py`, jeu de test `_fixtures.html` (59 séances sur 15 semaines, plan CSV réel
de 84 séances, objectif Mafate).

- **8 pages × 375 / 768 / 1280 px** : `overflow` horizontal **0 partout**, aucune image cassée,
  aucun `<main>` vide.
- **Hiérarchie des titres** : 8/8 pages, un seul `<h1>`, **aucun saut de niveau**.
- **Contraste WCAG AA** : **0 échec en thème sombre**, **0 échec en thème clair** après correction.
  Deux jetons introduits pendant cette mission échouaient de peu en thème clair (`--confidence-high`
  à 4,16 et `--confidence-medium` à 3,96 pour 4,5 exigé) — recalculés à 4,90 et 4,65.
- **Ordre de la page Activité** mesuré : identité 0 px → **à retenir 308 px** → récit du terrain
  631 px → carte 1073 px. La conclusion précède bien les graphiques (P1-6).
- **Mobile 375 px** : les rangées d'onglets (7 entrées sur Objectifs) sont remplacées par un
  `<select>` de 44 px de haut, le ruban est retiré de l'ordre de lecture, `overflow` 0, et le
  changement de section fonctionne.
- **États vides** (jeu « vide ») : Plan n'affiche **ni onglets, ni panneaux, ni insight** — seulement
  l'état vide et son action. Accueil, Objectifs, Progression et Profil affichent un état vide porteur
  d'une action, sans structure analytique derrière.
- **Mode hors ligne** : service worker actif, **32 ressources en cache**, les 8 pages et les
  4 fichiers JS/CSS présents, **0 tuile OpenStreetMap mise en cache** (données tierces jamais stockées).

### Démonstration de bout en bout du correctif P0-1

Avant liaison, les trois courses reçoivent `scope: general` et le même traitement. Après avoir lié
le plan à « Mafate Trail Tour » : cette course passe en `scope: race` (96 %, fenêtre bornée par le
plan) tandis que les deux autres restent en `general`. Les libellés diffèrent. Deux courses ne
peuvent donc plus partager artificiellement un état de préparation présenté comme spécifique.

### Démonstration de bout en bout du correctif P0-2

Sur le jeu de test, le volume réalisé atteint **152 % de la cible du plan**. Avant : score plafonné à
100, libellé « Excellente préparation ». Après : `planAlignment(152)` retourne `score: null` et
`diverging: true`, le libellé devient **« Écart important avec le plan »**, et la divergence est
nommée sous le hero. L'interface ne peut plus afficher une préparation excellente et une divergence
majeure en même temps.

### Trois faux positifs écartés, sans modification du produit

1. **« Course 100 % / Marche 0 % » sur toutes les bandes de pente** (page Progression) : le générateur
   de jeu de test produit une cadence de 154 à 166 pas/min en permanence, toujours au-dessus du seuil
   de 140. Artefact du jeu de test, pas du produit — les vrais fichiers donnent une bascule nette.
2. **Débordement horizontal de 214 px sur l'Accueil** : `document.documentElement.clientWidth`
   retournait 0 après une réinitialisation de la fenêtre. Mesuré à nouveau à une largeur explicite :
   0 de débordement.
3. **Échec de contraste persistant après correction** : le cache du navigateur servait l'ancienne
   feuille de style aux iframes de mesure. Confirmé en récupérant la feuille avec un paramètre
   anti-cache, puis en la réinjectant : 0 échec.

Un quatrième piège a été évité : les messages d'erreur de la console **s'accumulent entre les
navigations**. Deux erreurs déjà corrigées (`trend is not defined`, `reading 'split'`) réapparaissaient
dans le relevé de pages saines. Vérifié en interrogeant l'état réel du DOM plutôt que le journal.

### Non vérifié, et pourquoi

- **Aucun test sur données personnelles réelles ni sur téléphone physique.** Tout repose sur le jeu de
  test et sur les 3 fichiers `.fit` du dépôt. Le jugement esthétique appartient à l'utilisateur.
- **Aucun chemin réseau Supabase** (synchronisation entre deux appareils, téléchargement du `.fit`
  depuis le Storage, appel IA réel) : aucun projet Supabase n'est configuré dans cet environnement.
- **Le mode hors ligne n'a pas été éprouvé réseau réellement coupé** : le cache et l'enregistrement
  du service worker sont vérifiés, le comportement en coupure reste à constater à l'usage.
- **Ni lint, ni typecheck, ni build** : ils n'existent pas dans ce dépôt (HTML/CSS/JS natifs, aucun
  `package.json`). La vérification syntaxique passe par `node --check`.
