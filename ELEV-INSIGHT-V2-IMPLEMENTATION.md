# Registre d'implémentation — ELEV Insight V2

**Source :** `AUDIT-SCIENTIFIQUE-ELEV-INSIGHT-V2-2026-08-23.md`
**Branche :** `fix/quatre-defauts-cibles` — aucun commit, aucun push, aucun déploiement.
**Baseline avant travaux :** `node audit-qa/qa_tests.mjs` → **84/84 réussis, 0 échec**.
**État final :** `node audit-qa/qa_tests.mjs` → **108/108 réussis, 0 échec** (24 tests ajoutés).

Statuts : `À FAIRE` · `EN COURS` · `TERMINÉ` · `BLOQUÉ` · `HORS DÉPÔT` · `À VALIDER`.

---

## 1. Vérification des constats de l'audit dans le code actuel

L'audit décrit un état daté. Chaque constat `OBSERVÉ` a été revérifié **avant** modification.

| Constat de l'audit | Vérifié dans le code | Écart |
|---|---|---|
| `makeInsight()` ne conserve pas `provenance` | **Confirmé** — le constructeur ne copiait pas le champ que `insightRejectionReason` testait pourtant | aucun |
| VAM agrégée = moyenne pondérée par le D+ | **Confirmé** — `aggregatePeriod` : `gainVam / totalGain` | aucun |
| Moyennes de repli non pondérées par le temps | **Confirmé** — `summarizeFit` : FC, cadence, puissance, température | aucun |
| D+ de repli sur altitude brute | **Confirmé** — somme des deltas sans lissage | aucun |
| `parsePlanNumber()` retourne `0` pour une valeur absente | **Confirmé** | aucun |
| Séance planifiée validée par la seule date | **Confirmé** | aucun |
| Objectif/Plan hors contrat commun | **Confirmé** — `{title,text}` et balisage propre à chaque page | aucun |
| « Excellente préparation » / « Sur la bonne voie » | **Confirmé** — `readinessLevelLabel` | aucun |
| Prompt coach prescrit récupération et « 48 h » | **Confirmé** — bloc `<exemple>` d'`activite.html` | aucun |
| `buildProfileSummaryText()` lit `profile.age` inexistant | **Confirmé** — le profil ne stocke que `naissance` | aucun |

**Trois constats de MES propres tests se sont révélés faux à la mesure**, et n'ont donné lieu à
aucune modification du produit — seulement à la correction du test :
1. `elevCoverageLevel` retourne `usable`/`high`, non `partial`/`full` : les frontières 60 %/85 %
   étaient **déjà correctes**.
2. `parsePlanCsv` exige une année dans la date : mon CSV de test était mal formé.
3. `generateElevInsight` retourne **un** insight, la priorisation étant faite par la page :
   mon test supposait un résultat de priorisation.

Un quatrième écart a été trouvé **dans mon propre code** en cours de route : la détection de
contradictions portait sur les insights retenus **après** déduplication par famille, si bien que
deux signaux opposés de la même famille disparaissaient avant d'être détectés — exactement l'effet
que l'audit interdit. Corrigé : la détection porte sur tous les insights valides.

---

## 2. P0 — Intégrité et sécurité

| # | Exigence (audit) | Statut | Fichiers | Preuve |
|---|---|---|---|---|
| P0-A1 | `makeInsight` conserve `provenance` | TERMINÉ | `assets/elev-insight.js` | `V2-P0A1` — estimation non nommée désormais rejetée |
| P0-A2 | Objet d'insight canonique commun aux 5 surfaces | TERMINÉ | `elev-insight.js`, `objectifs.html`, `plan.html` | `V2-P0A4` — vérification statique sur les 5 pages |
| P0-A3 | Objectif/Plan/IA ne contournent plus les garde-fous | TERMINÉ | `assets/app.js` | `V2-P0A3` — 0 rejet, tous les champs contractuels présents |
| P0-A4 | Observation / interprétation / recommandation / incertitude séparées | TERMINÉ | `assets/elev-insight.js` | `V2-P0A2` — `statement{…}` + alias rétrocompatibles |
| P0-B1 | VAM agrégée = ΣD+ / Σdurée × 3600 | TERMINÉ | `assets/app.js` | `V2-G07` — **667 m/h** au lieu de 750 (audit §3.4) |
| P0-B2 | Moyennes pondérées par le temps | TERMINÉ | `assets/app.js` | `V2-G06` — **142 bpm** au lieu de 110 ; 1 s et 10 s donnent le même résultat |
| P0-B3 | D+ de repli lissé, provenance exposée | TERMINÉ | `assets/app.js` | `V2-G05` — **0 m** au lieu de 300 sur plat bruité ; 297 m sur relief réel |
| P0-B4 | Absence ≠ zéro | TERMINÉ | `assets/app.js` | `V2-G10` — colonne absente → `null`, vrai 0 préservé |
| P0-B5 | Calcul analytique avant réduction LTTB | TERMINÉ | `assets/app.js`, `activite.html` | `V2-P0B5` — 6000 points analysés, 1244 stockés |
| P0-B6 | Bornes d'intervalles explicites | TERMINÉ | `assets/app.js` | `V2-P0B6` — 4 fenêtres à 70 km, aucun double compte |
| P0-C1 | Correspondance plan–activité par lien ou date + type | TERMINÉ | `assets/app.js`, `activite.html` | `V2-G11`/`V2-G12` — footing ≠ fractionné, lien explicite persistant |
| P0-D1 | Formulations globales trompeuses retirées | TERMINÉ | `assets/app.js`, `plan.html` | `V2-P0D1` — plus d'« excellente préparation » ni de « dans les clous » |
| P0-D2 | Divergence affichée, pas moyennée | TERMINÉ | `assets/app.js` | `V2-P0D1` — la divergence prime sur tout libellé |
| P0-D3 | Repères génériques classés selon leur preuve | TERMINÉ | `assets/app.js` | `V2-P0D2` — sans plan : **aucun indice global** ; avec plan : 77 |
| P0-E1 | Schéma JSON strict des sorties IA | TERMINÉ | `assets/elev-ai-policy.js`, `activite.html` | `V2-G16` — 7 familles de rejet vérifiées |
| P0-E2 | Retrait des prescriptions (récupération, 48 h) | TERMINÉ | `activite.html` | `V2-P0E` — exemple assaini, contre-exemple ajouté |
| P0-E3 | Estimation expérimentale, sans remplissage auto | TERMINÉ | `objectifs.html` | `V2-P0E` — bouton et `extractTimeGuess` retirés |
| P0-F | Tests P0 + jeux G00–G18 | TERMINÉ | `audit-qa/qa_tests.mjs` | G02, G05, G06, G07, G10, G11, G12, G14, G16 |

## 3. P1 — Preuve et expérience unifiées

| # | Exigence (audit) | Statut | Fichiers | Preuve |
|---|---|---|---|---|
| P1-A | Modules proportionnés à la pile | TERMINÉ (découpe adaptée, voir §5) | `elev-evidence.js`, `elev-metrics.js`, `elev-ai-policy.js` | `V2-P1A` — 8 métriques déclarées et consommées |
| P1-B | Registre de preuve A/B/C/D/X, 19 sources | TERMINÉ | `assets/elev-evidence.js` | `V2-P1B` — 19 sources, 17 affirmations, dates de revue |
| P1-C | Triple confiance plafonnée | TERMINÉ | `assets/elev-insight.js` | `V2-P1C` — charge : haute → **moyenne** ; estimation D → **faible** |
| P1-D | Contradictions visibles | TERMINÉ | `assets/elev-insight.js`, `assets/style.css` | `V2-P1D` — 2 familles de tension détectées et rendues |
| P1-E | Priorité explicable, cooldown, feedback | TERMINÉ | `assets/elev-insight.js` | `V2-P1E` — priorité multiplicative, alerte jamais effacée |
| P1-F | InsightCard V2 et volet de preuve | TERMINÉ | `assets/elev-insight.js`, `assets/style.css` | `V2-P1F` — méthode, formule, niveau, sources, limites, revue |

## 4. P2 et P3

| # | Exigence | Statut |
|---|---|---|
| P2-* | RPE, bien-être, sommeil, douleur, météo, source capteur, autres sports | **À VALIDER** — point d'arrêt respecté, aucune donnée sensible ajoutée, aucun changement de persistance |
| P3-* | Validation prospective, calibration, revue clinique | **HORS DÉPÔT** — l'infrastructure existe (registre versionné, dates de revue, niveaux de preuve), la validation ne peut pas être déclarée ici |

---

## 5. Écarts assumés par rapport à la lettre de l'audit

**Découpe des modules (P1-A).** L'audit proposait `elev-metrics.js`, `elev-evidence.js`,
`elev-insight-catalog.js`, `elev-insight-policy.js` et `elev-insight-priority.js`. Trois modules ont
été créés — `elev-evidence.js`, `elev-metrics.js`, `elev-ai-policy.js` — et le catalogue, la
politique et la priorité restent dans `elev-insight.js`. Raison : l'audit interdit lui-même de
« créer un module abstrait sans consommateur réel » ; ces trois responsabilités n'ont qu'un seul
consommateur, le contrat, et les extraire aurait produit trois fichiers dont aucun n'aurait de vie
propre. Les trois modules créés ont chacun **plusieurs** consommateurs réels et des tests dédiés.

**Réduction du nombre d'observations sur Plan.** Faire passer Plan par le contrat commun applique la
règle « une observation par famille » : l'écart au plan et les séances non associées appartiennent
tous deux à la famille `plan`, seul le plus important s'affiche. C'est le comportement voulu par
l'audit (§4.2 relève d'ailleurs que la dynamique de charge « peut répéter l'Accueil »). Rien n'est
perdu : le reste part dans `dropped`.

**Indice de préparation sans plan.** L'audit demande de retirer les repères génériques des scores
personnels. Conséquence directe et assumée : **sans plan importé, il n'y a plus d'indice global**.
Les dimensions restent lisibles une par une, avec leur repère nommé, et le message dit ce qui
rendrait l'indice calculable. Avec un plan, l'indice subsiste car il compare aux cibles que
l'utilisateur a lui-même définies.

---

## 5 bis. Décisions produit soumises à l'utilisateur — VALIDÉES le 2026-08-23

Les deux conséquences visibles de cette implémentation lui ont été présentées, et il les a
approuvées. Elles ne sont donc pas des régressions à corriger lors d'une passe ultérieure.

| Décision | Statut | Conséquence à l'écran |
|---|---|---|
| Plus d'indice de préparation global sans plan importé | **VALIDÉE** | Un chiffre en moins sur Objectifs ; les sous-scores restent lisibles un par un, chacun nommant son repère |
| Retrait du bouton « Utiliser comme temps visé » | **VALIDÉE** | L'estimation reste consultable et étiquetée expérimentale ; le temps visé se saisit à la main |

**Ne pas rétablir l'un ou l'autre sans une nouvelle décision explicite** — pour le second, sans une
calibration réelle du modèle (backtest et intervalle d'erreur mesuré), que le dépôt ne contient pas.

---

## 6. Vérification exécutée

**Tests automatisés** — `node audit-qa/qa_tests.mjs` : **108 tests, 108 réussis, 0 échec, 0 non
exécuté**. Les 84 tests historiques sont conservés ; un seul (`E20-11`) a été adapté à la nouvelle
forme de retour de `getPlanInsights`, son invariant restant identique.

**Contrôle syntaxique** — `node --check` sur `assets/app.js` et les 5 modules, plus extraction et
contrôle des **15 blocs de script inline** des pages HTML : tous valides.

**Vérification rendue** (serveur local, jeu de test `_fixtures.html`, 4 pages × 2 largeurs
375/1280 px × 2 thèmes sombre/clair, soit 16 chargements) :
- aucun débordement horizontal, aucun saut de niveau de titre, aucune erreur JavaScript ;
- un `<h1>` par page, plus aucun rendu d'insight ad hoc sur les 5 surfaces ;
- **0 échec de contraste WCAG AA** sur les éléments Insight V2, dans les deux thèmes ;
- volets de preuve focalisables au clavier, ouverture par activation, 1344 caractères de preuve
  réellement exposés ;
- cibles tactiles du volet de preuve portées de **25 px à 44 px** en mobile (défaut préexistant sur
  l'Accueil et Progression, étendu par ma propre généralisation du composant, donc corrigé).

**NON VÉRIFIÉ, et pourquoi :**
- **Captures d'écran** : le volet navigateur n'était pas affiché, la page ne compose donc pas
  d'images. La vérification repose sur des mesures DOM réelles. Le jugement esthétique final
  appartient à l'utilisateur.
- **Chemins réseau Supabase** : aucun projet configuré ici. `plannedUid`, `analytics` et la
  provenance du D+ ont été vérifiés sur l'aller-retour de mapping (`sessionToActivityRow` →
  `activityRowToSession`), **pas** contre une vraie base.
- **Appel Anthropic réel** : la validation des sorties IA est testée sur des réponses simulées. Le
  comportement du modèle face au nouveau prompt JSON n'a pas été observé en conditions réelles.
- **Téléphone physique** : non testé.
- **Données personnelles réelles** : tout le travail a porté sur le jeu de test du dépôt.

**Défaut préexistant signalé, non corrigé (hors périmètre) :** `activite.html` contient un
`<img src="">` (`#takeawaysIcon`, présent dans `HEAD`) rempli par JavaScript ; tant que l'insight
n'est pas rendu, l'image reste vide et compte comme cassée.

---

## 7. Journal des lots

**Lot 1 — intégrité mathématique (P0-B).** 5 tests écrits d'abord, tous rouges sur les défauts
décrits, puis corrigés. `84 → 89`.

**Lot 2 — contrat universel (P0-A).** `89 → 93`. `provenance` réparée, quatre blocs séparés,
Objectif et Plan convertis, vérification statique anti-contournement.

**Lot 3 — rapprochement plan ↔ activité (P0-C).** `93 → 95`. Difficulté de fond : une séance
réalisée ne porte **aucun** type d'entraînement (le `.fit` donne un sport, pas une intention). Le
rapprochement s'appuie donc sur ce que les deux côtés mesurent — volume et intensité en zones — avec
trois niveaux (`explicit`, `strong`, `weak`) et une confirmation utilisateur pour les cas douteux.
`plannedUid` ajouté à `raw.clientMeta` et à `SESSION_USER_FIELDS`, sans quoi la confirmation aurait
été détruite à la première resynchronisation.

**Lot 4 — readiness et formulations (P0-D).** `95 → 98`. Libellés descriptifs, repères génériques
classés et sortis du score global, statut hebdomadaire reformulé.

**Lot 5 — sécurisation de l'IA (P0-E).** `98 → 100`. Nouveau module `elev-ai-policy.js` : objet
déterministe autorisé construit **avant** l'appel, schéma JSON strict, validation des nombres contre
les données réelles, rejet des causalités, délais, consignes de récupération et termes médicaux.
Estimation de course étiquetée expérimentale, remplissage automatique du temps visé supprimé, bug
`profile.age` corrigé.

**Lot 6 — calcul avant réduction (P0-B5).** `100 → 101`. `computeSessionAnalytics` calcule montées
et locomotion sur la série complète ; seul le résultat est stocké.

**Lot 7 — bornes temporelles (P0-B6).** `101 → 102`.

**Lot 8 — preuve, confiance, contradictions, priorité (P1-B à P1-F).** `102 → 107`. Registre de
19 sources, triple confiance plafonnée, contradictions rendues, priorité multiplicative avec
cooldown et règle de sécurité sur les alertes, InsightCard V2.

**Lot 9 — registre de métriques (P1-A).** `107 → 108`. 8 métriques déclarées avec formule, unité,
minimums et politique de valeur manquante, consommées par le volet de preuve.
