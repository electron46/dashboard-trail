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

Toutes les commandes se lancent depuis le dossier du projet (celui qui contient `index.html`).

**1. Relier le dossier à ton projet Supabase**

```bash
supabase link --project-ref TON_REF_DE_PROJET
```

`TON_REF_DE_PROJET` est la chaîne visible dans l'URL de ton tableau de bord Supabase
(`https://supabase.com/dashboard/project/XXXXXXXX` → `XXXXXXXX`).

**2. Déposer la clé Anthropic comme secret du projet**

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-ta-cle-ici
```

C'est le seul endroit où la clé existe. Elle n'est ni dans le dépôt Git, ni dans le site, ni dans
tes exports. Tu peux la retirer à tout moment avec `supabase secrets unset ANTHROPIC_API_KEY`.

**3. Déployer la fonction**

```bash
supabase functions deploy ai-proxy
```

**4. Vérifier depuis ELEV**

Ouvre la page **Paramètres → Connectivité & appareils** : la ligne « Fonctions IA » doit indiquer
*Prête (via ton projet Supabase)*. Ouvre ensuite une séance et lance « Générer le retour Coach
ELEV ».

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
- **Non vérifié de bout en bout dans l'environnement de développement** : aucun projet Supabase
  n'était configuré au moment d'écrire cette fonction. Le code client et la fonction ont été relus
  et testés par simulation (voir `audit-qa/regression.mjs`, section « Appels IA »), mais le
  déploiement réel et l'appel réel restent à constater à l'usage.
- La fonction relaie un seul modèle (`claude-sonnet-5`) et deux usages. Ajouter un usage demande de
  l'inscrire dans la table `TASKS` d'`index.ts` — c'est volontaire : sans cette liste fermée, la
  fonction serait un accès Anthropic générique ouvert à tout compte du projet.
