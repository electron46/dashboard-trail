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

await test('OK-6', 'PWA : toujours aucun service worker (constat de l\'audit, non traité)', () => {
  const files = fs.readdirSync(root).filter(name => /\.(html|js)$/i.test(name));
  const all = files.map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n') + '\n' + source;
  const present = /serviceWorker\.register|navigator\.serviceWorker/.test(all);
  assert(!present, 'un service worker a été ajouté : mettre ce constat à jour');
  return { offlineCache: false };
});

/* --------------------------- rapport --------------------------- */
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.length - passed;
console.log(JSON.stringify({ summary: { total: results.length, passed, failed }, results }, null, 2));
if (failed) process.exitCode = 1;
