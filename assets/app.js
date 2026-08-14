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
  if (btn) {
    // Bascule discrète et iconique dans le header — le libellé complet reste disponible
    // en page Paramètres (#themeToggleBig) pour l'action explicite.
    btn.textContent = theme === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
    btn.title = btn.getAttribute('aria-label');
  }
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
  0:['position_lat',null,null], 1:['position_long',null,null],
};
// Position GPS encodée en "semicircles" dans le format FIT — conversion vers degrés décimaux.
const SEMICIRCLE_TO_DEG = 180 / 2147483648;
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
        lat: r.position_lat != null ? r.position_lat * SEMICIRCLE_TO_DEG : null,
        lon: r.position_long != null ? r.position_long * SEMICIRCLE_TO_DEG : null,
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
      descent: l.total_descent ?? null,
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
    calories: session.total_calories != null ? Math.round(session.total_calories) : null,
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
function statutLabel(s) { return s === 'principal' ? 'Objectif principal' : (s === 'envisage' ? 'Objectif envisagé' : 'Objectif secondaire'); }

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
const FR_MONTHS_SHORT = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function fmtDayMonth(iso) { const [,m,d] = iso.split('-'); return parseInt(d,10) + ' ' + FR_MONTHS_SHORT[parseInt(m,10)-1]; }

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

/* --------------------------- ANALYSE D'UNE SÉANCE (page Activité) --------------------------- */

// Détection des montées d'une séance à partir de la série altitude/distance déjà stockée.
// Logique volontairement simple et déterministe : on suit un segment tant que l'altitude
// progresse globalement, et on le clôt dès que l'altitude redescend de plus de `reversalM`
// depuis son point le plus haut (évite de couper une montée sur un simple faux plat ou du
// bruit GPS/baro). Un segment n'est retenu comme "montée" que s'il dépasse un gain minimum
// ET une pente moyenne minimum (sinon un faux plat vallonné ressortirait comme montée).
// Retourne au plus les 6 montées les plus significatives (par D+), triées par ordre chronologique.
function detectClimbs(series, opts) {
  opts = opts || {};
  const minGainM = opts.minGainM ?? 40;
  const minGradePct = opts.minGradePct ?? 3;
  const reversalM = opts.reversalM ?? 8;
  const pts = (series || []).filter(p => p.alt != null && p.distKm != null && p.t != null);
  if (pts.length < 3) return [];

  const raw = [];
  let start = null, peakAlt = -Infinity, peakIdx = null;
  const flush = (s, e) => {
    if (s == null || e == null || e <= s) return;
    const a = pts[s], b = pts[e];
    const gainM = b.alt - a.alt;
    const distKm = b.distKm - a.distKm;
    if (gainM < minGainM || distKm <= 0) return;
    const gradePct = (gainM / (distKm * 1000)) * 100;
    if (gradePct < minGradePct) return;
    const durationS = b.t - a.t;
    const seg = pts.slice(s, e + 1).filter(p => p.hr != null);
    const avgHr = seg.length ? Math.round(seg.reduce((sum, p) => sum + p.hr, 0) / seg.length) : null;
    raw.push({
      startDistKm: a.distKm, endDistKm: b.distKm,
      distanceKm: +distKm.toFixed(2), gainM: Math.round(gainM), gradePct: +gradePct.toFixed(1),
      durationS: Math.round(durationS), vamMh: durationS > 0 ? Math.round(gainM / (durationS / 3600)) : null,
      avgHr,
    });
  };
  for (let i = 1; i < pts.length; i++) {
    if (start === null) {
      if (pts[i].alt > pts[i - 1].alt) { start = i - 1; peakAlt = pts[i].alt; peakIdx = i; }
      continue;
    }
    if (pts[i].alt >= peakAlt) { peakAlt = pts[i].alt; peakIdx = i; continue; }
    if (peakAlt - pts[i].alt >= reversalM) { flush(start, peakIdx); start = null; peakAlt = -Infinity; peakIdx = null; }
  }
  if (start !== null) flush(start, peakIdx);

  return raw.sort((a, b) => b.gainM - a.gainM).slice(0, 6).sort((a, b) => a.startDistKm - b.startDistKm);
}

// Répartition du temps passé dans chaque zone FC (Karvonen) sur UNE séance, à partir de sa série
// détaillée. Même logique que le calcul déjà utilisé pour le sous-score "Intensité" de l'indice de
// préparation (computeRaceReadiness) — centralisée ici pour être réutilisée par page Activité.
// Retourne null si les zones ne sont pas calculables (FC max/repos non renseignées) ou sans FC.
function computeSessionZoneDistribution(session, zones) {
  const series = (session && session.series) || [];
  if (!zones || series.length < 2) return null;
  const secByZone = zones.map(() => 0);
  let totalSec = 0;
  for (let i = 1; i < series.length; i++) {
    const hr = series[i].hr; if (hr == null) continue;
    const dt = series[i].t - series[i - 1].t; if (!dt || dt <= 0 || dt > 120) continue;
    totalSec += dt;
    let zi = zones.findIndex(z => hr >= z.low && hr <= z.high);
    if (zi < 0) zi = hr < zones[0].low ? 0 : zones.length - 1;
    secByZone[zi] += dt;
  }
  if (totalSec <= 0) return null;
  return zones.map((z, i) => ({ key: z.key, label: z.label, sec: secByZone[i], pct: Math.round(secByZone[i] / totalSec * 100) }));
}

// Compare une séance aux N séances précédentes du même type (sport), pour donner un repère rapide
// ("+18% de distance vs moyenne des 5 dernières sorties"). Retourne null s'il n'y a pas assez
// d'historique du même type pour que la comparaison soit honnête (minimum 2 séances antérieures).
function computeSessionComparison(session, allSessions, n) {
  n = n || 5;
  const prior = (allSessions || []).filter(s => s.id !== session.id && s.date < session.date && s.sport === session.sport).slice(-n);
  if (prior.length < 2) return null;
  const avg = key => { const vals = prior.map(s => s[key]).filter(v => v != null); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; };
  const pctDelta = (cur, ref) => (ref && ref > 0) ? Math.round((cur - ref) / ref * 100) : null;
  const avgDist = avg('distanceKm'), avgAscent = avg('ascent'), avgPace = avg('avgPaceSecPerKm');
  return {
    n: prior.length,
    distanceDeltaPct: session.distanceKm != null ? pctDelta(session.distanceKm, avgDist) : null,
    ascentDeltaPct: session.ascent != null ? pctDelta(session.ascent, avgAscent) : null,
    // Allure : delta négatif = plus rapide que la moyenne (moins de secondes/km), on l'affiche tel quel côté rendu.
    paceDeltaPct: session.avgPaceSecPerKm != null ? pctDelta(session.avgPaceSecPerKm, avgPace) : null,
  };
}

// Insight ELEV d'UNE séance (contrairement à generateElevInsight() qui porte sur la tendance globale).
// Règles explicites et déterministes, aucun appel réseau/IA — à ne jamais confondre avec le retour IA
// post-séance. On ne produit que des observations que les données permettent réellement d'établir
// (voir CLAUDE.md / consignes de rédaction : pas de diagnostic physiologique, pas d'affirmation non
// vérifiable). Retourne un tableau de 0 à 3 phrases courtes.
function generateSessionInsight(session, zoneDist, climbs) {
  const bullets = [];

  if (zoneDist) {
    const z1z2 = zoneDist.slice(0, 2).reduce((a, z) => a + z.pct, 0);
    const z3plus = zoneDist.slice(2).reduce((a, z) => a + z.pct, 0);
    if (z3plus >= 55) bullets.push(z3plus + '% du temps a été passé en zones Z3, Z4 et Z5 : intensité soutenue.');
    else if (z1z2 >= 65) bullets.push(z1z2 + '% du temps a été passé en zones Z1 et Z2 : sortie principalement axée endurance.');
  }

  if (climbs && climbs.length) {
    const withHr = climbs.filter(c => c.avgHr != null);
    if (withHr.length && session.avgHr != null) {
      const avgClimbHr = Math.round(withHr.reduce((a, c) => a + c.avgHr, 0) / withHr.length);
      if (avgClimbHr - session.avgHr >= 8) bullets.push('La fréquence cardiaque est nettement plus élevée dans les montées (' + avgClimbHr + ' bpm en moyenne) que sur l\'ensemble de la séance (' + session.avgHr + ' bpm).');
    }
    const withVam = climbs.filter(c => c.vamMh != null && c.gainM != null);
    if (withVam.length) {
      const totalGain = withVam.reduce((a, c) => a + c.gainM, 0);
      const avgVam = Math.round(withVam.reduce((a, c) => a + c.vamMh * c.gainM, 0) / totalGain);
      bullets.push('VAM moyenne en montée : ' + avgVam + ' m/h sur ' + withVam.length + ' montée' + (withVam.length > 1 ? 's' : '') + ' détectée' + (withVam.length > 1 ? 's' : '') + '.');
    }
  }

  // Régularité de l'allure sur les portions "roulantes" (même seuil que la classification déjà
  // utilisée pour les splits) — coefficient de variation faible = allure stable.
  const flatLaps = (session.laps || []).filter(l => l.distanceKm > 0 && l.avgPaceSecPerKm && ((l.ascent || 0) / l.distanceKm) < 20);
  if (flatLaps.length >= 3) {
    const paces = flatLaps.map(l => l.avgPaceSecPerKm);
    const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
    const variance = paces.reduce((a, p) => a + Math.pow(p - mean, 2), 0) / paces.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv < 0.06) bullets.push('Ton allure est restée relativement stable sur les portions de terrain comparables.');
  }

  return bullets.slice(0, 3);
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

// Indice de préparation détaillé pour une course donnée : décompose la préparation en 5 sous-scores
// (volume, dénivelé, sorties longues, intensité, régularité) au lieu d'un seul pourcentage global,
// pour identifier un point faible actionnable plutôt qu'un chiffre unique. Repères fixes documentés
// ci-dessous (pas de comparaison à d'autres coureurs).
const READINESS_WEEKS = 12;
const READINESS_LONG_RUN_RATIO = 0.6; // la plus longue sortie récente devrait représenter ~60% de la distance de course
const READINESS_VOL_BENCHMARK = 60;   // km/semaine — repère générique utilisé seulement si aucun plan n'est importé
const READINESS_DPLUS_BENCHMARK = 2200; // m D+/semaine — idem
const READINESS_INTENSITY_BENCHMARK = 15; // % du temps en zone FC 3+ (tempo/seuil/VMA) sur la fenêtre, pour un score plein
function computeRaceReadiness(race) {
  const sessions = loadAllSessions();
  const today = new Date().toISOString().slice(0,10);
  const windowStart = new Date(new Date(today).getTime() - READINESS_WEEKS*7*86400000).toISOString().slice(0,10);
  const recent = sessions.filter(s => s.date >= windowStart && s.date <= today);
  const subs = [];

  // Volume + dénivelé : priorité à la comparaison avec le plan importé (28 derniers jours) si disponible,
  // sinon repère générique hebdomadaire sur la fenêtre de 12 semaines.
  const prep = computePrepStatus(race.date);
  if (prep) {
    subs.push({ key:'volume', label:'Volume', score: clampScore(prep.pct), detail: prep.pct + '% du volume prévu au plan (28 derniers jours)' });
    subs.push({ key:'dplus', label:'Dénivelé', score: prep.pctDplus != null ? clampScore(prep.pctDplus) : null, detail: prep.pctDplus != null ? (prep.pctDplus + '% du D+ prévu au plan (28 derniers jours)') : 'Pas de D+ renseigné dans le plan' });
  } else {
    const weekKm = {}, weekDplus = {};
    recent.forEach(s => { const wk = isoWeek(s.date); weekKm[wk] = (weekKm[wk]||0) + (s.distanceKm||0); weekDplus[wk] = (weekDplus[wk]||0) + (s.ascent||0); });
    const kmVals = Object.values(weekKm), dplusVals = Object.values(weekDplus);
    const avgKm = kmVals.length ? kmVals.reduce((a,b)=>a+b,0)/kmVals.length : null;
    const avgDplus = dplusVals.length ? dplusVals.reduce((a,b)=>a+b,0)/dplusVals.length : null;
    subs.push({ key:'volume', label:'Volume', score: avgKm!=null ? clampScore(avgKm/READINESS_VOL_BENCHMARK*100) : null, detail: avgKm!=null ? (Math.round(avgKm)+' km/semaine en moyenne (aucun plan importé — repère générique '+READINESS_VOL_BENCHMARK+' km/semaine)') : 'Pas assez de séances récentes' });
    subs.push({ key:'dplus', label:'Dénivelé', score: avgDplus!=null ? clampScore(avgDplus/READINESS_DPLUS_BENCHMARK*100) : null, detail: avgDplus!=null ? (Math.round(avgDplus)+' m D+/semaine en moyenne (repère générique '+READINESS_DPLUS_BENCHMARK+' m/semaine)') : 'Pas assez de séances récentes' });
  }

  // Sorties longues : la plus longue sortie récente, rapportée à la distance de la course visée.
  const longest = recent.reduce((max, s) => (s.distanceKm||0) > (max ? max.distanceKm||0 : 0) ? s : max, null);
  const longKm = longest ? longest.distanceKm : null;
  const target = race.distanceKm * READINESS_LONG_RUN_RATIO;
  subs.push({
    key:'longues', label:'Sorties longues',
    score: (longKm != null && target > 0) ? clampScore(longKm / target * 100) : null,
    detail: longKm != null ? ('Plus longue sortie récente : ' + longKm.toFixed(1) + ' km (repère : ' + target.toFixed(0) + ' km, soit ' + Math.round(READINESS_LONG_RUN_RATIO*100) + '% de la distance de course)') : 'Aucune séance récente',
  });

  // Intensité : part du temps passé en zone FC 3+ (tempo/seuil/VMA) sur la fenêtre — nécessite FC max
  // et FC repos renseignées en page Accueil pour calculer les zones Karvonen.
  const profile = getProfile();
  const zones = karvonenZones(parseFloat(profile.fcMax), parseFloat(profile.fcRepos));
  if (zones) {
    let z3PlusSec = 0, totalSec = 0;
    recent.forEach(s => {
      const series = s.series || [];
      for (let i = 1; i < series.length; i++) {
        const hr = series[i].hr; if (hr == null) continue;
        const dt = series[i].t - series[i-1].t; if (!dt || dt <= 0 || dt > 120) continue;
        totalSec += dt;
        let zi = zones.findIndex(z => hr >= z.low && hr <= z.high);
        if (zi < 0) zi = hr < zones[0].low ? 0 : zones.length - 1;
        if (zi >= 2) z3PlusSec += dt;
      }
    });
    const pctZ3 = totalSec > 0 ? (z3PlusSec/totalSec*100) : null;
    subs.push({ key:'intensite', label:'Intensité', score: pctZ3!=null ? clampScore(pctZ3/READINESS_INTENSITY_BENCHMARK*100) : null, detail: pctZ3!=null ? (Math.round(pctZ3)+'% du temps en zone 3+ (repère : '+READINESS_INTENSITY_BENCHMARK+'%)') : 'Pas de données FC exploitables récemment' });
  } else {
    subs.push({ key:'intensite', label:'Intensité', score: null, detail: 'Renseigne ta FC max et ta FC repos en page Accueil pour calculer ce sous-score' });
  }

  // Régularité : proportion des 12 dernières semaines avec au moins une séance enregistrée.
  const weeksWithSession = new Set(recent.map(s => isoWeek(s.date))).size;
  subs.push({ key:'regularite', label:'Régularité', score: clampScore(weeksWithSession / READINESS_WEEKS * 100), detail: weeksWithSession + '/' + READINESS_WEEKS + ' semaines avec au moins une séance' });

  const valid = subs.filter(s => s.score != null);
  const overall = valid.length ? Math.round(valid.reduce((a,s) => a+s.score, 0) / valid.length) : null;
  const weakest = valid.length ? valid.reduce((min,s) => s.score < min.score ? s : min, valid[0]) : null;
  return { overall, subs, weakest };
}

// Statistiques de la semaine en cours (depuis lundi), comparées à la semaine précédente complète.
// Pure fonction de calcul (aucun accès au DOM) — réutilisée par les KPI et la section "Cette semaine".
// deltaPct vaut null quand il n'y a rien à comparer (semaine précédente vide) : à afficher comme "—",
// jamais comme 0%, pour ne pas laisser croire à une stagnation mesurée.
function getWeeklyStats() {
  const sessions = loadAllSessions();
  if (!sessions.length) return null;
  const today = new Date().toISOString().slice(0,10);
  const weekStart = isoWeek(today);
  const prevWeekStart = new Date(new Date(weekStart).getTime() - 7*86400000).toISOString().slice(0,10);
  const current = sessions.filter(s => s.date >= weekStart && s.date <= today);
  const previous = sessions.filter(s => s.date >= prevWeekStart && s.date < weekStart);
  const sum = (arr, key) => arr.reduce((a,s) => a + (s[key] || 0), 0);
  const deltaPct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const distanceKm = sum(current, 'distanceKm'), prevDistanceKm = sum(previous, 'distanceKm');
  const ascent = sum(current, 'ascent'), prevAscent = sum(previous, 'ascent');
  const durationS = sum(current, 'durationS'), prevDurationS = sum(previous, 'durationS');
  return {
    distanceKm: +distanceKm.toFixed(1), distanceDeltaPct: deltaPct(distanceKm, prevDistanceKm),
    ascent: Math.round(ascent), ascentDeltaPct: deltaPct(ascent, prevAscent),
    durationS, durationDeltaPct: deltaPct(durationS, prevDurationS),
    sessionsCount: current.length, sessionsDeltaPct: deltaPct(current.length, previous.length),
  };
}

// Tendance de charge : compare la charge aiguë (7 derniers jours) à la charge chronique (moyenne glissante
// des 4 dernières semaines), sur le volume (km) déjà suivi. Retourne un niveau QUALITATIF plutôt qu'un score
// sur 100 — ce n'est pas une mesure physiologique (pas de FC, pas de TRIMP), juste un repère de lecture du
// volume, à traiter comme une observation et non un diagnostic.
// Seuils documentés et ajustables ici :
const TREND_RISING_RATIO = 1.15;      // ratio au-dessus duquel la hausse de volume est jugée raisonnable
const TREND_RISING_FAST_RATIO = 1.5;  // ratio au-dessus duquel la hausse est jugée rapide, à surveiller
const TREND_FALLING_RATIO = 0.75;     // ratio en-dessous duquel le volume est jugé en net repli
const TREND_LABELS = { rising: 'En hausse', rising_fast: 'Hausse rapide', stable: 'Stable', falling: 'En baisse' };
function getTrainingTrend() {
  const sessions = loadAllSessions();
  if (sessions.length < 2) return null;
  const today = new Date().toISOString().slice(0,10);
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const start = new Date(new Date(today).getTime() - (i+1)*7*86400000).toISOString().slice(0,10);
    const end = new Date(new Date(today).getTime() - i*7*86400000).toISOString().slice(0,10);
    const km = sessions.filter(s => s.date > start && s.date <= end).reduce((a,s) => a + (s.distanceKm||0), 0);
    weeks.push(+km.toFixed(1));
  }
  const acute = weeks[weeks.length-1];
  const chronic = weeks.reduce((a,b)=>a+b,0) / weeks.length;
  if (chronic <= 0) return null;
  const ratio = +(acute / chronic).toFixed(2);
  let level;
  if (ratio >= TREND_RISING_FAST_RATIO) level = 'rising_fast';
  else if (ratio >= TREND_RISING_RATIO) level = 'rising';
  else if (ratio <= TREND_FALLING_RATIO) level = 'falling';
  else level = 'stable';
  return { level, label: TREND_LABELS[level], ratio, acute, chronic: +chronic.toFixed(1), weeks };
}

// Insight ELEV : traduit la tendance de charge en une observation textuelle, à partir de règles explicites
// et déterministes (pas d'IA, pas d'appel réseau). Ce sont des observations basées sur l'historique
// d'entraînement — jamais un diagnostic médical ou physiologique.
function generateElevInsight() {
  const trend = getTrainingTrend();
  if (!trend) return null;
  const w = trend.weeks; // [S-3, S-2, S-1, S courante], km, du plus ancien au plus récent
  const texts = {
    rising: {
      title: 'Progression régulière',
      text: 'Ton volume augmente progressivement par rapport aux dernières semaines (' + w[0].toFixed(0) + ' → ' + trend.acute.toFixed(0) + ' km).',
    },
    rising_fast: {
      title: 'Hausse importante du volume',
      text: 'Ta charge récente augmente rapidement (' + trend.acute.toFixed(1) + ' km cette semaine, contre ' + trend.chronic.toFixed(1) + ' km en moyenne). Pense à surveiller la récupération avant d\'ajouter davantage de volume.',
    },
    stable: {
      title: 'Entraînement stable',
      text: 'Ton volume reste proche de ta moyenne récente (autour de ' + trend.chronic.toFixed(0) + ' km/semaine).',
    },
    falling: {
      title: 'Volume en baisse',
      text: 'Ton volume est inférieur aux semaines précédentes (' + trend.acute.toFixed(1) + ' km, contre ' + trend.chronic.toFixed(1) + ' km en moyenne).',
    },
  };
  return Object.assign({ level: trend.level }, texts[trend.level]);
}

// Profil de performance à 6 axes, calculé à partir des séances des 12 dernières semaines (repères fixes
// documentés ci-dessous, pas de comparaison à d'autres coureurs — juste une lecture de tes propres données).
const RADAR_WEEKS = 12;
const RADAR_AXES = [
  { key:'endurance', label:'Endurance' },
  { key:'montee', label:'Montée' },
  { key:'descente', label:'Descente' },
  { key:'vitesse', label:'Vitesse' },
  { key:'resistance', label:'Résistance' },
  { key:'regularite', label:'Régularité' },
];
function clampScore(v) { return v == null ? null : Math.round(Math.max(0, Math.min(100, v))); }
function computePerformanceRadar(sessions) {
  const today = new Date();
  const windowStart = new Date(today.getTime() - RADAR_WEEKS*7*86400000).toISOString().slice(0,10);
  const recent = sessions.filter(s => s.date >= windowStart);
  const notes = [];

  // Endurance : volume hebdomadaire moyen sur les semaines actives. Repère : 60 km/semaine = 100.
  const weekKm = {};
  recent.forEach(s => { const wk = isoWeek(s.date); weekKm[wk] = (weekKm[wk]||0) + (s.distanceKm||0); });
  const activeWeeks = Object.values(weekKm);
  const endurance = activeWeeks.length ? clampScore((activeWeeks.reduce((a,b)=>a+b,0) / activeWeeks.length) / 60 * 100) : null;
  if (endurance == null) notes.push('Endurance : pas assez de séances récentes.');

  // Montée / Descente : dénivelé positif ou négatif hebdomadaire moyen. Repère : 2200 m/semaine = 100.
  const weekDplus = {}, weekDmoins = {};
  recent.forEach(s => {
    const wk = isoWeek(s.date);
    weekDplus[wk] = (weekDplus[wk]||0) + (s.ascent||0);
    weekDmoins[wk] = (weekDmoins[wk]||0) + (s.descent||0);
  });
  const dplusVals = Object.values(weekDplus), dmoinsVals = Object.values(weekDmoins);
  const montee = dplusVals.length ? clampScore((dplusVals.reduce((a,b)=>a+b,0) / dplusVals.length) / 2200 * 100) : null;
  const descente = dmoinsVals.length ? clampScore((dmoinsVals.reduce((a,b)=>a+b,0) / dmoinsVals.length) / 2200 * 100) : null;
  if (montee == null) notes.push('Montée : pas assez de séances récentes.');
  if (descente == null) notes.push('Descente : pas assez de séances récentes.');

  // Vitesse : meilleure allure atteinte sur un km roulant (D+ et D- < 20 m/km, seuil déjà utilisé
  // pour distinguer terrain roulant/montée en page Activités). Repère : 4:00/km = 100, 8:00/km = 0.
  let bestFlatPace = null;
  recent.forEach(s => {
    (s.laps||[]).forEach(l => {
      if (!l.distanceKm || !l.avgPaceSecPerKm) return;
      const dplusKm = (l.ascent||0)/l.distanceKm, dmoinsKm = (l.descent||0)/l.distanceKm;
      if (dplusKm < 20 && dmoinsKm < 20) { if (bestFlatPace == null || l.avgPaceSecPerKm < bestFlatPace) bestFlatPace = l.avgPaceSecPerKm; }
    });
  });
  const vitesse = bestFlatPace != null ? clampScore((480 - bestFlatPace) / (480 - 240) * 100) : null;
  if (vitesse == null) notes.push('Vitesse : pas de split sur terrain roulant identifié récemment.');

  // Résistance : dérive cardiaque sur les sorties longues (≥1h30, courbe FC disponible) — écart entre la FC
  // moyenne de la 2e moitié et celle de la 1re moitié. Repère : 0% de dérive = 100, 15%+ = 0.
  const drifts = [];
  recent.forEach(s => {
    if (!s.durationS || s.durationS < 5400 || !s.series || s.series.length < 20) return;
    const withHr = s.series.filter(p => p.hr != null);
    if (withHr.length < 20) return;
    const mid = Math.floor(withHr.length/2);
    const firstHalf = withHr.slice(0, mid), secondHalf = withHr.slice(mid);
    const avg = arr => arr.reduce((a,p)=>a+p.hr,0) / arr.length;
    const h1 = avg(firstHalf), h2 = avg(secondHalf);
    if (h1 > 0) drifts.push((h2 - h1) / h1 * 100);
  });
  const resistance = drifts.length ? clampScore(100 - (drifts.reduce((a,b)=>a+b,0)/drifts.length) / 15 * 100) : null;
  if (resistance == null) notes.push('Résistance : pas de sortie longue avec FC exploitable récemment.');

  // Régularité : proportion des 12 dernières semaines avec au moins une séance enregistrée.
  const weeksWithSession = new Set(recent.map(s => isoWeek(s.date))).size;
  const regularite = clampScore(weeksWithSession / RADAR_WEEKS * 100);

  return { scores: { endurance, montee, descente, vitesse, resistance, regularite }, notes };
}

// Volume et D+ par semaine sur une fenêtre récente, limitée à l'historique réellement disponible :
// si l'utilisateur a moins de nWeeks semaines de séances, retourne moins de semaines plutôt que de
// compléter avec des zéros — une semaine sans donnée n'est pas une semaine à 0 km.
function getRecentWeeklyVolumes(nWeeks) {
  const sessions = loadAllSessions();
  if (!sessions.length) return [];
  const today = new Date().toISOString().slice(0,10);
  const firstWeek = isoWeek(sessions[0].date);
  const weeks = [];
  for (let i = nWeeks - 1; i >= 0; i--) {
    const ws = isoWeek(new Date(new Date(today).getTime() - i*7*86400000).toISOString().slice(0,10));
    if (ws < firstWeek) continue;
    const weEnd = new Date(ws); weEnd.setDate(weEnd.getDate() + 6);
    const inWeek = sessions.filter(s => s.date >= ws && s.date <= weEnd.toISOString().slice(0,10));
    weeks.push({
      startISO: ws,
      km: inWeek.reduce((a,s) => a + (s.distanceKm||0), 0),
      dplus: inWeek.reduce((a,s) => a + (s.ascent||0), 0),
      shortLabel: ws.slice(8,10)+'/'+ws.slice(5,7),
    });
  }
  return weeks;
}

/* --------------------------- 7) GRAPHIQUES SVG PARTAGÉS --------------------------- */
function svgEmpty(title) { return '<div class="chart-box"><h3>' + title + '</h3><div class="empty">Pas encore assez de séances pour ce graphique (2 minimum).</div></div>'; }

// Sparkline minimaliste (sans axes ni légende) pour les KPI — juste la forme de la tendance récente.
function sparklineSvg(values) {
  if (!values || values.length < 2) return '';
  const w = 100, h = 28;
  const min = Math.min(...values), max = Math.max(...values);
  const span = (max - min) || 1;
  const stepX = w / (values.length - 1);
  const pts = values.map((v,i) => [i*stepX, h - 3 - ((v-min)/span)*(h-6)]);
  const path = pts.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return '<svg class="kpi-spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><path d="'+path+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

// Anneau de progression circulaire compact (KPI "Objectif principal"). Trait de fond très
// discret + arc rempli proportionnel au pourcentage, pas de texte à l'intérieur (la valeur
// est déjà affichée en grand à côté).
function ringSvg(pct) {
  const size = 44, stroke = 4, r = (size - stroke) / 2, c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return '<svg class="kpi-ring" viewBox="0 0 '+size+' '+size+'">' +
    '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="rgba(244,247,245,.09)" stroke-width="'+stroke+'"/>' +
    '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="var(--accent)" stroke-width="'+stroke+'" stroke-linecap="round" ' +
      'stroke-dasharray="'+circumference.toFixed(1)+'" stroke-dashoffset="'+offset.toFixed(1)+'" transform="rotate(-90 '+c+' '+c+')"/>' +
  '</svg>';
}

// Aperçu visuel d'une séance pour la carte "Dernière activité" : trace GPS si les coordonnées sont
// disponibles, sinon profil altimétrique, sinon rien — jamais d'image générique. Fonction de rendu
// pure, sans dépendance à un fond de carte externe (contrairement à la carte Leaflet du détail de séance).
function sessionPreviewSvg(session) {
  const series = Array.isArray(session.series) ? session.series : [];
  const w = 160, h = 100, pad = 10;
  const withGps = series.filter(p => p.lat != null && p.lon != null);
  if (withGps.length >= 2) {
    const lats = withGps.map(p=>p.lat), lons = withGps.map(p=>p.lon);
    const minLat=Math.min(...lats), maxLat=Math.max(...lats), minLon=Math.min(...lons), maxLon=Math.max(...lons);
    const spanLat=(maxLat-minLat)||1, spanLon=(maxLon-minLon)||1;
    const pts = withGps.map(p => [
      pad + (p.lon-minLon)/spanLon*(w-2*pad),
      (h-pad) - (p.lat-minLat)/spanLat*(h-2*pad),
    ]);
    const pointsAttr = pts.map(p => p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    return '<svg class="activity-trace" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMidYMid meet">' +
      '<polyline points="'+pointsAttr+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="'+pts[pts.length-1][0].toFixed(1)+'" cy="'+pts[pts.length-1][1].toFixed(1)+'" r="3" fill="var(--accent)"/>' +
    '</svg>';
  }
  const withAlt = series.filter(p => p.alt != null);
  if (withAlt.length >= 2) {
    const alts = withAlt.map(p=>p.alt);
    const minA=Math.min(...alts), maxA=Math.max(...alts), span=(maxA-minA)||1;
    const stepX = w / (withAlt.length-1);
    const pts = withAlt.map((p,i) => [i*stepX, (h-4) - ((p.alt-minA)/span)*(h-8)]);
    const path = pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const area = path + ' L'+w+','+h+' L0,'+h+' Z';
    return '<svg class="activity-trace" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">' +
      '<path d="'+area+'" fill="var(--chart-fill-top)" stroke="none"/>' +
      '<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2"/>' +
    '</svg>';
  }
  return '';
}

let _chartGradientId = 0;
function lineChartSvg(title, points, opts) {
  opts = opts || {};
  if (points.length < 2) return svgEmpty(title);
  const w = 620, h = opts.height || 280, padL = 54, padR = 18, padT = 20, padB = 36;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = opts.yMin ?? Math.min(...ys), maxY = opts.yMax ?? Math.max(...ys);
  const spanY = (maxY - minY) || 1;
  const spanX = (maxX - minX) || 1;
  const midY = (minY + maxY) / 2;
  const sx = x => padL + (x - minX) / spanX * (w - padL - padR);
  const sy = y => (h - padB) - (y - minY) / spanY * (h - padT - padB);
  const path = points.map((p,i) => (i===0?'M':'L') + sx(p.x).toFixed(1) + ',' + sy(p.y).toFixed(1)).join(' ');
  const gradId = 'chartFill' + (_chartGradientId++);
  const areaPath = path + ' L' + sx(points[points.length-1].x).toFixed(1) + ',' + (h-padB) + ' L' + sx(points[0].x).toFixed(1) + ',' + (h-padB) + ' Z';
  const dots = points.map(p => {
    const cx = sx(p.x).toFixed(1), cy = sy(p.y).toFixed(1);
    return '<circle cx="'+cx+'" cy="'+cy+'" r="11" fill="transparent" data-tooltip="'+escapeHtml(p.label)+'"/>' +
      '<circle cx="'+cx+'" cy="'+cy+'" r="4" fill="var(--accent)" style="pointer-events:none;"/>';
  }).join('');
  const firstLabel = points[0].xLabel, lastLabel = points[points.length-1].xLabel;
  return '<div class="chart-box' + (opts.hideTitle ? ' no-title' : '') + '">' + (opts.hideTitle ? '' : '<h3>' + title + '</h3>') + '<svg viewBox="0 0 '+w+' '+h+'">' +
    '<defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--chart-fill-top)"/><stop offset="100%" stop-color="var(--chart-fill-bottom)"/>' +
    '</linearGradient></defs>' +
    '<path d="'+areaPath+'" fill="url(#'+gradId+')" stroke="none"/>' +
    '<line x1="'+padL+'" y1="'+sy(midY).toFixed(1)+'" x2="'+(w-padR)+'" y2="'+sy(midY).toFixed(1)+'" stroke="var(--border)" stroke-dasharray="3,3"/>' +
    '<line x1="'+padL+'" y1="'+(h-padB)+'" x2="'+(w-padR)+'" y2="'+(h-padB)+'" stroke="var(--border)"/>' +
    '<line x1="'+padL+'" y1="'+padT+'" x2="'+padL+'" y2="'+(h-padB)+'" stroke="var(--border)"/>' +
    '<text x="4" y="'+(padT+6)+'" font-size="13" fill="var(--muted)">'+(opts.yMaxLabel ?? maxY.toFixed(opts.decimals??0))+'</text>' +
    '<text x="4" y="'+(sy(midY)-5).toFixed(1)+'" font-size="12" fill="var(--muted)">'+midY.toFixed(opts.decimals??0)+'</text>' +
    '<text x="4" y="'+(h-padB+2)+'" font-size="13" fill="var(--muted)">'+(opts.yMinLabel ?? minY.toFixed(opts.decimals??0))+'</text>' +
    '<text x="'+padL+'" y="'+(h-8)+'" font-size="12" fill="var(--muted)">'+firstLabel+'</text>' +
    '<text x="'+(w-padR-50)+'" y="'+(h-8)+'" font-size="12" fill="var(--muted)">'+lastLabel+'</text>' +
    '<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2.5"/>' + dots +
  '</svg></div>';
}
function groupedBarChartSvg(title, weeks, series, opts) {
  opts = opts || {};
  if (!weeks.length) return svgEmpty(title);
  const w = 620, h = opts.height || 290, padL = 54, padR = 18, padT = 20, padB = 44;
  const maxV = Math.max(1, ...series.flatMap(s => s.values));
  const groupW = (w - padL - padR) / weeks.length;
  const barW = (groupW * 0.7) / series.length;
  let bars = '';
  weeks.forEach((wk, i) => {
    const groupX = padL + i * groupW + groupW * 0.15;
    series.forEach((s, si) => {
      const val = s.values[i] || 0;
      const bh = (val / maxV) * (h - padT - padB);
      const x = groupX + si * barW;
      const y = (h - padB) - bh;
      const tip = escapeHtml(s.name + ' — ' + (wk.tooltipLabel || ('semaine du ' + wk.shortLabel)) + ' : ' + val.toFixed(1));
      bars += '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(barW*0.85).toFixed(1)+'" height="'+Math.max(bh,1).toFixed(1)+'" fill="'+s.color+'" data-tooltip="'+tip+'"/>';
    });
    if (i % Math.ceil(weeks.length/8||1) === 0) {
      bars += '<text x="'+(groupX+groupW*0.35).toFixed(1)+'" y="'+(h-14)+'" font-size="11" fill="var(--muted)" text-anchor="middle">'+wk.shortLabel+'</text>';
    }
  });
  const legend = '<div class="chart-legend">' + series.map(s => '<span><span class="dot" style="background:'+s.color+'"></span>'+s.name+'</span>').join('') + '</div>';
  return '<div class="chart-box' + (opts.hideTitle ? ' no-title' : '') + '">' + (opts.hideTitle ? '' : '<h3>' + title + '</h3>') + legend + '<svg viewBox="0 0 '+w+' '+h+'">' +
    '<line x1="'+padL+'" y1="'+(h-padB)+'" x2="'+(w-padR)+'" y2="'+(h-padB)+'" stroke="var(--border)"/>' +
    '<text x="4" y="'+(padT+6)+'" font-size="13" fill="var(--muted)">'+maxV.toFixed(0)+'</text>' +
    bars +
  '</svg></div>';
}

function radarChartSvg(axes, scores) {
  const w = 340, h = 340, cx = w/2, cy = h/2, r = 120;
  const n = axes.length;
  const angle = i => -Math.PI/2 + i * (2*Math.PI/n);
  const pt = (i, frac) => [cx + Math.cos(angle(i)) * r * frac, cy + Math.sin(angle(i)) * r * frac];
  // Anneaux de repère à 25/50/75/100%.
  let rings = '';
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const poly = axes.map((_, i) => pt(i, frac).join(',')).join(' ');
    rings += '<polygon points="'+poly+'" fill="none" stroke="var(--border)" stroke-width="1"/>';
  });
  let spokes = '', labels = '';
  axes.forEach((ax, i) => {
    const [x, y] = pt(i, 1);
    spokes += '<line x1="'+cx+'" y1="'+cy+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--border)" stroke-width="1"/>';
    const [lx, ly] = pt(i, 1.16);
    const score = scores[ax.key];
    labels += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" font-size="12" fill="var(--text)" text-anchor="middle" dominant-baseline="middle">'+ax.label+(score!=null?' ('+score+')':' (n/d)')+'</text>';
  });
  const dataPts = axes.map((ax, i) => pt(i, (scores[ax.key] ?? 0) / 100));
  const dataPoly = dataPts.map(p => p.join(',')).join(' ');
  const dots = axes.map((ax, i) => {
    const [x, y] = dataPts[i];
    const score = scores[ax.key];
    const tip = escapeHtml(ax.label + ' : ' + (score!=null ? score+'/100' : 'donnée insuffisante'));
    return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="10" fill="transparent" data-tooltip="'+tip+'"/>' +
      '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="4" fill="var(--accent)" style="pointer-events:none;"/>';
  }).join('');
  return '<div class="chart-box radar-box"><h3>Profil de performance <small style="font-weight:400;">(estimé sur les '+RADAR_WEEKS+' dernières semaines)</small></h3>' +
    '<svg viewBox="0 0 '+w+' '+h+'">' + rings + spokes +
    '<polygon points="'+dataPoly+'" fill="var(--chart-fill-top)" stroke="var(--accent)" stroke-width="2.5"/>' +
    dots + labels +
    '</svg></div>';
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
