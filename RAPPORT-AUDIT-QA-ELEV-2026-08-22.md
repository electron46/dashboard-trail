# Audit QA intégral — ELEV Dashboard Trail

**Date de l'audit :** 22 août 2026  
**Version déclarée dans le code :** 1.0.0  
**Dossier audité :** `Dashboard Trail html`  
**Version publique contrôlée :** <https://electron46.github.io/dashboard-trail/index.html>  
**Référentiel :** recette fonctionnelle, risques données, UX/UI, responsive, WCAG 2.2 AA, performance, compatibilité, robustesse et sécurité de base.

> Les mentions **TESTÉ**, **VÉRIFIÉ DANS LE CODE**, **PROBABLE**, **À CONFIRMER** et **NON TESTÉ** sont employées au sens strict. Les tests ayant servi à confirmer un défaut sont considérés comme techniquement réussis, même si le résultat produit est non conforme.

---

## 1. Résumé exécutif

ELEV présente une interface déjà solide : les huit pages principales sont cohérentes, les états normal, vide et partiel s'affichent proprement, le thème sombre est lisible et aucun débordement horizontal n'a été observé aux sept largeurs testées de 320 à 1440 px. Les trois fichiers FIT réels fournis sont correctement analysés, le CSV réel produit 84 séances et la version publique charge ses huit écrans principaux sans erreur de console observée.

Le principal risque se situe dans la couche de données. Trois scénarios peuvent masquer ou remplacer une activité : échec d'envoi Supabase ignoré avant reconstruction de l'index local, collision d'identifiant entre deux activités distinctes et réimport d'un doublon annoncé comme un nouvel import. La réinitialisation et le vidage du cache peuvent en outre reprogrammer une synchronisation différée après son annulation et envoyer au cloud un état local incomplet si la récupération tarde ou échoue. Ces scénarios sont confirmés par exécution instrumentée ou par reproduction dans l'interface.

L'import/export JSON n'est pas un aller-retour complet : l'export contient les notes et l'année du plan, mais l'import ne les restaure pas ; un tableau de courses vide ne remplace pas les courses existantes. Un fichier FIT dont le CRC final est invalide est également accepté par l'import normal, alors que l'inspecteur interne détecte bien la corruption.

La sécurité de base doit être renforcée : les messages génériques utilisent `innerHTML` sans échapper leur texte, et la clé Anthropic est conservée dans `localStorage` puis utilisée directement depuis le navigateur. Aucune clé réelle n'a été exposée ou recopiée pendant cet audit.

## 2. Verdict

# 🔴 NO-GO

La version est démontrable et largement utilisable en local, mais elle ne doit pas être considérée comme prête pour une nouvelle mise en production tant que les trois risques de données P0 ne sont pas corrigés et couverts par des tests de non-régression : synchronisation Supabase après échec d'upsert, collision d'identifiant FIT et synchronisation différée après réinitialisation/vidage du cache.

Le verdict ne sanctionne pas l'interface : il découle du critère explicite « risque sérieux de perte ou de corruption de données ». Une activité invisible n'entre plus dans les totaux ni dans l'export, et une collision peut remplacer silencieusement une séance distincte.

## 3. Score qualité

### Score global : **64 / 100**

Méthode : huit domaines notés sur 100 à partir des seuls contrôles réellement exécutés ou vérifiés dans le code, puis pondérés selon leur impact produit. Les métriques Lighthouse et Core Web Vitals non mesurées ne sont pas remplacées par une estimation.

| Domaine | Note | Poids | Contribution | Justification principale |
|---|---:|---:|---:|---|
| Fonctionnel | 71 | 20 % | 14,2 | Parcours et rendus principaux stables ; plusieurs imports et restaurations non conformes |
| Données | 45 | 20 % | 9,0 | Trois risques critiques de remplacement ou disparition apparente |
| UX | 80 | 12 % | 9,6 | Navigation claire et états utiles ; retour de doublon trompeur |
| UI | 86 | 10 % | 8,6 | Composition cohérente et responsive ; défaut ciblé en thème clair mobile |
| Accessibilité | 75 | 12 % | 9,0 | Structure, titres et thème sombre solides ; contraste mobile clair insuffisant, clavier partiellement non exécuté |
| Performance | 65 | 8 % | 5,2 | Rendu local acceptable à 222 lignes ; dépendances bloquantes, métriques Web non mesurées |
| Compatibilité | 60 | 6 % | 3,6 | Chromium testé ; autres moteurs uniquement revus dans le code |
| Robustesse technique | 40 | 12 % | 4,8 | Ordre d'écriture fragile, synchronisation et restauration non atomiques, HTML dynamique non échappé |
| **Total** |  | **100 %** | **64,0** | |

Ce score n'est ni un Lighthouse ni une couverture de code. Il sert uniquement à prioriser le travail issu de cette campagne.

## 4. Architecture fonctionnelle

### Pages et fonctions découvertes

| ID | Page / zone | Fonctionnalité | Interaction et données | Criticité | Statut d'audit |
|---|---|---|---|---|---|
| F-01 | `index.html` | Tableau de bord hebdomadaire et objectif principal | Agrégats des séances, courses, plan, équipements | Critique | TESTÉ |
| F-02 | Navigation partagée | Menu desktop/mobile, thème, profil | `renderAppNav`, `localStorage` | Haute | TESTÉ |
| F-03 | `historique.html` | Liste, tri et filtres d'activités | Index et séances locales | Critique | TESTÉ en rendu ; interactions VÉRIFIÉES DANS LE CODE |
| F-04 | `historique.html` | Import FIT par bouton et glisser-déposer | File API, parseur FIT, stockage, Supabase | Critique | TESTÉ |
| F-05 | `activite.html` | Détail d'une activité | Série FIT, tours, contexte, équipement | Critique | VÉRIFIÉ DANS LE CODE ; parcours visuel partiel |
| F-06 | `activite.html` | Carte Leaflet et graphiques | GPS, altitude, FC, allure, CDN/OSM | Haute | VÉRIFIÉ DANS LE CODE ; réseau cartographique NON TESTÉ |
| F-07 | `activite.html` | Retour Coach ELEV | Profil, plan, séances, Anthropic | Haute | VÉRIFIÉ DANS LE CODE ; API NON TESTÉE |
| F-08 | `analyse.html` | Tendances et statistiques globales | Séances et agrégats partagés | Haute | TESTÉ en rendu normal/vide/partiel/volume |
| F-09 | `objectifs.html` | Gestion des courses et préparation | Courses, profil, séances | Haute | TESTÉ en rendu ; CRUD non exécuté |
| F-10 | `objectifs.html` | Estimation IA de course | Profil, santé, historique, Anthropic | Haute | VÉRIFIÉ DANS LE CODE ; API NON TESTÉE |
| F-11 | `plan.html` | Calendrier et suivi du plan | Plan, notes, année, séances | Haute | TESTÉ en rendu |
| F-12 | Paramètres / Plan | Import CSV | Fichier CSV, `parsePlanCsv` | Haute | TESTÉ |
| F-13 | `profil.html` | Profil sportif et santé | Données personnelles locales/cloud | Haute | TESTÉ en rendu ; modification non exécutée |
| F-14 | `equipements.html` | Équipements, chaussures, kilométrage | Équipements + références des séances | Haute | TESTÉ en rendu ; CRUD non exécuté |
| F-15 | Paramètres / Données | Export JSON complet | Séances, plan, courses, profil, équipements | Critique | TESTÉ |
| F-16 | Paramètres / Données | Import JSON et fusion | Même jeu de données | Critique | VÉRIFIÉ DANS LE CODE et instrumenté |
| F-17 | Paramètres / Données | Réinitialisation locale | Toutes les clés `trail:*` | Critique | VÉRIFIÉ DANS LE CODE ; clic destructif NON TESTÉ |
| F-18 | Paramètres / Sauvegarde | Vidage du cache et récupération cloud | Blob `trail_data` + table `activities` | Critique | VÉRIFIÉ DANS LE CODE et simulé |
| F-19 | Stockage | États vide, partiel, corrompu, quota | `localStorage` | Critique | TESTÉ / simulé |
| F-20 | Supabase | Authentification, push/pull, synchronisation | Auth, `trail_data`, `activities`, Storage FIT | Critique | Synchronisation simulée ; compte réel NON TESTÉ |
| F-21 | `connexion.html` | Connexion, inscription, mot de passe | Supabase Auth | Critique | NON TESTÉ sans compte de recette |
| F-22 | `onboarding.html` | Première utilisation | Profil, course, import | Moyenne | VÉRIFIÉ DANS LE CODE |
| F-23 | `inspecteur.html` | Diagnostic FIT, CRC et champs | Fichier FIT en lecture seule | Moyenne | TESTÉ par fonctions internes |
| F-24 | `composants.html` | Documentation du design system | CSS et composants | Faible | VÉRIFIÉ DANS LE CODE |
| F-25 | `_audit.html` / `_fixtures.html` | Audit responsive et jeux de données | Iframe, stockage de test | Haute pour la QA | TESTÉ |
| F-26 | PWA | Manifeste et installation | `manifest.json`, icônes | Moyenne | VÉRIFIÉ DANS LE CODE ; hors-ligne NON DISPONIBLE |

### Arborescence simplifiée

```text
Dashboard Trail html/
├─ index.html, historique.html, activite.html, analyse.html
├─ objectifs.html, plan.html, profil.html, equipements.html
├─ parametres.html, connexion.html, onboarding.html
├─ inspecteur.html, composants.html, _audit.html, _fixtures.html
├─ assets/
│  ├─ app.js, authgate.js, style.css, icon.svg
│  ├─ lucide.min.js, lucide-fallback.js
│  └─ images/*.webp
├─ fit_files/*.fit
├─ plan-trail-nico.csv
├─ manifest.json
├─ supabase/migrations/0001_activities_and_fit_files.sql
└─ audit-qa/                  # artefacts de cette campagne uniquement
```

## 5. Architecture technique

### Carte fonctionnalité → fichiers → données → dépendances

| Fonction | Fichiers principaux | Source de données | Dépendances |
|---|---|---|---|
| Navigation, thème, calculs, stockage, graphiques | `assets/app.js`, `assets/style.css` | `localStorage`, DOM | Lucide local avec repli CDN |
| Import FIT | `historique.html`, `assets/app.js` | Fichier local, `trail:seance:*`, `trail:index` | File API, Supabase optionnel |
| Détail activité | `activite.html`, `assets/app.js` | Séance locale/cloud | Leaflet 1.9.4, tuiles OSM, Anthropic optionnel |
| Plan | `plan.html`, `parametres.html`, `assets/app.js` | CSV, `trail:plan`, notes, année | Aucune bibliothèque de parsing externe |
| Objectifs | `objectifs.html`, `assets/app.js` | Courses, profil, activités | Anthropic optionnel |
| Profil/équipements | `profil.html`, `equipements.html` | `trail:profile`, `trail:gear`, séances | Stockage local/Supabase |
| Sauvegarde locale | `parametres.html`, `assets/app.js` | JSON local | Blob/File API |
| Synchronisation | `assets/app.js`, `assets/authgate.js`, `connexion.html`, `parametres.html` | `trail_data`, `activities`, bucket privé `fit-files` | Supabase JS `@2` via jsDelivr |
| PWA | `manifest.json`, icônes | Métadonnées statiques | Aucun service worker |

### Constats techniques structurants

- Application statique sans framework ni étape de construction : HTML/CSS/JavaScript natifs.
- `assets/app.js` pèse 277 558 octets et `assets/style.css` 179 163 octets sur disque.
- Google Fonts est appelé par les pages ; Supabase JS est chargé depuis `@2` sans version corrective figée ; Leaflet 1.9.4 est chargé sur le détail activité.
- Anthropic est appelé directement depuis le navigateur sur deux pages.
- Aucune clé API réelle n'a été trouvée dans les fichiers sources audités.
- La migration Supabase active la sécurité par ligne et limite les lignes/buckets à `auth.uid() = user_id`.
- Aucun fichier local référencé par les pages HTML racines n'est manquant.

## 6. Analyse des risques

Échelle : probabilité et impact de 1 à 5 ; risque = produit des deux valeurs.

| Fonctionnalité | Probabilité | Impact | Risque | Priorité de test | Résultat |
|---|---:|---:|---:|---|---|
| Synchronisation d'une activité locale absente du cloud | 4 | 5 | 20 | 1 | Échec critique confirmé |
| Identifiant et réimport FIT | 4 | 5 | 20 | 1 | Collision/remplacement confirmé |
| Réinitialisation / vidage du cache avec sync différée | 3 | 5 | 15 | 1 | Minuterie réarmée confirmée |
| Import/export JSON | 4 | 4 | 16 | 2 | Aller-retour incomplet confirmé |
| Quota `localStorage` | 4 | 4 | 16 | 2 | Quota atteint avec jeu volumique |
| Dates et fuseau horaire | 3 | 4 | 12 | 2 | Décalage de jour reproduit |
| Fichier FIT corrompu mais parsable | 3 | 3 | 9 | 3 | CRC invalide accepté |
| Clé Anthropic et données de santé côté navigateur | 3 | 5 | 15 | 2 | Architecture confirmée ; exploitation non réalisée |
| Contraste thème clair mobile | 5 | 3 | 15 | 3 | Échec sur huit pages |
| Dépendances CDN / réseau | 3 | 3 | 9 | 4 | Revue du code ; pannes CDN non exécutées |

## 7. Matrice de couverture

### Couverture réelle

- **Fonctionnalités découvertes : 26 groupes fonctionnels.**
- **Fonctionnalités avec exécution directe : 18 / 26.**
- **Fonctionnalités supplémentaires vérifiées seulement dans le code : 6 / 26.**
- **Fonctionnalités non exécutées : 2 / 26** (authentification réelle et appels Anthropic réels).
- Cette valeur est une couverture fonctionnelle de l'inventaire ci-dessus, pas une couverture de code.

### Campagnes réellement exécutées

| Campagne | Volume exécuté | Résultat produit |
|---|---:|---|
| Scénarios automatisés ciblés | 19 | 19 assertions de test réussies : 8 comportements conformes, 10 défauts confirmés, 1 absence de cache hors-ligne confirmée |
| Audit pages × modes × largeurs × états | 224 exécutions | 216 conformes, 8 échecs de contraste correspondant à une même anomalie |
| Smoke test de la version publique | 8 pages | 8 pages avec `main`, un titre visible et contenu non vide ; aucune erreur console observée |
| Fichiers FIT réels | 3 | 3 analysés avec distance, durée, date et série |
| Parcours FIT dans l'interface | 3 | invalide rejeté ; valide visible ; doublon annoncé comme importé mais remplaçant la ligne |
| Volumétrie historique | 222 activités | Liste rendue ; hauteur 59 584 px ; médiane locale vers première ligne visible 318 ms sur 3 rechargements |
| Références locales HTML | toutes les pages racines | aucune cible locale manquante |
| Syntaxe JavaScript | `app.js`, `authgate.js` | 2/2 valides avec `node --check` |

La médiane de 318 ms est une mesure locale ciblée, pas un temps de chargement réseau, un LCP ou un score Lighthouse.

### Matrice de traçabilité principale

| Exigence / fonction | Test | Résultat produit | Constat |
|---|---|---|---|
| Import FIT | 3 fichiers réels | Conforme | — |
| Import FIT | signature invalide | Rejet lisible | — |
| Import FIT | fichier tronqué | Rejet | — |
| Import FIT | CRC final invalide | Accepté malgré corruption | BUG-004 |
| Import FIT | même fichier deux fois | 1 ligne, message « 1 séance importée » | BUG-003, UX-001 |
| FIT | instant 21:00 UTC / 01:00 Maurice | enregistré au jour UTC précédent | BUG-005 |
| FIT | deux distances arrondies à 5 000 m | même identifiant | BUG-003 |
| CSV | plan réel | 84 séances du 07/08 au 28/11/2026 | — |
| CSV | `;`, accents, virgule décimale | ligne correctement analysée | — |
| CSV | vide | tableau vide sans exception | — |
| JSON | export complet | séances, notes et année présentes | — |
| JSON | réimport de notes/année | champs non restaurés | BUG-006 |
| JSON | `races: []` | courses existantes conservées | BUG-007 |
| Réinitialisation | métadonnées du plan | notes/année restent stockées | BUG-009 |
| Cache/sync | annuler puis supprimer localement | minuterie de sync réarmée | BUG-002 |
| Supabase | upsert local échoue, remote vide | succès retourné et index vidé | BUG-001 |
| Stockage | ordre d'écriture FIT | index écrit avant séance | BUG-008 |
| Responsive | 320, 375, 390, 768, 1024, 1366, 1440 px | aucun overflow sur 8 pages | — |
| Accessibilité | contraste sombre 375/1440 | conforme au test interne | — |
| Accessibilité | contraste clair 375 | 8 libellés actifs à 3,07:1 | A11Y-001 |
| Stockage | vide, partiel, volumique | pages rendues sans crash | — |
| Historique | 222 activités | rendu complet sans crash | PERF-002 |
| Version publique | 8 pages principales | chargées | — |
| PWA hors-ligne | présence service worker | absent | AMEL-001 |

## 8. Synthèse des anomalies

| ID | Type | Titre | Sévérité | Priorité | Statut |
|---|---|---|---|---|---|
| BUG-001 | BUG | Un échec d'upsert peut retirer une activité de l'index local | S1 | P0 | Confirmé |
| BUG-002 | BUG | La réinitialisation réarme une synchronisation annulée | S1 | P0 | Confirmé |
| BUG-003 | BUG | Deux activités distinctes peuvent partager le même identifiant | S1 | P0 | Confirmé |
| BUG-004 | BUG | Un FIT au CRC invalide est accepté par l'import normal | S2 | P1 | Confirmé |
| BUG-005 | BUG | Une activité peut être classée au mauvais jour à Maurice | S2 | P1 | Confirmé |
| BUG-006 | BUG | L'import JSON ne restaure pas les notes et l'année du plan | S2 | P1 | Confirmé |
| BUG-007 | BUG | Un export avec zéro course ne peut pas vider la liste locale | S2 | P1 | Confirmé |
| BUG-008 | BUG | L'index FIT est écrit avant la séance | S2 | P1 | Confirmé |
| BUG-009 | BUG | La réinitialisation laisse deux métadonnées du plan | S3 | P2 | Confirmé |
| UX-001 | UX | Un doublon est annoncé comme une nouvelle séance importée | S2 | P1 | Confirmé |
| A11Y-001 | ACCESSIBILITÉ | Contraste insuffisant du menu mobile en thème clair | S2 | P1 | Confirmé |
| RISK-001 | RISQUE | Texte dynamique non échappé injecté dans `innerHTML` | S1 | P1 | Vérifié dans le code |
| RISK-002 | RISQUE | Clé Anthropic persistée dans le navigateur | S1 | P1 | Vérifié dans le code |
| RISK-003 | RISQUE | Appels Anthropic sans délai d'expiration | S2 | P2 | Vérifié dans le code |
| PERF-001 | PERFORMANCE | SDK Supabase bloquant et version corrective non figée | S3 | P2 | Vérifié dans le code |
| PERF-002 | PERFORMANCE | Historique sans pagination ni virtualisation | S3 | P2 | Confirmé, impact actuel limité |
| TECH-001 | DETTE TECHNIQUE | Restauration cloud et import JSON suivent deux règles différentes | S2 | P1 | Vérifié dans le code |

## 9. Bugs fonctionnels

### BUG-001 — Un échec d'upsert peut retirer une activité de l'index local

**Catégorie :** BUG — synchronisation  
**Sévérité :** S1 · **Priorité :** P0 · **Statut :** Confirmé · **Confiance :** Haute  
**Page / fonction :** toutes les pages utilisant les séances ; `syncActivitiesWithSupabase()`  
**Environnement :** simulation JavaScript locale de Supabase  
**Préconditions / données :** une séance `local-1` existe localement, est absente de la table distante ; l'upsert échoue et la lecture distante retourne zéro ligne.

**Étapes de reproduction :**

1. Charger une séance locale absente de Supabase.
2. Simuler `pushActivityRow()` en échec.
3. Laisser `syncActivitiesWithSupabase()` relire la table distante vide.
4. Lire `trail:index` et la clé de séance.

**Observé :** la fonction retourne `ok: true`, l'index devient vide, mais l'objet séance reste orphelin dans `localStorage`. L'activité disparaît de l'interface, des totaux et de l'export.  
**Attendu :** arrêter la reconstruction et conserver l'index local dès qu'un upsert requis échoue.  
**Fréquence :** toujours avec ces préconditions.  
**Impact utilisateur/données :** perte apparente et exclusion de la sauvegarde JSON ; récupération difficile sans outil technique.  
**Preuve :** test automatisé `qa_tests.mjs`, résultat `{reportedOk:true, visibleIndex:[], orphanStillStored:true}`.  
**Fichier / zone :** `assets/app.js`, lignes 1379–1412 ; résultat de `pushActivityRow` ignoré à la ligne 1390.  
**Cause probable :** stratégie « pousser puis reconstruire depuis le cloud » non transactionnelle.  
**Correction :** collecter tous les résultats d'upsert ; si l'un échoue, retourner l'erreur et ne pas remplacer l'index. Idéalement, fusionner par identifiant et conserver les lignes locales non confirmées.  
**Risque de régression :** doublons ou sessions anciennes réapparues lors de la fusion.  
**Non-régression :** upsert réussi/échoué, remote vide/partiel, hors-ligne, session expirée, reprise ultérieure.

### BUG-002 — La réinitialisation réarme une synchronisation annulée

**Catégorie :** BUG — données cloud  
**Sévérité :** S1 · **Priorité :** P0 · **Statut :** Confirmé · **Confiance :** Haute  
**Page / fonction :** Paramètres → Réinitialiser / Vider le cache ; `cancelPendingSync`, `deleteSession`, `scheduleSync`  
**Environnement :** simulation locale avec Supabase configuré  
**Préconditions / données :** au moins une séance locale et un client Supabase configuré.

**Étapes :** annuler la minuterie ; appeler `deleteSession` comme le font les deux parcours ; contrôler `_syncTimer`.  
**Observé :** la suppression appelle de nouveau `scheduleSync()` et `_syncTimer` redevient non nul. Si `syncPull()` tarde plus de 1,5 s ou échoue, le blob vidé/partiel peut être renvoyé au cloud. Les séances sont désormais dans `activities`, mais plan, courses, profil, équipements, notes et année restent exposés.  
**Attendu :** aucune synchronisation sortante pendant toute l'opération de purge/récupération.  
**Fréquence :** toujours pour le réarmement ; dommage cloud dépendant du délai réseau.  
**Impact :** écrasement potentiel de la copie cloud que le message promet de conserver.  
**Preuve :** test instrumenté `timerRearmedAfterCancel: true`; code `parametres.html` 401–445 et `assets/app.js` 1090–1110/561.  
**Cause :** annulation ponctuelle, sans verrou de transaction couvrant les suppressions et le pull.  
**Correction :** activer `_applyingRemote` ou un verrou `_syncSuspended` avant la première suppression, annuler après les suppressions, effectuer les pulls, puis lever le verrou seulement après succès/gestion d'échec.  
**Régression :** synchronisation qui resterait bloquée après exception.  
**Non-régression :** pull rapide/lent/échoué, 0/1/n séances, rechargement, nouvelle modification après récupération.

### BUG-003 — Deux activités distinctes peuvent partager le même identifiant

**Catégorie :** BUG — import/persistance  
**Sévérité :** S1 · **Priorité :** P0 · **Statut :** Confirmé · **Confiance :** Haute  
**Page :** `historique.html`  
**Préconditions / données :** deux FIT de même date, même sport et distances 5,0001 et 5,0004 km, ou réimport du même fichier.

**Étapes :** calculer/importer les deux séances ; observer l'identifiant et le nombre de lignes.  
**Observé :** les deux produisent `2026-08-22_Trail_5000`. La seconde écriture remplace la première sous la même clé. Dans l'interface, trois imports successifs du même FIT laissent une seule ligne.  
**Attendu :** un identifiant stable mais unique par activité ; un doublon exact doit être détecté explicitement.  
**Fréquence :** toujours en cas de collision.  
**Impact :** remplacement silencieux d'une séance, possible perte de notes/équipement/feedback liés.  
**Preuve :** test automatisé de collision et parcours navigateur.  
**Fichier / zone :** `historique.html` 141–147.  
**Cause :** identifiant composé uniquement de la date, du sport et de la distance arrondie au mètre.  
**Correction :** utiliser l'empreinte du fichier ou `timestamp + manufacturer/product + serial + distance + duration`, avec UUID de repli ; séparer détection de doublon et identité.  
**Régression :** migration des identifiants déjà synchronisés.  
**Non-régression :** doublon exact, deux séances même jour, distances égales/différentes, import multi-fichiers, synchronisation.

### BUG-004 — Un FIT au CRC invalide est accepté par l'import normal

**Catégorie :** BUG — validation fichier  
**Sévérité :** S2 · **Priorité :** P1 · **Statut :** Confirmé · **Confiance :** Haute  
**Page :** Historique / Inspecteur FIT  
**Donnée :** copie d'un FIT réel dont le dernier octet CRC est modifié.

**Étapes :** modifier uniquement le CRC final ; lancer l'inspecteur ; lancer `parseFit`.  
**Observé :** l'inspecteur retourne `fileCrcValid:false` sans erreur de parsing ; l'import normal accepte 3 661 enregistrements.  
**Attendu :** l'import normal doit refuser un CRC invalide ou demander une confirmation explicite en indiquant le risque.  
**Fréquence :** toujours sur le fichier de test.  
**Impact :** statistiques issues d'un fichier altéré ; confiance dans les données.  
**Preuve :** test automatisé.  
**Fichier :** `assets/app.js` 123–140 et 435–483.  
**Cause :** le contrôle CRC existe seulement dans `buildFitInspectorReport`, pas dans `parseFit`.  
**Correction :** factoriser la validation d'en-tête, taille et CRC avant parsing.  
**Régression :** certains appareils peuvent produire un CRC absent/à zéro ; prévoir une règle documentée.  
**Non-régression :** CRC valide, nul, invalide, fichier tronqué, signature incorrecte.

### BUG-005 — Une activité peut être classée au mauvais jour à Maurice

**Catégorie :** BUG — date/calcul  
**Sévérité :** S2 · **Priorité :** P1 · **Statut :** Confirmé · **Confiance :** Haute  
**Pages :** toutes les vues regroupant par date/semaine  
**Donnée :** instant FIT `2026-08-21T21:00:00Z`, soit le 22 août à 01:00 à Maurice.

**Observé :** la date stockée est `2026-08-21`; la date locale Maurice est `2026-08-22`.  
**Attendu :** conserver l'instant UTC et dériver la date civile selon le fuseau de l'activité ou, à défaut, celui du navigateur.  
**Fréquence :** pour les activités entre minuit et 03:59 heure Maurice si le timestamp représente l'instant UTC.  
**Impact :** mauvais jour/semaine, rapprochement incorrect avec le plan, totaux hebdomadaires et compte à rebours incohérents.  
**Preuve :** test automatisé.  
**Fichier :** `assets/app.js` 213, 295–301, 408–410 et nombreux `toISOString().slice(0,10)`.  
**Cause :** utilisation de la date UTC comme date civile locale.  
**Correction :** centraliser `localDateISO(date, timeZone)` ; conserver aussi le timestamp original et le fuseau quand disponible.  
**Régression :** historiques existants et calculs de semaine.  
**Non-régression :** minuit dans UTC+4, UTC-10, changement d'année, semaine ISO.

### BUG-006 — L'import JSON ne restaure pas les notes et l'année du plan

**Catégorie :** BUG — sauvegarde/restauration  
**Sévérité :** S2 · **Priorité :** P1 · **Statut :** Confirmé · **Confiance :** Haute  
**Page :** Paramètres → Données  
**Préconditions :** export contenant `planNotes` et `planYear`.

**Étapes :** générer l'export ; restaurer le fichier dans une origine vide ; lire notes et année.  
**Observé :** l'export les contient, le gestionnaire d'import ne les lit jamais.  
**Attendu :** un export réimporté restaure tous les champs exportés.  
**Fréquence :** toujours.  
**Impact :** perte de réglages et notes lors d'une migration ou restauration.  
**Preuve :** test automatisé et code.  
**Fichier :** `assets/app.js` 1049–1051 ; `parametres.html` 364–391.  
**Cause :** l'import JSON duplique une logique plus ancienne au lieu d'appeler la fonction partagée de restauration.  
**Correction :** valider le schéma puis restaurer explicitement tous les champs, idéalement via une seule fonction partagée avec `applySyncPayload`.  
**Régression :** compatibilité avec exports anciens.  
**Non-régression :** export actuel/ancien, champs absents/supplémentaires, destination vide/existante.

### BUG-007 — Un export avec zéro course ne peut pas vider la liste locale

**Catégorie :** BUG — restauration  
**Sévérité :** S2 · **Priorité :** P1 · **Statut :** Confirmé · **Confiance :** Haute  
**Page :** Paramètres → Données  
**Donnée :** JSON valide avec `races: []` importé dans une origine contenant une course.

**Observé :** condition `Array.isArray(data.races) && data.races.length` ; la liste existante reste.  
**Attendu :** une clé présente et vide remplace la liste par une liste vide ; une clé absente ne change rien.  
**Fréquence :** toujours.  
**Impact :** restauration non fidèle, anciennes courses ressuscitées.  
**Preuve :** test automatisé/code.  
**Fichier :** `parametres.html` 383–386.  
**Correction :** appliquer la même sémantique que `applySyncPayload` : distinguer absence et tableau vide.  
**Régression :** imports partiels.  
**Non-régression :** clé absente, tableau vide, une/n courses, entrée invalide.

### BUG-008 — L'index FIT est écrit avant la séance

**Catégorie :** BUG — persistance  
**Sévérité :** S2 · **Priorité :** P1 · **Statut :** Confirmé · **Confiance :** Haute  
**Page :** Historique  
**Précondition :** stockage proche du quota.

**Observé :** `saveIndex(idx) && saveSession(id, summary)` écrit d'abord l'identifiant ; si la séance volumineuse échoue, l'index peut référencer une clé absente et le message agrège mal le résultat.  
**Attendu :** écrire la séance d'abord, puis publier l'identifiant ; revenir en arrière si la seconde étape échoue.  
**Fréquence :** toujours sur l'ordre ; incohérence lors d'un échec d'écriture.  
**Impact :** activité fantôme, index incohérent, import compté de manière ambiguë.  
**Preuve :** code et scénario de quota ; le jeu volumique a atteint le quota après 222 séances synthétiques lors de l'ajout du plan.  
**Fichier :** `historique.html` 145–158.  
**Correction :** transaction locale simulée : sauvegarder séance, sauvegarder index, supprimer la séance si l'index échoue.  
**Régression :** doublon et synchronisation déclenchée deux fois.  
**Non-régression :** quota sur première/deuxième écriture, import multiple, reload.

### BUG-009 — La réinitialisation laisse deux métadonnées du plan

**Catégorie :** BUG — reset  
**Sévérité :** S3 · **Priorité :** P2 · **Statut :** Confirmé · **Confiance :** Haute  
**Page :** Paramètres → Réinitialiser  
**Observé :** `trail:planNotes` et `trail:planYear` ne sont pas supprimés.  
**Attendu :** la réinitialisation annoncée comme globale supprime toutes les données applicatives locales, sauf choix explicitement documenté.  
**Fréquence :** toujours.  
**Impact :** ancien contexte réapparaissant après un nouveau départ.  
**Preuve :** test automatisé/code.  
**Fichier :** `parametres.html` 394–410.  
**Correction :** inclure les deux clés dans une liste centralisée de purge ; conserver séparément la configuration Supabase si c'est le choix produit.  
**Régression :** vérifier le message de confirmation et la récupération cloud.

## 10. Données et calculs

### Résultats conformes

- **TESTÉ — FIT réels :**
  - 18,70845 km, 15 705 s, 15 725 records, date 08/08/2026 ;
  - 13,93878 km, 14 122 s, 14 134 records, date 09/08/2026 ;
  - 7,92898 km, 3 658 s, 3 661 records, date 11/08/2026.
- Les trois séries sont réduites à 1 500 points pour l'affichage, sans absence de distance/durée.
- **TESTÉ — CSV réel :** 84 séances entre le 7 août et le 28 novembre 2026.
- **TESTÉ — CSV alternatif :** accents, point-virgule, virgule décimale et valeurs `≈` pris en charge.
- **TESTÉ — états vide/partiel :** pas de crash ni total `NaN` visible.

### Incohérences confirmées

- Le fuseau UTC peut déplacer une séance vers le jour précédent (BUG-005).
- L'identifiant ne garantit pas l'unicité (BUG-003).
- L'export et l'import ne portent pas le même schéma effectif (BUG-006/007).
- Une séance orpheline hors index n'entre plus dans `loadAllSessions()`, donc aucun calcul aval ne la voit (BUG-001).
- La vérification d'intégrité existante cherche les références d'équipement orphelines, mais pas les clés `trail:seance:*` absentes de l'index ni les identifiants d'index sans objet.

### À confirmer après correctif

- Exactitude manuelle des D+/D-, VAM, moyennes cardiaques et allures sur un FIT de référence calculé par un outil indépendant.
- Cas sans FC, sans altitude, sans GPS, activité ultra-courte, ultra-longue et valeurs extrêmes : aucun fichier de référence correspondant n'était fourni.

## 11. UX

### UX-001 — Un doublon est annoncé comme une nouvelle séance importée

**Catégorie :** UX · **Sévérité :** S2 · **Priorité :** P1 · **Statut :** Confirmé · **Confiance :** Haute  
**Page :** Historique  
**Précondition :** une activité déjà importée.  
**Étapes :** réimporter exactement le même FIT par le bouton visible.  
**Observé :** message `1 séance(s) importée(s).` ; la liste reste à une activité.  
**Attendu :** `Doublon détecté — aucune nouvelle séance ajoutée`, ou demande de remplacement si les contenus diffèrent.  
**Fréquence :** toujours.  
**Conséquence :** l'utilisateur croit posséder deux séances ou une sauvegarde supplémentaire alors qu'une clé a été remplacée.  
**Preuve :** parcours navigateur sur origine de test isolée.  
**Fichier :** `historique.html` 145–163.  
**Correction :** compter séparément `added`, `duplicate`, `updated`, `failed` après comparaison d'empreinte.  
**Régression :** import multi-fichiers avec mélange de nouveaux et doublons.

### Autres constats UX

| Constat | Conséquence utilisateur | Proposition |
|---|---|---|
| Les messages Supabase peuvent afficher directement une raison technique | Difficulté à agir sans comprendre l'erreur | Ajouter une traduction courte + détail dépliable |
| Le quota est expliqué dans `saveSession`, ce qui est positif, mais l'état avant saturation n'est pas visible | Découverte tardive au moment de l'échec | Afficher espace estimé et inciter à exporter/synchroniser avant seuil |
| L'état vide guide bien vers l'import | Bonne découvrabilité | Conserver ce comportement dans les régressions |
| L'historique de 222 lignes ne propose ni pagination ni regroupement | Recherche longue sur plusieurs saisons | Pagination, chargement progressif ou filtre par année |
| L'absence de clé Anthropic renvoie vers Paramètres | Action compréhensible | Ajouter un lien direct vers la section concernée |

## 12. UI / Responsive

### Résultats testés

- 8 pages principales × 320, 375, 390, 768, 1024, 1366 et 1440 px : aucun débordement horizontal, image cassée ou zone principale vide.
- États normal, vide, partiel et volumique : aucun chevauchement bloquant observé par le harnais.
- Thème sombre à 375 et 1440 px : aucun échec de contraste remonté par le contrôle interne.
- Une capture de référence a été conservée dans `audit-qa/captures/accueil-desktop-1440x900.png`.

### Limites

- « Grand écran » au-delà de 1440 px : non exécuté.
- Hover, focus, disabled, loading et modales : partiellement revus dans le code, pas tous rejoués visuellement.
- Le harnais signale quelques contrôles cachés sans nom ; ils correspondent à des inputs fichiers invisibles déclenchés par des boutons nommés et à un bouton d'archive dont le texte est ajouté à l'ouverture. Ils ne sont pas classés comme anomalies sans preuve utilisateur.

## 13. Accessibilité

### A11Y-001 — Contraste insuffisant du menu mobile en thème clair

**Catégorie :** ACCESSIBILITÉ  
**Sévérité :** S2 · **Priorité :** P1 · **Statut :** Confirmé · **Confiance :** Haute  
**Pages :** les 8 pages principales à 375 px, thème clair  
**Critère :** WCAG 1.4.3 Contraste minimum  
**Donnée :** libellé actif du rail mobile (`Aujourd'hui`, `Activités`, `Progression`, `Objectif` ou `Plus`).

**Observé :** contraste 3,07:1 pour un texte de 11 px, couleur `rgb(74,104,50)` sur fond `rgb(10,14,12)` ; seuil attendu 4,5:1.  
**Attendu :** contraste ≥ 4,5:1.  
**Fréquence :** toujours dans la configuration testée.  
**Impact :** l'onglet courant est difficile à identifier pour basse vision ou en environnement lumineux.  
**Preuve :** 8 échecs du harnais de contraste.  
**Fichier :** `assets/style.css`, variables du thème clair et styles du rail mobile.  
**Cause :** la variable d'accent du thème clair est réutilisée sur une barre qui reste sombre.  
**Correction :** créer un jeton dédié `--rail-accent` assez clair sur le fond sombre au lieu de réutiliser `--accent`.  
**Régression :** vérifier états actif/focus/hover dans les deux thèmes.  
**Non-régression :** 320/375/390 px, zoom 200 %, contraste normal et focus.

### Contrôles conformes ou partiels

- **TESTÉ :** un seul H1 visible par page principale dans les scénarios du harnais ; absence de saut de niveau détecté.
- **TESTÉ :** `main` non vide sur toutes les pages principales ; lien d'évitement présent dans le rendu.
- **TESTÉ :** aucun défaut de nom accessible visible sur les contrôles affichés du jeu normal.
- **VÉRIFIÉ DANS LE CODE :** messages `showMsg` portent `role=status` et `aria-live=polite`.
- **VÉRIFIÉ DANS LE CODE :** gestion partagée d'Échap et du focus des modales présente.
- **VÉRIFIÉ DANS LE CODE :** `prefers-reduced-motion` existe dans les styles.
- **NON TESTÉ :** lecteur d'écran réel, VoiceOver/NVDA, ordre complet de tabulation, piège de focus réel, zoom navigateur 200 %, cibles tactiles mesurées sur appareil physique.

## 14. Compatibilité

| Cible | Statut | Résultat |
|---|---|---|
| Chromium intégré | TESTÉ | Pages locales et publiques chargées ; imports fichiers exécutés ; aucun défaut console observé sur le smoke public |
| Chrome externe | NON TESTÉ | Aucun navigateur externe demandé ou attaché |
| Edge | NON TESTÉ | Revue du code seulement |
| Firefox | NON TESTÉ | Revue du code seulement |
| Safari / WebKit | NON TESTÉ | Non disponible sur l'environnement Windows |

### Revue de compatibilité du code

- File API, `Blob`, `TextDecoder`, `localStorage`, `MutationObserver`, CSS Grid/Flex et `fetch` sont largement supportés sur navigateurs modernes.
- L'application dépend de CDN et de Google Fonts ; les politiques de blocage réseau ou anti-pistage peuvent dégrader la police, Supabase ou la carte.
- Supabase chargé via `@2` peut changer de version corrective sans modification du dépôt : risque de régression non maîtrisée.
- Les conversions par `Date`/`toISOString` sont compatibles techniquement mais incorrectes fonctionnellement pour la date civile locale (BUG-005).
- Les tuiles OSM et Leaflet n'ont pas été testées hors ligne ni sous politique CSP stricte.

## 15. Performance

### Mesures réellement disponibles

| Indicateur | Résultat |
|---|---|
| Historique 222 activités, délai local vers première ligne visible | 332 / 318 / 316 ms, médiane 318 ms |
| Hauteur de page correspondante | 59 584 px |
| Taille disque `assets/app.js` | 277 558 octets |
| Taille disque `assets/style.css` | 179 163 octets |
| LCP | Non mesuré |
| INP | Non mesuré |
| CLS | Non mesuré |
| FCP | Non mesuré |
| TTFB | Non mesuré |
| Poids transféré réseau | Non mesuré |
| Nombre de requêtes réseau | Non mesuré |
| Lighthouse | Non exécuté |

### PERF-001 — SDK Supabase bloquant et version corrective non figée

**Sévérité :** S3 · **Priorité :** P2 · **Statut :** Vérifié dans le code · **Confiance :** Haute  
**Observé :** Supabase JS `@2` est chargé de manière classique sur de nombreuses pages, y compris celles pouvant fonctionner localement.  
**Impact :** dépendance au réseau au démarrage, parsing inutile et comportement pouvant varier après mise à jour CDN.  
**Correction :** figer une version exacte et charger Supabase en différé uniquement quand configuration/authentification l'exige.  
**Non-régression :** démarrage local-first sans réseau, connexion et synchronisation.

### PERF-002 — Historique sans pagination ni virtualisation

**Sévérité :** S3 · **Priorité :** P2 · **Statut :** Confirmé, impact actuel limité · **Confiance :** Moyenne  
**Observé :** 222 lignes sont toutes rendues ; la page atteint 59 584 px. Le délai local mesuré reste acceptable sur cette machine.  
**Impact probable :** DOM, mémoire et filtres croissent linéairement ; appareils mobiles modestes non mesurés.  
**Correction :** chargement par lots, pagination accessible ou virtualisation prudente conservant navigation et lecture d'écran.  
**Non-régression :** filtres, tri, focus, URL activité, retour arrière.

## 16. Code et dette technique

### TECH-001 — Deux moteurs de restauration aux règles différentes

**Catégorie :** DETTE TECHNIQUE  
**Sévérité :** S2 · **Priorité :** P1 · **Statut :** Vérifié dans le code · **Confiance :** Haute  
**Zone :** `applySyncPayload()` et gestionnaire `importFileInput`  
**Observé :** la restauration cloud sait appliquer `races: []`, `planNotes` et `planYear`, alors que l'import JSON manuel ne le fait pas.  
**Impact :** bugs BUG-006/007 et futurs écarts de schéma.  
**Correction :** une fonction de validation/migration/restauration commune, avec options explicites pour fusionner ou remplacer.  
**Risque de régression :** import partiel écrasant des valeurs absentes ; contrôler la distinction « absent » / « présent vide ».

### Autres dettes

- `app.js` centralise parsing, stockage, calculs, graphiques, navigation et synchronisation ; une modification partagée a un rayon de régression élevé.
- Les écritures locales déclenchent implicitement une synchronisation, ce qui rend les opérations multi-étapes difficiles à rendre atomiques.
- Le contrôle d'intégrité devrait couvrir index ↔ objets séances, versions de schéma et collisions d'identifiants.
- Le projet ne contenait pas de suite de régression automatisée de production ; `audit-qa/qa_tests.mjs` constitue un harnais ciblé, pas encore une suite maintenue.
- Les dépendances externes ne sont pas toutes figées et aucun cache applicatif hors ligne n'existe.

## 17. Confidentialité / robustesse

### RISK-001 — Texte dynamique non échappé injecté dans `innerHTML`

**Catégorie :** RISQUE sécurité · **Sévérité :** S1 · **Priorité :** P1 · **Statut :** Vérifié dans le code · **Confiance :** Haute  
**Zone :** `showMsg(elId, text, kind)`  
**Préconditions :** un texte contenant du HTML atteint un appel à `showMsg` ; plusieurs messages concatènent des erreurs de fichiers, Supabase ou parsing.  
**Observé :** `text` est concaténé directement dans `innerHTML`. Aucun scénario offensif n'a été exécuté.  
**Attendu :** le texte d'erreur est affiché comme texte, jamais interprété comme HTML.  
**Impact :** injection DOM possible si une source contrôlable fournit une chaîne HTML.  
**Preuve :** `assets/app.js` 2215–2221.  
**Correction :** créer le conteneur puis affecter `textContent`, ou appliquer `escapeHtml(text)` ; valider également `kind` avec une liste fermée.  
**Régression :** conserver `aria-live`, délai de disparition et styles.  
**Non-régression :** `<img onerror>`, caractères spéciaux, messages Supabase, noms de fichiers.

### RISK-002 — Clé Anthropic persistée dans le navigateur

**Catégorie :** RISQUE confidentialité · **Sévérité :** S1 · **Priorité :** P1 · **Statut :** Vérifié dans le code · **Confiance :** Haute  
**Pages :** Paramètres, Activité, Objectifs  
**Observé :** la clé est stockée sous `trail:apikey` dans `localStorage` puis envoyée directement en en-tête `x-api-key`. Les scripts tiers exécutés sur la même origine peuvent techniquement lire ce stockage.  
**Attendu :** secret conservé côté serveur ou dans une fonction intermédiaire authentifiée, jamais accessible au JavaScript tiers.  
**Impact :** vol de clé, coût API, accès non autorisé ; les prompts transmettent aussi profil santé et historique lorsque l'utilisateur déclenche l'action.  
**Preuve :** `assets/app.js` 533/583 ; `parametres.html` 306–327 ; `activite.html` 882–964 ; `objectifs.html` 981–1038.  
**Correction :** déplacer l'appel vers une fonction serveur/Supabase Edge Function, limiter quota et journaliser sans contenu sensible ; ajouter information et consentement sur les données transmises.  
**Régression :** parcours sans clé, quotas, erreurs et séparation par utilisateur.  
**Secrets :** aucune valeur réelle n'est reproduite dans ce rapport.

### RISK-003 — Appels Anthropic sans délai d'expiration

**Catégorie :** RISQUE robustesse · **Sévérité :** S2 · **Priorité :** P2 · **Statut :** Vérifié dans le code · **Confiance :** Haute  
**Observé :** les deux appels `fetch` n'utilisent ni `AbortController` ni délai maximal.  
**Impact :** bouton et spinner peuvent rester bloqués longtemps sur réseau suspendu.  
**Correction :** annuler après un délai défini, proposer Réessayer et distinguer clé invalide, quota, timeout et indisponibilité.  
**Non-régression :** succès, HTTP 4xx/5xx, corps inattendu, réponse vide, timeout.

### Points positifs de robustesse

- Migration Supabase : RLS activée, politiques propriétaire sur table et bucket privé.
- FIT tronqué et signature invalide rejetés.
- Les retours IA affichés utilisent `escapeHtml` dans leurs zones dédiées.
- Les fichiers FIT réels ne sont pas envoyés à un tiers pendant l'audit ; toutes les mutations ont été faites sur des origines locales isolées.

## 18. Causes racines

| Cause racine | Constats liés | Correction globale |
|---|---|---|
| Persistance multi-étapes non atomique | BUG-001, BUG-002, BUG-008 | Introduire transactions logiques, verrou de synchronisation et journal d'opérations en attente |
| Identité d'activité dérivée de données arrondies | BUG-003, UX-001 | Empreinte de fichier + identifiant événement stable + politique de doublon |
| Schéma de sauvegarde non versionné et logique dupliquée | BUG-006, BUG-007, BUG-009, TECH-001 | `schemaVersion`, migrations pures, validateur unique, modes fusion/remplacement |
| Gestion des dates par chaînes UTC | BUG-005 et risque sur semaines/objectifs | Service de dates unique séparant instant, fuseau et date civile |
| Validation FIT séparée entre import et inspecteur | BUG-004 | Pipeline commun validation → parsing → résumé → persistance |
| Variables visuelles réutilisées entre surfaces de fonds différents | A11Y-001 | Jetons sémantiques par surface/état et tests de contraste par thème |
| HTML dynamique générique | RISK-001 | API DOM sûre par défaut (`textContent`) et échappement centralisé |
| Secrets et appels IA côté client | RISK-002/003 | Façade serveur authentifiée, quotas, timeout, politique de confidentialité |

## 19. Top 10 des corrections — impact / effort

| Rang | Correction | Impact | Effort | Groupe |
|---:|---|---|---|---|
| 1 | Bloquer la reconstruction distante si un upsert local échoue | Fort | Faible à moyen | Quick Win P0 |
| 2 | Suspendre réellement `scheduleSync` pendant purge + pull | Fort | Moyen | Priorité stratégique P0 |
| 3 | Remplacer l'identifiant arrondi par une identité robuste et gérer les doublons | Fort | Moyen/fort | Priorité stratégique P0 |
| 4 | Unifier import JSON et `applySyncPayload`, ajouter `schemaVersion` | Fort | Moyen | Priorité stratégique P1 |
| 5 | Valider CRC/taille/signature dans le pipeline FIT commun | Fort | Faible | Quick Win P1 |
| 6 | Inverser/transactionnaliser séance puis index | Fort | Faible | Quick Win P1 |
| 7 | Remplacer `showMsg.innerHTML` par une construction DOM sûre | Fort | Faible | Quick Win P1 |
| 8 | Corriger le jeton d'accent du rail mobile clair | Moyen/fort | Faible | Quick Win P1 |
| 9 | Centraliser les dates civiles et prévoir la migration | Fort | Moyen/fort | Priorité stratégique P1 |
| 10 | Déplacer Anthropic derrière une fonction serveur avec timeout | Fort | Fort | Priorité stratégique P1 |

Améliorations secondaires : pagination de l'historique, chargement différé de Supabase, contrôle d'intégrité enrichi. Faible priorité : cache PWA hors-ligne tant que les risques données ne sont pas résolus.

## 20. Roadmap

### Étape 1 — Sécuriser

1. Corriger BUG-001, BUG-002 et BUG-003.
2. Ajouter les tests automatiques de panne Supabase, collision/doublon et purge lente.
3. Corriger RISK-001 avant d'exposer davantage de messages distants.
4. Empêcher tout déploiement si ces tests échouent.

**Critère de sortie :** aucune activité locale ne disparaît de l'index après une panne ; aucune purge ne pousse un blob vide ; aucune collision silencieuse.

### Étape 2 — Stabiliser

1. Corriger BUG-004 à BUG-009 et TECH-001.
2. Versionner le schéma d'export et tester les migrations.
3. Centraliser les dates et comparer les agrégats entre toutes les pages.
4. Corriger A11Y-001.

**Critère de sortie :** export/import fidèle, FIT corrompu refusé, dates cohérentes, contraste AA.

### Étape 3 — Améliorer

1. Façade serveur Anthropic et politique de confidentialité.
2. Timeout/retry et messages d'erreur orientés action.
3. Pagination/chargement progressif de l'historique.
4. Figer/charger à la demande les dépendances.
5. Mesurer CWV et tester Edge/Firefox/WebKit dans une matrice automatisée.

## 21. Tests non réalisés

| Test non réalisé | Motif précis | Niveau restant |
|---|---|---|
| Création de compte, connexion, déconnexion, mot de passe | Aucun compte/tenant de recette fourni ; ne pas muter un compte réel | NON TESTÉ |
| Synchronisation avec deux vrais appareils | Pas de deux sessions authentifiées de recette | NON TESTÉ ; simulation seulement |
| Conflit cloud réel, session expirée, RLS refusée | Pas d'environnement Supabase de recette autorisé | NON TESTÉ ; code/simulation |
| Appel Anthropic : clé invalide, quota, timeout, réponse volumineuse | Ne pas utiliser ni exposer une clé réelle ; pas de mock réseau intégré | NON TESTÉ ; code uniquement |
| Suppression globale et suppression de compte | Action destructive interdite sans confirmation | NON TESTÉ |
| Firefox, Edge, Safari/WebKit | Moteurs non disponibles/attachés ; Windows pour Safari | NON TESTÉ |
| Lecteur d'écran réel | NVDA/VoiceOver non piloté dans cette campagne | NON TESTÉ |
| Zoom 200 % et appareil tactile physique | Outils actuels insuffisants pour une preuve fiable | NON TESTÉ |
| FIT sans FC/altitude/GPS, extrêmes et très longue activité | Jeux de référence correspondants non fournis | NON TESTÉ |
| Carte et tuiles OSM avec données GPS réelles | Ne pas transmettre de traces précises sans nécessité ; réseau cartographique non indispensable aux blocants | NON TESTÉ |
| LCP, INP, CLS, FCP, TTFB, requêtes et poids transféré | Instrumentation Web Performance/Lighthouse non disponible de façon fiable | Non mesuré |
| Grand écran > 1440 px | Harnais exécuté jusqu'à 1440 px | NON TESTÉ |
| Mode hors-ligne complet | Aucun service worker ; résultat attendu non disponible | VÉRIFIÉ DANS LE CODE, pas simulé |

## 22. Tests de régression recommandés

### Suite P0 obligatoire

1. **Sync — upsert échoué :** l'index et la séance locale restent visibles, `ok:false`, message actionnable.
2. **Sync — remote partiel :** fusion sans suppression des éléments locaux non confirmés.
3. **Cache lent :** purge, pull > 2 s, aucun push sortant avant fin.
4. **Cache en erreur :** pull échoue, données cloud inchangées, possibilité de réessayer.
5. **FIT doublon exact :** aucune nouvelle séance ; message explicite.
6. **FIT collision :** deux séances même jour/sport/distance restent distinctes.
7. **Migration identifiants :** activités existantes et lignes Supabase restent reliées.

### Suite P1

8. CRC valide/invalide/absent, signature, taille, troncature.
9. Import FIT avec quota sur écriture séance puis index ; aucun objet/index orphelin.
10. Export → nouvelle origine → import → export : JSON canonique équivalent.
11. Courses absentes vs présentes vides ; notes/année ; exports anciens.
12. Réinitialisation : liste exhaustive des clés, message conforme, récupération cloud.
13. Dates autour de minuit dans UTC+4, UTC, UTC-10 ; limites semaine/mois/année.
14. Agrégats identiques Activité → Dashboard → Analyse → Objectifs → Plan → Profil → Équipements.
15. Contraste rail mobile clair/sombre, focus et hover à 320/375/390 px.
16. `showMsg` avec HTML, nom de fichier spécial et message Supabase.

### Suite d'amélioration

17. API Anthropic : absence de clé, 401, 429, 500, timeout, réponse vide/invalide, retry.
18. Auth/Supabase sur environnement de recette : compte, session expirée, RLS, deux appareils.
19. Matrice Chromium/Edge/Firefox/WebKit.
20. Volumétrie 50/200/500/1 000 activités sur mobile modeste avec mémoire et temps de filtrage.
21. Audit lecteur d'écran et clavier complet.
22. Lighthouse/CWV sur la version publique avec cache froid/chaud et réseau mobile simulé.

## 23. Verdict final

**Est-ce que je recommande aujourd'hui de mettre cette version en production ? Non.**

Je recommande de conserver la version comme environnement de démonstration ou de test, puis de bloquer toute nouvelle promotion tant que BUG-001, BUG-002 et BUG-003 ne sont pas corrigés. Ces défauts touchent l'intégrité perçue ou réelle des activités et des sauvegardes cloud ; ils répondent au critère NO-GO même si le reste du produit est utilisable.

Une fois ces P0 corrigés et la suite de non-régression verte, le produit pourra raisonnablement passer à un **GO conditionnel**, à condition de traiter ensuite l'aller-retour JSON, le contrôle CRC, les dates, l'injection DOM et le contraste mobile clair. L'interface et la structure responsive constituent une base suffisamment saine pour une correction ciblée : il n'est pas nécessaire de recommencer le produit ni de changer son architecture front-end.

---

## Annexes — preuves et artefacts

- `audit-qa/qa_tests.mjs` : scénarios instrumentés FIT, CSV, stockage, sync et sécurité.
- `audit-qa/browser_runner.html` : exécution du harnais `_audit.html` à largeur et thème contrôlés.
- `audit-qa/fixtures/` : fichiers invalides et restauration de test, sans donnée réelle.
- `audit-qa/captures/accueil-desktop-1440x900.png` : capture de la version locale testée.
- Aucun fichier de production HTML/CSS/JS n'a été modifié pendant cette campagne.
