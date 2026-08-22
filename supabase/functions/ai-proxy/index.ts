/**
 * ELEV — façade serveur pour les appels IA (Supabase Edge Function, Deno).
 *
 * POURQUOI CETTE FONCTION EXISTE
 * L'application appelait l'API Anthropic directement depuis le navigateur, avec la clé secrète de
 * l'utilisateur conservée en clair dans `localStorage` sous `trail:apikey` et envoyée en en-tête
 * `x-api-key` (audit RISK-002). Tout script exécuté sur la même origine — extension, dépendance
 * CDN compromise — pouvait la lire, et elle partait aussi dans l'export JSON.
 *
 * INVARIANTS TENUS ICI
 * - le secret vit UNIQUEMENT dans la configuration du projet Supabase (`ANTHROPIC_API_KEY`) ;
 * - il n'est jamais renvoyé au navigateur, ni dans une réponse, ni dans un message d'erreur ;
 * - l'appel exige un jeton de session Supabase valide : un visiteur anonyme ne peut rien déclencher ;
 * - seuls les usages connus de l'application sont acceptés, avec un plafond de jetons par usage ;
 * - un délai maximal côté serveur, en plus de celui du navigateur (audit RISK-003).
 *
 * CE QUI N'EST PAS FAIT ICI, ET POURQUOI
 * Aucun quota par utilisateur n'est implémenté : il demanderait une table de comptage et une
 * politique de facturation qui n'existent pas dans ce projet personnel. Le point est signalé
 * plutôt que simulé. La journalisation reste volontairement muette sur le CONTENU des prompts,
 * qui portent des données de santé.
 *
 * DÉPLOIEMENT : voir supabase/functions/README.md
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';

// Liste fermée : la fonction ne relaie que ce que l'application sait demander. Sans cela, elle
// deviendrait un accès Anthropic générique offert à tout compte du projet.
const TASKS: Record<string, { maxTokens: number }> = {
  'coach-seance': { maxTokens: 2000 },
  'estimation-course': { maxTokens: 1600 },
  // Vérification de bout en bout depuis la page Paramètres. Le prompt et le plafond de jetons
  // sont IMPOSÉS ici, côté serveur : sans cela, un appelant pourrait se servir de ce chemin pour
  // obtenir une génération complète en le déclarant « diagnostic ».
  'diagnostic': { maxTokens: 8 },
};
const DIAGNOSTIC_PROMPT = 'ping';

const MAX_SYSTEM_CHARS = 20000;
const MAX_MESSAGE_CHARS = 40000;
const UPSTREAM_TIMEOUT_MS = 55000;

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405, origin);

  // 1) Authentification. `verify_jwt` est actif par défaut sur les Edge Functions, mais on vérifie
  //    explicitement : la fonction ne doit jamais dépendre d'un réglage de projet pour rester sûre.
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json({ error: 'Jeton de session absent.' }, 401, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'Fonction mal configurée côté serveur.' }, 500, origin);

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!userResp.ok) return json({ error: 'Session invalide ou expirée.' }, 401, origin);
  const user = await userResp.json().catch(() => null);
  if (!user || !user.id) return json({ error: 'Session invalide ou expirée.' }, 401, origin);

  // 2) Validation de la requête. Rien n'est deviné : un usage inconnu est refusé, pas relayé.
  let body: any = null;
  try { body = await req.json(); } catch { return json({ error: 'Corps de requête illisible.' }, 400, origin); }
  const task = String(body?.task ?? '');
  const spec = TASKS[task];
  if (!spec) return json({ error: `Usage IA inconnu : ${task}` }, 400, origin);

  const diagnostic = task === 'diagnostic';
  const system = diagnostic ? undefined : (typeof body?.system === 'string' ? body.system.slice(0, MAX_SYSTEM_CHARS) : undefined);
  const message = diagnostic ? DIAGNOSTIC_PROMPT : (typeof body?.message === 'string' ? body.message.slice(0, MAX_MESSAGE_CHARS) : '');
  if (!message.trim()) return json({ error: 'Requête vide.' }, 400, origin);
  const askedTokens = Number(body?.maxTokens);
  const maxTokens = diagnostic
    ? spec.maxTokens
    : Math.min(spec.maxTokens, Number.isFinite(askedTokens) && askedTokens > 0 ? askedTokens : spec.maxTokens);

  // 3) Le secret. Absent = la fonction est déployée mais pas configurée : on le dit clairement,
  //    sans jamais renvoyer la moindre partie d'une valeur.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: "Clé Anthropic non configurée sur le projet (secret ANTHROPIC_API_KEY)." }, 503, origin);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        thinking: { type: 'disabled' },
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: message }],
      }),
      signal: controller.signal,
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      // Journalisation SANS le contenu du prompt : ces requêtes portent des données de santé.
      console.error(`ai-proxy: refus amont ${upstream.status} pour ${task} (utilisateur ${user.id})`);
      // Le corps amont peut contenir des détails d'infrastructure : on ne relaie qu'un extrait court
      // du message d'erreur, jamais la réponse brute complète.
      let detail = '';
      try { detail = String(JSON.parse(raw)?.error?.message ?? '').slice(0, 200); } catch { /* corps non JSON */ }
      return json({ error: detail || `Service IA indisponible (${upstream.status}).` }, upstream.status, origin);
    }

    const data = JSON.parse(raw);
    const text = (data?.content ?? []).map((c: any) => c?.text ?? '').join('\n').trim();
    if (!text) return json({ error: 'Réponse vide du service IA.' }, 502, origin);
    // Le diagnostic renvoie de quoi afficher un verdict précis côté Paramètres — le modèle
    // réellement joint et le nombre de jetons consommés — plutôt qu'un simple « ça marche ».
    if (diagnostic) {
      return json({
        text,
        model: MODEL,
        usage: data?.usage ? { entree: data.usage.input_tokens ?? null, sortie: data.usage.output_tokens ?? null } : null,
      }, 200, origin);
    }
    return json({ text }, 200, origin);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return json({ error: `Pas de réponse du service IA après ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)} s.` }, 504, origin);
    }
    console.error('ai-proxy: erreur réseau amont', (err as Error)?.message);
    return json({ error: 'Appel au service IA impossible.' }, 502, origin);
  } finally {
    clearTimeout(timer);
  }
});
