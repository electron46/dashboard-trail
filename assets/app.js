/* =========================================================================
   ELEV — logique partagée par toutes les pages (dashboard-trail).
   1) Thème (clair/sombre)   2) Parsing .FIT   3) Stockage (localStorage)
   4) Plan CSV   5) Formatage   6) Utilitaires DOM
   ========================================================================= */

/* --------------------------- 1) THÈME --------------------------- */
const THEME_KEY = 'trail:theme';
// Sombre par défaut : c'est la surface réelle du produit (identité ELEV) — le thème
// clair reste disponible via la bascule, utile pour la lisibilité en plein soleil.
function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; } }
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
  7:['power',null,null], 13:['temperature',null,null],
  73:['enhanced_speed',1000,0], 78:['enhanced_altitude',5,500],
};
const SESSION_FIELDS = {
  253:['timestamp',null,null], 2:['start_time',null,null], 5:['sport',null,null], 6:['sub_sport',null,null],
  7:['total_elapsed_time',1000,0], 8:['total_timer_time',1000,0], 9:['total_distance',100,0],
  11:['total_calories',null,null], 14:['avg_speed',1000,0], 15:['max_speed',1000,0],
  16:['avg_heart_rate',null,null], 17:['max_heart_rate',null,null], 18:['avg_cadence',null,null],
  19:['max_cadence',null,null], 20:['avg_power',null,null], 21:['max_power',null,null],
  22:['total_ascent',null,null], 23:['total_descent',null,null],
  124:['enhanced_avg_speed',1000,0], 125:['enhanced_max_speed',1000,0],
};
// Champs "lap" — mêmes numéros de champ que "session" pour le socle commun (résumé par portion),
// à l'exception des variantes enhanced_* qui divergent selon le type de message dans le format FIT.
const LAP_FIELDS = {
  253:['timestamp',null,null], 2:['start_time',null,null],
  7:['total_elapsed_time',1000,0], 8:['total_timer_time',1000,0], 9:['total_distance',100,0],
  14:['avg_speed',1000,0], 15:['max_speed',1000,0],
  16:['avg_heart_rate',null,null], 17:['max_heart_rate',null,null],
  22:['total_ascent',null,null], 23:['total_descent',null,null],
};
const FIELD_MAPS = { record:RECORD_FIELDS, session:SESSION_FIELDS, lap:LAP_FIELDS };
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
  let avgPower = session.avg_power;
  let maxPower = session.max_power;
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
  if (avgPower == null) {
    const pows = records.map(r => r.power).filter(v => v != null);
    if (pows.length) { avgPower = Math.round(pows.reduce((a,b)=>a+b,0)/pows.length); maxPower = maxPower ?? Math.max(...pows); }
  }
  const temps = records.map(r => r.temperature).filter(v => v != null);
  const avgTemp = temps.length ? Math.round(temps.reduce((a,b)=>a+b,0)/temps.length) : null;
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

  // Série temporelle downsamplée pour les courbes de séance (allure/FC/altitude/cadence) —
  // on limite à ~120 points pour rester léger en localStorage, quel que soit le nombre de records bruts.
  const withTs = records.filter(r => r.timestamp != null);
  let series = [];
  if (withTs.length >= 2) {
    const t0 = withTs[0].timestamp;
    const maxPoints = 120;
    const step = Math.max(1, Math.ceil(withTs.length / maxPoints));
    for (let i = 0; i < withTs.length; i += step) {
      const r = withTs[i];
      const spd = r.enhanced_speed || r.speed;
      series.push({
        t: r.timestamp - t0,
        distKm: r.distance != null ? r.distance / 1000 : null,
        paceSecKm: (spd && spd > 0) ? Math.round(1000 / spd) : null,
        hr: r.heart_rate ?? null,
        alt: r.enhanced_altitude ?? r.altitude ?? null,
        cadenceSpm: r.cadence != null ? Math.round(r.cadence * 2) : null,
      });
    }
  }

  // Splits par portion (laps) — le plus souvent un auto-lap par km sur Garmin, utile pour repérer les montées.
  const laps = (messages.lap || []).map((l, i) => {
    const lDist = l.total_distance;
    const lDur = l.total_timer_time || l.total_elapsed_time;
    const lSpeed = l.avg_speed || (lDist && lDur ? lDist / lDur : null);
    return {
      index: i + 1,
      distanceKm: lDist != null ? lDist / 1000 : null,
      durationS: lDur != null ? Math.round(lDur) : null,
      avgPaceSecPerKm: (lSpeed && lSpeed > 0) ? Math.round(1000 / lSpeed) : null,
      avgHr: l.avg_heart_rate ?? null,
      ascent: l.total_ascent ?? null,
    };
  }).filter(l => l.distanceKm != null && l.distanceKm > 0);

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
    avgPower: avgPower != null ? Math.round(avgPower) : null,
    maxPower: maxPower != null ? Math.round(maxPower) : null,
    avgTemp: avgTemp,
    series: series,
    laps: laps,
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
function saveIndex(ids) { try { localStorage.setItem(IDX_KEY, JSON.stringify(ids)); scheduleSync(); return true; } catch (e) { console.error(e); return false; } }
function loadSession(id) { try { const raw = localStorage.getItem(STORAGE_PREFIX + 'seance:' + id); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function saveSession(id, data) { try { localStorage.setItem(STORAGE_PREFIX + 'seance:' + id, JSON.stringify(data)); scheduleSync(); return true; } catch (e) { console.error(e); return false; } }
function deleteSession(id) { try { localStorage.removeItem(STORAGE_PREFIX + 'seance:' + id); scheduleSync(); } catch (e) {} }
function loadAllSessions() { return loadIndex().map(loadSession).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)); }

function getPlan() { try { const raw = localStorage.getItem(PLAN_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function savePlan(plan) { try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); scheduleSync(); return true; } catch (e) { return false; } }
function clearPlan() { try { localStorage.removeItem(PLAN_KEY); scheduleSync(); } catch (e) {} }
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
function saveRaces(races) { try { localStorage.setItem(RACES_KEY, JSON.stringify(races)); scheduleSync(); return true; } catch (e) { return false; } }
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
const WEEKDAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYTIMES = ['Matin','Midi','Soir'];
// Groupes de champs affichés sur profil.html et repris dans le résumé exportable pour l'IA.
// Chaque champ : [clé dans l'objet profil, libellé, type ('text'|'number'|'textarea'|'date'|'checkboxset'), placeholder, options (pour checkboxset)]
const PROFILE_FIELD_GROUPS = [
  { title: 'Historique sportif', fields: [
    ['histPratiqueDepuis', 'Pratique la course à pied depuis', 'date', ''],
    ['histVolumeKm', 'Volume hebdomadaire habituel (km/semaine)', 'number', ''],
    ['histVolumeDplus', 'Volume hebdomadaire habituel (m D+/semaine)', 'number', ''],
    ['histVolumeJours', 'Nombre de jours de course par semaine', 'number', ''],
    ['histPerfDistanceKm', 'Meilleure perf récente — distance (km)', 'number', ''],
    ['histPerfTemps', 'Meilleure perf récente — temps (hh:mm:ss)', 'text', 'ex. 0:48:00'],
    ['histPerfCourse', 'Meilleure perf récente — course', 'text', ''],
    ['histPerfDate', 'Meilleure perf récente — date', 'date', ''],
    ['histPratiqueAntType', 'Pratique sportive antérieure (type)', 'text', 'ex. padel'],
    ['histPratiqueAntFreq', 'Pratique sportive antérieure (fréquence, x/semaine)', 'number', ''],
  ]},
  { title: 'Données physiologiques', fields: [
    ['age', 'Âge', 'number', ''],
    ['poids', 'Poids (kg)', 'number', ''],
    ['fcMax', 'FC max (bpm)', 'number', ''],
    ['fcRepos', 'FC repos (bpm)', 'number', ''],
    ['vma', 'VMA (km/h)', 'number', ''],
    ['allureSeuil', 'Allure seuil / allure spécifique trail (min/km)', 'text', ''],
  ]},
  { title: 'Disponibilités', fields: [
    ['dispoJours', 'Jours disponibles pour courir', 'checkboxset', '', WEEKDAYS],
    ['dispoRenfo', 'Jour(s) dédié(s) au renforcement', 'checkboxset', '', WEEKDAYS],
    ['dispoCreneaux', 'Créneaux horaires habituels', 'checkboxset', '', DAYTIMES],
    ['dispoDureeMax', 'Durée max sortie longue le week-end (minutes)', 'number', 'ex. 210 pour 3h30'],
  ]},
  { title: 'Contraintes géographiques et matérielles', fields: [
    ['geoBase', 'Lieu de vie / base actuelle', 'text', ''],
    ['geoPeriodeUrbaineDebut', 'Début période en zone urbaine / sans dénivelé', 'date', ''],
    ['geoPeriodeUrbaineFin', 'Fin période en zone urbaine / sans dénivelé', 'date', ''],
    ['geoRetour', 'Retour prévu vers le terrain d\'entraînement spécifique', 'date', ''],
    ['geoOptionMontagne', 'Options d\'accès au dénivelé pendant les périodes urbaines', 'text', ''],
    ['geoChaleur', 'Accès sauna / bain chaud pendant les périodes sans chaleur naturelle', 'text', ''],
    ['geoEquipement', 'Équipement possédé (bâtons, sac, GPS...)', 'textarea', ''],
  ]},
  { title: 'Blessures et limitations (au-delà des points de vigilance ci-dessus)', fields: [
    ['blessureAutresZones', 'Autres zones fragiles / douleurs récurrentes', 'text', ''],
    ['blessureLimiteur', 'Limiteur principal identifié sur l\'objectif principal', 'text', 'ex. fatigue musculaire quadriceps en descente'],
    ['blessureExcentrique', 'Fréquence actuelle de travail excentrique dédié (x/semaine)', 'number', ''],
  ]},
  { title: 'Outils de suivi', fields: [
    ['outilsMontre', 'Montre connectée (marque, modèle)', 'text', ''],
    ['outilsPlateforme', 'Plateformes utilisées (Garmin Connect, Strava, Intervals.icu...)', 'text', ''],
    ['outilsDashboards', 'Autres dashboards ou outils de suivi existants', 'textarea', ''],
  ]},
  { title: 'Contraintes de vie', fields: [
    ['vieAssociative', 'Engagement associatif / bénévolat (charge)', 'text', ''],
    ['viePro', 'Activité professionnelle (temps, fatigue induite)', 'text', ''],
    ['vieAutreSportType', 'Autre pratique sportive régulière (type)', 'text', ''],
    ['vieAutreSportFreq', 'Autre pratique sportive régulière (fréquence, x/semaine)', 'number', ''],
    ['vieFamiliale', 'Contraintes familiales / autres', 'text', ''],
  ]},
  { title: 'Nutrition course', fields: [
    ['nutriGlucides', 'Glucides testés à l\'entraînement sur sortie longue (g/h)', 'number', ''],
    ['nutriGout', 'Préférence gustative (salé/sucré) et lassitude connue en effort long', 'text', ''],
    ['nutriHydratation', 'Stratégie hydratation/sel actuelle (mL/h, sodium mg/h)', 'text', ''],
    ['nutriGels', 'Gels / barres / solides déjà testés et validés', 'textarea', ''],
  ]},
];
const DEFAULT_PROFILE = Object.assign(
  { nom:'', naissance:'', sante:'', records:[], objectifsAutres:'' },
  ...PROFILE_FIELD_GROUPS.flatMap(g => g.fields.map(([key]) => ({ [key]: '' })))
);
function getProfile() { try { const raw = localStorage.getItem(PROFILE_KEY); return raw ? Object.assign({}, DEFAULT_PROFILE, JSON.parse(raw)) : Object.assign({}, DEFAULT_PROFILE); } catch (e) { return Object.assign({}, DEFAULT_PROFILE); } }
function saveProfile(profile) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); scheduleSync(); return true; } catch (e) { return false; } }
// Zone Z2 indicative (méthode Karvonen, 60-70% de réserve cardiaque) — repère, pas une prescription médicale.
function karvonenZ2(fcMax, fcRepos) {
  if (!fcMax || !fcRepos) return null;
  const reserve = fcMax - fcRepos;
  return { low: Math.round(fcRepos + reserve * 0.6), high: Math.round(fcRepos + reserve * 0.7) };
}
// Les 5 zones de FC classiques (méthode Karvonen, % de réserve cardiaque) — repère indicatif, pas une prescription médicale.
const KARVONEN_ZONES = [
  { key: 'z1', label: 'Z1 — Récupération', low: 0.50, high: 0.60 },
  { key: 'z2', label: 'Z2 — Endurance fondamentale', low: 0.60, high: 0.70 },
  { key: 'z3', label: 'Z3 — Tempo / rythme', low: 0.70, high: 0.80 },
  { key: 'z4', label: 'Z4 — Seuil', low: 0.80, high: 0.90 },
  { key: 'z5', label: 'Z5 — VMA / anaérobie', low: 0.90, high: 1.00 },
];
function karvonenZones(fcMax, fcRepos) {
  if (!fcMax || !fcRepos || fcMax <= fcRepos) return null;
  const reserve = fcMax - fcRepos;
  return KARVONEN_ZONES.map(z => ({
    key: z.key,
    label: z.label,
    low: Math.round(fcRepos + reserve * z.low),
    high: Math.round(fcRepos + reserve * z.high),
  }));
}

// --- Équipements (chaussures) ---
function getGear() { try { return JSON.parse(localStorage.getItem(GEAR_KEY) || '[]'); } catch (e) { return []; } }
function saveGear(list) { try { localStorage.setItem(GEAR_KEY, JSON.stringify(list)); scheduleSync(); return true; } catch (e) { return false; } }
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
// Le CSV du plan ne contient pas l'année dans la colonne "Jour" — configurable dans Paramètres
// (onglet "Plan d'entraînement"), 2026 par défaut si rien n'est enregistré.
const PLAN_YEAR_KEY = STORAGE_PREFIX + 'planYear';
function getPlanYear() { try { return parseInt(localStorage.getItem(PLAN_YEAR_KEY), 10) || 2026; } catch (e) { return 2026; } }
function savePlanYear(year) { try { localStorage.setItem(PLAN_YEAR_KEY, String(year)); scheduleSync(); return true; } catch (e) { return false; } }

// Découpe une ligne CSV en respectant les champs entre guillemets (ex. notes contenant des virgules).
function parseCsvLine(line, delimiter) {
  const cols = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = false; } }
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delimiter) { cols.push(cur); cur = ''; }
      else cur += c;
    }
  }
  cols.push(cur);
  return cols;
}
// Supporte deux formats de plan :
// - le format "riche" (séparateur ;) avec colonne Date complète (JJ/MM/AAAA) et zones FC détaillées
//   par phase (échauffement / corps de séance / retour au calme / moyenne globale) + D- + objectif de séance
// - l'ancien format (séparateur ,) où seule la colonne "Jour" (ex. "Ven 07/08") donne la date,
//   complétée par l'année réglée dans Paramètres
function parsePlanCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const delimiter = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
  const header = parseCsvLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
  const idx = {
    semaine: header.findIndex(h => h.includes('semaine')),
    bloc: header.findIndex(h => h.includes('bloc')),
    date: header.findIndex(h => h.trim() === 'date'),
    jour: header.findIndex(h => h.includes('jour')),
    type: header.findIndex(h => h.includes('type')),
    distance: header.findIndex(h => h.includes('distance')),
    denivele: header.findIndex(h => h.includes('d+')),
    descente: header.findIndex(h => h.trim() === 'd-'),
    duree: header.findIndex(h => h.includes('duree')),
    fcEchauffement: header.findIndex(h => h.includes('echauffement')),
    fcCorps: header.findIndex(h => h.includes('corps')),
    fcRetourCalme: header.findIndex(h => h.includes('retour au calme')),
    fcMoyenne: header.findIndex(h => h.includes('moyenne globale')),
    intensite: header.findIndex(h => h.includes('intensit')),
    objectif: header.findIndex(h => h.includes('objectif')),
    notes: header.findIndex(h => h.trim() === 'notes'),
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    let dateISO = null;
    if (idx.date >= 0 && cols[idx.date]) {
      const dm = cols[idx.date].trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dm) dateISO = dm[3] + '-' + dm[2].padStart(2,'0') + '-' + dm[1].padStart(2,'0');
    }
    if (!dateISO && idx.jour >= 0) {
      const m = (cols[idx.jour] || '').trim().match(/(\d{2})\/(\d{2})/);
      if (m) dateISO = getPlanYear() + '-' + m[2] + '-' + m[1];
    }
    if (!dateISO) continue;
    const notesVal = idx.objectif >= 0 ? cols[idx.objectif] : (idx.notes >= 0 ? cols[idx.notes] : '');
    out.push({
      date: dateISO,
      semaine: idx.semaine >= 0 ? (cols[idx.semaine] || '').trim() : '',
      bloc: (cols[idx.bloc] || '').trim(),
      jourLabel: idx.jour >= 0 ? (cols[idx.jour] || '').trim() : '',
      type: (cols[idx.type] || '').trim(),
      distanceKm: parseFloat(cols[idx.distance]) || 0,
      deniveleM: parseFloat(cols[idx.denivele]) || 0,
      descenteM: idx.descente >= 0 ? (parseFloat(cols[idx.descente]) || 0) : null,
      dureeDetail: idx.duree >= 0 ? (cols[idx.duree] || '').trim() : '',
      fcEchauffement: idx.fcEchauffement >= 0 ? (cols[idx.fcEchauffement] || '').trim() : '',
      fcCorpsSeance: idx.fcCorps >= 0 ? (cols[idx.fcCorps] || '').trim() : '',
      fcRetourCalme: idx.fcRetourCalme >= 0 ? (cols[idx.fcRetourCalme] || '').trim() : '',
      fcMoyenneGlobale: idx.fcMoyenne >= 0 ? (cols[idx.fcMoyenne] || '').trim() : '',
      intensite: (cols[idx.intensite] || '').trim(),
      notes: (notesVal || '').trim(),
    });
  }
  return out;
}
// Bloc du plan en cours (colonne "Bloc" du CSV) : dernière entrée dont la date <= aujourd'hui.
function getCurrentBloc() {
  const plan = getPlan();
  if (!plan || !plan.length) return null;
  const today = new Date().toISOString().slice(0,10);
  const past = plan.filter(p => p.date <= today && p.bloc).sort((a,b) => b.date.localeCompare(a.date));
  return past.length ? past[0].bloc : null;
}
// Ratio dénivelé positif / distance (m par km) — repère de technicité d'une séance ou d'une course.
function ratioDplusKm(ascentM, distanceKm) {
  if (ascentM == null || !distanceKm) return null;
  return Math.round(ascentM / distanceKm);
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

/* --------------------------- SYNCHRO SUPABASE (multi-appareils, optionnelle) --------------------------- */
const SUPA_URL_KEY = STORAGE_PREFIX + 'supabaseUrl';
const SUPA_ANON_KEY = STORAGE_PREFIX + 'supabaseAnonKey';
const SUPA_META_KEY = STORAGE_PREFIX + 'supabaseMeta';

function getSupabaseConfig() {
  try { return { url: localStorage.getItem(SUPA_URL_KEY) || '', anonKey: localStorage.getItem(SUPA_ANON_KEY) || '' }; }
  catch (e) { return { url:'', anonKey:'' }; }
}
function saveSupabaseConfig(url, anonKey) {
  try { localStorage.setItem(SUPA_URL_KEY, url.trim()); localStorage.setItem(SUPA_ANON_KEY, anonKey.trim()); _supaClient = null; return true; }
  catch (e) { return false; }
}
function clearSupabaseConfig() {
  try { localStorage.removeItem(SUPA_URL_KEY); localStorage.removeItem(SUPA_ANON_KEY); localStorage.removeItem(SUPA_META_KEY); } catch (e) {}
  _supaClient = null;
}

let _supaClient = null;
function getSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  if (typeof supabase === 'undefined' || !supabase.createClient) return null;
  if (!_supaClient) _supaClient = supabase.createClient(url, anonKey);
  return _supaClient;
}
async function supaGetUser() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data ? data.user : null;
}

function buildSyncPayload() {
  return { sessions: loadAllSessions(), plan: getPlan(), races: getRaces(), profile: getProfile(), gear: getGear() };
}
// Pendant l'application des données reçues du cloud, on désactive scheduleSync() pour ne pas
// renvoyer immédiatement vers Supabase ce qu'on vient d'en recevoir.
let _applyingRemote = false;
function applySyncPayload(payload) {
  _applyingRemote = true;
  try {
    if (Array.isArray(payload.sessions)) {
      loadIndex().forEach(deleteSession);
      const ids = [];
      payload.sessions.forEach(s => { if (s && s.id) { saveSession(s.id, s); ids.push(s.id); } });
      saveIndex(ids);
    }
    if (payload.plan) savePlan(payload.plan);
    if (Array.isArray(payload.races) && payload.races.length) saveRaces(payload.races);
    if (payload.profile) saveProfile(payload.profile);
    if (Array.isArray(payload.gear)) saveGear(payload.gear);
  } finally { _applyingRemote = false; }
}

let _syncTimer = null;
// Appelé automatiquement par les fonctions de sauvegarde locales — programme un envoi vers
// Supabase avec un léger délai (pour regrouper plusieurs modifications rapprochées).
function scheduleSync() {
  if (_applyingRemote) return;
  if (!getSupabaseClient()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { syncPush(); }, 1500);
}
async function syncPush() {
  const client = getSupabaseClient();
  if (!client) return { ok:false, reason:'not-configured' };
  const user = await supaGetUser();
  if (!user) return { ok:false, reason:'not-logged-in' };
  const nowIso = new Date().toISOString();
  const { error } = await client.from('trail_data').upsert({ user_id: user.id, payload: buildSyncPayload(), updated_at: nowIso });
  if (error) return { ok:false, reason: error.message };
  try { localStorage.setItem(SUPA_META_KEY, JSON.stringify({ lastRemoteUpdatedAt: nowIso })); } catch (e) {}
  return { ok:true };
}
async function syncPull() {
  const client = getSupabaseClient();
  if (!client) return { ok:false, reason:'not-configured' };
  const user = await supaGetUser();
  if (!user) return { ok:false, reason:'not-logged-in' };
  const { data, error } = await client.from('trail_data').select('payload, updated_at').eq('user_id', user.id).maybeSingle();
  if (error) return { ok:false, reason: error.message };
  if (!data) return { ok:false, reason:'empty' };
  applySyncPayload(data.payload || {});
  try { localStorage.setItem(SUPA_META_KEY, JSON.stringify({ lastRemoteUpdatedAt: data.updated_at })); } catch (e) {}
  return { ok:true, updatedAt: data.updated_at };
}
// Au chargement d'une page : si le cloud a une version plus récente que la dernière connue ici,
// on la récupère silencieusement puis on recharge une fois la page pour tout ré-afficher à jour.
async function autoPullIfNewer() {
  const client = getSupabaseClient();
  if (!client) return;
  const user = await supaGetUser();
  if (!user) return;
  const { data, error } = await client.from('trail_data').select('updated_at').eq('user_id', user.id).maybeSingle();
  if (error || !data) return;
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem(SUPA_META_KEY) || '{}'); } catch (e) {}
  if (meta.lastRemoteUpdatedAt && new Date(data.updated_at) <= new Date(meta.lastRemoteUpdatedAt)) return;
  const guardKey = 'trail:autoPullGuard';
  if (sessionStorage.getItem(guardKey) === data.updated_at) return; // évite une boucle de rechargement
  const res = await syncPull();
  if (res.ok) { sessionStorage.setItem(guardKey, data.updated_at); location.reload(); }
}

/* --------------------------- 6) UTILITAIRES DOM --------------------------- */
function showMsg(elId, text, kind) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '<div class="msg ' + kind + '">' + text + '</div>';
  if (kind === 'ok') setTimeout(() => { if (el.firstChild) el.innerHTML=''; }, 5000);
}
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }
// Redimensionne une image côté navigateur avant stockage en localStorage (évite de saturer le quota avec des photos pleine taille).
function resizeImageFile(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('Image invalide.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
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
  const plannedInWindow = plan.filter(p => p.date >= windowStart && p.date <= today);
  const doneInWindow = loadAllSessions().filter(s => s.date >= windowStart && s.date <= today);
  const plannedKm = plannedInWindow.reduce((s,p) => s + (p.distanceKm||0), 0);
  const doneKm = doneInWindow.reduce((s,x) => s + (x.distanceKm||0), 0);
  if (plannedKm <= 0) return null;
  const pct = Math.round((doneKm / plannedKm) * 100);
  const plannedDplus = plannedInWindow.reduce((s,p) => s + (p.deniveleM||0), 0);
  const doneDplus = doneInWindow.reduce((s,x) => s + (x.ascent||0), 0);
  const pctDplus = plannedDplus > 0 ? Math.round((doneDplus / plannedDplus) * 100) : null;
  // Repère d'alerte simple, sur le même principe que l'usure des chaussures : sous 60% = sous-préparation,
  // au-dessus de 130% = possible surcharge (charge cumulée bien supérieure au plan). Indicatif, pas une science exacte.
  const level = pct < 60 ? 'low' : (pct > 130 ? 'high' : 'ok');
  return { pct, doneKm, plannedKm, pctDplus, doneDplus, plannedDplus, level };
}

// Info-bulle interactive au survol pour les graphiques SVG (remplace les <title> natifs, peu lisibles
// et lents à apparaître). Les éléments survolables portent un attribut data-tooltip="texte".
function initChartTooltips(container) {
  if (!container || container.dataset.tooltipWired) return;
  container.dataset.tooltipWired = '1';
  let tip = document.getElementById('chartTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chartTooltip';
    tip.className = 'chart-tooltip';
    document.body.appendChild(tip);
  }
  container.addEventListener('mousemove', e => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) { tip.style.display = 'none'; return; }
    tip.textContent = target.getAttribute('data-tooltip');
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top = (e.clientY + 14) + 'px';
  });
  container.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  // Support tactile (mobile) : un appui affiche l'info-bulle au même endroit qu'au survol souris.
  container.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = el && el.closest('[data-tooltip]');
    if (!target) { tip.style.display = 'none'; return; }
    tip.textContent = target.getAttribute('data-tooltip');
    tip.style.display = 'block';
    tip.style.left = Math.min(touch.clientX + 14, window.innerWidth - 160) + 'px';
    tip.style.top = (touch.clientY + 14) + 'px';
  }, { passive: true });
  document.addEventListener('touchstart', e => {
    if (!container.contains(e.target)) tip.style.display = 'none';
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
  if (!storageAvailable()) {
    document.querySelectorAll('.storage-warning-target').forEach(el => {
      el.innerHTML = '<div class="msg err">Le stockage local du navigateur n\'est pas disponible (navigation privée ?) — les données ne seront pas conservées après fermeture de la page.</div>';
    });
  }
  autoPullIfNewer();
});
