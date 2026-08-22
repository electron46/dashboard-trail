# Fonctions serveur ELEV — déploiement

## Pourquoi

Jusqu'au 22 août 2026, les deux fonctions IA d'ELEV (retour Coach ELEV sur une séance, estimation
de temps de course) appelaient l'API Anthropic **directement depuis le navigateur**, avec ta clé
secrète conservée en clair dans le stockage du navigateur (`trail:apikey`).

Concrètement, n'importe quel script s'exécutant sur la même page — une extension de navigateur, une
bibliothèque chargée depuis un CDN qui serait compromise — pouvait lire cette clé. Elle partait
aussi dans l'export JSON de tes données.

Elle est maintenant détenue par une **fonction serveur** hébergée dans ton propre projet Supabase.
Le navigateur ne la voit jamais : il envoie sa demande à cette fonction, authentifié par ton compte,
et reçoit uniquement le texte de la réponse.

**Conséquence à connaître :** les deux fonctions IA exigent désormais un projet Supabase configuré,
un compte connecté, et cette fonction déployée. **Tout le reste d'ELEV continue de fonctionner sans
compte**, exactement comme avant : import des séances, plan, objectifs, analyses, export.

Si la fonction n'est pas déployée, l'interface le dit explicitement (page Paramètres →
Connectivité, et sur les deux boutons IA) au lieu d'échouer en cours d'appel.

---

## Ce dont tu as besoin

- Le projet Supabase que tu utilises déjà pour la synchronisation ELEV.
- La **CLI Supabase** installée sur ta machine : <https://supabase.com/docs/guides/cli>
- Ta clé API Anthropic (elle ne sera saisie qu'ici, jamais dans le site).

## Étapes

Toutes les commandes se lancent **depuis le dossier du projet** (celui qui contient `index.html`).
Si ton chemin contient des espaces, mets-le entre guillemets :

```bash
cd "C:\Users\...\Dashboard Trail html"
```

> **Le piège, rencontré pour de bon le 2026-08-22.** La CLI trouve la racine du projet en cherchant
> `supabase/config.toml`, et **se rabat silencieusement sur ton dossier personnel** si elle ne le
> trouve pas. L'erreur affichée est alors `entrypoint path does not exist (/Users/toi/supabase/…)`,
> qui laisse croire à un problème de chemin de fichier. Ce `config.toml` est désormais versionné dans
> le dépôt : un clone fonctionne directement, et `supabase link` n'est pas nécessaire.

**1. Se connecter à ton compte Supabase**

```bash
supabase login
```

Ouvre ton navigateur pour valider. À faire une seule fois par machine.

**2. Déposer la clé Anthropic comme secret du projet**

`TA_REFERENCE` est la chaîne visible dans l'URL de ton tableau de bord Supabase
(`https://supabase.com/dashboard/project/XXXXXXXX` → `XXXXXXXX`). Tu la retrouves aussi dans ELEV,
page **Paramètres → Synchronisation**, dans l'URL `https://XXXXXXXX.supabase.co`.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-ta-cle-ici --project-ref TA_REFERENCE
```

C'est le seul endroit où la clé existe. Elle n'est ni dans le dépôt Git, ni dans le site, ni dans
tes exports. Tu peux la retirer à tout moment avec `supabase secrets unset ANTHROPIC_API_KEY`.

**3. Déployer la fonction**

```bash
supabase functions deploy ai-proxy --project-ref TA_REFERENCE
```

**4. Vérifier depuis ELEV**

Page **Paramètres → Connectivité**, bouton **« Tester les fonctions IA »**. Il fait un appel réel
minimal (quelques jetons) et rend un verdict sur toute la chaîne : fonction joignable, compte
authentifié, clé valide. En cas d'échec, le motif technique est affiché entre crochets et renvoie
directement au tableau ci-dessous.

La ligne « Fonctions IA » qui indique *Prête* ne dit, elle, qu'une chose : que Supabase est
configuré sur cet appareil. Elle ne prouve ni le déploiement ni la validité de la clé — c'est
précisément pour ça que le bouton de test existe.

---

## Diagnostiquer un problème

| Ce que dit ELEV | Cause | Que faire |
|---|---|---|
| « configure la synchronisation dans Paramètres » | Aucun projet Supabase enregistré sur cet appareil | Renseigner l'URL et la clé anon dans Paramètres |
| « Connecte-toi à ton compte ELEV » | Pas de session ouverte | Page Connexion |
| « la fonction `ai-proxy` n'est pas déployée » (HTTP 404) | Étape 3 non faite, ou faite sur un autre projet | Refaire `supabase functions deploy ai-proxy` |
| « Clé Anthropic non configurée sur le projet » (HTTP 503) | Étape 2 non faite | Refaire `supabase secrets set …` |
| « Session expirée ou accès refusé » (HTTP 401) | Jeton expiré | Se reconnecter |
| « Quota atteint » (HTTP 429) | Limite de l'API Anthropic | Réessayer plus tard |
| « Pas de réponse après 60 s » | Réseau, ou appel très long | Réessayer ; l'appel est bien interrompu, rien ne reste bloqué |

Les journaux de la fonction (tableau de bord Supabase → Edge Functions → `ai-proxy` → Logs)
n'enregistrent **jamais** le contenu des demandes : ces prompts contiennent des données de santé et
d'entraînement. Seuls le type d'usage, l'identifiant du compte et le code d'erreur y figurent.

---

## Limites connues

- **Aucun quota par utilisateur.** La fonction ne compte pas les appels : cela demanderait une table
  de comptage et une politique de facturation qui n'existent pas dans ce projet personnel. Tant que
  le projet Supabase n'a qu'un seul compte, le risque se limite à ta propre consommation.
- La fonction relaie un seul modèle (`claude-sonnet-5`) et trois usages. Ajouter un usage demande de
  l'inscrire dans la table `TASKS` d'`index.ts` — c'est volontaire : sans cette liste fermée, la
  fonction serait un accès Anthropic générique ouvert à tout compte du projet.

## État de vérification

Déployée sur le projet **ELEV** le 2026-08-22 (version 2, `verify_jwt` actif) et **validée en
conditions réelles** : un appel IA aboutit depuis le produit.

| Contrôle | Comment | Résultat |
|---|---|---|
| Fonction déployée | `supabase functions list` | `ACTIVE`, `verify_jwt: true` |
| Appel anonyme refusé | POST sans en-tête d'autorisation | **401** (et non 404 : elle existe bien) |
| Préflight CORS | OPTIONS depuis `electron46.github.io` | **204** |
| Chaîne complète | Bouton « Tester les fonctions IA », puis usage réel | **fonctionnelle** |

Le comportement du client face aux échecs (délai dépassé, 401, 404, 429, 5xx, réseau coupé, réponse
vide) est couvert par la suite de non-régression : `node audit-qa/qa_tests.mjs`, tests `R3-a` à
`R3-d`. Ces cas-là sont simulés, pas rejoués contre le vrai service — ce serait provoquer des pannes
réelles pour vérifier qu'on sait les afficher.
