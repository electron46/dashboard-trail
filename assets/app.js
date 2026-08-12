/* =========================================================================
   ELEV — logique partagée par toutes les pages (dashboard-trail).
   1) Thème (clair/sombre)   2) Parsing .FIT   3) Stockage (localStorage)
   4) Plan CSV   5) Formatage   6) Utilitaires DOM
   ========================================================================= */

/* --------------------------- 1) THÈME --------------------------- */
const THEME_KEY = 'trail:theme';
function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } }
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀ Clair' : '● Sombre';
}
function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  applyTheme(next);
}
applyTheme(getTheme()); // appliqué dès le chargement du script (avant le rendu du contenu)

/* --------------------------- 2) PARSING .FIT --------------------------- */
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);
const GLOBAL_MESSAGES = { 0:'file_id', 18:'session', 19:'lap', 20:'record', 21:'event', 23:'device_info', 34:'activity' };
const BASE_TYPES = {
  0x00:{bsize:1,invalid:0xFF, read:(v,o)=>v.getUint8(o)},
  0x01:{bsize:1,invalid:0x7F, read:(v,o)=>v.getInt8(o)},
  0x02:{bsize:1,invalid:0xFF, read:(v,o)=>v.getUint8(o)},
  0x83:{bsize:2,invalid:0x7FFF, read:(v,o,le)=>v.getInt16(o,le)},
  0x84:{bsize:2,invalid:0xFFFF, read:(v,o,le)=>v.getUint16(o,le)},
  0x85:{bsize:4,invalid:0x7FFFFFFF, read:(v,o,le)=>v.getInt32(o,le)},
  0x86:{bsize:4,invalid:0xFFFFFFFF, read:(v,o,le)=>v.getUint32(o,le)},
  0x88:{bsize:4,invalid:null, read:(v,o,le)=>v.getFloat32(o,le)},
  0x89:{bsize:8,invalid:null, read:(v,o,le)=>v.getFloat64(o,le)},
  0x0A:{bsize:1,invalid:0x00, read:(v,o)=>v.getUint8(o)},
  0x8B:{bsize:2,invalid:0x0000, read:(v,o,le)=>v.getUint16(o,le)},
  0x8C:{bsize:4,invalid:0x00000000, read:(v,o,le)=>v.getUint32(o,le)},
  0x0D:{bsize:1,invalid:0xFF, read:(v,o)=>v.getUint8(o)},
};
const RECORD_FIELDS = {
  253:['timestamp',null,null], 2:['altitude',5,500], 3:['heart_rate',null,null],
  4:['cadence',null,null], 5:['distance',100,0], 6:['speed',1000,0],
  73:['enhanced_speed',1000,0], 78:['enhanced_altitude',5,500],
};
const SESSION_FIELDS = {
  253:['timestamp',null,null], 2:['start_time',null,null], 5:['sport',null,null], 6:['sub_sport',null,null],
  7:['total_elapsed_time',1000,0], 8:['total_timer_time',1000,0], 9:['total_distance',100,0],
  11:['total_calories',null,null], 14:['avg_speed',1000,0], 15:['max_speed',1000,0],
  16:['avg_heart_rate',null,null], 17:['max_heart_rate',null,null], 18:['avg_cadence',null,null],
  19:['max_cadence',null,null], 22:['total_ascent',null,null], 23:['total_descent',null,null],
  124:['enhanced_avg_speed',1000,0], 125:['enhanced_max_speed',1000,0],
};
const FIELD_MAPS = { record:RECORD_FIELDS, session:SESSION_FIELDS };
const SPORT_LABELS = { 0:'Activité générique', 1:'Course à pied', 2:'Vélo', 4:'Renforcement / fitness', 5:'Natation', 11:'Randonnée', 254:'Activité' };

class FitParseError extends Error {}

function decodeField(view, offset, size, baseType) {
  if (baseType === 0x07) {
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, size);
    let end = bytes.indexOf(0); if (end < 0) end = bytes.length;
    try { return new TextDecoder('utf-8').decode(bytes.slice(0, end)); } catch (e) { return null; }
  }
  const info = BASE_TYPES[baseType];
  if (!info) return null;
  const n = Math.max(1, Math.floor(size / info.bsize));
  if (n <= 1) {
    if (size < info.bsize) return null;
    const val = info.read(view, offset, true);
    return (info.invalid !== null && val === info.invalid) ? null : val;
  }
  const vals = [];
  for (let i = 0; i < n; i++) {
    const v = info.read(view, offset + i * info.bsize, true);
    if (info.invalid === null || v !== info.invalid) vals.push(v);
  }
  return vals.length ? vals : null;
}
function applyScale(raw, scale, offset) {
  if (raw === null || raw === undefined || Array.isArray(raw)) return raw;
  return scale ? (raw / scale - offset) : raw;
}
function parseFit(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 14) throw new FitParseError("Fichier trop court pour être un .FIT valide");
  const headerSize = view.getUint8(0);
  const sig = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (sig !== '.FIT') throw new FitParseError("Signature '.FIT' manquante — ce n'est pas un fichier FIT valide");
  const dataSize = view.getUint32(4, true);
  const bodyStart = headerSize;
  const bodyEnd = bodyStart + dataSize;
  let offset = bodyStart;
  const definitions = {};
  const messages = {};
  while (offset < bodyEnd) {
    const headerByte = view.getUint8(offset); offset += 1;
    const compressedTs = !!(headerByte & 0x80);
    let localMsgType, isDefinition, hasDevFields;
    if (compressedTs) { localMsgType = (headerByte >> 5) & 0x03; isDefinition = false; hasDevFields = false; }
    else { isDefinition = !!(headerByte & 0x40); hasDevFields = !!(headerByte & 0x20); localMsgType = headerByte & 0x0F; }
    if (isDefinition) {
      offset += 1;
      const architecture = view.getUint8(offset); offset += 1;
      const littleEndian = architecture === 0;
      const globalMsgNum = view.getUint16(offset, littleEndian); offset += 2;
      const numFields = view.getUint8(offset); offset += 1;
      const fields = [];
      for (let i = 0; i < numFields; i++) { fields.push([view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2)]); offset += 3; }
      const devFields = [];
      if (hasDevFields) {
        const numDev = view.getUint8(offset); offset += 1;
        for (let i = 0; i < numDev; i++) { devFields.push([view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2)]); offset += 3; }
      }
      const msgName = GLOBAL_MESSAGES[globalMsgNum] || ('unknown_' + globalMsgNum);
      definitions[localMsgType] = { msgName, littleEndian, fields, devFields };
      continue;
    }
    const def = definitions[localMsgType];
    if (!def) throw new FitParseError('Message de type local ' + localMsgType + ' rencontré sans définition préalable.');
    const fieldMap = FIELD_MAPS[def.msgName] || {};
    const record = {};
    for (const [fieldDefNum, size, baseType] of def.fields) {
      const value = decodeField(view, offset, size, baseType);
      offset += size;
      const info = fieldMap[fieldDefNum];
      if (info) { const [fname, scale, foffset] = info; record[fname] = applyScale(value, scale, foffset); }
    }
    for (const [, size] of def.devFields) offset += size;
    (messages[def.msgName] = messages[def.msgName] || []).push(record);
  }
  return messages;
}
function fitTimestampToDate(ts) { if (ts === null || ts === undefined) return null; return new Date(FIT_EPOCH_MS + ts * 1000); }

function summarizeFit(messages, fileMeta) {
  const session = (messages.session && messages.session[0]) || {};
  const records = messages.record || [];
  let startDate = fitTimestampToDate(session.start_time) || fitTimestampToDate(session.timestamp);
  let dateApprox = false;
  if (!startDate && records.length) { const withTs = records.find(r => r.timestamp != null); if (withTs) startDate = fitTimestampToDate(withTs.timestamp); }
  if (!startDate) { startDate = new Date(fileMeta.lastModified); dateApprox = true; }
  let distanceM = session.total_distance;
  let durationS = session.total_timer_time || session.total_elapsed_time;
  let ascent = session.total_ascent;
  let descent = session.total_descent;
  let avgHr = session.avg_heart_rate;
  let maxHr = session.max_heart_rate;
  let avgCadence = session.avg_cadence;
  let avgSpeed = session.enhanced_avg_speed || session.avg_speed;
  if ((distanceM == null || durationS == null) && records.length >= 2) {
    const withDist = records.filter(r => r.distance != null);
    const withTs = records.filter(r => r.timestamp != null);
    if (distanceM == null && withDist.length) distanceM = withDist[withDist.length - 1].distance;
    if (durationS == null && withTs.length >= 2) durationS = (withTs[withTs.length - 1].timestamp - withTs[0].timestamp);
  }
  if (avgHr == null) {
    const hrs = records.map(r => r.heart_rate).filter(v => v != null);
    if (hrs.length) { avgHr = Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length); maxHr = maxHr ?? Math.max(...hrs); }
  }
  if (avgCadence == null) {
    const cads = records.map(r => r.cadence).filter(v => v != null);
    if (cads.length) avgCadence = Math.round(cads.reduce((a,b)=>a+b,0)/cads.length);
  }
  if ((ascent == null || descent == null)) {
    const alts = records.map(r => r.enhanced_altitude ?? r.altitude).filter(v => v != null);
    if (alts.length >= 2) {
      let up = 0, down = 0;
      for (let i = 1; i < alts.length; i++) { const d = alts[i] - alts[i-1]; if (d > 0) up += d; else down += -d; }
      if (ascent == null) ascent = Math.round(up);
      if (descent == null) descent = Math.round(down);
    }
  }
  if (avgSpeed == null && distanceM != null && durationS) avgSpeed = distanceM / durationS;
  return {
    date: startDate.toISOString().slice(0,10),
    dateApprox,
    sport: SPORT_LABELS[session.sport] ?? (session.sport != null ? ('Sport #' + session.sport) : null),
    distanceKm: distanceM != null ? distanceM / 1000 : null,
    durationS: durationS != null ? Math.round(durationS) : null,
    ascent: ascent != null ? Math.round(ascent) : null,
    descent: descent != null ? Math.round(descent) : null,
    avgHr: avgHr != null ? Math.round(avgHr) : null,
    maxHr: maxHr != null ? Math.round(maxHr) : null,
    cadenceSpm: avgCadence != null ? Math.round(avgCadence * 2) : null,
    avgPaceSecPerKm: (avgSpeed && avgSpeed > 0) ? Math.round(1000 / avgSpeed) : null,
  };
}

/* --------------------------- 3) STOCKAGE --------------------------- */
const STORAGE_PREFIX = 'trail:';
const IDX_KEY = STORAGE_PREFIX + 'index';
const PLAN_KEY = STORAGE_PREFIX + 'plan';
const KEY_KEY = STORAGE_PREFIX + 'apikey';
const RACES_KEY = STORAGE_PREFIX + 'races';
const PROFILE_KEY = STORAGE_PREFIX + 'profile';
const GEAR_KEY = STORAGE_PREFIX + 'gear';

function storageAvailable() { try { const k='__test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }
function loadIndex() { try { return JSON.parse(localStorage.getItem(IDX_KEY) || '[]'); } catch (e) { console.error('Index illisible', e); return []; } }
function saveIndex(ids) { try { localStorage.setItem(IDX_KEY, JSON.stringify(ids)); return true; } catch (e) { console.error(e); return false; } }
function loadSession(id) { try { const raw = localStorage.getItem(STORAGE_PREFIX + 'seance:' + id); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function saveSession(id, data) { try { localStorage.setItem(STORAGE_PREFIX + 'seance:' + id, JSON.stringify(data)); return true; } catch (e) { console.error(e); return false; } }
function deleteSession(id) { try { localStorage.removeItem(STORAGE_PREFIX + 'seance:' + id); } catch (e) {} }
function loadAllSessions() { return loadIndex().map(loadSession).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)); }

function getPlan() { try { const raw = localStorage.getItem(PLAN_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function findPlannedSession(dateISO) { const plan = getPlan(); if (!plan) return null; return plan.find(p => p.date === dateISO) || null; }
function getApiKey() { try { return localStorage.getItem(KEY_KEY); } catch (e) { return null; } }

// --- Courses (échéances) ---
const DEFAULT_RACES = [
  { id:'mafate-trail-tour', name:'Mafate Trail Tour', date:'2026-11-28', distanceKm:55, denivele:3500, statut:'principal' },
  { id:'trail-des-cascades', name:'Trail des Cascades', date:'2026-09-12', distanceKm:31, denivele:1700, statut:'secondaire' },
];
function getRaces() {
  try {
    const raw = localStorage.getItem(RACES_KEY);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(RACES_KEY, JSON.stringify(DEFAULT_RACES)); // migration depuis l'ancienne liste codée en dur
    return DEFAULT_RACES;
  } catch (e) { return DEFAULT_RACES; }
}
function saveRaces(races) { try { localStorage.setItem(RACES_KEY, JSON.stringify(races)); return true; } catch (e) { return false; } }
function upsertRace(race) {
  const races = getRaces();
  if (!race.id) race.id = 'course-' + Date.now();
  const i = races.findIndex(r => r.id === race.id);
  if (i >= 0) races[i] = race; else races.push(race);
  saveRaces(races);
  return race;
}
function deleteRace(id) { saveRaces(getRaces().filter(r => r.id !== id)); }

// --- Profil traileur ---
const DEFAULT_PROFILE = { nom:'', naissance:'', sante:'', records:[] };
function getProfile() { try { const raw = localStorage.getItem(PROFILE_KEY); return raw ? Object.assign({}, DEFAULT_PROFILE, JSON.parse(raw)) : Object.assign({}, DEFAULT_PROFILE); } catch (e) { return Object.assign({}, DEFAULT_PROFILE); } }
function saveProfile(profile) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); return true; } catch (e) { return false; } }

// --- Équipements (chaussures) ---
function getGear() { try { return JSON.parse(localStorage.getItem(GEAR_KEY) || '[]'); } catch (e) { return []; } }
function saveGear(list) { try { localStorage.setItem(GEAR_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
function upsertGearItem(item) {
  const list = getGear();
  if (!item.id) item.id = 'chaussure-' + Date.now();
  const i = list.findIndex(g => g.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
  saveGear(list);
  return item;
}
function deleteGearItem(id) { saveGear(getGear().filter(g => g.id !== id)); }
// Km parcourus par une paire = km de base saisi manuellement + somme des séances qui lui sont associées.
function gearKmFromSessions(gearId) {
  return loadAllSessions().filter(s => s.gearId === gearId).reduce((sum, s) => sum + (s.distanceKm || 0), 0);
}

/* --------------------------- 4) PLAN CSV --------------------------- */
const PLAN_YEAR = 2026; // le CSV du plan ne contient pas l'année dans la colonne "Jour" — à adapter si le plan change de saison

// Découpe une ligne CSV en respectant les champs entre guillemets (ex. notes contenant des virgules).
function parseCsvLine(line) {
  const cols = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = false; } }
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cols.push(cur); cur = ''; }
      else cur += c;
    }
  }
  cols.push(cur);
  return cols;
}
function parsePlanCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const idx = {
    jour: header.findIndex(h => h.includes('jour')),
    type: header.findIndex(h => h.includes('type')),
    distance: header.findIndex(h => h.includes('distance')),
    denivele: header.findIndex(h => h.includes('d+')),
    intensite: header.findIndex(h => h.includes('intensit')),
    notes: header.findIndex(h => h.includes('notes')),
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const jourRaw = (cols[idx.jour] || '').trim();
    const m = jourRaw.match(/(\d{2})\/(\d{2})/);
    if (!m) continue;
    const dateISO = PLAN_YEAR + '-' + m[2] + '-' + m[1];
    out.push({
      date: dateISO,
      type: (cols[idx.type] || '').trim(),
      distanceKm: parseFloat(cols[idx.distance]) || 0,
      deniveleM: parseFloat(cols[idx.denivele]) || 0,
      intensite: (cols[idx.intensite] || '').trim(),
      notes: (cols[idx.notes] || '').trim(),
    });
  }
  return out;
}

/* --------------------------- 5) FORMATAGE --------------------------- */
function fmtDate(iso) { const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
function fmtDuration(s) {
  if (s == null) return 'Non disponible';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.round(s%60);
  return h > 0 ? (h+'h'+String(m).padStart(2,'0')) : (m+'min'+String(sec).padStart(2,'0'));
}
function fmtPace(secPerKm) {
  if (secPerKm == null) return 'Non disponible';
  const m = Math.floor(secPerKm/60), s = Math.round(secPerKm%60);
  return m + ':' + String(s).padStart(2,'0') + ' /km';
}
function fmtNum(v, unit, digits) { if (v == null || isNaN(v)) return 'Non disponible'; return v.toFixed(digits ?? 0) + (unit || ''); }

/* --------------------------- 6) UTILITAIRES DOM --------------------------- */
function showMsg(elId, text, kind) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '<div class="msg ' + kind + '">' + text + '</div>';
  if (kind === 'ok') setTimeout(() => { if (el.firstChild) el.innerHTML=''; }, 5000);
}
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }
function isoWeek(dateISO) {
  const d = new Date(dateISO + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0,10);
}

// État de préparation d'une course : compare le volume réalisé au volume planifié sur les 28 derniers jours
// (ou depuis le début du plan si plus récent). Retourne null si aucun plan n'est enregistré.
function computePrepStatus(raceDateISO) {
  const plan = getPlan();
  if (!plan || !plan.length) return null;
  const today = new Date().toISOString().slice(0,10);
  const windowStart = new Date(new Date(today).getTime() - 28*86400000).toISOString().slice(0,10);
  const plannedKm = plan.filter(p => p.date >= windowStart && p.date <= today).reduce((s,p) => s + (p.distanceKm||0), 0);
  const doneKm = loadAllSessions().filter(s => s.date >= windowStart && s.date <= today).reduce((s,x) => s + (x.distanceKm||0), 0);
  if (plannedKm <= 0) return null;
  const pct = Math.round((doneKm / plannedKm) * 100);
  return { pct, doneKm, plannedKm };
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
  if (!storageAvailable()) {
    document.querySelectorAll('.storage-warning-target').forEach(el => {
      el.innerHTML = '<div class="msg err">Le stockage local du navigateur n\'est pas disponible (navigation privée ?) — les données ne seront pas conservées après fermeture de la page.</div>';
    });
  }
});
