# ELEV — Design System

Marque personnelle de suivi running / trail. Usage strictement personnel : le premier destinataire de l'identité, c'est son créateur, dans ses propres outils (dashboard de suivi). Personnalité : sobre et technique. Promesse : *"Une pratique suivie, mesurée, sans esbroufe."*

**Sources fournies** (dans `uploads/`, conservées telles que reçues) :
- `identite-de-marque_2.md` — document stratégique de marque (mission, valeurs, ton, palette, typo, concept de logo).
- `charte-graphique.html` — charte graphique interactive (mêmes tokens, avec vue Designer / Développeur / Rédacteur / Vue complète). Retirée du dépôt (n'était reliée à aucune page du site) ; les mêmes tokens restent disponibles dans ce dossier `design-system/`.
- `dashboard-trail.html` — dashboard fonctionnel de suivi (import `.fit`, plan CSV, historique, graphiques, retour IA) : **référence fonctionnelle uniquement**, non restylé — il garde ses propres couleurs et composants. `ui_kits/dashboard/` en est une recréation visuelle sous l'identité ELEV.
- Deux visuels générés (`ChatGPT Image…png`) : un logo au nom "RIDGELINE" et une infographie de charte au nom générique "[NOM]". Le nom de marque retenu est **ELEV** (confirmé par l'utilisateur) — ces deux images ne correspondent pas au nom final et n'ont pas été utilisées.

Décisions actées par l'utilisateur (le document stratégique laissait ces points ouverts) :
- **Nom** : ELEV.
- **Couleur d'accent** : un vert de marque unique (`#6B8E4E`), utilisé avec parcimonie (statut positif, action principale, sélection) — pas la palette "zéro accent" envisagée initialement. Décision confirmée après usage réel sur le dashboard.
- **Mobile** : dans le périmètre. Le dashboard réel (`assets/`, à la racine du dépôt) est une application multi-pages responsive, sombre par défaut, avec sidebar desktop et barre de navigation basse sur mobile.

> ⚠️ **Statut — à lire avant d'utiliser ce dossier** (mis à jour le 2026-08-21)
>
> Ce dossier contient **deux choses contradictoires**, et une seule fait foi.
>
> | | Contenu | Statut |
> |---|---|---|
> | **`../composants.html`** | les **composants réels**, rendus depuis `assets/style.css` | ✅ **fait foi** |
> | **`readme.md`** (ce fichier) | l'identité **telle qu'appliquée** dans `assets/style.css` | ✅ **fait foi** |
> | `tokens/*.css`, `guidelines/*.html`, `components/`, `SKILL.md`, `uploads/` | la **proposition initiale** de charte | ❌ jamais implémentée |
>
> **La documentation des composants vit désormais dans `composants.html`** (accessible depuis
> Paramètres → À propos), ajoutée le 2026-08-22. C'est une page **vivante** : elle charge la vraie
> feuille de style, rend les vrais composants et extrait leurs règles à l'exécution — elle ne peut
> donc pas dériver, contrairement à une description écrite à la main. Elle a été créée là plutôt
> qu'ici parce que `components/` de ce dossier décrit des composants **React**, que ce projet
> n'utilise pas : y écrire la documentation réelle aurait ajouté un troisième récit contradictoire.
>
> L'écart n'est pas une dérive de maintenance : la proposition décrit **un autre produit**. Thème
> clair (page `#F2F1EE`, cartes blanches), **aucune couleur d'accent** (décision explicite : « no
> vivid accent color », l'emphase passe par la police), IBM Plex Sans + IBM Plex Mono, neutres
> chauds. Le produit réel est sombre, vert `#6B8E4E`, en Raleway + Inter, neutres froids.
> Quasiment rien ne se recouvre.
>
> **Danger concret** : `SKILL.md` est un skill installable (`user-invocable: true`). Il n'est pas
> actif tant qu'il reste ici, mais s'il était copié dans `.claude/skills/`, il demanderait de
> concevoir en anthracite, sans accent et en IBM Plex — donc **contre** le produit réel, à chaque
> invocation. Ne pas l'installer sans l'avoir réécrit.
>
> **Décision en attente** : réconcilier les deux, point par point (voir « Divergences ouvertes »
> en fin de fichier). Tant que ce n'est pas tranché, ne régénérez pas `tokens/*.css` depuis le
> code, et ne recodez pas le site depuis `tokens/*.css`.

## Contenu fondamental (ton, voix)

- **Personnalité** : sobre, technique, constante.
- **Règle d'or** : tout contenu s'appuie sur au moins une donnée factuelle (distance, temps, allure, D+, date). Pas de storytelling sans chiffre à l'appui.
- **On dit** / **on ne dit pas** : "Séance du 12/05 : 12 km, allure 5'10/km" / pas "Séance de folie aujourd'hui !". "Semaine 6/12 du plan, charge en hausse" / pas "Je m'entraîne dur en ce moment".
- **Personne** : le document s'adresse à l'utilisateur lui-même (usage perso) — pas de "vous" marketing, registre neutre et factuel plutôt que conversationnel.
- **Casse** : titres en Title Case sobre ou tout capitales pour les eyebrows/labels mono (ex. "OBJECTIF PRINCIPAL"), jamais de emphase par la ponctuation (pas de "!").
- **Emoji** : aucun dans l'UI ou les rapports. Le fichier `dashboard-trail.html` fourni utilise 🏔️ dans son titre, mais ce n'est pas repris dans la charte — à éviter dans les nouveaux écrans.

## Fondations visuelles

*(section mise à jour pour refléter `assets/style.css` — voir encart de statut ci-dessus)*

- **Couleurs** : thème sombre par défaut ("Mountain Performance Intelligence" — c'est la surface réelle du produit). Fond `#0C0F0E`, surface `#181D1B`, surface relevée `#202622`, surface élevée `#242B27`, bordure `#29312D`, texte principal `#F0F3F0`, texte secondaire `#A9B1AC`, texte discret `#8B958E` (valeurs revues le 2026-08-21 : le canvas et les surfaces ont été neutralisés — ils tiraient au vert — et les surfaces éclaircies pour que les cartes se détachent réellement du fond). Accent de marque : vert `#6B8E4E` (survol `#7FA05E`), utilisé rarement — statut positif, action principale (bouton "Importer"), sélection active, liseré des cartes Insight. Feedback système : succès `#7FB86B`, alerte `#D9B85B`, erreur `#E2836C`, chacun avec une variante "soft" en fond translucide (badges, bannières) — jamais comme accent de marque. Un thème clair existe (bascule utilisateur, utile en plein soleil) mais le sombre est la référence.
- **Typographie** : deux familles, différentes de la proposition initiale. **Raleway** (600–800) pour les titres (h1, titres de section, valeurs de cartes "riches"). **Inter** pour le texte courant, les labels et — contrairement à la charte d'origine — **aussi les valeurs chiffrées** : pas de police monospace dédiée sur ce projet ; la lisibilité des nombres est assurée par `font-variant-numeric: tabular-nums` plutôt que par un changement de police. ⚠️ **Point rouvert le 2026-08-21** : `tabular-nums` est appliqué y compris aux grandes valeurs (chiffre héros, `.kpi-value`), ce qui est un usage fautif — les chiffres à chasse fixe servent à aligner des colonnes, pas à composer un nombre isolé au-dessus de ~1,5 rem, où ils créent des vides. Le rôle « police dédiée aux données » que la charte confiait à IBM Plex Mono reste donc à trancher (voir « Divergences ouvertes »).

Raleway n'est chargé qu'en **700 et 800** depuis le 2026-08-21 (audit : aucune règle n'utilisait 500 ni 600). Les polices sont déclarées par `<link rel=preconnect>` + `<link rel=stylesheet>` dans le `<head>` de chaque page, plus par `@import` dans le CSS, qui imposait un chargement en série.
- **Logo** : plus aucune page n'affiche `assets/logo-full.png` — depuis l'harmonisation des sidebars, toutes utilisent une icône montagne + le mot « ELEV » en texte. Le PNG n'est conservé que comme référence historique.
- **Imagery** : aucune image de contenu à ce stade (dashboard de données uniquement) ; carte GPS Leaflet/OpenStreetMap pour le tracé des séances.
- **Fonds** : plats, par paliers de contraste (fond → surface → surface relevée). Pas de dégradé décoratif, hors dégradé de remplissage très doux sous les courbes de graphique (`--chart-fill-top/bottom`).
- **Bordures & cartes** : cartes sur fond `--panel` (ou `--panel-raised` pour les KPI, légèrement plus clair), bordure fine 1px `--border`, coin arrondi 12px (cartes), ombre à peine perceptible. Exception documentée à la règle "jamais de bordure colorée sur le côté" : les cartes **Insight ELEV** portent un liseré gauche de 3px (vert, ou ambre si la charge monte vite) — traitement volontairement distinct pour signaler une interprétation plutôt qu'une simple métrique.
- **Rayons** : sm 6px (inputs/petits éléments), md 8px (boutons, tuiles), lg 12px (cartes), pill (badges, tags, tabs, KPI/segmented control).
- **Animation** : minimale et fonctionnelle — transitions d'état (hover, toggle) en 120–200ms, ease standard. Respect de `prefers-reduced-motion`. Pas de rebond, pas de fade cinématique.
- **Hover / press** : hover = bordure/fond légèrement plus clair, ou légère élévation (`translateY` + ombre douce) pour les cartes cliquables (ex. carte "Dernière activité"). Pas d'effet de press (scale).
- **Transparence / flou** : overlay de fenêtre modale (noir ~40% d'opacité, sans flou) ; badges/bannières en couleur translucide (`rgba`) plutôt qu'en teinte opaque pleine.
- **Iconographie** : voir section dédiée ci-dessous.

## Logo

Tentative de logo en SVG (`assets/logo-mark.svg`, `assets/logo-full.svg`, `assets/logo-mono.svg`), inspirée de la référence fournie (montagne + trace GPS) mais dessinée pour ELEV — ce n'est **pas** une illustration professionnelle, juste des formes géométriques simples (triangle de montagne, courbes de niveau, trace GPS orange). Le dashboard réel utilise `assets/logo-full.png` dans la sidebar, pas ces SVG. Le trait GPS orange (`#FF6B35`) de ces esquisses n'a pas été repris dans l'UI, qui utilise le vert de marque `#6B8E4E` comme accent (voir "Décisions actées" plus haut).

## Iconographie

Aucun set d'icônes n'a été fourni dans les sources. La charte recommande explicitement des icônes **line-art fines** (elle cite Lucide et Feather), jamais de style plein/glossy. Recommandation retenue : **Lucide** via CDN (`https://unpkg.com/lucide@latest`) comme substitution — à documenter comme tel si utilisé, car ce n'est pas un asset propre à la marque. Aucun usage d'emoji comme icône dans l'UI (règle enfreinte jusqu'au 2026-08-21 : le `<h1>` de l'Accueil affichait « Bonjour 👋 » ; retiré). Les composants (`IconButton`, boutons avec `icon`) acceptent n'importe quel ReactNode en slot d'icône plutôt que d'imposer un set, pour rester compatible avec Lucide ou un futur système propre à la marque.

## Index

- `styles.css` — point d'entrée global (imports uniquement).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css` (rayons, ombres, durées).
- `guidelines/` — 14 fiches spécimen (Colors, Type, Spacing, Brand) visibles dans l'onglet Design System.
- `components/` — primitives React groupées par usage :
  - `core/` — Button, IconButton, Card, Badge, Tag
  - `forms/` — Input, Select, Switch, Checkbox
  - `data/` — MetricCard, DataValue, Table
  - `feedback/` — Banner, Dialog, EmptyState
  - `navigation/` — Tabs
- `ui_kits/dashboard/` — recréation stylée du dashboard de suivi (échéances, import, progression, historique, détail de séance) — `index.html` interactif, `data.jsx` données de démo.
- `uploads/` — sources originales fournies par l'utilisateur (voir "Sources fournies" ci-dessus).
- `SKILL.md` — version portable de ce design system pour Claude Code.

### Intentional additions

Aucune source ne définissait d'inventaire de composants figé (pas de codebase ni de Figma attaché) : l'ensemble ci-dessus a été dimensionné aux besoins d'un dashboard de suivi personnel (import de fichiers, filtres, tableaux de séances, détail, retour IA), pas un set générique complet.

## Divergences ouvertes

Écarts réels entre la proposition (`tokens/`, `guidelines/`, `SKILL.md`) et le produit
(`assets/style.css`). Chacun demande une décision : adopter la charte, entériner le code, ou
choisir une troisième voie. Tant qu'une ligne n'est pas tranchée, **c'est la colonne « Produit »
qui s'applique**.

| # | Sujet | Charte | Produit | Décision (2026-08-21) |
|---|---|---|---|---|
| 1 | Thème | clair (`#F2F1EE`) | sombre (`#0C0F0E`) | ✅ **le produit** — porte l'identité |
| 2 | Accent | aucun, volontairement | vert `#6B8E4E` | ✅ **le produit** — déjà acté plus haut |
| 3 | Titres | IBM Plex Sans 700 | Raleway 700/800 | ✅ **le produit** — Raleway conservé |
| 4 | Texte | IBM Plex Sans | Inter | ✅ **le produit** — Inter conservé |
| 5 | Chiffres | **IBM Plex Mono** | Inter + `tabular-nums` | ✅ **la charte** — Plex Mono adopté |
| 6 | Neutres | chauds (`#DCD9D2`) | froids (`#29312D`) | ✅ **le produit** — cohérent avec 1 et 2 |
| 7 | Échelle typo | `--text-xs` → `--text-3xl` | valeurs en `rem`, sans échelle | ✅ **la charte** — échelle nommée ajoutée |
| 8 | Échelle d'espacement | `--space-1` → `--space-16` | valeurs en dur | ✅ **la charte** — échelle nommée ajoutée |

**Les 8 lignes sont tranchées.** ELEV garde donc son thème sombre, son vert et ses deux familles
de titre/texte, et récupère de la charte la police dédiée aux données ainsi que les deux échelles
nommées qui lui manquaient. C'est un partage : ni la charte ni le code n'a gagné en bloc.

Conséquence de la décision 5, appliquée le 2026-08-21 : `--font-mono` pointait sur `--font-sans`,
donc n'existait pas. Il pointe désormais sur IBM Plex Mono (graisses 500 et 600 chargées ; la
famille plafonne à 700, ne pas lui demander 800, le navigateur synthétiserait la graisse). Elle
est appliquée aux valeurs chiffrées de l'Accueil : score de préparation, métriques d'objectif,
statistiques de la semaine, valeurs de cartes KPI, KPI de la dernière sortie. Les intitulés
restent en Inter, les titres en Raleway. Une mono étant tabulaire par construction,
`font-variant-numeric` devient sans objet sur ces éléments et a été retiré.

Reste à faire pour clore ce chantier :

Une fois ces lignes tranchées : mettre à jour `tokens/*.css`, `guidelines/*.html` et `SKILL.md`
pour qu'ils décrivent le produit, puis synchroniser vers claude.ai/design avec `DesignSync`
(le dossier porte déjà `_ds_manifest.json` et les marqueurs `@dsCard` nécessaires).
