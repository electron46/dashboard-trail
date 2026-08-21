# Reprise — ce qu'il reste à faire après le plan d'action UX/UI

> Document de passation, rédigé le 2026-08-21 à la fin du plan d'action en 9 sprints.
> **Destiné à une nouvelle session de travail** qui n'aura pas l'historique de la précédente.
> Tout ce qui suit a été **mesuré**, pas supposé. Les chiffres sont reproductibles.

---

## 1. Où en est le projet

`main` est à jour, **toutes les branches du plan sont fusionnées** (PR #27 à #40).

Le plan d'action `ELEV_plan_action_UX_UI.md` (fourni par l'utilisateur, dans ses Téléchargements) a été mené :
sprints 1 à 9, plus les phases transverses 11, 12, 14 et 17. Chaque passe est documentée en
**section 14 de `CLAUDE.md`**, avec son commit, le défaut trouvé et sa mesure.

**Lire `CLAUDE.md` en entier avant de toucher au code.** Il porte les décisions produit, les
conventions, et surtout les pièges déjà rencontrés. Ce document-ci ne le remplace pas : il liste
seulement ce qui reste.

### L'enseignement principal de ces neuf sprints

Les défauts les plus lourds **ne figuraient dans aucune liste du plan**. Ils ont été trouvés en
chargeant les pages et en mesurant le DOM :

- une boucle de rechargement infinie sur le détail de séance ;
- trois systèmes de couleurs concurrents pour les mêmes zones de fréquence cardiaque ;
- un palier responsive qui mesurait le viewport au lieu du conteneur (colonnes de texte à 2-4px) ;
- toutes les icônes chargées depuis un CDN, donc absentes hors ligne alors qu'ELEV est une PWA ;
- un indice de préparation à 0 % sur un compte vierge, présentant une absence comme un échec.

À l'inverse, deux items du plan visaient des problèmes **déjà résolus ou inexistants** (le CLS
était déjà à 0). **Mesurer avant de corriger rapporte plus que dérouler une liste.**

---

## 2. Méthode de travail (à remettre en place en premier)

Sans cet outillage, on retombe dans le raisonnement à l'aveugle. Compter ~10 minutes.

### 2.1 Serveur de prévisualisation

`.claude/launch.json` existe déjà (non versionné) et pointe sur un script Python dans le
scratchpad de la session précédente — **il faudra le recréer**. Le `python -m http.server` par
défaut ne convient pas : mono-thread et HTTP/1.0, il lâche des connexions sous les rafales d'un
audit. Un `app.js` reçu tronqué produit alors des pages vides et des `ReferenceError` en cascade
que l'on prend pour de vrais bugs.

Il faut un serveur **multi-thread, HTTP/1.1, qui envoie chaque fichier en un seul `write`**.

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "elev-static", "runtimeExecutable": "python",
      "runtimeArgs": ["<chemin>/serve.py", "<racine du projet>"], "port": 8899 }
  ]
}
```

> Attention : sur cette machine `python3` n'existe pas, seul `python` est disponible.

### 2.2 Jeu de données de test

Les fixtures **ne sont pas versionnées** (fichiers de travail, supprimés à chaque fin de passe).
Il faut les recréer : un générateur qui écrit dans `localStorage` ~56 séances sur 15 semaines
(avec `series`, `laps`, GPS), un profil avec FC max/repos, 4 équipements, le plan
`plan-trail-nico.csv` du dépôt, et un profil GPX sur la course principale.

Formes exactes à respecter : `summarizeFit()` pour une séance, `parsePlanCsv()` pour le plan,
`getGear()` pour les équipements. **Ne pas inventer de valeurs de champ** — une passe précédente a
perdu du temps sur un `manualStatus:'ok'` inexistant (les valeurs sont `bon`/`surveiller`/
`remplacer`/`archive`).

### 2.3 Harnais de mesure

Charger chaque page dans une `<iframe>` de même origine (donc même `localStorage`), à plusieurs
largeurs, et relever : débordement horizontal, erreurs JavaScript, images cassées, présence du
`<h1>`, conteneurs restés vides. C'est ce harnais qui a trouvé la majorité des défauts.

Largeurs de référence : **360, 375, 430, 768, 900, 1024, 1099, 1280, 1440**.
États de données : **normal, vide, partiel (2 séances, aucun plan), gros volume (~280 séances)**.

---

## 3. Ce qui reste à faire, par priorité

### 3.1 — Phase 16 : accessibilité (le plus rentable)

C'est borné, mesurable, et ça touche l'usage réel. **Recommandé en premier.**

**a) Hiérarchie des titres — sauts de niveau mesurés :**

| Page | Saut | Élément |
|---|---|---|
| `analyse.html` | h1 → h4 | « Volume en progression » (Insight ELEV) |
| `objectifs.html` | h2 → h4 | « Priorité » (Insight) |
| `objectifs.html` | h2 → h4 | « Développer le dénivelé » (recommandations) |
| `plan.html` | h2 → h4 | « Séances » |

Les `<h4>` viennent des cartes d'Insight (`.insight-item h4`) et des `.coach-card h4`. Un lecteur
d'écran qui navigue par titres perd un niveau. À traiter dans les générateurs partagés
(`assets/app.js`) plutôt que page par page.

**b) Navigation clavier de bout en bout : jamais testée.** À vérifier concrètement — parcourir
chaque page à la touche Tab, contrôler que l'ordre est logique, que tout élément interactif est
atteignable et que le focus est visible. Les modales ont déjà un piège de focus fonctionnel
(vérifié). Les points à risque : les onglets, la palette de commandes (Ctrl/Cmd+K), la barre de
navigation mobile et son panneau « Plus », les `<details>`.

**c) Contrastes : un audit a été fait le 2026-08-21 et a trouvé 3 échecs, tous corrigés.** Mais il
ne couvrait que les nœuds texte directs de `<main>` sur 6 pages, en thème sombre. **Restent à
auditer : le thème clair (jamais audité page par page), les badges, les états de survol et de
focus, et les SVG.**

### 3.2 — Phase 15 : cohérence interactionnelle

Une seule règle a été posée (les liens de contenu, le 2026-08-21). Le reste n'a jamais fait
l'objet d'une passe : **hover / focus / active / disabled** sur boutons primaire, secondaire et
destructif, lignes de tableau, cartes interactives, onglets, puces de filtre.

Méthode : inventorier ce qui existe dans `assets/style.css`, repérer les incohérences (un même
rôle traité différemment selon le composant), poser une règle unique. Le projet a déjà les tokens
de motion (`--dur-*`, `--ease-*`).

### 3.3 — Phase 1.1 : échelle typographique par rôle

Le plan demande une échelle **nommée par rôle** : Display, H1, H2, H3, Body, Body Small, Label,
Caption, Metric XL / L / M. Ce qui existe est une échelle en **tailles** (`--text-2xs` à
`--text-3xl`), utilisée **8 fois seulement**, toutes issues de la typographie des graphiques.

Les tailles réelles sont écrites en dur partout ailleurs. Le travail consiste à **relever les
rôles réellement utilisés dans le produit** (mesurer, ne pas décréter), puis à les nommer et à les
appliquer progressivement.

### 3.4 — Phase 1.1 : échelle d'espacement

`--space-1` à `--space-16` sont définies et **utilisées 0 fois**, face à **108 styles inline de
marges** dans le HTML. La migration annoncée « progressive » depuis août n'a jamais commencé.

Sans effet visuel, mais c'est ce qui fait qu'un espacement se règle encore au cas par cas.
**Migrer par composant, jamais en un remplacement massif** : un `sed` global déplacerait la mise
en page partout à la fois, sans filet.

Il reste par ailleurs **9 valeurs hexadécimales en dur** hors du bloc de tokens.

### 3.5 — Phase 1.2 : documentation des composants

Le plan demande que chaque composant porte ses variantes, ses états interactifs, son comportement
responsive et ses règles d'accessibilité. **Aucune documentation de ce type n'existe.**

Le dossier `design-system/` est versionné mais décrit partiellement un autre produit (voir
`design-system/readme.md`, qui liste les 8 divergences tranchées). 16 fiches spécimen restent à
réécrire dans le vocabulaire réel du produit.

### 3.6 — Reste de la phase 7 (Activités)

Le plan demande de regrouper **recherche, période, type, filtres ET import** dans une barre
unique. Tout y est sauf le bouton d'import, resté dans la topbar.

### 3.7 — Phase 0 : captures de référence

Jamais produites de façon systématique. Utile avant toute nouvelle passe visuelle, pour détecter
une régression silencieuse.

---

## 4. Chantiers techniques ouverts (hors plan UX/UI)

Ils sont détaillés en **section 15 de `CLAUDE.md`**. Les plus structurants :

- **Deux écrivains concurrents pour les séances.** `autoPullIfNewer()` (blob `trail_data`) et
  `syncActivitiesWithSupabase()` (table `activities`) s'exécutent au même chargement de page, sans
  se coordonner — le dernier arrivé gagne. Une fusion non destructive limite les dégâts, mais
  l'ambiguïté d'architecture demeure. **La trancher est un vrai choix produit.**
- **Limite de stockage local.** Mesuré : **280 séances ≈ 12 Mo**, pour un quota navigateur de
  5 à 10 Mo. La limite est atteinte **vers 120-200 séances**, soit deux à trois saisons. L'échec
  est désormais expliqué à l'utilisateur, mais la limite reste.
- **Bucket `fit-files` en écriture seule** : les `.fit` y sont envoyés, aucun code ne les relit.
- **Le `.gpx` d'un objectif n'est jamais conservé**, seul le profil simplifié l'est.
- **`deleteSession` ne nettoie ni la ligne `activities` ni le Storage** — à traiter **avant**
  d'ajouter une suppression unitaire dans l'interface.
- **SDK Supabase (212 ko) bloquant sur chaque page.** Le passer en `defer` exige de différer aussi
  `assets/authgate.js` ; un écart d'ordre désactiverait silencieusement la synchronisation.
- **Liste d'activités sans pagination** : 280 séances rendent 280 lignes, ~2 s de chargement.

---

## 5. Pièges déjà rencontrés — à ne pas refaire

1. **Migrer le rail de navigation vers `--text`/`--muted` casserait le thème clair.** La sidebar et
   la barre mobile restent volontairement sombres dans les deux thèmes : elles ont leurs propres
   tokens `--rail-*`.
2. **Ne jamais lire un style calculé dans le même tick qu'un changement de classe**, ni pendant une
   transition CSS (160 ms ici). Deux faux positifs ont été créés ainsi, dont un a failli faire
   « corriger » du CSS parfaitement correct. Attendre ~300 ms.
3. **Un `MutationObserver` est asynchrone** : le focus des modales paraît cassé si on le mesure
   immédiatement. Il fonctionne.
4. **Le serveur de test tronque les fichiers sous charge.** Avant de conclure à un bug, vérifier
   que `app.js` et `style.css` sont **réellement parsés en entier**.
5. **`--muted-2` est réservé au décoratif.** Les libellés à lire prennent `--muted`. Cette règle,
   pourtant documentée, a été violée deux fois par les composants ajoutés en août.
6. **Échappement des apostrophes dans les scripts Python/perl** : trois erreurs de syntaxe
   introduites ainsi. Pour tout texte français contenant une apostrophe, **utiliser l'édition
   directe de fichier**, pas un script.
7. **Ne jamais fabriquer une valeur pour combler une absence.** Un sous-score qui retourne `0` au
   lieu de `null` a fait tomber tout l'indice de préparation à 0 % sur un compte vierge. Même
   principe pour un ratio absurde : le **nommer**, ne pas le plafonner.

---

## 6. Ce qui n'a jamais été vérifié

À dire à l'utilisateur plutôt qu'à laisser croire acquis :

- **Rien n'a été vu sur des données réelles.** Tout le plan a porté sur un jeu de test fictif.
- **Rien n'a été testé sur un téléphone physique**, seulement en navigateur redimensionné.
- **Aucun jugement esthétique** n'a été porté : les vérifications sont structurelles (mesures DOM,
  contrastes calculés, absence de débordement, quatre états de données).
- **Aucun outil de contrôle automatisé n'existe dans ce projet** : ni lint, ni TypeScript, ni
  tests, ni build, pas de `package.json`. Les seules vérifications possibles sont `node --check`
  sur `assets/app.js` et la mesure en navigateur.

---

## 7. Ordre recommandé

1. Remettre en place serveur + fixtures + harnais (§2).
2. **Phase 16 — accessibilité** (§3.1) : borné, mesurable, effet réel.
3. **Phase 15 — cohérence interactionnelle** (§3.2).
4. Trancher les **deux écrivains concurrents** (§4) — décision produit à demander à l'utilisateur.
5. Migration progressive des échelles (§3.3, §3.4), composant par composant.

Et à faire valider par l'utilisateur, indépendamment : **ouvrir le dashboard sur son téléphone
avec ses vraies séances.** C'est le seul test qui manque vraiment.
