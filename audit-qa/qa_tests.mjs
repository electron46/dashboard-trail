/* =============================================================================
   ELEV — suite de non-régression issue de l'audit QA du 22 août 2026.

   Ce fichier était le harnais de REPRODUCTION de l'audit : ses assertions
   décrivaient les défauts (« la synchro déclare ok alors que l'index est vidé »),
   et plusieurs portaient déjà la mention « mettre le test à jour » une fois le
   défaut corrigé. Elles ont été retournées en assertions d'INVARIANT : chaque
   test énonce désormais la propriété que le produit doit tenir, et échoue si le
   défaut réapparaît.

   Lancer :  node audit-qa/qa_tests.mjs
   Sortie :  JSON { summary, results } — code de sortie 1 si un test échoue.

   Un test qui ne peut pas être exécuté ici (réseau Supabase réel, appel
   Anthropic réel) n'est pas simulé en vert : il est absent, et le rapport final
   le dit. Rien n'est mocké pour « faire passer » un test.
   ============================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
/* Modules ELEV 2.0 chargés avant app.js, dans le même ordre que les pages HTML :
   la couverture et le contrat d'insight sont des dépendances d'app.js, pas l'inverse. */
const moduleSources = ['elev-data-quality.js', 'elev-terrain.js', 'elev-evidence.js', 'elev-metrics.js', 'elev-insight.js', 'elev-ai-policy.js']
  .map(f => fs.readFileSync(path.join(root, 'assets', f), 'utf8'));
const source = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(root, 'parametres.html'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'historique.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'assets', 'style.css'), 'utf8');

/* --------------------------- stockage simulé --------------------------- */
function makeStorage(seed) {
  const map = new Map(Object.entries(seed || {}).map(([k, v]) => [String(k), String(v)]));
  const api = {
    // `quotaAfter` : refuse toute écriture dépassant ce nombre de clés — sert à reproduire un
    // quota de navigateur atteint sans dépendre d'un vrai navigateur.
    quotaAfter: Infinity,
    refuseKey: null,
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) {
      if (api.refuseKey && String(k) === api.refuseKey) {
        const e = new Error('Quota exceeded'); e.name = 'QuotaExceededError'; throw e;
      }
      if (!map.has(String(k)) && map.size >= api.quotaAfter) {
        const e = new Error('Quota exceeded'); e.name = 'QuotaExceededError'; throw e;
      }
      map.set(String(k), String(v));
    },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    _map: map,
  };
  return api;
}

/* --------------------------- DOM minimal ---------------------------
   Assez réel pour vérifier ce qui compte ici : qu'un texte inséré par showMsg
   ne devienne JAMAIS du balisage. L'innerHTML est reconstruit par sérialisation
   depuis les nœuds, donc un `<img>` en textContent ressort échappé. */
const ESCAPE = s => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function makeElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    attributes: {},
    style: {},
    dataset: {},
    className: '',
    _text: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    appendChild(c) { this._text = ''; this.children.push(c); return c; },
    remove() {},
    focus() {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] ?? null; } });
  Object.defineProperty(el, 'textContent', {
    get() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._text; },
    set(v) { this.children.length = 0; this._text = String(v ?? ''); },
  });
  Object.defineProperty(el, 'innerHTML', {
    get() {
      if (this.children.length) {
        return this.children.map(c => {
          const attrs = Object.entries(c.attributes).map(([k, v]) => ` ${k}="${ESCAPE(v)}"`).join('');
          const cls = c.className ? ` class="${ESCAPE(c.className)}"` : '';
          return `<${c.tagName.toLowerCase()}${cls}${attrs}>${c.innerHTML}</${c.tagName.toLowerCase()}>`;
        }).join('');
      }
      return ESCAPE(this._text);
    },
    set(v) { this.children.length = 0; this._text = String(v ?? ''); },
  });
  return el;
}

function makeDocument() {
  const registry = new Map();
  return {
    _registry: registry,
    documentElement: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} } },
    body: { firstChild: null, appendChild() {}, insertBefore() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    getElementById(id) { return registry.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return makeElement(tag); },
  };
}

function loadApp(opts) {
  opts = opts || {};
  const localStorage = makeStorage(opts.seed);
  const sessionStorage = makeStorage();
  const document = makeDocument();
  const context = {
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    localStorage, sessionStorage, document,
    navigator: {},
    location: { href: '', reload() {} },
    addEventListener() {}, removeEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '', display: 'block' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: cb => cb(0),
    cancelAnimationFrame() {},
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams, Blob, TextDecoder, TextEncoder, DataView,
    Uint8Array, ArrayBuffer, Date, Math, JSON, Number, String, Object, Array,
    Map, Set, Promise, Intl, AbortController, Error,
    fetch: opts.fetch || (async () => { throw new Error('fetch non simulé dans ce test'); }),
  };
  context.window = context;
  vm.createContext(context);
  moduleSources.forEach((src, i) => vm.runInContext(src, context, { filename: 'assets/module-' + i + '.js' }));
  vm.runInContext(source, context, { filename: 'assets/app.js' });
  return context;
}

/* --------------------------- client Supabase simulé --------------------------- */
function makeFakeSupabase(cfg) {
  cfg = cfg || {};
  const state = {
    activities: cfg.activities ? [...cfg.activities] : [],
    trailData: cfg.trailData !== undefined ? cfg.trailData : null,
    pushCount: 0,          // upserts sur trail_data (le blob)
    activityUpserts: 0,
    deleted: [],
  };
  const listError = cfg.listError || null;          // erreur du select('client_id')
  const readError = cfg.readError || null;          // erreur du select('*')
  const readRows = cfg.readRows || null;            // force le contenu de la relecture
  const upsertActivityError = cfg.upsertActivityError || null;
  const trailPullError = cfg.trailPullError || null;
  const trailPullDelayMs = cfg.trailPullDelayMs || 0;

  const client = {
    _state: state,
    auth: {
      async getUser() { return { data: { user: { id: 'user-test', email: 'test@elev.local' } } }; },
      async getSession() { return { data: { session: { access_token: 'jeton-test' } } }; },
    },
    storage: {
      from() {
        return {
          async upload() { return { error: null }; },
          async download() { return { data: null, error: { message: 'non simulé' } }; },
          async remove(paths) { state.deleted.push(...paths); return { error: null }; },
        };
      },
    },
    from(table) {
      if (table === 'trail_data') {
        return {
          async upsert(row) {
            state.pushCount++;
            state.trailData = { payload: row.payload, updated_at: row.updated_at };
            return { error: null };
          },
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    if (trailPullDelayMs) await new Promise(r => setTimeout(r, trailPullDelayMs));
                    if (trailPullError) return { data: null, error: { message: trailPullError } };
                    return { data: state.trailData, error: null };
                  },
                };
              },
            };
          },
        };
      }
      // table `activities`
      return {
        async upsert(row) {
          state.activityUpserts++;
          if (upsertActivityError) return { error: { message: upsertActivityError } };
          const i = state.activities.findIndex(a => a.client_id === row.client_id);
          if (i >= 0) state.activities[i] = { ...state.activities[i], ...row };
          else state.activities.push(row);
          return { error: null };
        },
        select(cols) {
          const complet = cols === '*';
          return {
            eq() {
              const resultat = () => {
                if (complet) {
                  if (readError) return { data: null, error: { message: readError } };
                  return { data: readRows || state.activities, error: null };
                }
                if (listError) return { data: null, error: { message: listError } };
                return { data: state.activities.map(a => ({ client_id: a.client_id })), error: null };
              };
              const p = Promise.resolve(resultat());
              p.order = () => Promise.resolve(resultat());
              p.eq = () => ({ then: (f) => Promise.resolve({ error: null }).then(f) });
              return p;
            },
          };
        },
        delete() {
          return {
            eq() {
              return {
                eq(_c, id) {
                  state.activities = state.activities.filter(a => a.client_id !== id);
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };
  return client;
}

function installFakeSupabase(app, client) {
  app.getSupabaseClient = () => client;
  app.supaGetUser = async () => ({ id: 'user-test', email: 'test@elev.local' });
  return client;
}

function seedSession(app, s) {
  app.localStorage.setItem('trail:seance:' + s.id, JSON.stringify(s));
  const idx = JSON.parse(app.localStorage.getItem('trail:index') || '[]');
  if (!idx.includes(s.id)) idx.push(s.id);
  app.localStorage.setItem('trail:index', JSON.stringify(idx));
}

/* --------------------------- micro-harnais --------------------------- */
const results = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
async function test(id, name, fn) {
  try {
    const detail = await fn();
    results.push({ id, name, status: 'PASS', detail: detail ?? null });
  } catch (error) {
    results.push({ id, name, status: 'FAIL', detail: error.message });
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const app = loadApp();
const fitDir = path.join(root, 'fit_files');
const fitNames = fs.readdirSync(fitDir).filter(x => x.toLowerCase().endsWith('.fit'));
const readFit = name => {
  const b = fs.readFileSync(path.join(fitDir, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

/* =========================================================================
   SUITE P0 — les trois propriétés bloquantes de l'audit
   ========================================================================= */

await test('P0-1a', 'Sync — un upsert refusé ne retire PAS la séance de l\'index (BUG-001)', async () => {
  const iso = loadApp();
  seedSession(iso, { id: 'local-1', date: '2026-08-22', sport: 'Trail', distanceKm: 10 });
  installFakeSupabase(iso, makeFakeSupabase({ activities: [], upsertActivityError: 'upsert refusé (RLS)' }));
  const res = await iso.syncActivitiesWithSupabase();
  const index = iso.loadIndex();
  const seanceLisible = iso.loadSession('local-1') !== null;
  assert(res.ok === false, 'un échec d\'envoi doit être rapporté comme un échec, pas comme un succès');
  assert(index.includes('local-1'), 'la séance a disparu de l\'index alors que son envoi a échoué');
  assert(seanceLisible, 'la séance n\'est plus lisible');
  assert(res.indexPreserve === true, 'la réponse doit signaler que l\'index a été préservé');
  return { ok: res.ok, reason: res.reason, index, pending: res.pending };
});

await test('P0-1b', 'Sync — une lecture distante en erreur ne déclenche aucune reconstruction (BUG-001)', async () => {
  const iso = loadApp();
  seedSession(iso, { id: 'local-1', date: '2026-08-22', sport: 'Trail', distanceKm: 10 });
  installFakeSupabase(iso, makeFakeSupabase({ listError: 'lecture refusée' }));
  const res = await iso.syncActivitiesWithSupabase();
  assert(res.ok === false, 'une lecture en erreur doit retourner ok:false');
  assert(iso.loadIndex().includes('local-1'), 'l\'index a été touché malgré une lecture en erreur');
  return { ok: res.ok, reason: res.reason, index: iso.loadIndex() };
});

await test('P0-1c', 'Sync — remote PARTIEL : une séance jamais confirmée est conservée (BUG-001)', async () => {
  const iso = loadApp();
  // 'confirmee' a déjà été vue côté cloud lors d'un cycle précédent ; 'hors-ligne' n'est jamais partie.
  seedSession(iso, { id: 'confirmee', date: '2026-08-20', sport: 'Trail', distanceKm: 8 });
  seedSession(iso, { id: 'hors-ligne', date: '2026-08-21', sport: 'Trail', distanceKm: 9 });
  iso.setSyncedActivityIds(['confirmee']);
  const client = makeFakeSupabase({
    activities: [{ client_id: 'confirmee', date: '2026-08-20', sport: 'Trail', distance_km: 8, raw: {} }],
  });
  installFakeSupabase(iso, client);
  // L'envoi de 'hors-ligne' échoue : la reconstruction ne doit pas avoir lieu du tout.
  client._state.activities.push({ client_id: 'hors-ligne', date: '2026-08-21', sport: 'Trail', distance_km: 9, raw: {} });
  const res = await iso.syncActivitiesWithSupabase();
  assert(res.ok === true, 'la synchro aurait dû réussir : ' + res.reason);
  const index = iso.loadIndex();
  assert(index.includes('hors-ligne') && index.includes('confirmee'), 'une séance a disparu');
  return { ok: res.ok, index };
});

await test('P0-1d', 'Sync — une séance confirmée puis absente du cloud est bien retirée (pas de résurrection)', async () => {
  const iso = loadApp();
  seedSession(iso, { id: 'supprimee-ailleurs', date: '2026-08-20', sport: 'Trail', distanceKm: 8 });
  seedSession(iso, { id: 'toujours-la', date: '2026-08-21', sport: 'Trail', distanceKm: 9 });
  iso.setSyncedActivityIds(['supprimee-ailleurs', 'toujours-la']);
  installFakeSupabase(iso, makeFakeSupabase({
    activities: [{ client_id: 'toujours-la', date: '2026-08-21', sport: 'Trail', distance_km: 9, raw: {} }],
  }));
  const res = await iso.syncActivitiesWithSupabase();
  assert(res.ok === true, 'synchro en échec : ' + res.reason);
  const index = iso.loadIndex();
  assert(!index.includes('supprimee-ailleurs'), 'une séance supprimée sur un autre appareil est ressuscitée');
  assert(index.includes('toujours-la'), 'la séance encore présente a disparu');
  return { index };
});

await test('P0-1e', 'Sync — relecture incomplète : l\'index est conservé plutôt que reconstruit (BUG-001)', async () => {
  const iso = loadApp();
  seedSession(iso, { id: 'a', date: '2026-08-20', sport: 'Trail', distanceKm: 8 });
  seedSession(iso, { id: 'b', date: '2026-08-21', sport: 'Trail', distanceKm: 9 });
  iso.setSyncedActivityIds(['a', 'b']);
  installFakeSupabase(iso, makeFakeSupabase({
    activities: [
      { client_id: 'a', date: '2026-08-20', sport: 'Trail', distance_km: 8, raw: {} },
      { client_id: 'b', date: '2026-08-21', sport: 'Trail', distance_km: 9, raw: {} },
    ],
    // La seconde lecture ne renvoie qu'une ligne : incohérente avec la première.
    readRows: [{ client_id: 'a', date: '2026-08-20', sport: 'Trail', distance_km: 8, raw: {} }],
  }));
  const res = await iso.syncActivitiesWithSupabase();
  assert(res.ok === false, 'une relecture incomplète ne doit pas être traitée comme un succès');
  assert(iso.loadIndex().length === 2, 'l\'index a été reconstruit sur une lecture incomplète');
  return { reason: res.reason, index: iso.loadIndex() };
});

await test('P0-1f', 'Sync — hors ligne / non configuré : aucun effet de bord sur les données locales', async () => {
  const iso = loadApp();
  seedSession(iso, { id: 'local-1', date: '2026-08-22', sport: 'Trail', distanceKm: 10 });
  const sansClient = await iso.syncActivitiesWithSupabase();
  assert(sansClient.ok === false && sansClient.reason === 'not-configured', 'réponse inattendue sans configuration');
  installFakeSupabase(iso, makeFakeSupabase({}));
  iso.supaGetUser = async () => null;
  const nonConnecte = await iso.syncActivitiesWithSupabase();
  assert(nonConnecte.reason === 'not-logged-in', 'réponse inattendue sans session');
  assert(iso.loadIndex().includes('local-1'), 'l\'index a été modifié alors qu\'aucune synchro n\'était possible');
  return { sansClient: sansClient.reason, nonConnecte: nonConnecte.reason };
});

await test('P0-1g', 'Sync — reprise ultérieure : après un échec, un nouvel essai réussit et publie tout', async () => {
  const iso = loadApp();
  seedSession(iso, { id: 'local-1', date: '2026-08-22', sport: 'Trail', distanceKm: 10 });
  const client = makeFakeSupabase({ upsertActivityError: 'réseau coupé' });
  installFakeSupabase(iso, client);
  const echec = await iso.syncActivitiesWithSupabase();
  assert(echec.ok === false, 'le premier essai devait échouer');
  // Le réseau revient.
  const client2 = makeFakeSupabase({});
  installFakeSupabase(iso, client2);
  const reprise = await iso.syncActivitiesWithSupabase();
  assert(reprise.ok === true, 'la reprise a échoué : ' + reprise.reason);
  assert(client2._state.activities.some(a => a.client_id === 'local-1'), 'la séance n\'a pas été publiée à la reprise');
  assert(iso.loadIndex().includes('local-1'), 'la séance a disparu après la reprise');
  return { premier: echec.reason, reprise: reprise.ok, distantes: client2._state.activities.length };
});

await test('P0-2a', 'Purge — une suppression ne peut plus réarmer la synchronisation (BUG-002)', async () => {
  const iso = loadApp();
  installFakeSupabase(iso, makeFakeSupabase({}));
  seedSession(iso, { id: 's1', date: '2026-08-22', sport: 'Trail', distanceKm: 5 });
  iso.suspendSync();
  iso.resetLocalData();
  const timerArme = vm.runInContext('_syncTimer !== null', iso);
  assert(timerArme === false, 'la minuterie de synchronisation a été reprogrammée pendant la purge');
  assert(iso.isSyncSuspended() === true, 'le verrou devrait rester posé après une réinitialisation');
  return { timerArme, verrou: iso.isSyncSuspended() };
});

await test('P0-2b', 'Purge + pull LENT (> délai de 1,5 s) : aucun envoi sortant pendant l\'opération (BUG-002)', async () => {
  const iso = loadApp();
  const client = makeFakeSupabase({
    trailData: { payload: { races: [{ id: 'r1', name: 'Mafate' }], schemaVersion: 1 }, updated_at: '2026-08-22T00:00:00Z' },
    trailPullDelayMs: 1800, // dépasse volontairement le délai de scheduleSync (1500 ms)
  });
  installFakeSupabase(iso, client);
  seedSession(iso, { id: 's1', date: '2026-08-22', sport: 'Trail', distanceKm: 5 });
  const avant = client._state.pushCount;
  await iso.withSyncSuspended(async () => {
    iso.loadIndex().forEach(iso.deleteSession);
    iso.localStorage.removeItem('trail:index');
    iso.localStorage.removeItem('trail:races');
    const res = await iso.syncPull();
    assert(res.ok === true, 'la récupération aurait dû réussir : ' + res.reason);
  });
  const pendant = client._state.pushCount - avant;
  assert(pendant === 0, pendant + ' envoi(s) sortant(s) pendant la purge — le blob vidé a pu partir vers le cloud');
  // Après l'opération, les courses récupérées sont bien là.
  assert(iso.getRaces().length === 1, 'les courses n\'ont pas été récupérées');
  // Et le verrou est levé : la synchronisation n'est pas restée muette.
  assert(iso.isSyncSuspended() === false, 'le verrou n\'a pas été levé');
  return { envoisPendantPurge: pendant, courses: iso.getRaces().length };
});

await test('P0-2c', 'Purge + pull ÉCHOUÉ : la copie cloud n\'est pas écrasée (BUG-002)', async () => {
  const iso = loadApp();
  const client = makeFakeSupabase({
    trailData: { payload: { races: [{ id: 'r1', name: 'Mafate' }] }, updated_at: '2026-08-22T00:00:00Z' },
    trailPullError: 'réseau indisponible',
  });
  installFakeSupabase(iso, client);
  seedSession(iso, { id: 's1', date: '2026-08-22', sport: 'Trail', distanceKm: 5 });
  const cloudAvant = JSON.stringify(client._state.trailData);
  await iso.withSyncSuspended(async () => {
    iso.loadIndex().forEach(iso.deleteSession);
    iso.localStorage.removeItem('trail:index');
    iso.localStorage.removeItem('trail:races');
    const res = await iso.syncPull();
    assert(res.ok === false, 'la récupération devait échouer dans ce scénario');
  });
  await sleep(1700); // au-delà du délai de scheduleSync : rien ne doit être parti entre-temps
  assert(JSON.stringify(client._state.trailData) === cloudAvant, 'la copie cloud a été modifiée par la purge');
  assert(client._state.pushCount === 0, 'un envoi sortant a eu lieu malgré l\'échec de récupération');
  return { cloudIntact: true, pushCount: client._state.pushCount };
});

await test('P0-2d', 'Purge — une exception ne laisse pas la synchronisation verrouillée', async () => {
  const iso = loadApp();
  installFakeSupabase(iso, makeFakeSupabase({}));
  let leve = null;
  try {
    await iso.withSyncSuspended(async () => { throw new Error('panne simulée'); });
  } catch (e) { leve = e.message; }
  assert(leve === 'panne simulée', 'l\'exception aurait dû remonter');
  assert(iso.isSyncSuspended() === false, 'le verrou est resté posé après une exception');
  return { exception: leve, verrou: iso.isSyncSuspended() };
});

await test('P0-2e', 'Purge — les deux parcours de la page Paramètres posent bien le verrou', () => {
  const reset = settingsSource.slice(
    settingsSource.indexOf("document.getElementById('resetBtn').addEventListener"),
    settingsSource.indexOf('/* --------------------------- SAUVEGARDE')
  );
  assert(reset.includes('suspendSync()'), 'la réinitialisation ne pose pas suspendSync()');
  assert(reset.includes('resetLocalData()'), 'la réinitialisation n\'utilise pas la liste centralisée de clés');
  const cache = settingsSource.slice(settingsSource.indexOf("clearCacheBtn.addEventListener"));
  assert(cache.includes('withSyncSuspended'), 'le vidage du cache ne pose pas le verrou sur toute l\'opération');
  return { reset: true, cache: true };
});

await test('P0-2f', 'Purge + pull RAPIDE, 0 / 1 / n séances, puis reprise normale de la synchronisation', async () => {
  for (const nb of [0, 1, 5]) {
    const iso = loadApp();
    const distantes = [];
    for (let i = 0; i < nb; i++) distantes.push({ client_id: 'd' + i, date: '2026-08-' + (10 + i), sport: 'Trail', distance_km: 5 + i, raw: {} });
    const client = makeFakeSupabase({
      activities: distantes,
      trailData: { payload: { schemaVersion: 1, races: [{ id: 'r1', name: 'Mafate' }] }, updated_at: '2026-08-22T00:00:00Z' },
    });
    installFakeSupabase(iso, client);
    for (let i = 0; i < nb; i++) seedSession(iso, { id: 'd' + i, date: '2026-08-' + (10 + i), sport: 'Trail', distanceKm: 5 + i });
    iso.setSyncedActivityIds(distantes.map(d => d.client_id));

    const bilan = await iso.withSyncSuspended(async () => {
      iso.loadIndex().forEach(iso.deleteSession);
      iso.localStorage.removeItem('trail:index');
      iso.localStorage.removeItem('trail:races');
      iso.localStorage.removeItem('trail:syncedActivityIds');
      const a = await iso.syncPull();
      const b = await iso.syncActivitiesWithSupabase();
      return { a, b };
    });
    assert(bilan.a.ok === true, nb + ' séances : récupération du blob en échec (' + bilan.a.reason + ')');
    assert(bilan.b.ok === true, nb + ' séances : récupération des séances en échec (' + bilan.b.reason + ')');
    assert(iso.loadIndex().length === nb, nb + ' séances attendues, ' + iso.loadIndex().length + ' obtenues');
    assert(iso.getRaces().length === 1, nb + ' séances : les courses n\'ont pas été récupérées');
    assert(client._state.pushCount === 0, nb + ' séances : un envoi sortant a eu lieu pendant la purge');

    // Reprise : une modification de l'utilisateur après l'opération doit REDEVENIR synchronisable.
    assert(iso.isSyncSuspended() === false, 'le verrou est resté posé');
    iso.saveRaces(iso.getRaces().concat([{ id: 'r2', name: 'Nouvelle course' }]));
    const programmee = vm.runInContext('_syncTimer !== null', iso);
    assert(programmee, nb + ' séances : la synchronisation ne repart pas après l\'opération');
    iso.cancelPendingSync();
  }
  return { cas: [0, 1, 5] };
});

await test('P0-3a', 'Identité — deux activités distinctes ne partagent plus d\'identifiant (BUG-003)', () => {
  const commun = { devices: [{ manufacturer: 1, product: 2, serialNumber: 42 }], records: new Array(100), session: { sport: 2 } };
  const a = { ...commun, startTsRaw: 1000000, distanceM: 5000.1, durationS: 1800 };
  const b = { ...commun, startTsRaw: 1004000, distanceM: 5000.4, durationS: 1830 };
  const idA = app.makeSessionId({ date: '2026-08-22', sport: 'Trail', distanceKm: 5.0001, identityKey: app.fitIdentityKey(a, {}) });
  const idB = app.makeSessionId({ date: '2026-08-22', sport: 'Trail', distanceKm: 5.0004, identityKey: app.fitIdentityKey(b, {}) });
  const ancienA = app.legacySessionId({ date: '2026-08-22', sport: 'Trail', distanceKm: 5.0001 });
  const ancienB = app.legacySessionId({ date: '2026-08-22', sport: 'Trail', distanceKm: 5.0004 });
  assert(ancienA === ancienB, 'le scénario de collision de l\'audit n\'est plus reproductible : revoir ce test');
  assert(idA !== idB, 'les deux activités partagent toujours le même identifiant');
  return { ancien: ancienA, nouveauA: idA, nouveauB: idB };
});

await test('P0-3b', 'Identité — le même fichier importé deux fois est reconnu comme doublon (BUG-003 / UX-001)', () => {
  const buffer = readFit(fitNames[0]);
  const hash = app.fitFileFingerprint(buffer);
  const { summary } = app.readFitFile(buffer, { name: fitNames[0], lastModified: Date.now(), fileHash: hash });
  summary.fileHash = hash;
  const premier = app.prepareSessionForImport(summary, hash, []);
  assert(premier.action === 'new', 'le premier import devrait créer une séance');
  const enBase = [premier.session];
  const second = app.prepareSessionForImport(summary, hash, enBase);
  assert(second.action === 'duplicate', 'le réimport du même fichier n\'est pas détecté comme doublon (annoncé : ' + second.action + ')');
  assert(app.fitFileFingerprint(buffer) === hash, 'l\'empreinte de fichier n\'est pas déterministe');
  return { premier: premier.action, second: second.action, id: premier.session.id };
});

await test('P0-3c', 'Identité — deux fichiers réels différents restent deux séances distinctes', () => {
  const vus = new Set();
  const sessions = [];
  fitNames.forEach(n => {
    const buffer = readFit(n);
    const hash = app.fitFileFingerprint(buffer);
    const { summary } = app.readFitFile(buffer, { name: n, lastModified: Date.now(), fileHash: hash });
    summary.fileHash = hash;
    const issue = app.prepareSessionForImport(summary, hash, sessions);
    assert(issue.action === 'new', n + ' a été confondu avec une autre séance (' + issue.action + ')');
    assert(!vus.has(issue.session.id), 'collision d\'identifiant entre deux fichiers réels : ' + issue.session.id);
    vus.add(issue.session.id);
    sessions.push(issue.session);
  });
  return { fichiers: fitNames.length, identifiants: [...vus] };
});

await test('P0-3d', 'Identité — une séance ANCIENNE garde son identifiant et reste accessible (migration)', () => {
  const buffer = readFit(fitNames[0]);
  const hash = app.fitFileFingerprint(buffer);
  const { summary } = app.readFitFile(buffer, { name: fitNames[0], lastModified: Date.now(), fileHash: hash });
  // Séance telle qu'elle aurait été enregistrée AVANT la correction : identifiant hérité,
  // ni identityKey ni fileHash, et des données saisies par l'utilisateur.
  const ancienne = {
    ...summary,
    id: app.legacySessionId(summary),
    identityKey: undefined, fileHash: undefined,
    gearId: 'chaussures-1', contexte: 'jambes lourdes', aiFeedback: 'retour coach existant',
  };
  delete ancienne.identityKey; delete ancienne.fileHash;
  summary.fileHash = hash;
  const issue = app.prepareSessionForImport(summary, hash, [ancienne]);
  assert(issue.action === 'update', 'le réimport aurait dû être une mise à jour, pas ' + issue.action);
  assert(issue.session.id === ancienne.id, 'l\'identifiant de la séance existante a changé : URL, ligne Supabase et fichier .fit seraient orphelins');
  assert(issue.session.gearId === 'chaussures-1', 'l\'équipement associé a été perdu');
  assert(issue.session.contexte === 'jambes lourdes', 'la note de contexte a été perdue');
  assert(issue.session.aiFeedback === 'retour coach existant', 'le retour Coach a été perdu');
  assert(!!issue.session.identityKey, 'la séance ancienne n\'acquiert pas d\'identité de contenu');
  return { action: issue.action, id: issue.session.id, identiteAcquise: !!issue.session.identityKey };
});

await test('P0-3e', 'Identité — import multi-fichiers : un doublon dans la même sélection est reconnu', () => {
  const buffer = readFit(fitNames[0]);
  const hash = app.fitFileFingerprint(buffer);
  const mk = () => {
    const { summary } = app.readFitFile(buffer, { name: fitNames[0], lastModified: Date.now(), fileHash: hash });
    summary.fileHash = hash;
    return summary;
  };
  let connues = [];
  const actions = [];
  for (let i = 0; i < 3; i++) {
    const issue = app.prepareSessionForImport(mk(), hash, connues);
    actions.push(issue.action);
    if (issue.action !== 'duplicate') connues = connues.filter(s => s.id !== issue.session.id).concat([issue.session]);
  }
  assert(actions.join(',') === 'new,duplicate,duplicate', 'séquence inattendue : ' + actions.join(','));
  assert(connues.length === 1, connues.length + ' séances créées au lieu d\'une');
  return { actions };
});

await test('P0-3f', 'Identité — la page Activités n\'utilise plus l\'identifiant arrondi', () => {
  assert(!historySource.includes("Math.round((summary.distanceKm||0)*1000)"), 'l\'ancienne formule d\'identifiant est encore employée');
  assert(historySource.includes('prepareSessionForImport'), 'la page n\'utilise pas la décision d\'import partagée');
  assert(historySource.includes('persistSession'), 'la page n\'utilise pas l\'écriture transactionnelle');
  return { ancienneFormule: false };
});

/* =========================================================================
   SUITE P1
   ========================================================================= */

await test('P1-8a', 'FIT — un CRC de fin de fichier invalide est REFUSÉ par l\'import (BUG-004)', () => {
  const original = fs.readFileSync(path.join(fitDir, fitNames[0]));
  const bytes = Buffer.from(original);
  bytes[bytes.length - 1] ^= 0xff;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const validation = app.validateFitFile(buffer);
  assert(validation.fileCrcValid === false, 'le CRC invalide n\'est pas détecté');
  assert(validation.ok === false, 'la validation accepte un fichier au CRC invalide');
  let refuse = false, message = null;
  try { app.readFitFile(buffer, { name: 'crc-invalide.fit', lastModified: Date.now() }); }
  catch (e) { refuse = true; message = e.message; }
  assert(refuse, 'l\'import accepte encore un fichier au CRC invalide');
  // L'inspecteur, lui, doit continuer de l'analyser pour permettre le diagnostic.
  const rapport = app.buildFitInspectorReport(buffer, { name: 'crc-invalide.fit', lastModified: Date.now() });
  assert(rapport.file.fileCrcValid === false && rapport.file.importAccepte === false, 'l\'inspecteur ne rend plus le même verdict');
  assert((rapport.summary && rapport.summary.date) || rapport.parseError === null, 'l\'inspecteur ne parvient plus à analyser le fichier');
  return { message, inspecteurAnalyseQuandMeme: !rapport.parseError };
});

await test('P1-8b', 'FIT — l\'import reste possible après confirmation explicite du risque (BUG-004)', () => {
  const original = fs.readFileSync(path.join(fitDir, fitNames[0]));
  const bytes = Buffer.from(original);
  bytes[bytes.length - 1] ^= 0xff;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const lu = app.readFitFile(buffer, { name: 'crc-invalide.fit', lastModified: Date.now() }, { allowCrcMismatch: true });
  assert(lu.summary.crcMismatch === true, 'la séance ne garde pas la trace du CRC invalide');
  assert(historySource.includes('allowCrcMismatch'), 'la page Activités ne propose pas ce passage outre explicite');
  assert(historySource.includes('confirm('), 'le passage outre n\'est pas soumis à confirmation');
  return { crcMismatch: lu.summary.crcMismatch };
});

await test('P1-8c', 'FIT — CRC valide, CRC nul, signature invalide, troncature, taille aberrante', () => {
  const original = fs.readFileSync(path.join(fitDir, fitNames[0]));

  const valide = app.validateFitFile(readFit(fitNames[0]));
  assert(valide.ok === true && valide.fileCrcValid === true, 'un fichier réel valide est refusé');

  // CRC stocké à zéro = « non calculé par l'appareil » : indéterminé, accepté (règle documentée).
  const nul = Buffer.from(original);
  nul[nul.length - 2] = 0; nul[nul.length - 1] = 0;
  const vNul = app.validateFitFile(nul.buffer.slice(nul.byteOffset, nul.byteOffset + nul.byteLength));
  assert(vNul.fileCrcValid === null, 'un CRC nul devrait être rapporté comme indéterminé');
  assert(vNul.ok === true, 'un CRC nul ne doit pas bloquer l\'import');

  const sig = Buffer.from(original);
  sig[8] = 0x58;
  const vSig = app.validateFitFile(sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength));
  assert(vSig.ok === false && vSig.signatureValid === false, 'une signature invalide est acceptée');

  const coupe = original.subarray(0, Math.floor(original.length / 2));
  const vCoupe = app.validateFitFile(coupe.buffer.slice(coupe.byteOffset, coupe.byteOffset + coupe.byteLength));
  assert(vCoupe.ok === false && vCoupe.truncated === true, 'un fichier tronqué est accepté');

  const court = new Uint8Array(8);
  assert(app.validateFitFile(court.buffer).ok === false, 'un fichier trop court est accepté');

  return { valide: vNul.reason || null, crcNulAccepte: vNul.ok, signature: vSig.reason, tronque: vCoupe.reason };
});

await test('P1-8d', 'FIT — les trois fichiers réels restent correctement analysés', () => {
  const out = fitNames.map(n => {
    const buffer = readFit(n);
    const { messages, summary } = app.readFitFile(buffer, { name: n, lastModified: Date.now() });
    assert((messages.record || []).length > 0, n + ' : aucun enregistrement');
    assert(Number.isFinite(summary.distanceKm) && summary.distanceKm > 0, n + ' : distance invalide');
    assert(Number.isFinite(summary.durationS) && summary.durationS > 0, n + ' : durée invalide');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(summary.date), n + ' : date invalide');
    assert(typeof summary.startedAt === 'string', n + ' : instant de départ non conservé');
    return { name: n, records: messages.record.length, km: summary.distanceKm, date: summary.date, offset: summary.utcOffsetS };
  });
  return out;
});

await test('P1-9a', 'Stockage — un quota atteint sur la séance ne laisse AUCUN identifiant fantôme (BUG-008)', () => {
  const iso = loadApp();
  iso.localStorage.refuseKey = 'trail:seance:s1';
  const res = iso.persistSession('s1', { id: 's1', date: '2026-08-22', sport: 'Trail' });
  assert(res.ok === false, 'l\'écriture aurait dû échouer');
  assert(!iso.loadIndex().includes('s1'), 'l\'index référence une séance qui n\'a pas pu être écrite');
  assert(iso.loadSession('s1') === null, 'une séance fantôme a été laissée');
  assert(/plein|impossible/i.test(res.reason), 'la raison ne dit pas quoi faire : ' + res.reason);
  return { ok: res.ok, reason: res.reason.slice(0, 80), index: iso.loadIndex() };
});

await test('P1-9b', 'Stockage — un quota atteint sur l\'index annule la séance écrite (BUG-008)', () => {
  const iso = loadApp();
  iso.localStorage.refuseKey = 'trail:index';
  const res = iso.persistSession('s1', { id: 's1', date: '2026-08-22', sport: 'Trail' });
  assert(res.ok === false, 'l\'écriture aurait dû échouer');
  assert(iso.loadSession('s1') === null, 'la séance écrite n\'a pas été annulée : elle reste invisible et occupe le quota');
  const integrite = iso.checkDataIntegrity();
  assert(integrite.seanceHorsIndex.length === 0, 'une séance hors index subsiste');
  return { ok: res.ok, integrite: integrite.ok };
});

await test('P1-9c', 'Stockage — l\'ordre d\'écriture est séance PUIS index (BUG-008)', () => {
  const iso = loadApp();
  const ordre = [];
  const vraiSet = iso.localStorage.setItem.bind(iso.localStorage);
  iso.localStorage.setItem = (k, v) => { if (String(k).startsWith('trail:')) ordre.push(String(k)); return vraiSet(k, v); };
  iso.persistSession('s1', { id: 's1', date: '2026-08-22', sport: 'Trail' });
  const iSeance = ordre.indexOf('trail:seance:s1');
  const iIndex = ordre.indexOf('trail:index');
  assert(iSeance >= 0 && iIndex >= 0, 'écritures non observées : ' + ordre.join(','));
  assert(iSeance < iIndex, 'l\'index est encore écrit avant la séance : ' + ordre.join(','));
  return { ordre };
});

await test('P1-9d', 'Intégrité — index sans séance et séance hors index sont DÉTECTÉS, et réparés sans perte', () => {
  const iso = loadApp();
  seedSession(iso, { id: 'ok-1', date: '2026-08-20', sport: 'Trail', distanceKm: 5 });
  // Séance stockée mais absente de l'index (invisible partout dans l'application).
  iso.localStorage.setItem('trail:seance:orpheline', JSON.stringify({ id: 'orpheline', date: '2026-08-21', sport: 'Trail', distanceKm: 7 }));
  // Identifiant d'index sans objet (activité fantôme) + doublon.
  iso.localStorage.setItem('trail:index', JSON.stringify(['ok-1', 'ok-1', 'fantome']));
  const avant = iso.checkDataIntegrity();
  assert(avant.seanceHorsIndex.includes('orpheline'), 'la séance hors index n\'est pas détectée');
  assert(avant.indexSansSeance.includes('fantome'), 'l\'identifiant fantôme n\'est pas détecté');
  assert(avant.indexDoublons.includes('ok-1'), 'le doublon d\'index n\'est pas détecté');
  const rep = iso.repairDataIntegrity();
  assert(rep.ok, 'la réparation a échoué');
  assert(iso.loadSession('orpheline') !== null, 'la réparation a SUPPRIMÉ une donnée');
  assert(iso.loadIndex().includes('orpheline'), 'la séance hors index n\'a pas été réintégrée');
  assert(iso.checkDataIntegrity().ok === true, 'des incohérences subsistent après réparation');
  return { avant: { horsIndex: avant.seanceHorsIndex, fantomes: avant.indexSansSeance }, apres: rep };
});

await test('P1-9e', 'Intégrité — une collision d\'identité est signalée, jamais « réparée » par suppression', () => {
  const iso = loadApp();
  seedSession(iso, { id: 'a', date: '2026-08-20', sport: 'Trail', distanceKm: 5, identityKey: 'MEME' });
  seedSession(iso, { id: 'b', date: '2026-08-20', sport: 'Trail', distanceKm: 5, identityKey: 'MEME' });
  const r = iso.checkDataIntegrity();
  assert(r.collisionsIdentite.length === 1, 'la collision n\'est pas détectée');
  iso.repairDataIntegrity();
  assert(iso.loadSession('a') && iso.loadSession('b'), 'la réparation a supprimé une séance en collision');
  return { collisions: r.collisionsIdentite };
});

await test('P1-10', 'Sauvegarde — aller-retour export → origine vide → import → export CANONIQUE', () => {
  const src = loadApp();
  seedSession(src, { id: 's1', date: '2026-08-20', sport: 'Trail', distanceKm: 12.5, ascent: 600 });
  seedSession(src, { id: 's2', date: '2026-08-21', sport: 'Course à pied', distanceKm: 8, ascent: 120 });
  src.savePlan([{ date: '2026-08-25', type: 'Sortie longue', distanceKm: 20, deniveleM: 800 }]);
  src.saveRaces([{ id: 'r1', name: 'Mafate', date: '2026-11-28', distanceKm: 55, denivele: 3500, statut: 'principal' }]);
  src.saveProfile({ nom: 'Nicolas', fcMax: 186, fcRepos: 48 });
  src.saveGear([{ id: 'g1', nom: 'Speedgoat', category: 'chaussures', kmInitial: 0 }]);
  src.savePlanNotes('note de test');
  src.savePlanYear(2027);
  const export1 = src.buildExportPayload();

  const dst = loadApp();
  const res = dst.restoreBackupPayload(JSON.parse(JSON.stringify(export1)), { sessionsMode: 'merge' });
  assert(res.ok, 'la restauration a échoué : ' + res.reason);
  const export2 = dst.buildExportPayload();

  const normaliser = p => {
    const c = JSON.parse(JSON.stringify(p));
    delete c.exportedAt; // horodatage de génération, jamais identique d'un export à l'autre
    c.sessions.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return c;
  };
  const a = normaliser(export1), b = normaliser(export2);
  assert(JSON.stringify(a) === JSON.stringify(b), 'l\'aller-retour n\'est pas canonique');
  assert(b.planNotes === 'note de test', 'la note du plan n\'a pas été restaurée (BUG-006)');
  assert(b.planYear === 2027, 'l\'année du plan n\'a pas été restaurée (BUG-006)');
  assert(b.schemaVersion === a.schemaVersion, 'la version de schéma n\'est pas conservée');
  return { schemaVersion: b.schemaVersion, seances: b.sessions.length, cles: Object.keys(b).sort() };
});

await test('P1-10b', 'Sauvegarde — un index refusé pendant la restauration ne laisse aucune séance inaccessible', () => {
  const iso = loadApp();
  iso.localStorage.refuseKey = 'trail:index';
  const res = iso.restoreBackupPayload({
    sessions: [
      { id: 'a', date: '2026-08-20', sport: 'Trail', distanceKm: 5 },
      { id: 'b', date: '2026-08-21', sport: 'Trail', distanceKm: 6 },
    ],
    profile: { nom: 'N' },
  }, { sessionsMode: 'merge' });
  assert(iso.loadIndex().length === 0, "l'index a été modifié alors que son écriture était refusée");
  assert(iso.loadSession('a') === null && iso.loadSession('b') === null, 'des séances inaccessibles ont été laissées en stockage');
  assert(res.added === 0 && res.failed === 2, 'le décompte ne reflète pas l\'échec : ' + JSON.stringify({ added: res.added, failed: res.failed }));
  assert(iso.getProfile().nom === 'N', 'le reste de la restauration aurait dû aboutir');
  assert(iso.checkDataIntegrity().ok === true, 'incohérence laissée après un échec de restauration');
  return { added: res.added, failed: res.failed, erreurs: res.errors.length };
});

await test('P1-11', 'Sauvegarde — clé ABSENTE vs PRÉSENTE ET VIDE (BUG-007)', () => {
  // Présente et vide : la suppression doit se propager.
  const a = loadApp();
  a.saveRaces([{ id: 'r1', name: 'Mafate' }]);
  a.restoreBackupPayload({ races: [] }, { sessionsMode: 'merge' });
  assert(a.getRaces().length === 0, 'un tableau de courses vide ne remplace toujours pas la liste locale');

  // Absente : rien ne doit changer.
  const b = loadApp();
  b.saveRaces([{ id: 'r1', name: 'Mafate' }]);
  b.restoreBackupPayload({ profile: { nom: 'X' } }, { sessionsMode: 'merge' });
  assert(b.getRaces().length === 1, 'une clé absente a modifié les courses locales');

  // Mauvais type : ignorée ET signalée, jamais devinée.
  const c = loadApp();
  c.saveRaces([{ id: 'r1', name: 'Mafate' }]);
  const res = c.restoreBackupPayload({ races: 'oui', profile: { nom: 'X' } }, { sessionsMode: 'merge' });
  assert(c.getRaces().length === 1, 'une valeur invalide a écrasé les courses');
  assert(res.ignored.includes('races'), 'la valeur invalide n\'est pas signalée');

  // Plan présent et nul : effacement réel.
  const d = loadApp();
  d.savePlan([{ date: '2026-08-25' }]);
  d.restoreBackupPayload({ plan: null }, { sessionsMode: 'merge' });
  assert(d.getPlan() === null, 'un plan effacé ne se propage pas');
  return { videApplique: true, absenteIgnoree: true, invalideSignalee: res.ignored };
});

await test('P1-11b', 'Sauvegarde — un export d\'une version PLUS RÉCENTE est refusé proprement', () => {
  const iso = loadApp();
  iso.saveRaces([{ id: 'r1', name: 'Mafate' }]);
  const res = iso.restoreBackupPayload({ schemaVersion: 999, races: [] }, { sessionsMode: 'merge' });
  assert(res.ok === false, 'un schéma inconnu a été appliqué');
  assert(/plus récente/i.test(res.reason), 'le motif de refus n\'est pas explicite : ' + res.reason);
  assert(iso.getRaces().length === 1, 'des données ont été modifiées malgré le refus');
  return { reason: res.reason };
});

await test('P1-11c', 'Sauvegarde — un export ANCIEN (sans schemaVersion) reste accepté', () => {
  const iso = loadApp();
  const res = iso.restoreBackupPayload({ races: [{ id: 'r1', name: 'Mafate' }], profile: { nom: 'N' } }, { sessionsMode: 'merge' });
  assert(res.ok === true, 'un export antérieur au versionnement est refusé');
  assert(res.schemaVersion === 0, 'l\'absence de version devrait être rapportée comme 0');
  assert(iso.getRaces().length === 1, 'les courses n\'ont pas été restaurées');
  return { schemaVersion: res.schemaVersion, applied: res.applied };
});

await test('P1-11d', 'Sauvegarde — la page Paramètres utilise bien la restauration partagée (TECH-001)', () => {
  const bloc = settingsSource.slice(
    settingsSource.indexOf("document.getElementById('importFileInput').addEventListener('change'"),
    settingsSource.indexOf("document.getElementById('resetBtn').addEventListener")
  );
  assert(bloc.includes('restoreBackupPayload'), 'l\'import manuel a encore sa propre logique');
  assert(!bloc.includes('Array.isArray(data.races) && data.races.length'), 'la condition fautive de BUG-007 est encore présente');
  return { moteurPartage: true };
});

await test('P1-12', 'Réinitialisation — toutes les clés de données partent, y compris notes et année (BUG-009)', () => {
  const iso = loadApp();
  seedSession(iso, { id: 's1', date: '2026-08-20', sport: 'Trail', distanceKm: 5 });
  iso.savePlan([{ date: '2026-08-25' }]);
  iso.saveRaces([{ id: 'r1', name: 'Mafate' }]);
  iso.saveProfile({ nom: 'N' });
  iso.saveGear([{ id: 'g1', nom: 'X' }]);
  iso.savePlanNotes('note');
  iso.savePlanYear(2027);
  iso.localStorage.setItem('trail:theme', 'light');
  iso.localStorage.setItem('trail:supabaseUrl', 'https://exemple.supabase.co');
  iso.suspendSync();
  iso.resetLocalData();
  const restantes = [...iso.localStorage._map.keys()].filter(k => k.startsWith('trail:'));
  assert(!restantes.includes('trail:planNotes'), 'trail:planNotes survit à la réinitialisation');
  assert(!restantes.includes('trail:planYear'), 'trail:planYear survit à la réinitialisation');
  assert(!restantes.some(k => k.startsWith('trail:seance:')), 'des séances survivent');
  assert(restantes.includes('trail:theme'), 'le thème (préférence d\'affichage) ne devrait pas être effacé');
  assert(restantes.includes('trail:supabaseUrl'), 'la configuration Supabase ne doit pas être effacée : elle donne accès à la copie cloud');
  return { restantes };
});

await test('P1-13a', 'Dates — la date civile d\'une séance suit le fuseau, pas UTC (BUG-005)', () => {
  const instant = new Date('2026-08-21T21:00:00Z'); // 22 août 01:00 à Maurice
  assert(app.localDateISO(instant, 'Indian/Mauritius') === '2026-08-22', 'Maurice (UTC+4) mal calculé');
  assert(app.localDateISO(instant, 'UTC') === '2026-08-21', 'UTC mal calculé');
  assert(app.localDateISO(instant, 'Pacific/Honolulu') === '2026-08-21', 'Honolulu (UTC-10) mal calculé');
  // Le fuseau de l'ACTIVITÉ, quand le fichier .fit le porte, prime sur celui du navigateur.
  assert(app.civilDateFromOffset(instant, 4 * 3600) === '2026-08-22', 'décalage +4h mal appliqué');
  assert(app.civilDateFromOffset(instant, -10 * 3600) === '2026-08-21', 'décalage -10h mal appliqué');
  assert(app.civilDateFromOffset(new Date('2026-08-21T21:00:00Z'), 0) === '2026-08-21', 'décalage nul mal appliqué');
  return {
    utc: app.localDateISO(instant, 'UTC'),
    maurice: app.localDateISO(instant, 'Indian/Mauritius'),
    honolulu: app.localDateISO(instant, 'Pacific/Honolulu'),
  };
});

await test('P1-13b', 'Dates — frontières de jour, semaine, mois et année', () => {
  const cas = [
    ['2026-12-31T20:30:00Z', 'Indian/Mauritius', '2027-01-01'],   // changement d'année
    ['2026-01-01T02:00:00Z', 'Pacific/Honolulu', '2025-12-31'],   // recul d'année
    ['2026-08-31T21:30:00Z', 'Indian/Mauritius', '2026-09-01'],   // changement de mois
    ['2026-08-23T20:00:00Z', 'Indian/Mauritius', '2026-08-24'],   // dimanche soir -> lundi
  ];
  cas.forEach(([iso, tz, attendu]) => {
    const got = app.localDateISO(new Date(iso), tz);
    assert(got === attendu, iso + ' en ' + tz + ' : ' + got + ' au lieu de ' + attendu);
  });
  // La semaine ISO du lundi obtenu doit bien être ce lundi.
  assert(app.isoWeek('2026-08-24') === '2026-08-24', 'semaine ISO incorrecte sur un lundi');
  assert(app.isoWeek('2026-08-23') === '2026-08-17', 'semaine ISO incorrecte sur un dimanche');
  return { cas: cas.length };
});

await test('P1-13c', 'Dates — plus aucun `new Date().toISOString().slice(0,10)` comme date du jour', () => {
  const fichiers = ['assets/app.js', 'index.html', 'historique.html', 'activite.html', 'analyse.html',
    'objectifs.html', 'plan.html', 'profil.html', 'equipements.html', 'parametres.html'];
  const fautifs = [];
  fichiers.forEach(f => {
    const txt = fs.readFileSync(path.join(root, f), 'utf8');
    if (/new Date\(\)\.toISOString\(\)\.slice\(0,\s?10\)/.test(txt)) fautifs.push(f);
    if (/setDate\(\s*\w+\.getDate\(\)\s*[-+]/.test(txt)) fautifs.push(f + ' (setDate local)');
  });
  assert(fautifs.length === 0, 'date UTC utilisée comme date civile dans : ' + fautifs.join(', '));
  assert(/^\d{4}-\d{2}-\d{2}$/.test(app.todayISO()), 'todayISO() ne renvoie pas une date ISO');
  return { fichiersControles: fichiers.length };
});

await test('P1-13e', 'Pages — aucune variable locale ne masque une fonction partagée', () => {
  /* Défaut réellement rencontré en vérifiant le rendu : remplacer
     `const todayISO = new Date().toISOString().slice(0,10)` par `todayISO()` a produit
     `const todayISO = todayISO();`, une auto-référence qui lève une ReferenceError de zone morte
     temporelle et laissait Objectifs et Plan à moitié rendues, SANS que la syntaxe soit fautive
     ni qu'aucun test node ne le voie. Ce contrôle statique couvre cette classe d'erreur. */
  const pages = fs.readdirSync(root).filter(n => n.endsWith('.html'));
  const fautifs = [];
  const auto = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\1\s*\(/g;
  pages.forEach(p => {
    const txt = fs.readFileSync(path.join(root, p), 'utf8');
    let m;
    auto.lastIndex = 0;
    while ((m = auto.exec(txt)) !== null) fautifs.push(p + ' : ' + m[1]);
  });
  assert(fautifs.length === 0, 'déclaration auto-référente : ' + fautifs.join(', '));
  return { pagesControlees: pages.length };
});

await test('P1-13d', 'Dates — agrégats cohérents : la même séance tombe dans la même semaine partout', () => {
  const iso = loadApp();
  const jours = ['2026-08-17', '2026-08-19', '2026-08-23', '2026-08-24'];
  jours.forEach((d, i) => seedSession(iso, { id: 's' + i, date: d, sport: 'Trail', distanceKm: 10, durationS: 3600 }));
  const semaines = iso.groupByWeek(iso.loadAllSessions());
  const parSemaine = Object.fromEntries(semaines.map(w => [w.startISO, w.count]));
  assert(parSemaine['2026-08-17'] === 3, 'regroupement hebdomadaire incorrect : ' + JSON.stringify(parSemaine));
  assert(parSemaine['2026-08-24'] === 1, 'regroupement hebdomadaire incorrect : ' + JSON.stringify(parSemaine));
  return { parSemaine };
});

await test('P1-15a', 'Messages — du HTML dans un message reste du TEXTE (RISK-001)', () => {
  const iso = loadApp();
  const zone = iso.document.createElement('div');
  iso.document._registry.set('msg', zone);
  const hostile = '<img src=x onerror="alert(1)"> & <b>gras</b>';
  iso.showMsg('msg', hostile, 'err');
  const rendu = zone.innerHTML;
  assert(!/<img/i.test(rendu), 'une balise img a été créée : ' + rendu);
  assert(!/<b>/i.test(rendu), 'une balise b a été créée : ' + rendu);
  assert(rendu.includes('&lt;img'), 'le texte n\'a pas été échappé : ' + rendu);
  assert(zone.children[0].textContent === hostile, 'le texte affiché ne correspond pas au message');
  return { rendu: rendu.slice(0, 120) };
});

await test('P1-15b', 'Messages — accessibilité et classes préservées ; `kind` sur liste fermée', () => {
  const iso = loadApp();
  const zone = iso.document.createElement('div');
  iso.document._registry.set('msg', zone);
  iso.showMsg('msg', 'Import terminé', 'ok');
  const box = zone.children[0];
  assert(box.className === 'msg ok', 'classe inattendue : ' + box.className);
  assert(box.getAttribute('role') === 'status', 'role=status perdu');
  assert(box.getAttribute('aria-live') === 'polite', 'aria-live perdu');
  iso.showMsg('msg', 'x', 'onmouseover=alert(1)');
  assert(zone.children[0].className === 'msg info', 'un `kind` arbitraire devient un nom de classe : ' + zone.children[0].className);
  return { classeOk: 'msg ok', kindInvalide: 'msg info' };
});

await test('P1-15c', 'Messages — un nom de fichier ou une erreur Supabase ne peut pas injecter de balise', () => {
  const iso = loadApp();
  const zone = iso.document.createElement('div');
  iso.document._registry.set('msg', zone);
  ['<script>alert(1)</script>.fit', 'PGRST301: <svg onload=alert(1)>', 'fichier "test" & co'].forEach(t => {
    iso.showMsg('msg', t, 'err');
    assert(!/<(script|svg)/i.test(zone.innerHTML), 'injection possible avec : ' + t);
  });
  return { cas: 3 };
});

await test('P1-16', 'Contraste — le repère actif du rail mobile atteint 4,5:1 en thème clair (A11Y-001)', () => {
  const lire = nom => {
    const m = new RegExp('--' + nom + ':\\s*(#[0-9A-Fa-f]{6})').exec(cssSource);
    return m ? m[1] : null;
  };
  const accent = lire('rail-accent');
  const fond = lire('rail-bg-top');
  assert(accent && fond, 'jetons --rail-accent / --rail-bg-top introuvables');
  const lum = h => {
    const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const l1 = lum(accent), l2 = lum(fond);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  assert(ratio >= 4.5, 'contraste insuffisant : ' + ratio.toFixed(2) + ':1');
  // Le rail ne doit plus consommer le jeton d'accent thématisé.
  const railRules = cssSource.split('\n').filter(l => /\.mobile-nav (a|button)\.active/.test(l));
  assert(railRules.length > 0, 'règles du rail mobile introuvables');
  assert(!railRules.some(l => l.includes('var(--accent-light)')), 'le rail consomme encore --accent-light');
  return { accent, fond, ratio: Number(ratio.toFixed(2)), reglesControlees: railRules.length };
});

/* =========================================================================
   SÉCURITÉ ET ROBUSTESSE (RISK-002 / RISK-003)
   ========================================================================= */

await test('R2-a', 'Secret — aucune clé Anthropic n\'est lue, écrite ni exportée (RISK-002)', () => {
  const iso = loadApp({ seed: { 'trail:apikey': 'sk-ant-secret-de-test' } });
  assert(iso.localStorage.getItem('trail:apikey') === null, 'la clé héritée n\'a pas été effacée au chargement');
  assert(iso.legacyApiKeyWasPurged() === true, 'la purge n\'est pas signalée à l\'interface');
  assert(typeof iso.getApiKey === 'undefined', 'getApiKey() existe encore');
  const payload = JSON.stringify(iso.buildExportPayload());
  assert(!payload.includes('sk-ant'), 'un secret figure dans l\'export');
  assert(!payload.includes('apikey'), 'la clé API figure dans l\'export');
  return { purgee: true, exportSansSecret: true };
});

await test('R2-b', 'Secret — plus aucun appel direct à l\'API Anthropic depuis le navigateur (RISK-002)', () => {
  const fichiers = fs.readdirSync(root).filter(n => /\.(html|js)$/i.test(n))
    .concat(['assets/app.js', 'assets/authgate.js']);
  const fautifs = [];
  fichiers.forEach(f => {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) return;
    const txt = fs.readFileSync(p, 'utf8');
    // On ignore les commentaires qui documentent la correction.
    const lignes = txt.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
    if (lignes.some(l => l.includes('api.anthropic.com') || l.includes("'x-api-key'"))) fautifs.push(f);
  });
  assert(fautifs.length === 0, 'appel direct encore présent dans : ' + fautifs.join(', '));
  assert(fs.existsSync(path.join(root, 'supabase', 'functions', 'ai-proxy', 'index.ts')), 'la façade serveur est absente');
  return { fichiersControles: fichiers.length };
});

await test('R3-a', 'IA — un appel sans réponse est interrompu par un délai maximal (RISK-003)', async () => {
  // fetch qui ne répond jamais, mais qui HONORE le signal d'annulation comme le fait un vrai
  // navigateur : c'est ce qui permet de vérifier que le délai maximal vient bien du produit.
  const iso = loadApp({
    fetch: (url, opts) => new Promise((_, rej) => {
      const t = setTimeout(() => rej(new Error('jamais atteint')), 5000);
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', () => {
          clearTimeout(t);
          rej(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      }
    }),
  });
  installFakeSupabase(iso, makeFakeSupabase({}));
  iso.saveSupabaseConfig('https://exemple.supabase.co', 'anon-test');
  const t0 = Date.now();
  const res = await iso.callElevAi({ task: 'coach-seance', message: 'test', timeoutMs: 300 });
  const duree = Date.now() - t0;
  assert(res.ok === false && res.reason === 'timeout', 'le délai maximal n\'a pas été appliqué : ' + JSON.stringify(res));
  assert(duree < 2000, 'l\'appel a duré ' + duree + ' ms malgré un délai de 300 ms');
  return { reason: res.reason, dureeMs: duree };
});

await test('R3-b', 'IA — 401, 429, 5xx, réponse vide et réseau coupé rendent tous un état stable', async () => {
  const cas = [
    { status: 401, body: '{"error":"jwt expired"}', attendu: 'unauthorized' },
    { status: 404, body: '{}', attendu: 'not-deployed' },
    { status: 429, body: '{"error":"rate limit"}', attendu: 'rate-limited' },
    { status: 500, body: '{"error":"boom"}', attendu: 'server-error' },
    { status: 200, body: '{"text":"   "}', attendu: 'empty' },
    { status: 200, body: 'pas du json', attendu: 'empty' },
  ];
  const out = [];
  for (const c of cas) {
    const iso = loadApp({ fetch: async () => ({ ok: c.status < 400, status: c.status, text: async () => c.body }) });
    installFakeSupabase(iso, makeFakeSupabase({}));
    iso.saveSupabaseConfig('https://exemple.supabase.co', 'anon-test');
    const res = await iso.callElevAi({ task: 'coach-seance', message: 'test' });
    assert(res.ok === false, 'statut ' + c.status + ' traité comme un succès');
    assert(res.reason === c.attendu, 'statut ' + c.status + ' : motif ' + res.reason + ' au lieu de ' + c.attendu);
    assert(typeof res.message === 'string' && res.message.length > 10, 'message non actionnable pour ' + c.status);
    out.push({ status: c.status, reason: res.reason });
  }
  const reseau = loadApp({ fetch: async () => { throw new Error('Failed to fetch'); } });
  installFakeSupabase(reseau, makeFakeSupabase({}));
  reseau.saveSupabaseConfig('https://exemple.supabase.co', 'anon-test');
  const r = await reseau.callElevAi({ task: 'coach-seance', message: 'test' });
  assert(r.ok === false && r.reason === 'network', 'réseau coupé mal traité : ' + JSON.stringify(r));
  out.push({ status: 'réseau', reason: r.reason });
  return out;
});

await test('R3-c', 'IA — sans configuration ni session, le produit dit quoi faire au lieu d\'échouer', async () => {
  const sansConfig = loadApp();
  const a = await sansConfig.callElevAi({ task: 'coach-seance', message: 'x' });
  assert(a.reason === 'not-configured' && /Paramètres/.test(a.message), 'message inutilisable : ' + JSON.stringify(a));

  const sansSession = loadApp({ fetch: async () => ({ ok: true, status: 200, text: async () => '{"text":"ok"}' }) });
  const client = makeFakeSupabase({});
  client.auth.getSession = async () => ({ data: { session: null } });
  installFakeSupabase(sansSession, client);
  sansSession.saveSupabaseConfig('https://exemple.supabase.co', 'anon-test');
  const b = await sansSession.callElevAi({ task: 'coach-seance', message: 'x' });
  assert(b.reason === 'not-logged-in', 'session absente mal détectée : ' + JSON.stringify(b));

  const mauvaisUsage = loadApp();
  const c = await mauvaisUsage.callElevAi({ task: 'usage-inconnu', message: 'x' });
  assert(c.reason === 'bad-request', 'un usage inconnu devrait être refusé côté client aussi');
  return { sansConfig: a.reason, sansSession: b.reason, usageInconnu: c.reason };
});

await test('R3-d', 'IA — un appel réussi renvoie le texte, sans secret dans la requête', async () => {
  let requete = null;
  const iso = loadApp({
    fetch: async (url, opts) => { requete = { url, opts }; return { ok: true, status: 200, text: async () => '{"text":"Analyse de la séance."}' }; },
  });
  installFakeSupabase(iso, makeFakeSupabase({}));
  iso.saveSupabaseConfig('https://exemple.supabase.co', 'anon-test');
  const res = await iso.callElevAi({ task: 'coach-seance', system: 'sys', message: 'msg' });
  assert(res.ok === true && res.text === 'Analyse de la séance.', 'réponse inattendue : ' + JSON.stringify(res));
  assert(requete.url.endsWith('/functions/v1/ai-proxy'), 'la requête ne vise pas la façade serveur : ' + requete.url);
  assert(!('x-api-key' in requete.opts.headers), 'un en-tête x-api-key est encore envoyé');
  assert(requete.opts.headers.authorization === 'Bearer jeton-test', 'la requête n\'est pas authentifiée');
  assert(!/sk-ant/.test(requete.opts.body), 'un secret circule dans le corps de la requête');
  return { url: requete.url, entetes: Object.keys(requete.opts.headers) };
});

/* =========================================================================
   NON-RÉGRESSION DES COMPORTEMENTS DÉJÀ CONFORMES
   ========================================================================= */

await test('OK-1', 'CSV réel : 84 séances reconnues', () => {
  const csv = fs.readFileSync(path.join(root, 'plan-trail-nico.csv'), 'utf8');
  const plan = app.parsePlanCsv(csv);
  assert(plan.length === 84, `84 attendues, ${plan.length} obtenues`);
  assert(plan.every(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date)), 'Date ISO absente');
  return { count: plan.length, first: plan[0].date, last: plan.at(-1).date };
});

await test('OK-2', 'CSV alternatif : accents, virgule décimale, point-virgule', () => {
  const csv = 'Date (JJ/MM/AAAA);Type;Distance;D+;Durée totale;Objectif\n22/08/2026;Côtes;≈9,5 km;≈250 m;1h15;Test';
  const plan = app.parsePlanCsv(csv);
  assert(plan.length === 1 && plan[0].distanceKm === 9.5 && plan[0].deniveleM === 250, 'ligne mal analysée');
  return plan[0];
});

await test('OK-3', 'CSV vide : repli propre', () => {
  const plan = app.parsePlanCsv('  \n');
  assert(Array.isArray(plan) && plan.length === 0, 'Tableau vide attendu');
  return { length: 0 };
});

await test('OK-4', 'Aller-retour Supabase d\'une séance : aucun champ détruit', () => {
  const seance = {
    id: 's1', date: '2026-08-22', sport: 'Trail', distanceKm: 12.3, durationS: 5400,
    ascent: 700, descent: 690, avgHr: 142, maxHr: 171, avgPaceSecPerKm: 439,
    gearId: 'g1', contexte: 'jambes lourdes', aiFeedback: 'retour',
    fileName: 'sortie.fit', importedAt: '2026-08-22T06:00:00Z', dateApprox: false,
    startedAt: '2026-08-22T02:00:00Z', utcOffsetS: 14400, identityKey: 'abc123', fileHash: 'zz-1234',
    series: [{ t: 0, alt: 100 }], laps: [], events: [], devices: [], raw: {},
  };
  const row = app.sessionToActivityRow(seance, 'user-test', 'user-test/s1.fit');
  const retour = app.activityRowToSession(row);
  const perdus = Object.keys(seance).filter(k => {
    const v = seance[k];
    if (v === false || v === '' || (Array.isArray(v) && !v.length)) return false; // valeurs vides, non concernées
    // `raw` est volontairement enrichi au passage (il transporte les champs sans colonne dédiée) :
    // on vérifie plus bas qu'il ne PERD rien, pas qu'il reste identique.
    if (k === 'raw') return false;
    return JSON.stringify(retour[k]) !== JSON.stringify(v);
  });
  assert(perdus.length === 0, 'champs perdus à l\'aller-retour : ' + perdus.join(', '));
  assert(row.context === 'jambes lourdes', 'la note de contexte n\'atteint pas la colonne `context`');

  // Second aller-retour : une valeur périmée logée dans `raw` ne doit pas écraser la valeur fraîche.
  const modifiee = Object.assign({}, retour, { contexte: 'nouvelle note', fileName: 'renomme.fit' });
  const row2 = app.sessionToActivityRow(modifiee, 'user-test', 'user-test/s1.fit');
  const retour2 = app.activityRowToSession(row2);
  assert(retour2.contexte === 'nouvelle note', 'la note modifiée est écrasée par une valeur périmée');
  assert(retour2.fileName === 'renomme.fit', 'le nom de fichier modifié est écrasé par une valeur périmée');
  assert(retour2.identityKey === 'abc123' && retour2.fileHash === 'zz-1234', 'identité ou empreinte perdue au second aller-retour');
  return { champsPerdus: perdus, secondAllerRetour: 'stable' };
});

await test('OK-5', 'Le payload de synchronisation ne contient plus les séances (un seul propriétaire)', () => {
  const iso = loadApp();
  seedSession(iso, { id: 's1', date: '2026-08-22', sport: 'Trail', distanceKm: 5 });
  const sync = iso.buildSyncPayload();
  const exp = iso.buildExportPayload();
  assert(!('sessions' in sync), 'les séances sont revenues dans le payload cloud : deux écrivains concurrents');
  assert(Array.isArray(exp.sessions) && exp.sessions.length === 1, 'l\'export manuel doit rester complet');
  return { clesSync: Object.keys(sync).sort(), seancesExport: exp.sessions.length };
});

/* Ce test affirmait l'inverse jusqu'au 22 août 2026 : il constatait l'ABSENCE de service worker,
   défaut P2-10 de l'audit produit, et portait la mention « mettre ce constat à jour » une fois
   traité. Décision utilisateur : tenir la promesse d'application installable. L'invariant est donc
   retourné — c'est désormais la disparition du mode hors ligne qui doit faire échouer la suite. */
await test('OK-6', 'PWA : le mode hors ligne existe réellement (service worker enregistré)', () => {
  const swPath = path.join(root, 'sw.js');
  assert(fs.existsSync(swPath), 'sw.js a disparu : la promesse « application installable » redevient creuse');
  const sw = fs.readFileSync(swPath, 'utf8');
  assert(/CACHE_NAME/.test(sw) && /addEventListener\('fetch'/.test(sw), 'le service worker ne gère pas les requêtes');
  assert(/mode === 'navigate'/.test(sw), 'les navigations doivent être traitées à part (réseau d\'abord)');
  assert(/serviceWorker\.register/.test(source), 'plus personne n\'enregistre le service worker');
  // Les tuiles de carte ne doivent JAMAIS être mises en cache : ce sont des données tierces que
  // l'utilisateur n'a pas demandé de stocker.
  assert(/estInterne/.test(sw), 'le service worker ne distingue plus les ressources internes des tierces');
  return { offlineCache: true, cacheName: (sw.match(/CACHE_NAME = '([^']+)'/) || [])[1] };
});

/* =========================================================================
   SUITE ELEV 2.0 — les quinze garde-fous exigés par l'audit produit
   (AUDIT-PRODUIT-ELEV-2-0-2026-08-22.md, §12 « tests à ajouter » et §6.3).

   Chaque test énonce une propriété que le produit doit tenir. Il échoue si le
   défaut correspondant réapparaît. Un test qui ne peut pas être exécuté ici
   (réseau réel) reste absent plutôt que simulé en vert.
   ========================================================================= */

/* Jeu de séances déterministe : douze semaines, une séance par semaine, avec altitude,
   FC et cadence. Sert de base commune aux tests de tendance et de couverture. */
function seedHistorique(iso, opts) {
  opts = opts || {};
  const semaines = opts.semaines != null ? opts.semaines : 12;
  const aujourdhui = iso.todayISO();
  for (let i = semaines - 1; i >= 0; i--) {
    const date = iso.addDaysIso(aujourdhui, -i * 7);
    const series = [];
    for (let t = 0; t <= 60; t++) {
      series.push({
        t: t * 30, distKm: t * 0.1, alt: 200 + t * 5,
        hr: opts.sansFc ? null : 140,
        cadenceSpm: opts.sansCadence ? null : 160,
      });
    }
    seedSession(iso, {
      id: 'h' + i, date, sport: 'Trail',
      distanceKm: opts.km != null ? opts.km : 30,
      ascent: 800, descent: 800, durationS: 1800, avgHr: 140, series,
    });
  }
}

await test('E20-1', 'Deux courses ne partagent pas automatiquement la même préparation spécifique', () => {
  const iso = loadApp();
  seedHistorique(iso);
  const aujourdhui = iso.todayISO();
  iso.saveRaces([
    { id: 'a', name: 'Course A', date: iso.addDaysIso(aujourdhui, 60), distanceKm: 50, denivele: 3000, statut: 'principal' },
    { id: 'b', name: 'Course B', date: iso.addDaysIso(aujourdhui, 90), distanceKm: 30, denivele: 1500, statut: 'secondaire' },
  ]);
  iso.savePlan([{ date: iso.addDaysIso(aujourdhui, -7), distanceKm: 30, deniveleM: 800 }]);
  iso.savePlanGoalId('a');
  const a = iso.computeRaceReadiness(iso.getRaces()[0]);
  const b = iso.computeRaceReadiness(iso.getRaces()[1]);
  assert(a.scope === 'race', 'la course à laquelle le plan est lié doit recevoir une préparation spécifique');
  assert(b.scope === 'general', "une course SANS plan lié ne doit jamais être présentée comme spécifiquement préparée");
  assert(/générale/i.test(b.scopeLabel), 'la portée générale doit être dite en toutes lettres');
  return { a: a.scope, b: b.scope, labelB: b.scopeLabel };
});

await test('E20-2', 'Un dépassement du plan ne produit pas une préparation parfaite', () => {
  const iso = loadApp();
  // 152 % de la cible : c'est le chiffre relevé par l'audit (P0-2).
  const aligne = iso.planAlignment(100);
  const depassement = iso.planAlignment(120);
  const divergence = iso.planAlignment(152);
  assert(aligne.score === 100, 'atteindre la cible doit valoir 100');
  assert(depassement.score < 100, 'dépasser la cible ne peut pas valoir autant que l\'atteindre');
  assert(divergence.score === null, 'au-delà du seuil de divergence, l\'adéquation ne doit plus être notée du tout');
  assert(divergence.diverging === true, 'la divergence doit être signalée explicitement');
  // Et le libellé ne peut pas annoncer une excellente préparation pendant ce temps.
  const libelle = iso.readinessLevelLabel(95, { diverging: true, scope: 'race' });
  assert(!/excellente/i.test(libelle), 'jamais « Excellente préparation » en même temps qu\'une divergence');

  /* Ajouté après coup, sur un défaut que ce test NE VOYAIT PAS et qui n'est apparu qu'en regardant
     la page rendue : les sous-scores en divergence passent à `null`, ils sortaient donc de la
     moyenne, qui remontait à 95 % sur les seules dimensions restantes. La divergence FAISAIT MONTER
     la note, et un anneau vert à 95 % s'affichait sous « Écart important avec le plan ».
     On vérifie donc le bout de la chaîne, pas seulement planAlignment() isolément. */
  seedHistorique(iso, { km: 46 });                 // réalisé très au-dessus du plan
  iso.saveRaces([{ id: 'd', name: 'Course', date: iso.addDaysIso(iso.todayISO(), 28), distanceKm: 50, denivele: 3000, statut: 'principal' }]);
  const planDivergent = [];
  for (let i = 1; i <= 4; i++) planDivergent.push({ date: iso.addDaysIso(iso.todayISO(), -i * 7), distanceKm: 10, deniveleM: 200 });
  iso.savePlan(planDivergent);
  iso.savePlanGoalId('d');
  const rd = iso.computeRaceReadiness(iso.getRaces()[0]);
  assert(rd.diverging === true, 'le jeu de test doit bien produire une divergence, sinon ce test ne prouve rien');
  assert(rd.overall === null, "AUCUN indice global en cas de divergence — l'ecarter du calcul revenait a la recompenser");
  assert(typeof rd.unscoredWhy === 'string' && /ecarte|écarte/i.test(rd.unscoredWhy), 'le non-calcul doit nommer la divergence');
  return { aligne: aligne.score, depassement: depassement.score, divergence: divergence.score, libelle, overallEnDivergence: rd.overall };
});

await test('E20-3', 'Deux séances ne suffisent pas à établir une tendance', () => {
  const iso = loadApp();
  seedSession(iso, { id: 'x1', date: iso.addDaysIso(iso.todayISO(), -3), sport: 'Trail', distanceKm: 10 });
  seedSession(iso, { id: 'x2', date: iso.todayISO(), sport: 'Trail', distanceKm: 12 });
  const t = iso.getTrainingTrend();
  assert(t && t.available === false, 'une tendance ne doit pas être produite à partir de deux séances');
  assert(typeof t.reason === 'string' && t.reason.length > 0, 'le refus doit porter sa raison, pas disparaître en silence');
  return { available: t.available, reason: t.reason };
});

await test('E20-4', 'Moins de quatre semaines couvertes bloque la tendance', () => {
  const iso = loadApp();
  seedHistorique(iso, { semaines: 3 });
  const t = iso.getTrainingTrend();
  assert(t.available === false, 'trois semaines ne suffisent pas');
  const hist = iso.elevHistoryCoverage([10, 10, 10]);
  assert(hist.enoughForTrend === false, 'elevHistoryCoverage doit refuser 3 semaines');
  const ok = iso.elevHistoryCoverage([10, 10, 10, 10]);
  assert(ok.enoughForTrend === true, 'quatre semaines non vides doivent suffire');
  return { troisSemaines: t.reason };
});

await test('E20-5', 'Une référence incomplète bloque les deltas trompeurs', () => {
  const iso = loadApp();
  const courant = { distanceKm: 200, ascent: 6000, durationS: 72000, vamAvg: 700, count: 12 };
  const precedent = { distanceKm: 20, ascent: 400, durationS: 7200, vamAvg: 600, count: 1 };
  // 84 jours de période courante, mais seulement 10 jours réellement documentés avant.
  const bloque = iso.comparePeriods(courant, precedent, { currentDays: 84, previousCoveredDays: 10 });
  assert(bloque.comparable === false, 'une référence couvrant 12 % de la période ne doit pas produire de delta');
  assert(bloque.deltas.distanceKm === null, 'aucun pourcentage ne doit être calculé sur une référence incomplète');
  assert(/incomplet/i.test(bloque.baseline.reason), 'la raison doit nommer l\'historique incomplet');
  // Avec une couverture suffisante, la comparaison redevient légitime.
  const ok = iso.comparePeriods(courant, precedent, { currentDays: 84, previousCoveredDays: 80 });
  assert(ok.comparable === true && ok.deltas.distanceKm !== null, 'une référence complète doit rester comparable');
  return { bloque: bloque.baseline.reason, deltaOk: ok.deltas.distanceKm };
});

await test('E20-6', 'Montée et descente sont distinctes (fin de la valeur absolue)', () => {
  const iso = loadApp();
  const bandes = iso.TERRAIN_GRADE_BANDS;
  const dirs = new Set(bandes.map(b => b.dir));
  assert(dirs.has('up') && dirs.has('down') && dirs.has('flat'), 'les trois directions doivent exister');
  // Une pente de -12 % et une pente de +12 % ne peuvent pas tomber dans la même bande.
  const iDown = iso.terrainBandIndex(-12), iUp = iso.terrainBandIndex(12);
  assert(iDown !== iUp, 'une descente et une montée de même inclinaison ne doivent pas partager une bande');
  assert(bandes[iDown].dir === 'down' && bandes[iUp].dir === 'up', 'le signe doit décider de la direction');
  // Et sur une vraie séance : la répartition porte une synthèse par direction.
  const session = { id: 'seg', date: iso.todayISO(), series: [] };
  for (let t = 0; t <= 200; t++) {
    session.series.push({ t: t * 10, distKm: t * 0.02, alt: t < 100 ? 200 + t * 4 : 600 - (t - 100) * 4, hr: 150, cadenceSpm: 150 });
  }
  const dist = iso.terrainGradeDistribution(session);
  const up = dist.byDir.find(d => d.dir === 'up'), down = dist.byDir.find(d => d.dir === 'down');
  assert(up.pct > 0 && down.pct > 0, 'une sortie qui monte puis descend doit montrer les deux directions');
  return { bandes: bandes.length, up: up.pct, down: down.pct };
});

await test('E20-7', 'Une couverture cadence insuffisante bloque l\'insight de locomotion', () => {
  const iso = loadApp();
  const faire = avecCadence => {
    const s = { id: 'c', date: iso.todayISO(), series: [] };
    for (let t = 0; t <= 200; t++) {
      s.series.push({
        t: t * 10, distKm: t * 0.02, alt: 200 + t * 4, hr: 150,
        // cadence présente sur 20 % du temps seulement dans le cas dégradé
        cadenceSpm: avecCadence ? 150 : (t < 40 ? 150 : null),
      });
    }
    return iso.terrainRunWalkByGrade(s);
  };
  const degrade = faire(false);
  assert(degrade.available === false, 'aucune conclusion course/marche sous 60 % de couverture cadence');
  assert(typeof degrade.coveragePct === 'number', 'la couverture doit être publiée, pas seulement le refus');
  assert(/cadence/i.test(degrade.reason), 'la raison doit nommer la cadence');
  const bon = faire(true);
  assert(bon.available === true && bon.coveragePct >= 60, 'une couverture suffisante doit débloquer l\'analyse');
  return { couvertureDegradee: degrade.coveragePct, couvertureBonne: bon.coveragePct };
});

await test('E20-8', 'Aucune pseudo-résistance physiologique sans comparaison d\'effort adaptée', () => {
  const iso = loadApp();
  // Sortie longue dont la FC monte, mais dont la vitesse et la pente varient : l'ancien calcul
  // (moyenne de FC de la 2e moitié vs la 1re) aurait produit une « résistance ». Le nouveau exige
  // des segments réellement comparables.
  const s = { id: 'd', date: iso.todayISO(), durationS: 7200, series: [] };
  for (let t = 0; t <= 400; t++) {
    const monte = t < 200;
    s.series.push({ t: t * 18, distKm: t * (monte ? 0.01 : 0.03), alt: monte ? 200 + t * 3 : 800 - (t - 200) * 3, hr: 130 + t * 0.15, cadenceSpm: 150 });
  }
  const d = iso.computeEffortDrift(s);
  if (d.available) {
    assert(typeof d.pairs === 'number' && d.pairs >= 2, 'une dérive publiée doit reposer sur au moins deux paires comparables');
    assert(typeof d.method === 'string' && /pente/i.test(d.method), 'la méthode doit dire qu\'elle contrôle la pente');
    assert(typeof d.limits === 'string' && d.limits.length > 0, 'les limites doivent être portées');
  } else {
    assert(typeof d.why === 'string' && d.why.length > 0, 'un refus doit être expliqué');
  }
  // Dans tous les cas, aucun axe « Résistance » ne subsiste dans le profil.
  /* Lu via computeTrailAptitude() plutôt que via la constante RADAR_AXES : un `const` de premier
     niveau n'appartient pas à l'objet global, il est donc invisible depuis ce contexte isolé. */
  const axes = iso.computeTrailAptitude([]).axes.map(a => a.key);
  assert(axes.indexOf('resistance') < 0, 'l\'axe « Résistance » à deux moyennes de FC ne doit pas revenir');
  return { available: d.available, why: d.why || null, pairs: d.pairs || null, axes };
});

await test('E20-9', 'Aucun conseil de récupération sans donnée de récupération', () => {
  const iso = loadApp();
  seedHistorique(iso);
  const ins = iso.generateElevInsight();
  if (ins && ins.action) {
    assert(!/r[ée]cup[ée]ration/i.test(ins.action), 'aucune action ne doit conseiller la récupération');
  }
  // Le garde-fou doit aussi refuser un insight fabriqué exprès.
  const interdit = iso.makeInsight({
    id: 'faux', family: 'load', observation: 'Charge en hausse.',
    action: 'Pense à surveiller ta récupération.', importance: 'attention', confidence: 'high',
  });
  const raison = iso.insightRejectionReason(interdit, { hasRecoveryData: false });
  assert(raison !== null, 'un conseil de récupération doit être refusé quand rien ne mesure la récupération');
  // Et aucun langage de prédiction de blessure ne doit passer.
  const blessure = iso.makeInsight({
    id: 'faux2', family: 'load', observation: 'Charge en hausse.',
    why: 'Cela augmente ton risque de blessure.', importance: 'attention', confidence: 'high',
  });
  assert(iso.insightRejectionReason(blessure, {}) !== null, 'aucune prédiction de blessure ne doit passer');
  return { raison, insightAction: ins && ins.action };
});

await test('E20-10', 'Aucun score global sous le minimum de dimensions fiables', () => {
  const iso = loadApp();
  // Compte quasiment vierge : une seule séance, pas de plan, pas de zones FC.
  seedSession(iso, { id: 'seul', date: iso.todayISO(), sport: 'Trail', distanceKm: 8 });
  iso.saveRaces([{ id: 'r', name: 'Course', date: iso.addDaysIso(iso.todayISO(), 60), distanceKm: 50, denivele: 3000, statut: 'principal' }]);
  const r = iso.computeRaceReadiness(iso.getRaces()[0]);
  if (r.dimensions < r.minDimensions) {
    assert(r.overall === null, 'aucun indice global ne doit être publié sous ' + r.minDimensions + ' dimensions fiables');
    assert(typeof r.unscoredWhy === 'string' && r.unscoredWhy.length > 0, 'le non-calcul doit être expliqué');
  }
  assert(r.subs.some(x => x.score === null), 'les sous-scores non calculables restent nuls, jamais des zéros');
  return { dimensions: r.dimensions, minimum: r.minDimensions, overall: r.overall, why: r.unscoredWhy };
});

await test('E20-11', 'Aucun insight de plan quand aucun plan n\'existe', () => {
  const iso = loadApp();
  seedHistorique(iso);
  iso.clearPlan();
  /* Depuis le passage au contrat commun (audit Insight V2, P0-A), getPlanInsights retourne un
     résultat de priorisation `{primary, secondary, dropped, rejected}` et non plus une liste de
     bullets. L'INVARIANT testé ici est inchangé : sans plan, aucune observation n'est publiée. */
  const sans = iso.getPlanInsights(iso.getPlan(), iso.loadAllSessions());
  const compte = r => (r.primary ? 1 : 0) + (r.secondary || []).length;
  assert(compte(sans) === 0,
    'la page Plan ne doit produire aucune observation sans plan (elle affichait une dynamique de charge)');
  // Avec un plan, les observations redeviennent possibles.
  iso.savePlan([{ date: iso.addDaysIso(iso.todayISO(), -3), distanceKm: 20, deniveleM: 600 }]);
  const avec = iso.getPlanInsights(iso.getPlan(), iso.loadAllSessions());
  assert(avec && 'primary' in avec, 'getPlanInsights doit rester utilisable avec un plan');
  return { sansPlan: compte(sans), avecPlan: compte(avec) };
});

await test('E20-12', 'Une donnée absente reste indisponible, jamais un zéro', () => {
  const iso = loadApp();
  // Séance sans cadence ni FC : les signaux concernés doivent être « indisponibles ».
  const s = { id: 'nu', date: iso.todayISO(), series: [] };
  for (let t = 0; t <= 60; t++) s.series.push({ t: t * 30, distKm: t * 0.1, alt: 200 + t * 5 });
  const cov = iso.elevSessionCoverage(s);
  assert(cov.signals.hr.provenance === 'unavailable', 'une FC absente doit être marquée indisponible');
  assert(cov.signals.hr.pct === null || cov.signals.hr.pct === 0, 'une FC absente ne doit pas produire de pourcentage inventé');
  assert(cov.signals.alt.level === 'high', 'une altitude complète doit être reconnue comme telle');
  // Un axe d'aptitude sans données doit être « indisponible », pas noté zéro.
  const apt = iso.computeTrailAptitude([]);
  assert(apt.axes.every(a => a.available === false && a.score === null),
    'sans séance, aucun axe ne doit porter de score — surtout pas 0');
  assert(apt.axes.every(a => typeof a.why === 'string' && a.why.length > 0), 'chaque axe indisponible doit dire pourquoi');
  return { hr: cov.signals.hr.provenance, alt: cov.signals.alt.level, axes: apt.axes.map(a => a.label + ':' + a.score) };
});

await test('E20-13', 'Une estimation est explicitement nommée « estimation »', () => {
  const iso = loadApp();
  assert(iso.ELEV_PROVENANCE.inferred.label === 'Estimation', 'la provenance estimée doit porter ce mot');
  // Le garde-fou refuse une estimation qui ne se nomme pas.
  const muet = iso.makeInsight({
    id: 'muet', family: 'terrain', observation: 'Tu marches surtout en montée.',
    importance: 'context', confidence: 'medium',
  });
  muet.provenance = 'inferred';
  assert(iso.insightRejectionReason(muet, {}) !== null, 'une estimation anonyme doit être refusée');
  const nomme = iso.makeInsight({
    id: 'nomme', family: 'terrain', observation: 'Tu marches surtout en montée.',
    importance: 'context', confidence: 'medium', method: 'Estimation ELEV basée sur la cadence.',
  });
  nomme.provenance = 'inferred';
  assert(iso.insightRejectionReason(nomme, {}) === null, 'une estimation nommée doit passer');
  // Et le run/walk, qui EST une estimation, le dit dans sa méthode.
  const s = { id: 'e', date: iso.todayISO(), series: [] };
  for (let t = 0; t <= 200; t++) s.series.push({ t: t * 10, distKm: t * 0.02, alt: 200 + t * 4, cadenceSpm: 150 });
  const rw = iso.terrainRunWalkByGrade(s);
  assert(/estimation/i.test(rw.method), 'la locomotion doit se présenter comme une estimation');
  return { methode: rw.method };
});

await test('E20-14', 'Les états vides ne laissent aucune structure analytique derrière eux', () => {
  const plan = fs.readFileSync(path.join(root, 'plan.html'), 'utf8');
  // La rangée d'onglets et les panneaux doivent être masqués quand aucun plan n'existe.
  assert(/tabs\.hidden = !aPlan/.test(plan), 'la rangée d\'onglets doit être masquée sans plan');
  assert(/tab-panel'\)\.forEach\(p2 => \{ p2\.hidden = !aPlan; \}\)/.test(plan), 'les panneaux d\'analyse doivent être masqués sans plan');
  assert(/if \(aPlan\) renderPlanInsightCompact\(\)/.test(plan), 'aucun insight de plan ne doit être rendu sans plan');
  const css = fs.readFileSync(path.join(root, 'assets', 'style.css'), 'utf8');
  assert(/\[hidden\]\{display:none !important;\}/.test(css), 'l\'attribut hidden doit réellement masquer');
  return { ok: true };
});

await test('E20-15', 'Tout insight porte les métadonnées exigées par le contrat', () => {
  const iso = loadApp();
  seedHistorique(iso);
  const candidats = [iso.generateElevInsight()].concat(iso.generateElevSideInsights()).filter(Boolean);
  assert(candidats.length > 0, 'le jeu de test doit produire au moins une observation');
  candidats.forEach(i => {
    assert(typeof i.id === 'string' && i.id, 'chaque insight doit porter un identifiant stable');
    assert(iso.INSIGHT_FAMILIES[i.family], 'chaque insight doit appartenir à une famille connue : ' + i.family);
    assert(typeof i.observation === 'string' && i.observation, 'chaque insight doit porter une observation');
    assert(iso.INSIGHT_IMPORTANCE[i.importance], 'chaque insight doit porter une importance connue');
    assert(['high', 'medium', 'low', 'none'].indexOf(i.confidence) >= 0, 'chaque insight doit porter une confiance');
    assert(typeof i.window === 'string' && i.window, 'chaque insight doit dire sur quelle fenêtre il porte');
    if (i.delta != null) assert(i.reference, 'un écart sans référence n\'est pas interprétable');
  });
  // La priorisation respecte le plafond d'écran et l'unicité de famille.
  const res = iso.prioritizeInsights(candidats, { hasRecoveryData: false });
  assert(res.secondary.length <= 2, 'au plus deux insights secondaires par écran');
  const familles = [res.primary].concat(res.secondary).filter(Boolean).map(i => i.family);
  assert(new Set(familles).size === familles.length, 'jamais deux insights de la même famille sur un écran');
  return { candidats: candidats.length, principal: res.primary && res.primary.id, secondaires: res.secondary.map(i => i.id) };
});

/* =========================================================================
   SUITE FIX — défauts visuels et fonctionnels corrigés le 23 août 2026.
   Quatre zones : point culminant tronqué (Activité), rythme vertical de
   Progression, page Plan (timeline, dates modifiables, fiche d'entraînement),
   formulaire et photo du Profil.
   ========================================================================= */

await test('FIX-1a', 'Activité — l\'étiquette du point culminant reste dans le cadre du graphique', async () => {
  const iso = loadApp();
  /* Le sommet est par construction le point le plus HAUT du cadre : sans marge dédiée, son
     étiquette était dessinée au-dessus du bord et coupée (mesuré : 6,3 px hors cadre). */
  const points = [];
  for (let i = 0; i < 40; i++) points.push({ x: i * 0.5, alt: i === 20 ? 1969 : 400 + i * 3 });
  const html = iso.elevChartSvg(points, { key: 'alt', terrain: true, width: 900 });
  const vb = html.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert(vb, 'le graphique doit porter un viewBox');
  const hauteur = Number(vb[2]);
  const peak = html.match(/class="c-peak"[^>]*>([^<]+)</);
  assert(peak && peak[1].trim() === '1969 m', 'l\'altitude du sommet doit être écrite en entier, jamais tronquée');
  const y = Number(html.match(/<text x="[\d.]+" y="([\d.]+)" class="c-peak"/)[1]);
  /* Ligne de base à `y` : le haut du texte est ~1,2 × la taille de police au-dessus. Une police
     d'axe fait au plus 14 px, on exige donc 14 px de dégagement au-dessus de la ligne de base. */
  assert(y >= 14, 'la ligne de base de l\'étiquette doit laisser la place au texte au-dessus (y=' + y + ')');
  assert(y < hauteur, 'l\'étiquette doit rester dans le cadre');
  return { y, hauteur, texte: peak[1].trim() };
});

await test('FIX-1b', 'Activité — un sommet en bord de parcours ne sort pas du cadre latéralement', async () => {
  const iso = loadApp();
  const cas = {};
  [['debut', 0], ['fin', 39]].forEach(([nom, idx]) => {
    const points = [];
    for (let i = 0; i < 40; i++) points.push({ x: i * 0.5, alt: i === idx ? 9999 : 100 + i });
    const html = iso.elevChartSvg(points, { key: 'alt', terrain: true, width: 320 });
    const m = html.match(/<text x="([\d.]+)" y="[\d.]+" class="c-peak" fill="[^"]*" text-anchor="(\w+)"/);
    assert(m, 'l\'étiquette du sommet doit être rendue (' + nom + ')');
    const x = Number(m[1]), anchor = m[2];
    /* Un ancrage centré ferait sortir la moitié de l'étiquette : on bascule l'ancrage plutôt
       que de rogner le texte — une altitude à quatre chiffres doit rester lisible en entier. */
    assert(anchor !== 'middle', 'près d\'un bord, l\'ancrage doit basculer (' + nom + ' → ' + anchor + ')');
    assert(x >= 0 && x <= 320, 'l\'ancre doit rester dans le cadre (' + nom + ')');
    cas[nom] = { x, anchor };
  });
  return cas;
});

await test('FIX-1c', 'Activité — le graphique se dessine à la largeur réelle du conteneur', async () => {
  const iso = loadApp();
  const points = [];
  for (let i = 0; i < 30; i++) points.push({ x: i, alt: 500 + i * 4 });
  /* Un viewBox fixe de 1000 comprimé dans 293 px, c'est une échelle de 0,29 : mesuré sur
     téléphone, les libellés d'axes tombaient à 4 px de haut. La largeur du viewBox doit
     suivre celle du conteneur pour que l'échelle revienne à 1. */
  [293, 640, 939].forEach(w => {
    const html = iso.elevChartSvg(points, { key: 'alt', terrain: true, width: w });
    const vb = Number(html.match(/viewBox="0 0 (\d+)/)[1]);
    assert(vb === w, 'le viewBox doit valoir la largeur demandée (' + w + ' → ' + vb + ')');
  });
  assert(typeof iso.mountElevChart === 'function', 'mountElevChart doit exister pour brancher la mesure du conteneur');
  const pages = ['activite.html'];
  pages.forEach(p => {
    const src = fs.readFileSync(path.join(root, p), 'utf8');
    assert(!/elevChartSvg\(/.test(src), p + ' doit passer par mountElevChart, jamais dessiner à largeur fixe');
  });
  return { ok: true };
});

await test('FIX-2', 'Progression — le contenu reconduit le rythme vertical de la page', async () => {
  /* `#analysisContent` était un simple `div` : ses enfants retombaient au flux par défaut et
     perdaient le `gap` de `main`. Mesuré avant correction : deux cartes voisines à 0 px, et un
     titre de groupe chevauchant la carte suivante de 4 px, là où Profil — dont les mêmes blocs
     sont enfants directs de `main` — obtenait 24 px avant et 12 px après. */
  const src = fs.readFileSync(path.join(root, 'analyse.html'), 'utf8');
  assert(/id="analysisContent" class="page-flow"/.test(src), '#analysisContent doit porter .page-flow');
  const flow = cssSource.match(/\.page-flow\{([^}]*)\}/);
  assert(flow, '.page-flow doit être défini dans la feuille de style partagée');
  assert(/flex-direction:column/.test(flow[1]) && /gap:16px/.test(flow[1]),
    '.page-flow doit reproduire la colonne et le gap de main');
  const mainRule = cssSource.match(/\nmain\{([^}]*)\}/);
  assert(/gap:16px/.test(mainRule[1]), 'le gap de référence de main doit rester 16px');
  assert(/main\.analysis-main\{max-width:1360px;\}/.test(cssSource),
    'Progression doit partager la largeur maximale des autres pages');
  return { ok: true };
});

await test('FIX-3a', 'Plan — la timeline des phases est un trait unique, insensible à la hauteur des libellés', async () => {
  /* Chaque étape dessinait son propre segment dans une piste `align-items:center` : deux
     libellés de hauteurs différentes centraient leurs segments à des ordonnées différentes et
     le trait apparaissait haché. Le trait est désormais un élément unique, et les étapes sont
     alignées sur leur bord haut. */
  assert(!/\.plan-phase-step::before/.test(cssSource),
    'aucune étape ne doit plus dessiner son propre segment de trait');
  const steps = cssSource.match(/\.plan-phase-steps\{([^}]*)\}/);
  assert(steps && /align-items:flex-start/.test(steps[1]),
    'les étapes doivent être alignées sur leur bord haut, sinon les pastilles se décalent');
  assert(/width:max-content/.test(steps[1]),
    'la piste doit prendre la largeur de son contenu, sinon le trait s\'arrête avant la dernière pastille');
  assert(/\.plan-phase-rail\{/.test(cssSource), 'le trait doit exister comme élément propre');
  const src = fs.readFileSync(path.join(root, 'plan.html'), 'utf8');
  assert(/plan-phase-rail/.test(src), 'plan.html doit rendre le trait continu');
  assert(/--steps:/.test(src), 'le nombre d\'étapes doit être transmis au CSS pour caler les extrémités');
  return { ok: true };
});

await test('FIX-3b', 'Plan — une séance planifiée porte une identité stable, indépendante de sa date', async () => {
  const iso = loadApp();
  const plan = iso.parsePlanCsv('Semaine,Jour,Type de seance,Distance (km)\n1,Lun 10/08,Footing,8\n1,Lun 10/08,Fractionné,6');
  iso.savePlan(plan);
  const avecIds = iso.ensurePlanUids(iso.getPlan());
  assert(avecIds.every(p => p.uid), 'chaque séance doit recevoir un identifiant');
  /* Deux séances le MÊME JOUR doivent rester distinguables : c'est précisément le cas que la
     date seule ne sait pas désigner, et il devient courant dès qu'on peut déplacer une séance. */
  assert(new Set(avecIds.map(p => p.uid)).size === 2, 'deux séances du même jour ne partagent pas d\'identifiant');
  // Les identifiants sont PERSISTÉS : une seconde lecture ne les régénère pas.
  const relu = iso.ensurePlanUids(iso.getPlan());
  assert(relu[0].uid === avecIds[0].uid, 'les identifiants doivent être persistés, pas recalculés à chaque lecture');
  return { uids: relu.map(p => p.uid) };
});

await test('FIX-3c', 'Plan — la date d\'une séance est modifiable, persistée, et redistribue la semaine', async () => {
  const iso = loadApp();
  iso.savePlan(iso.parsePlanCsv(
    'Semaine,Jour,Type de seance,Distance (km),D+ (m)\n' +
    '1,Lun 10/08,Footing,8,100\n1,Mer 12/08,Seuil,10,200\n2,Lun 17/08,Sortie longue,20,900'));
  const plan = iso.ensurePlanUids(iso.getPlan());
  const cible = plan.find(p => p.date === '2026-08-12');
  const semaineAvant = iso.getPlanWeeksOverview(iso.getPlan());
  const s1Avant = semaineAvant.find(w => w.startISO === '2026-08-10');

  const res = iso.updatePlannedSessionDate(cible.uid, '2026-08-18');
  assert(res.ok, 'le déplacement doit réussir : ' + res.error);
  // Persistance réelle : relecture depuis le stockage, pas depuis l'objet en mémoire.
  const relu = JSON.parse(iso.localStorage.getItem('trail:plan')).find(p => p.uid === cible.uid);
  assert(relu.date === '2026-08-18', 'la nouvelle date doit être enregistrée');
  assert(relu.movedFrom === '2026-08-12', 'la date d\'origine doit être conservée');
  assert(relu.jourLabel === 'Mar 18/08', 'le libellé de jour doit suivre la nouvelle date, sinon la fiche ment');

  const semaineApres = iso.getPlanWeeksOverview(iso.getPlan());
  const s1Apres = semaineApres.find(w => w.startISO === '2026-08-10');
  const s2Apres = semaineApres.find(w => w.startISO === '2026-08-17');
  assert(s1Apres.plannedCount === s1Avant.plannedCount - 1, 'la semaine d\'origine doit perdre la séance');
  assert(s2Apres.plannedCount === 2, 'la semaine cible doit la recevoir');
  assert(s1Apres.plannedKm === s1Avant.plannedKm - 10, 'le volume prévu doit suivre la séance');

  // Retour à la date d'origine : la mention « déplacée » disparaît plutôt que de rester à vie.
  iso.updatePlannedSessionDate(cible.uid, '2026-08-12');
  const retour = iso.getPlan().find(p => p.uid === cible.uid);
  assert(!retour.movedFrom, 'un retour à la date d\'origine efface la mention de déplacement');
  return { origine: s1Avant.plannedCount, apres: s1Apres.plannedCount, cible: s2Apres.plannedCount };
});

await test('FIX-3d', 'Plan — une date invalide est refusée avec un motif, jamais appliquée', async () => {
  const iso = loadApp();
  iso.savePlan(iso.parsePlanCsv('Semaine,Jour,Type de seance,Distance (km)\n1,Lun 10/08,Footing,8'));
  const uid = iso.ensurePlanUids(iso.getPlan())[0].uid;
  const cas = {};
  [['vide', ''], ['nulle', null], ['format libre', '10/08/2026'], ['jour inexistant', '2026-02-31'],
   ['mois inexistant', '2026-13-01'], ['identifiant inconnu', 'ps-inconnu']].forEach(([nom, val]) => {
    const res = nom === 'identifiant inconnu'
      ? iso.updatePlannedSessionDate(val, '2026-09-01')
      : iso.updatePlannedSessionDate(uid, val);
    assert(res.ok === false, nom + ' doit être refusé');
    assert(typeof res.error === 'string' && res.error, nom + ' doit porter un motif affichable');
    cas[nom] = res.error;
  });
  assert(iso.getPlan()[0].date === '2026-08-10', 'aucun refus ne doit avoir modifié le plan');
  return cas;
});

await test('FIX-3e', 'Plan — la fiche n\'expose que les champs réellement présents dans le CSV', async () => {
  const iso = loadApp();
  // Plan PAUVRE : format simple, ni durée, ni zones, ni objectif, ni D+.
  const pauvre = iso.parsePlanCsv('Semaine,Jour,Type de seance,Distance (km)\n1,Lun 10/08,Footing,8')[0];
  const dPauvre = iso.plannedSessionDetails(pauvre);
  assert(dPauvre.duree === null && dPauvre.intensite === null, 'aucune durée ni intensité inventée');
  assert(dPauvre.objectif === null && dPauvre.zones.length === 0, 'aucun objectif ni zone inventés');
  /* `parsePlanNumber` retourne 0 quand la colonne est ABSENTE : afficher « D+ 0 m » se lirait
     comme « sortie plate prévue », pas comme « non renseigné ». */
  assert(dPauvre.deniveleM === null, 'une colonne D+ absente ne doit pas devenir « 0 m »');
  assert(dPauvre.distanceKm === 8, 'une valeur réellement présente est conservée');

  // Plan RICHE : format détaillé, toutes les colonnes renseignées.
  const riche = iso.parsePlanCsv(
    'Semaine;Bloc;Date (JJ/MM/AAAA);Type de seance;Distance (km);D+ (m);D-;Duree totale;' +
    'FC echauffement;FC corps de seance;FC retour au calme;FC moyenne globale;Intensite (RPE);Objectif detaille\n' +
    '3;Spécifique;12/08/2026;Sortie longue;24;1450;1400;3h30;Z1 110-130;Z2 138-158;Z1 <120;145;RPE4;Allure de course sur les 8 derniers km')[0];
  const dRiche = iso.plannedSessionDetails(riche);
  assert(dRiche.duree === '3h30' && dRiche.intensite === 'RPE4', 'durée et intensité doivent être lues');
  assert(dRiche.descenteM === 1400 && dRiche.bloc === 'Spécifique', 'D− et bloc doivent être lus');
  assert(dRiche.zones.length === 4, 'les quatre repères de FC par phase doivent être exposés');
  assert(/8 derniers km/.test(dRiche.objectif), 'l\'objectif détaillé doit être exposé');
  return { pauvre: Object.keys(dPauvre).filter(k => dPauvre[k] != null && dPauvre[k].length !== 0), zonesRiches: dRiche.zones.length };
});

await test('FIX-3f', 'Plan — le détail des séances vit dans Plan, pas dans Paramètres', async () => {
  /* Le contenu réel d'une séance (objectif, zones FC par phase, D−) n'était lisible que dans un
     tableau à six colonnes de la page Paramètres — un lieu de configuration, consulté une fois à
     l'import. Paramètres ne garde qu'un récapitulatif de ce qui a été lu. */
  const settings = fs.readFileSync(path.join(root, 'parametres.html'), 'utf8');
  assert(!/Zone FC \/ intensité<\/th>/.test(settings), 'Paramètres ne doit plus rendre la fiche d\'entraînement');
  assert(/plan\.html#semaines/.test(settings), 'Paramètres doit renvoyer vers le détail dans Plan');
  const plan = fs.readFileSync(path.join(root, 'plan.html'), 'utf8');
  assert(/plannedSessionFicheHtml/.test(plan), 'Plan doit rendre une vraie fiche de séance');
  assert(/applyPlanHash/.test(plan), 'l\'ancre d\'onglet doit être prise en charge, sinon le lien tombe sur Aperçu');
  // Un seul rendu de fiche, partagé : Aujourd'hui, Prochaine séance et Semaines ne doivent pas diverger.
  const appels = (plan.match(/plannedSessionFicheHtml\(/g) || []).length;
  assert(appels >= 4, 'la fiche doit être partagée par les trois emplacements (déclaration + 3 appels)');
  return { appels };
});

await test('FIX-4a', 'Profil — un champ empilé ne prend plus la hauteur d\'une section', async () => {
  /* `label.field` porte `flex:1 1 160px`, pensé pour une RANGÉE (160px = largeur minimale). Dans
     un conteneur en colonne, ce flex-basis devient une HAUTEUR : mesuré, chaque champ occupait
     160px pour un input de 37px, et la carte Identité passait de 152 à 451px en édition. */
  const stack = cssSource.match(/\.field-stack\{([^}]*)\}/);
  assert(stack && /flex-direction:column/.test(stack[1]), '.field-stack doit exister comme primitive partagée');
  assert(/\.field-stack > \.field,\.field-stack > \.field-pair\{flex:none;\}/.test(cssSource),
    'un champ empilé doit neutraliser son flex-basis');
  const src = fs.readFileSync(path.join(root, 'profil.html'), 'utf8');
  assert(!/class="row" style="flex-direction:column;align-items:stretch;"/.test(src),
    'Profil ne doit plus empiler des champs dans une .row sans protection');
  assert((src.match(/class=\"field-stack\"/g) || []).length === 4,
    'les quatre formulaires d\'édition du Profil doivent utiliser la primitive');
  return { ok: true };
});

await test('FIX-4b', 'Profil — une photo est réduite avant stockage, et un fichier invalide est refusé', async () => {
  const iso = loadApp();
  assert(typeof iso.readProfilePhotoFile === 'function', 'le pipeline photo doit exister');
  /* Les `const` de app.js ne sont pas des propriétés du contexte VM (contrairement aux
     fonctions) : les seuils sont donc lus dans la source, ce qui teste la même propriété. */
  const px = Number(source.match(/PROFILE_PHOTO_PX = (\d+)/)[1]);
  const maxStored = Number(source.match(/PROFILE_PHOTO_MAX_STORED = (\d+) \* 1024/)[1]) * 1024;
  const maxInput = Number(source.match(/PROFILE_PHOTO_MAX_INPUT = (\d+) \* 1024 \* 1024/)[1]) * 1024 * 1024;
  assert(px === 256, 'la photo doit être ramenée à 256 px');
  /* Le stockage local est déjà sous tension (~12 Mo pour 280 séances, quota de 5 à 10 Mo) :
     une photo brute en base64 y serait un vrai risque. Le plafond doit rester modeste. */
  assert(maxStored <= 300 * 1024, 'jamais plus de 300 ko écrits dans le profil');
  assert(maxInput <= 12 * 1024 * 1024, 'un fichier d\'entrée démesuré doit être refusé tôt');

  const refusTexte = await iso.readProfilePhotoFile({ type: 'text/plain', size: 10 });
  assert(refusTexte.ok === false && /image/i.test(refusTexte.error), 'un fichier non-image doit être refusé');
  const refusGros = await iso.readProfilePhotoFile({ type: 'image/jpeg', size: 20 * 1024 * 1024 });
  assert(refusGros.ok === false && /lourde/i.test(refusGros.error), 'un fichier trop lourd doit être refusé');
  const refusVide = await iso.readProfilePhotoFile(null);
  assert(refusVide.ok === false, 'aucun fichier doit être refusé proprement');
  return { px, maxStoredKo: maxStored / 1024, texte: refusTexte.error, gros: refusGros.error };
});

await test('FIX-4c', 'Profil — la photo se stocke, se remplace, se supprime et retombe sur l\'initiale', async () => {
  const iso = loadApp();
  iso.patchProfile({ nom: 'Nicolas' });
  assert(iso.getProfilePhoto() === null, 'sans photo, rien n\'est retourné');
  assert(/>N</.test(iso.avatarHtml()), 'le repli sur l\'initiale doit être rendu');
  assert(!/has-photo/.test(iso.avatarHtml()), 'sans photo, l\'avatar ne prétend pas en porter une');

  const a = 'data:image/jpeg;base64,AAAA', b = 'data:image/jpeg;base64,BBBB';
  iso.saveProfilePhoto(a);
  assert(iso.getProfilePhoto() === a, 'la photo doit être lisible après enregistrement');
  assert(/has-photo/.test(iso.avatarHtml()) && iso.avatarHtml().includes(a), 'l\'avatar doit rendre la photo');
  // Persistance réelle, et transport : la photo est un champ du profil, elle suit l'export et la synchro.
  assert(JSON.parse(iso.localStorage.getItem('trail:profile')).photo === a, 'la photo doit être persistée');
  assert(iso.buildSyncPayload().profile.photo === a, 'la photo doit suivre la synchronisation du profil');
  assert(iso.buildExportPayload().profile.photo === a, 'la photo doit suivre la sauvegarde manuelle');

  iso.saveProfilePhoto(b);
  assert(iso.getProfilePhoto() === b, 'le remplacement doit écraser la précédente');
  iso.saveProfilePhoto(null);
  assert(iso.getProfilePhoto() === null, 'la suppression doit vider le champ');
  assert(/>N</.test(iso.avatarHtml()), 'après suppression, l\'avatar retombe sur l\'initiale');

  // Une valeur qui n'est pas une image encodée n'est jamais rendue comme source.
  iso.patchProfile({ photo: 'javascript:alert(1)' });
  assert(iso.getProfilePhoto() === null, 'une valeur qui n\'est pas une data URI d\'image est ignorée');
  assert(!/<img/.test(iso.avatarHtml()), 'aucune source douteuse ne doit être rendue');
  // La photo part avec le reste des données locales à la réinitialisation.
  assert(iso.localDataKeys().indexOf('trail:profile') >= 0, 'la photo suit la réinitialisation locale du profil');
  return { ok: true };
});


/* =============================================================================
   ELEV Insight V2 — audit scientifique du 23 août 2026.
   Jeux de référence G00 à G18 (§11.4) et invariants P0 (§11.1).
   Chaque test énonce la propriété que le produit doit tenir ; il échoue si le
   défaut décrit par l'audit réapparaît.
   ============================================================================= */

/* Construit une série de séance exploitable par detectClimbs/aggregatePeriod.
   Montée monotone : `gainM` mètres gagnés en `durationS` secondes sur `distKm`. */
function climbSeries(gainM, durationS, distKm) {
  const n = 40, pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push({ t: Math.round(f * durationS), distKm: +(f * distKm).toFixed(4), alt: +(f * gainM).toFixed(2) });
  }
  return pts;
}

await test('V2-G07', 'VAM agrégée : ΣD+ / Σtemps, jamais une moyenne de VAM pondérée par le D+', async () => {
  const iso = loadApp();
  // Audit §3.4 : deux montées de 100 m, l'une à 1000 m/h (360 s), l'autre à 500 m/h (720 s).
  const s1 = { date: '2026-08-01', distanceKm: 2, ascent: 100, durationS: 360, series: climbSeries(100, 360, 2) };
  const s2 = { date: '2026-08-02', distanceKm: 2, ascent: 100, durationS: 720, series: climbSeries(100, 720, 2) };

  const c1 = iso.detectClimbs(s1.series), c2 = iso.detectClimbs(s2.series);
  assert(c1.length === 1 && c2.length === 1, 'une montée doit être détectée dans chaque série');
  assert(Math.abs(c1[0].vamMh - 1000) <= 30, 'VAM du segment 1 proche de 1000 m/h, obtenu ' + c1[0].vamMh);
  assert(Math.abs(c2[0].vamMh - 500) <= 30, 'VAM du segment 2 proche de 500 m/h, obtenu ' + c2[0].vamMh);

  const agg = iso.aggregatePeriod([s1, s2]);
  // Vitesse verticale agrégée = 200 m / 1080 s x 3600 = 667 m/h. La moyenne pondérée par le D+
  // donnerait 750 m/h, soit une surestimation de 12,4 % (audit §3.4).
  assert(agg.vamAvg != null, 'la VAM agrégée doit être calculable');
  assert(Math.abs(agg.vamAvg - 667) <= 20,
    'VAM agrégée attendue proche de 667 m/h (ΣD+/Σtemps), obtenu ' + agg.vamAvg);
  assert(Math.abs(agg.vamAvg - 750) > 40,
    'la moyenne pondérée par le D+ (750 m/h) ne doit plus être utilisée, obtenu ' + agg.vamAvg);
  return { vamAgregee: agg.vamAvg, attendu: 667, ancienneFormule: 750 };
});

await test('V2-G06', 'Moyennes de repli pondérées par le temps, pas par le nombre de points', async () => {
  const iso = loadApp();
  const base = 1000000;
  // Échantillonnage volontairement irrégulier : 10 points à 1 Hz à 100 bpm, puis deux points
  // espacés de 60 s à 160 bpm. La moyenne arithmétique donne 110 bpm parce qu'elle compte des
  // POINTS ; la moyenne pondérée par le temps donne environ 142 bpm : elle compte des SECONDES.
  const records = [];
  for (let t = 0; t <= 9; t++) records.push({ timestamp: base + t, heart_rate: 100, cadence: 80, distance: t * 3, altitude: 100 });
  records.push({ timestamp: base + 69, heart_rate: 160, cadence: 90, distance: 27 + 180, altitude: 100 });
  records.push({ timestamp: base + 129, heart_rate: 160, cadence: 90, distance: 27 + 360, altitude: 100 });

  const sum = iso.summarizeFit({ record: records, session: [{}] }, {});
  assert(sum.avgHr != null, 'la FC moyenne de repli doit être calculable');
  assert(sum.avgHr !== 110,
    'la moyenne arithmétique par points (110 bpm) ne doit plus être utilisée, obtenu ' + sum.avgHr);
  assert(Math.abs(sum.avgHr - 142) <= 4,
    'FC moyenne pondérée par le temps attendue proche de 142 bpm, obtenu ' + sum.avgHr);

  // Même exigence, même méthode : le nombre de points ne doit pas décider de la moyenne.
  const dense = [], sparse = [];
  for (let t = 0; t <= 600; t += 1) dense.push({ timestamp: base + t, heart_rate: t < 300 ? 120 : 160, distance: t * 3, altitude: 100 });
  for (let t = 0; t <= 600; t += 10) sparse.push({ timestamp: base + t, heart_rate: t < 300 ? 120 : 160, distance: t * 3, altitude: 100 });
  const a = iso.summarizeFit({ record: dense, session: [{}] }, {}).avgHr;
  const b = iso.summarizeFit({ record: sparse, session: [{}] }, {}).avgHr;
  assert(Math.abs(a - b) <= 2,
    'la même séance échantillonnée à 1 s et à 10 s doit donner la même moyenne (' + a + ' vs ' + b + ')');
  return { pondereeTemps: sum.avgHr, arithmetique: 110, dense: a, espace: b };
});

await test('V2-G05', 'D+ de repli : le bruit altimétrique ne fabrique plus des centaines de mètres', async () => {
  const iso = loadApp();
  const base = 1000000;
  // Parcours strictement plat, bruit barométrique de +/-0,5 m point à point sur 600 points.
  // La somme des différences brutes accumule environ 300 m de D+ purement artificiel.
  const plat = [];
  for (let i = 0; i < 600; i++) plat.push({ timestamp: base + i, altitude: 100 + (i % 2 ? 0.5 : -0.5), distance: i * 3 });
  const sumPlat = iso.summarizeFit({ record: plat, session: [{}] }, {});
  assert(sumPlat.ascent != null, 'un D+ de repli doit rester calculable');
  assert(sumPlat.ascent <= 20,
    'sur un parcours plat bruité, le D+ de repli doit rester marginal, obtenu ' + sumPlat.ascent + ' m');

  // Un vrai relief doit rester mesuré : le lissage ne doit pas effacer une montée réelle.
  const vrai = [];
  for (let i = 0; i < 600; i++) vrai.push({ timestamp: base + i, altitude: 100 + i * 0.5 + (i % 2 ? 0.5 : -0.5), distance: i * 3 });
  const sumVrai = iso.summarizeFit({ record: vrai, session: [{}] }, {});
  assert(Math.abs(sumVrai.ascent - 300) <= 30,
    'une montée réelle de 300 m doit rester mesurée, obtenu ' + sumVrai.ascent + ' m');

  // La provenance doit être nommée : un D+ reconstruit n'est pas un D+ fourni par l'appareil.
  assert(sumPlat.ascentSource === 'estimated',
    'un D+ reconstruit doit porter sa provenance, obtenu ' + sumPlat.ascentSource);
  const sumFit = iso.summarizeFit({ record: plat, session: [{ total_ascent: 42, total_descent: 40 }] }, {});
  assert(sumFit.ascent === 42 && sumFit.ascentSource === 'measured',
    'un D+ fourni par le fichier reste mesuré et prioritaire');
  return { platBruite: sumPlat.ascent, reliefReel: sumVrai.ascent, provenance: sumPlat.ascentSource };
});

await test('V2-G10', 'Plan : une colonne absente reste indisponible, jamais zéro', async () => {
  const iso = loadApp();
  assert(iso.parsePlanNumber(null) === null, 'une valeur absente doit rester null');
  assert(iso.parsePlanNumber('') === null, 'une cellule vide doit rester null');
  assert(iso.parsePlanNumber('   ') === null, 'une cellule blanche doit rester null');
  assert(iso.parsePlanNumber('repos') === null, 'une valeur non numérique doit rester null');
  assert(iso.parsePlanNumber('0') === 0, 'un vrai zéro doit rester zéro');
  assert(iso.parsePlanNumber('12,5') === 12.5, 'la virgule décimale reste lue');
  assert(iso.parsePlanNumber('1 700') === 1700, 'le séparateur de milliers reste lu');

  // CSV sans colonne D+ : le champ doit être indisponible, pas une cible de 0 m.
  const csv = 'Date;Type;Distance\n01/09/2026;Footing;10\n02/09/2026;Repos;0';
  const plan = iso.parsePlanCsv(csv);
  assert(plan.length === 2, 'les deux lignes doivent être lues');
  assert(plan[0].deniveleM === null,
    'sans colonne D+, le dénivelé doit être null (une cible de 0 m serait inventée), obtenu ' + plan[0].deniveleM);
  assert(plan[0].distanceKm === 10, 'la distance présente doit être lue');
  assert(plan[1].distanceKm === 0, 'un vrai 0 saisi reste 0 (jour de repos déclaré)');
  return { sansColonneDplus: plan[0].deniveleM, vraiZero: plan[1].distanceKm };
});

await test('V2-G02', 'Couverture : comportement exact aux frontières 60 % et 85 %', async () => {
  const iso = loadApp();
  // Audit §11.4 G02 : l'arrondi ne doit jamais inverser la décision.
  // Niveaux réellement définis par elev-data-quality.js : insufficient / usable / high.
  assert(iso.elevCoverageLevel(0.599) === 'insufficient', '59,9 % doit rester insuffisant');
  assert(iso.elevCoverageLevel(0.60) === 'usable', '60 % doit devenir exploitable');
  assert(iso.elevCoverageLevel(0.849) === 'usable', '84,9 % doit rester exploitable');
  assert(iso.elevCoverageLevel(0.85) === 'high', '85 % doit devenir complet');

  // La couverture plafonne la confiance, elle ne la gonfle jamais.
  assert(iso.elevCapConfidence('high', 0.599) !== 'high', 'une couverture insuffisante ne peut pas rester haute');
  assert(iso.elevCapConfidence('high', 0.70) === 'medium', 'une couverture partielle plafonne à moyenne');
  assert(iso.elevCapConfidence('high', 0.90) === 'high', 'une couverture complète laisse la confiance demandée');
  assert(iso.elevCapConfidence('low', 0.99) === 'low', 'une bonne couverture ne relève jamais la confiance demandée');

  // Un insight à couverture insuffisante est refusé, quelle que soit la confiance annoncée.
  const ins = iso.makeInsight({
    id: 'test.cov', family: 'effort', observation: 'Test', confidence: 'high', coverage: 0.599, importance: 'notable',
  });
  assert(iso.insightRejectionReason(ins) !== null, 'un insight sous 60 % de couverture doit être rejeté');
  return { seuils: '59,9 / 60 / 84,9 / 85' };
});


await test('V2-P0A1', 'Contrat : provenance survit à makeInsight et le garde-fou redevient opérant', async () => {
  const iso = loadApp();
  // Le défaut central de l'audit : le constructeur perdait `provenance`, si bien que la règle
  // « toute estimation porte le mot estimation » ne pouvait jamais s'appliquer.
  const estimationNonNommee = iso.makeInsight({
    id: 'test.inferred', family: 'terrain', observation: 'Tu marches 60 % du temps en montée.',
    provenance: 'inferred', confidence: 'medium', importance: 'notable',
    method: 'Seuil de cadence.',
  });
  assert(estimationNonNommee.provenance === 'inferred',
    'provenance doit être conservée par makeInsight, obtenu ' + estimationNonNommee.provenance);
  const raison = iso.insightRejectionReason(estimationNonNommee);
  assert(raison !== null && /estimation/i.test(raison),
    'une estimation non nommée doit être rejetée, obtenu ' + JSON.stringify(raison));

  // Nommée, elle passe : le garde-fou n'interdit pas d'estimer, il interdit de taire l'estimation.
  const estimationNommee = iso.makeInsight({
    id: 'test.inferred2', family: 'terrain', observation: 'Tu marches 60 % du temps en montée.',
    provenance: 'inferred', confidence: 'medium', importance: 'notable',
    method: 'Estimation ELEV basée sur la cadence.',
  });
  assert(iso.insightRejectionReason(estimationNommee) === null,
    'une estimation nommée doit rester publiable, refusée pour : ' + iso.insightRejectionReason(estimationNommee));

  // Les deux estimations réellement produites par le produit nomment bien leur méthode : réparer
  // provenance ne doit faire disparaître aucun insight existant.
  const src = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
  const inferred = src.split('\n').filter(l => /provenance:\s*'inferred'/.test(l));
  assert(inferred.length >= 2, 'les insights estimés du produit doivent rester présents');
  return { provenanceConservee: true, estimationsProduit: inferred.length };
});

await test('V2-P0A2', 'Contrat : observation, interprétation, recommandation et incertitude séparées', async () => {
  const iso = loadApp();
  const ins = iso.makeInsight({
    id: 'test.blocs', family: 'load', observation: 'Volume à 42 km.',
    interpretation: 'Supérieur de 12 % à la moyenne des 4 semaines précédentes.',
    recommendation: null,
    uncertainty: 'Le kilomètre ne mesure pas la charge totale en trail.',
    reference: 'moyenne 4 semaines', confidence: 'medium', importance: 'notable',
  });
  assert(ins.statement && typeof ins.statement === 'object', 'un bloc statement canonique doit exister');
  assert(ins.statement.observation === 'Volume à 42 km.', 'observation portée par son propre champ');
  assert(/12 %/.test(ins.statement.interpretation), 'interprétation portée par son propre champ');
  assert(ins.statement.recommendation === null, 'une recommandation absente reste absente, jamais déduite');
  assert(/kilomètre/.test(ins.statement.uncertainty), 'incertitude portée par son propre champ');

  // Rétrocompatibilité : les dix-neuf générateurs existants emploient why/action/limits.
  const ancien = iso.makeInsight({
    id: 'test.alias', family: 'load', observation: 'Obs.',
    why: 'Parce que.', action: 'Fais ceci.', limits: 'Ne dit pas cela.',
    confidence: 'low', importance: 'context',
  });
  assert(ancien.statement.interpretation === 'Parce que.', 'why alimente interpretation');
  assert(ancien.statement.recommendation === 'Fais ceci.', 'action alimente recommendation');
  assert(ancien.statement.uncertainty === 'Ne dit pas cela.', 'limits alimente uncertainty');
  assert(ancien.why === 'Parce que.' && ancien.action === 'Fais ceci.', 'les alias plats restent lisibles');
  return { blocs: ['observation', 'interpretation', 'recommendation', 'uncertainty'] };
});

await test('V2-P0A3', 'Objectif et Plan passent par le contrat commun et ses garde-fous', async () => {
  const iso = loadApp();
  const today = iso.todayISO();
  const jour = n => iso.addDaysIso(today, n);

  // Plan réel couvrant la fenêtre, et séances réalisées bien en deçà de la cible.
  const plan = [];
  for (let i = -27; i <= 7; i++) plan.push({ date: jour(i), type: 'Footing', distanceKm: 10, deniveleM: 300, intensite: 'Z2', jourLabel: '', semaine: '1', bloc: 'Général', notes: '' });
  iso.savePlan(plan);
  for (let i = -27; i <= -1; i += 7) {
    seedSession(iso, { id: 's' + i, date: jour(i), sport: 'Trail', distanceKm: 8, ascent: 200, durationS: 3600, series: [] });
  }

  const resPlan = iso.getPlanInsights(iso.getPlan(), iso.loadAllSessions());
  assert(resPlan && typeof resPlan === 'object' && 'primary' in resPlan,
    'getPlanInsights doit retourner un résultat de priorisation, pas une liste de bullets');
  const tousPlan = [resPlan.primary].concat(resPlan.secondary || []).filter(Boolean);
  assert(tousPlan.length >= 1, 'au moins une observation doit être produite sur ce jeu');
  tousPlan.forEach(i => {
    assert(iso.insightRejectionReason(i) === null, 'insight Plan hors contrat : ' + i.id + ' — ' + iso.insightRejectionReason(i));
    assert(i.reference, 'insight Plan sans référence : ' + i.id);
    assert(i.window, 'insight Plan sans fenêtre : ' + i.id);
    assert(i.method, 'insight Plan sans méthode : ' + i.id);
    assert(i.uncertainty, 'insight Plan sans incertitude déclarée : ' + i.id);
    assert(i.provenance, 'insight Plan sans provenance : ' + i.id);
  });
  assert(resPlan.rejected.length === 0, 'aucun insight Plan ne doit être rejeté par le contrat : ' + JSON.stringify(resPlan.rejected));

  // Objectif : même exigence.
  const race = { id: 'r1', name: 'Course test', date: jour(60), distanceKm: 50, denivele: 3000, statut: 'principal' };
  iso.saveRaces([race]);
  const readiness = iso.computeRaceReadiness(race);
  const resGoal = iso.generateGoalInsight(readiness, race);
  assert(resGoal && 'primary' in resGoal, 'generateGoalInsight doit retourner un résultat de priorisation');
  const tousGoal = [resGoal.primary].concat(resGoal.secondary || []).filter(Boolean);
  assert(tousGoal.length >= 1, 'au moins une observation Objectif doit être produite');
  tousGoal.forEach(i => {
    assert(iso.insightRejectionReason(i) === null, 'insight Objectif hors contrat : ' + i.id + ' — ' + iso.insightRejectionReason(i));
    assert(i.reference && i.window && i.uncertainty, 'insight Objectif incomplet : ' + i.id);
  });

  // Le repère de sortie longue doit être nommé comme un repère ELEV, jamais comme une norme.
  const lr = tousGoal.concat(resGoal.dropped || []).find(i => i.id === 'goal-longrun');
  if (lr) assert(/repère ELEV/i.test(lr.reference + ' ' + lr.observation),
    'le repère de 60 % doit être annoncé comme un repère ELEV non validé');

  return { plan: tousPlan.map(i => i.id), objectif: tousGoal.map(i => i.id) };
});

await test('V2-P0A4', 'Aucune page ne rend un insight hors du composant partagé', async () => {
  // Vérification statique exigée par l'audit §14, lot 2 point 5. Les surfaces d'insight doivent
  // toutes passer par insightBlockHtml/insightCardHtml : c'est ce qui garantit que la référence,
  // la fenêtre et la confiance ne peuvent pas être « oubliées » sur un écran particulier.
  const pages = ['index.html', 'activite.html', 'analyse.html', 'objectifs.html', 'plan.html'];
  const details = {};
  pages.forEach(f => {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const partage = /insightBlockHtml\s*\(|insightCardHtml\s*\(/.test(src);
    assert(partage, f + ' doit rendre ses insights par le composant partagé');
    // Motifs de rendu ad hoc supprimés : une page ne doit plus fabriquer ses propres cartes.
    assert(!/insight-item"/.test(src), f + ' contient encore un rendu ad hoc (.insight-item)');
    assert(!/insight-compact-item"/.test(src), f + ' contient encore un rendu ad hoc (.insight-compact-item)');
    details[f] = 'composant partagé';
  });
  return details;
});


await test('V2-G11', 'Plan : une activité du même jour ne valide plus arbitrairement la séance prévue', async () => {
  const iso = loadApp();
  const jour = '2026-09-01';
  // Zones FC nettes, pour que l'intensité soit réellement évaluable.
  iso.patchProfile({ fcMax: 190, fcRepos: 50 });
  const zones = iso.getActiveHrZones(iso.getProfile());

  const serie = hr => { const s = []; for (let t = 0; t <= 3600; t += 10) s.push({ t, distKm: t / 360, alt: 100, hr }); return s; };
  const fractionne = { uid: 'p-fract', date: jour, type: 'Fractionné', distanceKm: 10, deniveleM: 100, intensite: 'Z4' };
  const sortieLongue = { uid: 'p-long', date: jour, type: 'Sortie longue', distanceKm: 30, deniveleM: 1200, intensite: 'Z2' };

  // Footing tranquille : même jour, même volume que le fractionné, mais entièrement en zone basse.
  const footing = { id: 'a1', date: jour, sport: 'Course à pied', distanceKm: 10, ascent: 100, durationS: 3600, series: serie(115) };
  const qF = iso.planMatchQuality(fractionne, footing, { zones });
  assert(qF.level === 'weak',
    'un footing en zone basse ne doit pas valider un fractionné prévu, obtenu « ' + qF.level + ' »');
  assert(qF.reasons.some(r => /zone 3/.test(r)), 'la raison doit nommer l\'intensité manquante : ' + JSON.stringify(qF.reasons));

  // Vrai fractionné : même volume, mais du temps réel en zone haute.
  const vrai = { id: 'a2', date: jour, sport: 'Course à pied', distanceKm: 10, ascent: 100, durationS: 3600, series: serie(175) };
  assert(iso.planMatchQuality(fractionne, vrai, { zones }).level === 'strong',
    'une séance réellement intense doit valider le fractionné prévu');

  // Volume manifestement incompatible : 8 km ne réalisent pas une sortie longue de 30 km.
  const qL = iso.planMatchQuality(sortieLongue, { id: 'a3', date: jour, distanceKm: 8, durationS: 3600, series: [] }, { zones });
  assert(qL.level === 'weak', 'un volume très inférieur ne doit pas valider la séance prévue');
  assert(qL.reasons.some(r => /Distance/.test(r)), 'la raison doit nommer l\'écart de volume');

  // Dates différentes : aucune tolérance de rattrapage, comme avant.
  assert(iso.planMatchQuality(fractionne, { id: 'a4', date: '2026-09-02', distanceKm: 10 }, { zones }).level === 'none',
    'une activité d\'un autre jour ne doit jamais être rattachée');

  // La confirmation de l'utilisateur prime sur tout le reste.
  const confirme = Object.assign({}, footing, { plannedUid: 'p-fract' });
  assert(iso.planMatchQuality(fractionne, confirme, { zones }).level === 'explicit',
    'une association confirmée par l\'utilisateur doit primer sur les heuristiques');
  // …et n'autorise pas à valider une AUTRE séance planifiée.
  assert(iso.planMatchQuality(sortieLongue, confirme, { zones }).level === 'none',
    'une activité déjà reliée ailleurs ne doit pas valider une autre séance planifiée');

  // Plusieurs séances prévues le même jour : chacune est jugée séparément.
  const m = iso.matchActivitiesToPlannedSessions([fractionne, sortieLongue], [footing], { zones });
  assert(m[0].done.length === 0 && m[0].candidates.length === 1, 'le fractionné doit rester à confirmer');
  assert(m[1].done.length === 0 && m[1].candidates.length === 1, 'la sortie longue doit rester à confirmer');
  return { footingVsFractionne: qF.level, vraiFractionne: 'strong', volumeIncompatible: qL.level };
});

await test('V2-G12', 'Plan : le lien explicite survit à la synchronisation et à la ré-analyse', async () => {
  const iso = loadApp();
  const s = { id: 'x1', date: '2026-09-01', sport: 'Trail', distanceKm: 10, durationS: 3600, series: [] };
  iso.saveSession(s.id, s);
  assert(iso.linkSessionToPlanned('x1', 'p-fract') === true, 'le lien doit pouvoir être posé');
  assert(iso.loadSession('x1').plannedUid === 'p-fract', 'le lien doit être persisté localement');

  /* CLAUDE.md est explicite : tout champ absent de sessionToActivityRow est DÉTRUIT au retour,
     puisque syncActivitiesWithSupabase réécrit le cache local depuis les lignes distantes. Un lien
     posé par l'utilisateur ne doit pas disparaître à la première resynchronisation. */
  const row = iso.sessionToActivityRow(iso.loadSession('x1'), 'user-test', null);
  assert(row.raw.clientMeta.plannedUid === 'p-fract',
    'le lien explicite doit voyager vers Supabase, obtenu ' + JSON.stringify(row.raw.clientMeta.plannedUid));
  const retour = iso.activityRowToSession(row);
  assert(retour.plannedUid === 'p-fract', 'le lien explicite doit survivre à l\'aller-retour');

  // La provenance du D+ suit le même chemin : sans elle, une estimation redeviendrait une mesure.
  const s2 = Object.assign({}, s, { id: 'x2', ascent: 300, ascentSource: 'estimated', ascentMethod: 'Reconstruit.' });
  const row2 = iso.sessionToActivityRow(s2, 'user-test', null);
  assert(iso.activityRowToSession(row2).ascentSource === 'estimated',
    'la provenance du dénivelé doit survivre à l\'aller-retour');

  // Et une ré-analyse depuis le fichier .fit ne doit pas effacer la confirmation de l'utilisateur.
  // `const` de haut niveau : non exposé au contexte VM, on le vérifie donc dans la source.
  const src = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
  const decl = src.split('\n').find(l => l.includes('const SESSION_USER_FIELDS'));
  assert(decl && decl.includes("'plannedUid'"),
    'plannedUid doit figurer parmi les champs utilisateur préservés à la ré-analyse');
  return { lien: 'préservé', provenanceDplus: 'préservée' };
});


await test('V2-P0D1', 'Readiness : aucun libellé n\'affirme plus qu\'une préparation est excellente', async () => {
  const iso = loadApp();
  // Audit §7.1 : « Excellente préparation » et « Sur la bonne voie » sont des jugements globaux que
  // ces heuristiques ne portent pas — la littérature trail conclut qu'aucun score simple ne décrit
  // une préparation (§6.2). Les libellés doivent décrire une adéquation à des repères, pas un état.
  const interdits = /excellente pr[ée]paration|sur la bonne voie|dans les clous/i;
  [95, 85, 70, 60, 30].forEach(n => {
    ['race', 'general'].forEach(scope => {
      const l = iso.readinessLevelLabel(n, { scope, diverging: false });
      assert(l && !interdits.test(l), 'libellé trop fort pour ' + n + ' (' + scope + ') : « ' + l + ' »');
    });
  });
  // La portée doit rester lisible dans le libellé : « générale » n'est pas « pour cette course ».
  assert(/g[ée]n[ée]rique/i.test(iso.readinessLevelLabel(90, { scope: 'general' })),
    'sans plan lié, le libellé doit nommer le caractère générique du repère');
  assert(/plan/i.test(iso.readinessLevelLabel(90, { scope: 'race' })),
    'avec un plan lié, le libellé doit se référer au plan');
  // Une divergence prime toujours : jamais un verdict rassurant à côté d'un écart majeur.
  assert(/[ÉE]cart important/i.test(iso.readinessLevelLabel(95, { diverging: true })),
    'une divergence doit rester annoncée comme telle');

  // Le statut hebdomadaire du plan ne dit plus « dans les clous ».
  const src = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
  const codeSeul = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert(!/'Dans les clous'/.test(codeSeul), 'le libellé « Dans les clous » ne doit plus être produit');
  return { libelles: [90, 70, 30].map(n => iso.readinessLevelLabel(n, { scope: 'race' })) };
});

await test('V2-P0D2', 'Readiness : les repères génériques ne fabriquent plus d\'indice global', async () => {
  const iso = loadApp();
  const today = iso.todayISO(), jour = n => iso.addDaysIso(today, n);
  // Historique fourni, AUCUN plan importé : tous les repères disponibles sont génériques.
  for (let i = 1; i <= 24; i++) {
    seedSession(iso, { id: 'g' + i, date: jour(-i * 3), sport: 'Trail', distanceKm: 18, ascent: 700, durationS: 7200, series: [] });
  }
  iso.clearPlan();
  const race = { id: 'r1', name: 'Course', date: jour(60), distanceKm: 50, denivele: 3000, statut: 'principal' };
  iso.saveRaces([race]);

  const r = iso.computeRaceReadiness(race);
  assert(r.overall === null,
    'sans plan, aucun indice global ne doit être produit à partir de repères de manuel, obtenu ' + r.overall);
  assert(/g[ée]n[ée]riques/i.test(r.unscoredWhy || ''), 'la raison doit nommer le caractère générique des repères');
  assert(/plan/i.test(r.unscoredWhy || ''), 'la raison doit indiquer ce qui rendrait l\'indice calculable');
  // Les dimensions restent lisibles une par une : on retire un chiffre trompeur, pas l'information.
  const calculables = r.subs.filter(s => s.score != null);
  assert(calculables.length >= 3, 'les sous-scores doivent rester calculables et affichés, obtenu ' + calculables.length);
  assert(r.weakest != null, 'la dimension la plus basse reste une observation utile');
  // Chaque sous-score dit sur quel repère il s'appuie.
  r.subs.forEach(s => assert(s.benchmark, 'le sous-score ' + s.key + ' doit nommer son repère'));
  assert(r.subs.find(s => s.key === 'intensite').inGlobal === false,
    'le repère de 15 % de Z3+ (heuristique non validée) ne doit jamais entrer dans un indice global');

  // Avec un plan, l'indice redevient calculable : il compare alors aux cibles choisies par l'utilisateur.
  const plan = [];
  for (let i = -27; i <= 7; i++) plan.push({ uid: 'u' + i, date: jour(i), type: 'Footing', distanceKm: 12, deniveleM: 450, intensite: 'Z2' });
  iso.savePlan(plan);
  const r2 = iso.computeRaceReadiness(race);
  assert(r2.overall != null, 'avec un plan importé, un indice global redevient légitime');
  assert(r2.subs.find(s => s.key === 'volume').benchmark === 'plan', 'le volume doit alors se comparer au plan');
  assert(r2.subs.find(s => s.key === 'longues').benchmark === 'plan',
    'la sortie longue doit se comparer à la plus longue séance planifiée, pas au repère de 60 %');
  return { sansPlan: r.overall, avecPlan: r2.overall, reperes: r.subs.map(s => s.key + ':' + s.benchmark) };
});

await test('V2-G14', 'Charge en hausse : aucune consigne de repos, aucune donnée de récupération n\'existe', async () => {
  const iso = loadApp();
  const today = iso.todayISO(), jour = n => iso.addDaysIso(today, n);
  // Volume en forte hausse sur la semaine en cours.
  for (let i = 8; i <= 35; i++) seedSession(iso, { id: 'b' + i, date: jour(-i), sport: 'Trail', distanceKm: 6, ascent: 150, durationS: 2400, series: [] });
  for (let i = 0; i <= 6; i++) seedSession(iso, { id: 'h' + i, date: jour(-i), sport: 'Trail', distanceKm: 25, ascent: 900, durationS: 9000, series: [] });

  // Chemin réel de l'Accueil (index.html) : generateElevInsight retourne UN insight, les latéraux
  // s'y ajoutent, et c'est la page qui priorise. On reproduit ce chemin plutôt qu'un raccourci.
  const res = iso.prioritizeInsights(
    [iso.generateElevInsight()].concat(iso.generateElevSideInsights()).filter(Boolean), {});
  const tous = [res.primary].concat(res.secondary || [], res.dropped || []).filter(Boolean);
  assert(tous.length >= 1, 'une observation de charge doit être produite sur ce jeu — rejets : ' + JSON.stringify(res.rejected));
  tous.forEach(i => {
    // §6.1, réf. Impellizzeri 2020 et Meeusen 2013 : ni prédiction de blessure, ni surentraînement,
    // ni consigne de récupération — ELEV ne mesure ni sommeil, ni FC de repos, ni ressenti.
    assert(iso.insightRejectionReason(i) === null, 'observation hors contrat : ' + i.id);
    const action = i.recommendation || '';
    assert(!/r[ée]cup[ée]ration|repos|48\s*h/i.test(action),
      'aucune consigne de récupération ne doit être produite : « ' + action + ' »');
    assert(!/risque de blessure|surentra[îi]nement/i.test([i.observation, i.interpretation, i.uncertainty].join(' ')),
      'aucun langage de blessure ou de surentraînement : ' + i.id);
  });
  return { observations: tous.map(i => i.id) };
});


await test('V2-G16', 'IA : une réponse contenant un fait absent de l\'objet source est rejetée', async () => {
  const iso = loadApp();
  const session = { id: 's1', date: '2026-09-01', sport: 'Trail', distanceKm: 18.7, ascent: 1452, descent: 1982, durationS: 15660, avgHr: 165 };
  const planned = { uid: 'p1', date: '2026-09-01', type: 'Sortie longue', distanceKm: 17, deniveleM: 1700, intensite: 'Z2' };
  const allowed = iso.buildAllowedFacts({ session, planned, history: [], zones: [], insights: [], hasRecoveryData: false });

  const bonne = JSON.stringify({
    resume: 'Sortie longue et vallonnée, menée au-dessus de l\'intensité prévue.',
    analyse: ['18,7 km pour 17 km prévus', '1452 m D+ pour 1700 m prévus'],
    positif: ['Distance et dénivelé tenus sur terrain pentu'],
    suite: ['Revoir l\'allure cible sur la prochaine sortie longue'],
  });
  const okRes = iso.validateAiOutput(bonne, allowed);
  assert(okRes.ok, 'une réponse conforme doit être acceptée, refusée pour : ' + JSON.stringify(okRes.reasons));

  // Le cas exact du jeu G16 : « 48 h » n'existe dans aucune donnée.
  const avec48h = JSON.stringify({
    resume: 'Sortie exigeante.', analyse: ['18,7 km parcourus'], positif: ['Effort tenu'],
    suite: ['48 h de vigilance avant la prochaine grosse séance'],
  });
  const r48 = iso.validateAiOutput(avec48h, allowed);
  assert(!r48.ok, 'une réponse prescrivant « 48 h de vigilance » doit être rejetée');
  assert(r48.data === null, 'une réponse rejetée ne doit jamais être exploitable');

  // Nombre inventé : 2400 m de D+ n'a pas été mesuré.
  const inventeChiffre = JSON.stringify({
    resume: 'Sortie exigeante.', analyse: ['2400 m de D+ cumulés sur la séance'],
    positif: ['Effort tenu'], suite: ['Continuer ainsi'],
  });
  const rNum = iso.validateAiOutput(inventeChiffre, allowed);
  assert(!rNum.ok, 'un nombre absent des données doit faire rejeter la réponse');
  assert(rNum.reasons.some(x => /2400/.test(x)), 'la raison doit nommer la valeur inventée : ' + JSON.stringify(rNum.reasons));

  // Consigne de récupération : aucune donnée de récupération n'est suivie.
  const repos = JSON.stringify({
    resume: 'Sortie exigeante.', analyse: ['18,7 km parcourus'], positif: ['Effort tenu'],
    suite: ['Prioriser la récupération avant la prochaine charge'],
  });
  assert(!iso.validateAiOutput(repos, allowed).ok, 'une consigne de récupération doit être rejetée');

  // Causalité affirmée : les facteurs (chaleur, hydratation, terrain) ne sont pas contrôlés.
  const cause = JSON.stringify({
    resume: 'Sortie exigeante.', analyse: ["Ta FC est montée, ce qui prouve une baisse d'endurance"],
    positif: ['Effort tenu'], suite: ['Continuer ainsi'],
  });
  assert(!iso.validateAiOutput(cause, allowed).ok, 'une causalité affirmée doit être rejetée');

  // Langage médical et prédiction de blessure.
  const medical = JSON.stringify({
    resume: 'Sortie exigeante.', analyse: ['18,7 km parcourus'],
    positif: ['Effort tenu'], vigilance: ['Ta cheville est fragilisée'], suite: ['Continuer ainsi'],
  });
  assert(!iso.validateAiOutput(medical, allowed).ok, 'une affirmation sur l\'état du corps doit être rejetée');

  // Champ hors schéma : une clé en plus est une affirmation que rien n'a validée.
  const clePlus = JSON.stringify({
    resume: 'Sortie exigeante.', analyse: ['18,7 km parcourus'], positif: ['Effort tenu'],
    suite: ['Continuer ainsi'], pronostic: 'Tu finiras la course en 8h',
  });
  const rCle = iso.validateAiOutput(clePlus, allowed);
  assert(!rCle.ok && rCle.reasons.some(x => /pronostic/.test(x)), 'une clé hors schéma doit être rejetée');

  // Réponse illisible : rejetée, jamais devinée.
  assert(!iso.validateAiOutput('Voici mon analyse en texte libre.', allowed).ok,
    'une réponse non JSON doit être rejetée');
  return { conforme: true, rejets: ['48h', 'nombre inventé', 'récupération', 'causalité', 'médical', 'clé en trop', 'non-JSON'] };
});

await test('V2-P0E', 'IA : le prompt ne prescrit plus, et l\'estimation ne remplit plus le temps visé', async () => {
  const act = fs.readFileSync(path.join(root, 'activite.html'), 'utf8');
  const obj = fs.readFileSync(path.join(root, 'objectifs.html'), 'utf8');

  // L'exemple du prompt coach prescrivait « Prioriser la récupération » et « 48 h de vigilance ».
  // Ces formulations ne doivent plus apparaître QUE dans le contre-exemple, qui les montre comme
  // interdites — jamais dans l'exemple à imiter.
  const exemple = act.slice(act.indexOf('<exemple>'), act.indexOf('</exemple>'));
  assert(!/48\s*h\s*de\s*vigilance/i.test(exemple), "l'exemple du prompt ne doit plus prescrire de délai");
  assert(!/prioriser la r[ée]cup/i.test(exemple), "l'exemple du prompt ne doit plus prescrire de récupération");
  assert(/contre_exemple/.test(act), 'un contre-exemple doit montrer explicitement ce qui est refusé');

  // Sortie JSON stricte et validation branchée.
  assert(/validateAiOutput\(/.test(act), 'la réponse du coach doit être validée avant affichage');
  assert(/buildAllowedFacts\(/.test(act), "l'objet déterministe autorisé doit être construit avant l'appel");
  assert(/aiOutputContract\(/.test(act), 'le contrat de sortie doit être joint au prompt');
  assert(act.indexOf('buildAllowedFacts(') < act.indexOf('await callElevAi'),
    'le calcul doit précéder le texte : les faits autorisés sont construits AVANT l\'appel');

  // Estimation de course : plus de remplissage automatique du temps visé.
  assert(!/id="raceAiUseBtn"/.test(obj), 'le bouton « Utiliser comme temps visé » doit avoir été retiré');
  assert(!/function extractTimeGuess/.test(obj), 'l\'extraction automatique d\'un temps doit avoir été retirée');
  assert(/Expérimental/.test(obj), "l'estimation doit être étiquetée expérimentale à l'écran");
  assert(/non calibr/i.test(obj), "l'absence de calibration doit être dite à l'utilisateur");

  // Le bug d'âge relevé par l'audit §4.3 : profile.age n'existe pas dans le modèle de profil.
  // On ne regarde que le CODE : les commentaires citent le défaut corrigé, c'est leur rôle.
  const objCode = obj.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert(!/profile\.age\b/.test(objCode), "l'âge ne doit plus être lu depuis un champ inexistant");
  assert(/profile\.naissance/.test(obj), "l'âge doit être dérivé de la date de naissance");

  // La façade serveur reste seule détentrice du secret : aucune clé côté navigateur.
  assert(!/getApiKey\s*\(/.test(act) && !/getApiKey\s*\(/.test(obj),
    'aucune clé API ne doit être lue côté navigateur');
  return { promptCoach: 'JSON strict validé', estimation: 'expérimentale, sans remplissage auto' };
});


await test('V2-P0B5', 'Les métriques analytiques sont calculées avant la réduction d\'affichage', async () => {
  const iso = loadApp();
  const base = 1000000;
  /* Séance longue et détaillée : 6000 points, bien au-delà de la cible de ~1200 de la réduction
     LTTB. Deux montées franches séparées par une descente, pour que le résultat soit vérifiable. */
  const records = [];
  for (let i = 0; i < 6000; i++) {
    const phase = Math.floor(i / 1500);
    const monte = (phase === 0 || phase === 2);
    const alt = 100 + (phase === 0 ? i * 0.2
      : phase === 1 ? 300 - (i - 1500) * 0.2
      : phase === 2 ? (i - 3000) * 0.2
      : 300 - (i - 4500) * 0.2);
    records.push({ timestamp: base + i, altitude: alt, distance: i * 2, heart_rate: monte ? 165 : 135, cadence: monte ? 65 : 85, speed: 2 });
  }
  const sum = iso.summarizeFit({ record: records, session: [{}] }, {});

  assert(sum.analytics && sum.analytics.source === 'full',
    'la séance doit porter des métriques calculées sur la série complète');
  assert(sum.analytics.pointCount === 6000,
    'les métriques doivent porter sur les 6000 points enregistrés, obtenu ' + sum.analytics.pointCount);
  assert(sum.series.length < 2000,
    'la série stockée pour l\'affichage doit rester réduite, obtenu ' + sum.series.length + ' points');
  assert(sum.analytics.climbs.length >= 2,
    'les deux montées doivent être détectées, obtenu ' + sum.analytics.climbs.length);

  // Le point de vérité : les montées enregistrées viennent de la série complète, pas de la réduite.
  const surSerieReduite = iso.detectClimbs(sum.series);
  const dureeAnalytique = sum.analytics.climbs.reduce((a, c) => a + c.durationS, 0);
  const dureeReduite = surSerieReduite.reduce((a, c) => a + c.durationS, 0);
  assert(iso.sessionClimbs(sum) === sum.analytics.climbs,
    'sessionClimbs doit préférer le calcul fait avant réduction');

  // Et le résultat doit survivre à l'aller-retour Supabase : sinon il serait détruit au retour.
  const row = iso.sessionToActivityRow(Object.assign({ id: 'a1' }, sum), 'user-test', null);
  assert(row.raw.clientMeta.analytics && row.raw.clientMeta.analytics.source === 'full',
    'les métriques analytiques doivent voyager vers Supabase');
  assert(iso.activityRowToSession(row).analytics.source === 'full',
    'les métriques analytiques doivent survivre à l\'aller-retour');

  // Une séance importée AVANT ce changement n'a pas d'analytics : elle doit rester lisible.
  const ancienne = { id: 'old', date: '2026-01-01', series: sum.series };
  assert(Array.isArray(iso.sessionClimbs(ancienne)),
    'une séance sans analytics doit retomber proprement sur sa série réduite');
  return { pointsAnalyses: sum.analytics.pointCount, pointsStockes: sum.series.length,
           dureeMonteesAnalytique: dureeAnalytique, dureeMonteesSurSerieReduite: dureeReduite };
});


await test('V2-P0B6', 'Fenêtres temporelles : ni double compte ni trou aux bornes', async () => {
  const iso = loadApp();
  const today = iso.todayISO(), jour = n => iso.addDaysIso(today, n);

  /* Audit Insight V2, §11.1 : « fenêtre 28 jours — bornes et nombre de jours non ambigus ».
     Une séance posée exactement sur une borne ne doit être comptée ni deux fois (si deux fenêtres
     adjacentes l'incluent toutes deux) ni zéro fois (si aucune ne l'inclut). */
  const jours = [];
  for (let i = 0; i < 40; i++) jours.push(jour(-i));
  jours.forEach((d, i) => seedSession(iso, { id: 'w' + i, date: d, sport: 'Trail', distanceKm: 10, ascent: 100, durationS: 3600, series: [] }));

  const toutes = iso.loadAllSessions();
  assert(toutes.length === 40, '40 séances doivent exister, obtenu ' + toutes.length);

  // Découpage hebdomadaire : chaque séance doit appartenir à exactement une semaine.
  const semaines = iso.groupByWeek(toutes, jour(-39), today);
  const totalSemaines = semaines.reduce((a, w) => a + (w.km || 0), 0);
  const totalReel = toutes.reduce((a, s) => a + s.distanceKm, 0);
  assert(Math.abs(totalSemaines - totalReel) < 0.01,
    'la somme par semaine doit égaler le total réel (' + totalSemaines + ' vs ' + totalReel + ')');

  /* Les 4 fenêtres de 7 jours de la tendance ne doivent pas se chevaucher : 28 jours consécutifs à
     10 km doivent donner exactement 70 km par fenêtre, jamais 80 (une journée comptée deux fois). */
  const trend = iso.getTrainingTrend();
  assert(trend && trend.available, 'la tendance doit être calculable sur 40 jours pleins');
  trend.weeks.forEach((km, i) => assert(Math.abs(km - 70) < 0.01,
    'la fenêtre ' + i + ' doit contenir exactement 7 jours de 10 km, obtenue à ' + km + ' km'));
  const sommeFenetres = trend.weeks.reduce((a, b) => a + b, 0);
  assert(Math.abs(sommeFenetres - 280) < 0.01,
    'les 4 fenêtres doivent couvrir 28 jours distincts (280 km), obtenu ' + sommeFenetres);

  /* Fenêtre de préparation : elle annonce un nombre de jours, il doit correspondre à ce qu'elle
     compte réellement. 28 jours de fenêtre = 28 séances à 10 km. */
  const plan = [];
  for (let i = -40; i <= 0; i++) plan.push({ uid: 'p' + i, date: jour(i), type: 'Footing', distanceKm: 10, deniveleM: 100 });
  iso.savePlan(plan);
  const prep = iso.computePrepStatus();
  assert(prep, 'un état de préparation doit être calculable');
  assert(prep.windowDays === 29,
    'la fenêtre doit annoncer exactement le nombre de jours qu\'elle couvre (bornes incluses), obtenu ' + prep.windowDays);
  assert(Math.abs(prep.doneKm - prep.windowDays * 10) < 0.01,
    'le volume réalisé doit correspondre au nombre de jours annoncé (' + prep.doneKm + ' km pour ' + prep.windowDays + ' jours)');
  return { fenetresHebdo: trend.weeks, joursPreparation: prep.windowDays, kmPreparation: prep.doneKm };
});


await test('V2-P1B', 'Registre de preuve : niveaux A/B/C/D/X, sources réelles, dates de revue', async () => {
  const iso = loadApp();
  const src = fs.readFileSync(path.join(root, 'assets', 'elev-evidence.js'), 'utf8');

  // Les 19 sources documentées par l'audit §6 doivent être présentes, avec leur identifiant.
  const nbSources = (src.match(/pmid:\s*'/g) || []).length;
  assert(nbSources >= 19, 'les 19 sources de l\'audit doivent être enregistrées, trouvé ' + nbSources);

  // Chaque affirmation porte un niveau, des limites et une date de revue.
  const claims = ['CLAIM-ACWR-NO-INJURY-PREDICTION', 'CLAIM-NO-RECOVERY-INFERENCE',
    'CLAIM-WALKRUN-CADENCE-ESTIMATE', 'CLAIM-VAM-WITHIN-RUNNER', 'CLAIM-PLAN-ADHERENCE',
    'CLAIM-NO-TRAIL-READINESS-SCORE', 'CLAIM-RACE-TIME-UNCALIBRATED'];
  claims.forEach(id => {
    const c = iso.evidenceClaim(id);
    assert(c, 'affirmation absente du registre : ' + id);
    assert(c.grade && iso.EVIDENCE_GRADES[c.grade], id + ' doit porter un niveau valide');
    assert(c.reviewedAt && c.reviewDueAt, id + ' doit porter une date de revue et une échéance');
    assert(Array.isArray(c.limitations), id + ' doit déclarer ses limites');
  });

  // Une action n'est permise qu'au niveau A ou B (§9.1, principe 6).
  assert(iso.evidenceAllowsAction('CLAIM-HR-CONFOUNDED'), 'une preuve B doit autoriser une action');
  assert(!iso.evidenceAllowsAction('CLAIM-VAM-WITHIN-RUNNER'), 'un repère C ne doit pas autoriser une action');
  assert(!iso.evidenceAllowsAction('CLAIM-WALKRUN-CADENCE-ESTIMATE'), 'un niveau D ne doit jamais autoriser une action');

  // Les citations sont réelles : elles portent un identifiant vérifiable, jamais une URL fabriquée.
  const s = iso.evidenceSources('CLAIM-ACWR-NO-INJURY-PREDICTION');
  assert(s.length >= 2, 'cette interdiction doit s\'appuyer sur plusieurs sources');
  assert(s.every(x => x.doi || x.pmid), 'chaque source doit porter un DOI ou un PMID');
  assert(/Impellizzeri/.test(iso.evidenceCitation(s[0])), 'la citation doit être lisible');
  return { sources: nbSources, affirmations: Object.keys(iso.EVIDENCE_CLAIMS).length };
});

await test('V2-P1C', 'Triple confiance : plafonnée par la plus faible, jamais moyennée', async () => {
  const iso = loadApp();
  // Données parfaites, preuve scientifique faible : la conclusion ne peut pas être « haute ».
  const charge = iso.makeInsight({
    id: 'test.charge', family: 'load', observation: 'Volume en hausse de 30 %.',
    reference: 'moyenne 4 semaines', dataConfidence: 'high', inferenceConfidence: 'high',
    claimId: 'CLAIM-LOAD-DESCRIPTIVE', importance: 'notable',
  });
  assert(charge.confidenceDetail.data === 'high', 'la donnée peut rester haute');
  assert(charge.confidenceDetail.science === 'medium', 'un repère C vaut une confiance scientifique moyenne');
  assert(charge.confidence === 'medium',
    'la confiance affichée doit être plafonnée par la plus faible, obtenu ' + charge.confidence);

  // Une estimation de niveau D plafonne à « faible », même avec des données impeccables.
  const marche = iso.makeInsight({
    id: 'test.marche', family: 'terrain', observation: 'Estimation : marche sur 60 % du temps.',
    dataConfidence: 'high', inferenceConfidence: 'high', claimId: 'CLAIM-WALKRUN-CADENCE-ESTIMATE',
    provenance: 'inferred', method: 'Estimation ELEV.', importance: 'context',
  });
  assert(marche.confidence === 'low', 'un niveau D doit plafonner la confiance à faible, obtenu ' + marche.confidence);

  // Jamais l'inverse : une preuve forte ne relève pas une donnée pauvre.
  const pauvre = iso.makeInsight({
    id: 'test.pauvre', family: 'effort', observation: 'Test.', dataConfidence: 'low',
    claimId: 'CLAIM-DIRECT-MEASURE', importance: 'context',
  });
  assert(pauvre.confidence === 'low', 'une preuve A ne doit jamais relever une donnée faible');

  // Sans preuve déclarée, la dimension scientifique ne plafonne pas arbitrairement.
  const sansClaim = iso.makeInsight({
    id: 'test.sansclaim', family: 'effort', observation: 'Test.', confidence: 'high', importance: 'context',
  });
  assert(sansClaim.confidence === 'high',
    'sans preuve déclarée, la confiance ne doit pas être dégradée sans raison');
  assert(sansClaim.confidenceDetail.science === null, 'la dimension scientifique doit être explicitement inconnue');

  // Une recommandation adossée à un repère C ou D est refusée à la publication.
  const conseilFaible = iso.makeInsight({
    id: 'test.conseil', family: 'terrain', observation: 'Estimation : marche fréquente.',
    recommendation: 'Travaille ta cadence en montée.', claimId: 'CLAIM-WALKRUN-CADENCE-ESTIMATE',
    provenance: 'inferred', method: 'Estimation ELEV.', importance: 'notable',
  });
  const raison = iso.insightRejectionReason(conseilFaible);
  assert(raison && /preuve de niveau D/.test(raison),
    'une recommandation de niveau D doit être refusée, obtenu ' + JSON.stringify(raison));
  return { chargeC: charge.confidence, marcheD: marche.confidence, sansPreuve: sansClaim.confidence };
});

await test('V2-P1D', 'Contradictions : les signaux opposés restent visibles, jamais moyennés', async () => {
  const iso = loadApp();
  const base = { window: '4 semaines', reference: 'période précédente', importance: 'notable' };
  // Alerte de qualité de donnée + conclusion tirée de ce même signal (§8.3).
  const res = iso.prioritizeInsights([
    iso.makeInsight(Object.assign({ id: 'a', family: 'data', observation: 'FC disponible sur 62 % du temps seulement.', confidence: 'high' }, base)),
    iso.makeInsight(Object.assign({ id: 'b', family: 'effort', observation: '58 % du temps en zone 3 ou plus.', confidence: 'medium' }, base)),
  ], {});
  assert(res.contradictions.length >= 1, 'la tension donnée/conclusion doit être détectée');
  assert(res.primary && res.secondary.length === 1, 'les deux observations doivent RESTER affichées');
  assert(/qualité de donnée/i.test(res.contradictions[0].text), 'la contradiction doit être nommée en clair');

  // Deux observations de même famille en sens opposé.
  const res2 = iso.prioritizeInsights([
    iso.makeInsight(Object.assign({ id: 'c', family: 'load', observation: 'Volume +18 %.', delta: 18, confidence: 'high' }, base)),
    iso.makeInsight(Object.assign({ id: 'd', family: 'load', observation: 'Dénivelé -25 %.', delta: -25, confidence: 'high' }, base)),
  ], {});
  assert(res2.contradictions.some(x => x.kind === 'opposite-directions'),
    'deux deltas de signes opposés doivent être signalés');

  // Le rendu affiche la contradiction avant les observations, avec un symbole et pas qu'une couleur.
  const html = iso.insightBlockHtml(res, { headingLevel: 3 });
  assert(/insight-contradiction/.test(html), 'la contradiction doit être rendue');
  assert(html.indexOf('insight-contradiction') < html.indexOf('insight-card'),
    'la contradiction doit précéder les observations qu\'elle conditionne');
  assert(/dq-sym/.test(html), 'le statut ne doit pas reposer sur la seule couleur');
  return { tensions: res.contradictions.map(c => c.kind).concat(res2.contradictions.map(c => c.kind)) };
});

await test('V2-P1E', 'Priorité multiplicative, cooldown et feedback local', async () => {
  const iso = loadApp();
  const base = { window: '4 semaines', reference: 'période précédente' };
  const mk = (id, o) => iso.makeInsight(Object.assign({ id, family: o.family || 'load', observation: 'Obs ' + id }, base, o));

  // Multiplicatif : une preuve faible ne peut pas être compensée par le reste.
  const fort = mk('fort', { confidence: 'high', claimId: 'CLAIM-DIRECT-MEASURE', importance: 'notable' });
  const faible = mk('faible', { family: 'terrain', confidence: 'high', claimId: 'CLAIM-WALKRUN-CADENCE-ESTIMATE',
    importance: 'notable', provenance: 'inferred', method: 'Estimation ELEV.' });
  const pf = iso.insightPriorityScore(fort, {}, new Date());
  const pfb = iso.insightPriorityScore(faible, {}, new Date());
  assert(pf.score > pfb.score, 'une preuve forte doit primer sur une estimation à données égales');

  // Cooldown : un contexte déjà montré récemment perd en nouveauté…
  const now = new Date('2026-08-23T12:00:00Z');
  const hier = { 'ctx': { lastShownAt: '2026-08-22T12:00:00Z', shownCount: 1 } };
  const ctxIns = mk('ctx', { importance: 'context', confidence: 'medium' });
  assert(iso.insightPriorityScore(ctxIns, hier, now).novelty < 1, 'un contexte récemment montré doit perdre en nouveauté');
  assert(iso.insightPriorityScore(ctxIns, {}, now).novelty === 1, 'jamais montré : nouveauté au plafond');

  // …mais une alerte importante n'est JAMAIS effacée parce qu'elle dure (§9.4, règle de sécurité).
  const alerte = mk('alerte', { importance: 'attention', confidence: 'high' });
  const vu = { 'alerte': { lastShownAt: '2026-08-22T12:00:00Z', shownCount: 9 } };
  assert(iso.insightPriorityScore(alerte, vu, now).novelty === 1,
    'une alerte persistante ne doit pas disparaître par le délai de répétition');

  // Un changement matériel rouvre le sujet avant la fin du délai.
  const avecValeurs = mk('ctx', { importance: 'context', confidence: 'medium', values: { pct: 42 } });
  const ancien = { 'ctx': { lastShownAt: '2026-08-22T12:00:00Z', lastCalculationHash: JSON.stringify({ pct: 10 }) } };
  assert(iso.insightPriorityScore(avecValeurs, ancien, now).novelty === 1,
    'un changement matériel doit rouvrir le sujet malgré le délai');

  // Un insight masqué par l'utilisateur ne remonte pas — sauf s'il est critique.
  const masque = { 'ctx': { verdict: 'hidden', lastShownAt: null } };
  assert(iso.insightPriorityScore(ctxIns, masque, now).novelty === 0, 'un insight masqué ne doit pas remonter');
  const critique = mk('ctx', { importance: 'critical', confidence: 'high' });
  assert(iso.insightPriorityScore(critique, masque, now).novelty === 1,
    'une alerte critique ne peut pas être masquée par un retour utilisateur');

  // L'historique d'affichage est local et alimente la nouveauté.
  iso.noteInsightsShown([ctxIns], '2026-08-23T12:00:00Z');
  const fb = iso.getInsightFeedback();
  assert(fb.ctx && fb.ctx.lastShownAt === '2026-08-23T12:00:00Z' && fb.ctx.shownCount === 1,
    'l\'affichage doit être mémorisé localement');
  return { scoreFort: pf.score, scoreEstimation: pfb.score };
});

await test('V2-P1F', 'InsightCard V2 : le volet de preuve montre méthode, niveau, sources et limites', async () => {
  const iso = loadApp();
  const ins = iso.makeInsight({
    id: 'demo', family: 'load', title: 'Volume en hausse',
    observation: 'Volume des 7 derniers jours supérieur de 30 % à la moyenne des 4 semaines.',
    reference: 'la moyenne des 4 fenêtres de 7 jours', delta: 30,
    interpretation: 'Une hausse de cette ampleur mérite d\'être vue.',
    uncertainty: 'Ce rapport ne mesure ni fatigue ni risque de blessure.',
    method: 'Volume des 7 derniers jours rapporté à la moyenne des 4 fenêtres.',
    definitionVersion: '2.0.0', values: { ratio: 1.3 },
    claimId: 'CLAIM-LOAD-DESCRIPTIVE', confidence: 'high', coverage: 0.9,
    importance: 'attention', window: '4 dernières semaines', provenance: 'computed',
  });
  const html = iso.insightCardHtml(ins, { primary: true, headingLevel: 3 });

  assert(/Comment ELEV le sait/.test(html), 'le volet de preuve doit rester accessible');
  assert(/Méthode/.test(html) && /règle v2\.0\.0/.test(html), 'méthode et version de règle doivent être visibles');
  assert(/Niveau de preuve/.test(html) && /Repère ELEV/.test(html), 'le niveau de preuve doit être affiché');
  assert(/Impellizzeri/.test(html), 'les sources réelles doivent être citées');
  assert(/Limites connues/.test(html), 'les limites de l\'affirmation doivent être visibles');
  assert(/donnée haute/.test(html) && /preuve scientifique moyenne/.test(html),
    'les trois confiances doivent être distinguées');
  assert(/plus faible des trois/.test(html), 'la règle du plafond doit être expliquée à l\'utilisateur');
  assert(/Règle revue le/.test(html), 'la date de revue doit être visible');
  assert(/ratio = 1\.3/.test(html), 'les valeurs employées doivent être vérifiables');
  assert(/Ce que cela ne dit pas/.test(html), 'l\'incertitude doit rester affichée');

  // Le premier niveau reste lisible sans ouvrir le volet.
  const avantDetail = html.slice(0, html.indexOf('<details'));
  assert(/Volume en hausse/.test(avantDetail) && /Comparé à/.test(avantDetail),
    'observation et référence doivent être lisibles sans ouvrir le détail');
  assert(!/Impellizzeri/.test(avantDetail), 'la science ne doit pas encombrer le premier niveau');
  return { volet: 'méthode + niveau + sources + limites + revue + valeurs' };
});


await test('V2-P1A', 'Registre de métriques : formule, unité, minimums et règle de valeur manquante', async () => {
  const iso = loadApp();
  const ids = Object.keys(iso.ELEV_METRICS);
  assert(ids.length >= 6, 'les métriques clés doivent être déclarées, trouvé ' + ids.length);

  ids.forEach(id => {
    const m = iso.elevMetric(id);
    assert(m.version && m.label && m.unit, id + ' doit porter version, libellé et unité');
    assert(m.formula, id + ' doit porter sa formule');
    assert(Array.isArray(m.requiredFields) && m.requiredFields.length, id + ' doit déclarer ses champs requis');
    assert(iso.METRIC_MISSING_POLICY[m.missingPolicy], id + ' doit déclarer une règle de valeur manquante connue');
    assert(Array.isArray(m.knownLimits) && m.knownLimits.length, id + ' doit déclarer ses limites connues');
    // Une métrique reliée à une affirmation doit pointer vers une affirmation qui existe.
    if (m.claimId) assert(iso.evidenceClaim(m.claimId), id + ' pointe vers une affirmation inconnue : ' + m.claimId);
  });

  // La correction de la VAM est inscrite dans la définition, pas seulement dans le code.
  const vam = iso.elevMetric('terrain.vam.aggregate');
  assert(/somme des dénivelés positifs \/ somme des durées/.test(vam.formula),
    'la formule de la VAM agrégée doit être celle corrigée');
  assert(vam.unit === 'm/h', 'la VAM doit porter son unité');

  // Aucune métrique ne doit transformer une absence en zéro.
  ids.forEach(id => assert(iso.elevMetric(id).missingPolicy !== 'zero',
    id + ' ne doit jamais convertir une absence en zéro'));

  // Le registre est réellement consommé par le volet de preuve.
  const ins = iso.makeInsight({
    id: 'm', family: 'load', observation: 'Test.', reference: 'ref',
    metricId: 'load.volume.ratio', definitionVersion: '2.0.0',
    claimId: 'CLAIM-LOAD-DESCRIPTIVE', confidence: 'high', importance: 'notable', window: '4 semaines',
  });
  const html = iso.insightCardHtml(ins, {});
  assert(/Formule/.test(html), 'le volet de preuve doit afficher la formule de la métrique');
  assert(/métrique v2\.0\.0/.test(html), 'la version de la métrique doit être visible');
  assert(/Minimums exigés/.test(html), 'les minimums doivent être visibles');
  assert(/plutôt que de valoir zéro/.test(html), 'la règle de valeur manquante doit être dite');
  return { metriques: ids.length };
});


await test('V2-P1E2', 'Le délai de répétition est réellement branché, pas seulement disponible', async () => {
  const iso = loadApp();
  const base = { window: '4 semaines', reference: 'période précédente' };
  const mk = (id, fam, imp) => iso.makeInsight(Object.assign({ id, family: fam, observation: 'Obs ' + id, importance: imp, confidence: 'high' }, base));

  /* Le défaut corrigé ici : `noteInsightsShown` existait, était testée, et AUCUNE page ne
     l'appelait — `lastShownAt` n'était donc jamais écrit et le cooldown restait inerte. Un
     mécanisme complet mais débranché, exactement comme `provenance` avant sa réparation.
     L'écriture appartient désormais au composant de rendu : aucune page ne peut l'oublier. */
  const res = iso.prioritizeInsights([mk('a', 'load', 'context'), mk('b', 'terrain', 'notable')], {});
  assert(Object.keys(iso.getInsightFeedback()).length === 0, 'aucun historique avant le rendu');

  iso.insightBlockHtml(res, { headingLevel: 3 });
  const fb = iso.getInsightFeedback();
  assert(fb.a && fb.b, 'le rendu doit mémoriser les observations réellement montrées');
  assert(fb.a.lastShownAt && fb.a.firstShownAt, 'les dates d\'affichage doivent être écrites');
  assert(fb.a.shownCount === 1, 'le compteur doit démarrer à 1');

  // Un second rendu incrémente : c'est ce compteur qui alimente la nouveauté.
  iso.insightBlockHtml(res, { headingLevel: 3 });
  assert(iso.getInsightFeedback().a.shownCount === 2, 'un nouvel affichage doit être compté');

  // Et le cooldown s'applique alors réellement sur un contexte.
  const p = iso.insightPriorityScore(mk('a', 'load', 'context'), iso.getInsightFeedback(), new Date());
  assert(p.novelty < 1, 'une observation de contexte tout juste montrée doit perdre en nouveauté');

  // La page de documentation rend des exemples : elle ne doit pas polluer l'historique.
  const iso2 = loadApp();
  iso2.insightBlockHtml(iso2.prioritizeInsights([mk('demo', 'load', 'context')], {}), { silent: true });
  assert(Object.keys(iso2.getInsightFeedback()).length === 0,
    'un rendu de démonstration ne doit pas alimenter l\'historique');

  // Le composant partagé est bien le lieu de l'écriture : aucune page ne doit avoir à l'appeler.
  const pages = ['index.html', 'analyse.html', 'objectifs.html', 'plan.html', 'activite.html'];
  pages.forEach(f => {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert(!/noteInsightsShown\s*\(/.test(src),
      f + ' ne doit pas avoir à appeler noteInsightsShown : le composant s\'en charge');
  });
  return { historique: 'ecrit par le composant', pagesSansAppel: pages.length };
});

await test('V2-P1G', 'Vue avancée : les observations valides non retenues restent atteignables', async () => {
  const iso = loadApp();
  const base = { window: '4 semaines', reference: 'période précédente', confidence: 'high' };
  const mk = (id, fam) => iso.makeInsight(Object.assign({ id, family: fam, observation: 'Obs ' + id, importance: 'notable' }, base));

  /* Audit §13 (P1) : « vue avancée montrant les insights valides non retenus ». Deux observations
     de la même famille : la seconde est valide, seule la règle « une par famille » l'écarte de la
     vue principale. La garder invisible reviendrait à décider à la place de l'utilisateur. */
  const res = iso.prioritizeInsights([
    mk('l1', 'load'), mk('l2', 'load'), mk('t1', 'terrain'),
  ], {});
  assert(res.dropped.length >= 1, 'une observation valide doit être écartée par la règle de famille');
  assert(res.rejected.length === 0, 'aucune de ces observations ne doit être rejetée sur le fond');

  const html = iso.insightBlockHtml(res, { headingLevel: 3, silent: true });
  assert(/insight-more/.test(html), 'la vue avancée doit être rendue');
  assert(/Autres observations \(1\)/.test(html), 'elle doit annoncer combien d\'observations elle contient');
  assert(/data-insight-id="l2"/.test(html), 'l\'observation écartée doit être réellement présente');
  assert(/une observation par famille/.test(html), 'la raison de l\'écart doit être expliquée');
  // Repliée par défaut : secondaire, mais jamais masquée.
  assert(/<details class="insight-more"><summary>/.test(html), 'la vue avancée doit être repliée, pas cachée');
  assert(html.indexOf('insight-more') > html.indexOf('insight-card'),
    'elle doit venir après les observations principales');

  // Sans observation écartée, aucune section vide n'est ajoutée.
  const seul = iso.insightBlockHtml(iso.prioritizeInsights([mk('x', 'load')], {}), { silent: true });
  assert(!/insight-more/.test(seul), 'aucune vue avancée quand il n\'y a rien à y montrer');
  return { ecartees: res.dropped.length, rendues: true };
});

/* --------------------------- rapport --------------------------- */
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.length - passed;
console.log(JSON.stringify({ summary: { total: results.length, passed, failed }, results }, null, 2));
if (failed) process.exitCode = 1;
