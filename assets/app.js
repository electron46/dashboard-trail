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
const GLOBAL_MESSAGES = { 0:'file_id', 18:'session', 19:'lap', 20:'record', 21:'event', 23:'device_info', 34:'activity', 206:'field_description', 207:'developer_data_id' };
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
// Événements (pauses minuteur, sorties de parcours...) et infos appareils — ignorés jusqu'ici.
const EVENT_FIELDS = { 253:['timestamp',null,null], 0:['event',null,null], 1:['event_type',null,null], 4:['event_group',null,null] };
const DEVICE_INFO_FIELDS = {
  253:['timestamp',null,null], 0:['device_index',null,null], 1:['device_type',null,null],
  2:['manufacturer',null,null], 3:['serial_number',null,null], 4:['product',null,null],
  5:['software_version',100,0], 10:['product_name',null,null], 25:['battery_status',null,null],
};
// Champs "développeur" (Developer Data Fields) : le fichier .fit décrit lui-même leur nom/échelle/unité
// via ces deux messages — pas de table figée nécessaire, la résolution se fait après la première passe
// (voir resolveDeveloperFields).
const FIELD_DESCRIPTION_FIELDS = {
  0:['developer_data_index',null,null], 1:['field_definition_number',null,null], 2:['fit_base_type_id',null,null],
  3:['field_name',null,null], 6:['scale',null,null], 7:['offset',null,null], 8:['units',null,null],
};
const DEVELOPER_DATA_ID_FIELDS = { 3:['developer_data_index',null,null] };
const FIELD_MAPS = {
  record:RECORD_FIELDS, session:SESSION_FIELDS, lap:LAP_FIELDS, event:EVENT_FIELDS,
  device_info:DEVICE_INFO_FIELDS, field_description:FIELD_DESCRIPTION_FIELDS, developer_data_id:DEVELOPER_DATA_ID_FIELDS,
};
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
      // Champ non cartographié (message connu avec un champ rare, ou message inconnu) : on le
      // garde quand même sous un nom générique plutôt que de le perdre silencieusement.
      else if (value !== null) { record['field_' + fieldDefNum] = value; }
    }
    if (def.devFields.length) {
      record.dev = [];
      for (const [devFieldNum, size, devDataIndex] of def.devFields) {
        const bytes = Array.from(new Uint8Array(view.buffer, view.byteOffset + offset, size));
        record.dev.push({ devDataIndex, devFieldNum, bytes });
        offset += size;
      }
    }
    (messages[def.msgName] = messages[def.msgName] || []).push(record);
  }
  resolveDeveloperFields(messages);
  return messages;
}
// Résout les champs développeur bruts collectés pendant le décodage à l'aide des messages
// field_description présents dans le même fichier (nom, échelle, offset, type réel). Un champ dont
// la description est absente ou non reconnue reste tout de même conservé (valeur brute), jamais jeté.
function resolveDeveloperFields(messages) {
  const resolver = {};
  (messages.field_description || []).forEach(d => {
    if (d.developer_data_index == null || d.field_definition_number == null) return;
    resolver[d.developer_data_index + '_' + d.field_definition_number] = d;
  });
  Object.keys(messages).forEach(msgName => {
    messages[msgName].forEach(record => {
      if (!record.dev || !record.dev.length) return;
      record.dev.forEach(({ devDataIndex, devFieldNum, bytes }) => {
        const desc = resolver[devDataIndex + '_' + devFieldNum];
        const view = new DataView(new Uint8Array(bytes).buffer);
        let value;
        if (desc && desc.fit_base_type_id != null && BASE_TYPES[desc.fit_base_type_id]) {
          value = applyScale(decodeField(view, 0, bytes.length, desc.fit_base_type_id), desc.scale, desc.offset);
        } else if (bytes.length === 1) { value = view.getUint8(0); }
        else if (bytes.length === 2) { value = view.getUint16(0, true); }
        else if (bytes.length === 4) { value = view.getUint32(0, true); }
        else { value = bytes.map(b => b.toString(16).padStart(2, '0')).join(''); }
        const key = desc && desc.field_name ? 'dev_' + desc.field_name : 'dev_unresolved_' + devDataIndex + '_' + devFieldNum;
        record[key] = value;
      });
      delete record.dev;
    });
  });
}
function fitTimestampToDate(ts) { if (ts === null || ts === undefined) return null; return new Date(FIT_EPOCH_MS + ts * 1000); }

// LTTB (Largest Triangle Three Buckets) — réduit une série {x,y} à `threshold` points en
// préservant au mieux la forme visuelle (pics, creux, ruptures), contrairement à un simple
// échantillonnage "1 point tous les N". Référence : Sveinn Steinarsson, 2013. Opère sur des
// indices pour pouvoir être réutilisé sur plusieurs signaux (altitude/FC/allure) et recomposer
// ensuite un seul jeu de points communs (voir buildDetailSeries ci-dessous).
function lttbSelectIndices(points, threshold) {
  const n = points.length;
  if (threshold >= n || threshold <= 2) return points.map((_, i) => i);
  const sampled = [0];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
    let avgX = 0, avgY = 0;
    const avgLen = Math.max(1, avgEnd - avgStart);
    for (let j = avgStart; j < avgEnd; j++) { avgX += points[j].x; avgY += points[j].y; }
    avgX /= avgLen; avgY /= avgLen;

    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    const pax = points[a].x, pay = points[a].y;
    let maxArea = -1, maxAreaIndex = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs((pax - avgX) * (points[j].y - pay) - (pax - points[j].x) * (avgY - pay)) * 0.5;
      if (area > maxArea) { maxArea = area; maxAreaIndex = j; }
    }
    sampled.push(maxAreaIndex);
    a = maxAreaIndex;
  }
  sampled.push(n - 1);
  return sampled;
}

// Construit la série de points d'une séance (utilisée par les graphiques Altitude/Allure/FC et la
// carte GPS) en visant `targetPoints` points au rendu — au lieu d'un pas fixe uniforme, on fait tourner
// LTTB séparément sur l'altitude, la FC et l'allure (les 3 signaux réellement représentés en courbe),
// puis on fusionne (union) les index sélectionnés : chaque signal garde ses pics/ruptures propres,
// plutôt qu'un unique passage qui privilégierait la forme d'une seule métrique au détriment des autres.
function buildDetailSeries(withTs, t0, targetPoints) {
  const raw = withTs.map(r => {
    const spd = r.enhanced_speed || r.speed;
    let paceSecKm = (spd && spd > 0) ? 1000 / spd : null;
    if (paceSecKm != null && paceSecKm > 1200) paceSecKm = null; // > 20:00/km : arrêt/pause, pas une donnée d'allure exploitable
    return {
      t: r.timestamp - t0,
      distKm: r.distance != null ? r.distance / 1000 : null,
      paceSecKm,
      hr: r.heart_rate ?? null,
      alt: r.enhanced_altitude ?? r.altitude ?? null,
      cadenceSpm: r.cadence != null ? Math.round(r.cadence * 2) : null,
      power: r.power ?? null,
      lat: r.position_lat != null ? r.position_lat * SEMICIRCLE_TO_DEG : null,
      lon: r.position_long != null ? r.position_long * SEMICIRCLE_TO_DEG : null,
    };
  });
  if (raw.length <= targetPoints) return raw;

  const perSignalTarget = Math.max(50, Math.round(targetPoints * 0.55));
  const selected = new Set([0, raw.length - 1]);
  ['alt', 'hr', 'paceSecKm'].forEach(key => {
    const dense = []; const denseToGlobal = [];
    raw.forEach((p, i) => { if (p[key] != null) { dense.push({ x: i, y: p[key] }); denseToGlobal.push(i); } });
    if (dense.length < 3) return;
    lttbSelectIndices(dense, perSignalTarget).forEach(localIdx => selected.add(denseToGlobal[localIdx]));
  });
  let indices = Array.from(selected).sort((a, b) => a - b);
  // Garde-fou : si l'union des 3 signaux dépasse largement la cible (chevauchement faible), on
  // ré-échantillonne uniformément CETTE liste déjà réduite plutôt que de repartir des données brutes.
  const hardCap = Math.round(targetPoints * 1.25);
  if (indices.length > hardCap) {
    const stride = indices.length / hardCap;
    const thinned = [];
    for (let i = 0; i < hardCap; i++) thinned.push(indices[Math.min(indices.length - 1, Math.round(i * stride))]);
    thinned[thinned.length - 1] = indices[indices.length - 1];
    indices = Array.from(new Set(thinned)).sort((a, b) => a - b);
  }
  return indices.map(i => raw[i]);
}

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

  // Série temporelle pour les courbes de séance (allure/FC/altitude/cadence) et la carte GPS.
  // Réduite via LTTB (voir buildDetailSeries) plutôt qu'un pas fixe uniforme : préserve les pics,
  // creux et ruptures de chaque signal au lieu de les lisser arbitrairement. Cible ~1200 points
  // (zone recommandée 1000-1500 pour un rendu desktop détaillé) ; le rendu mobile réduit encore
  // ponctuellement à l'affichage (voir activite.html), sans dupliquer le stockage.
  const withTs = records.filter(r => r.timestamp != null);
  let series = [];
  if (withTs.length >= 2) {
    const t0 = withTs[0].timestamp;
    series = buildDetailSeries(withTs, t0, 1200);
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

  // Événements (démarrage/arrêt minuteur, sorties de parcours...) — horodatage relatif au début
  // de la séance, comme pour la série. Pas encore exploités dans l'interface (reconstruction des
  // pauses prévue à une étape suivante), mais conservés dès maintenant pour ne rien perdre.
  const events = (messages.event || []).filter(e => e.timestamp != null).slice(0, 500).map(e => ({
    t: e.timestamp - (records.find(r => r.timestamp != null)?.timestamp ?? e.timestamp),
    event: e.event ?? null,
    eventType: e.event_type ?? null,
  }));

  // Appareils ayant enregistré la séance (montre, ceinture FC, capteur de puissance externe...).
  const devices = [];
  const seenDevices = new Set();
  (messages.device_info || []).forEach(d => {
    if (d.manufacturer == null && d.product_name == null) return;
    const key = (d.device_index ?? '') + '_' + (d.manufacturer ?? '') + '_' + (d.serial_number ?? '');
    if (seenDevices.has(key)) return;
    seenDevices.add(key);
    devices.push({
      manufacturer: d.manufacturer ?? null,
      product: d.product ?? null,
      productName: d.product_name ?? null,
      serialNumber: d.serial_number ?? null,
      softwareVersion: d.software_version ?? null,
      batteryStatus: d.battery_status ?? null,
    });
  });

  // Inventaire brut : quels types de messages contenait réellement ce fichier .fit (y compris les
  // types inconnus/propriétaires), et quels champs développeur ont été détectés — utile pour l'audit
  // et pour le futur FIT Import Inspector, sans avoir à réanalyser le fichier original.
  const messageInventory = {};
  Object.keys(messages).forEach(name => { messageInventory[name] = messages[name].length; });
  const developerFieldNames = new Set();
  Object.values(messages).forEach(list => list.forEach(r => {
    Object.keys(r).forEach(k => { if (k.startsWith('dev_')) developerFieldNames.add(k); });
  }));

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
    events: events,
    devices: devices,
    raw: {
      messageInventory: messageInventory,
      developerFields: Array.from(developerFieldNames),
    },
  };
}

/* --------------------------- FIT IMPORT INSPECTOR (outil de développement) ---------------------------
   Radiographie d'un fichier .fit : en-tête, intégrité (CRC), inventaire complet des messages
   (connus et inconnus/propriétaires), taux de couverture des champs de la série de points, champs
   développeur détectés, appareils. Ne modifie rien, ne stocke rien — lecture seule, page dédiée
   inspecteur.html (non reliée à la navigation principale). */
// CRC-16 du format FIT (table à 16 entrées, spécification Garmin/ANT+) — permet de détecter un
// fichier tronqué ou corrompu avant même d'essayer de l'interpréter.
const FIT_CRC_TABLE = [0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400];
function fitCrc16(bytes) {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    let tmp = FIT_CRC_TABLE[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ FIT_CRC_TABLE[byte & 0xF];
    tmp = FIT_CRC_TABLE[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ FIT_CRC_TABLE[(byte >> 4) & 0xF];
  }
  return crc;
}
function buildFitInspectorReport(buffer, fileMeta) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const headerSize = view.getUint8(0);
  const protocolByte = view.getUint8(1);
  const protocolVersion = (protocolByte >> 4) + '.' + (protocolByte & 0x0F);
  const profileVersion = (view.getUint16(2, true) / 100).toFixed(2);
  const dataSize = view.getUint32(4, true);
  const signature = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  const expectedSize = headerSize + dataSize + 2; // +2 = CRC de fin de fichier
  const truncated = buffer.byteLength < expectedSize;

  let headerCrcValid = null;
  if (headerSize >= 14) {
    const storedHeaderCrc = view.getUint16(12, true);
    headerCrcValid = storedHeaderCrc === 0 ? null : (fitCrc16(bytes.slice(0, 12)) === storedHeaderCrc);
  }
  let fileCrcValid = null;
  if (!truncated && buffer.byteLength >= headerSize + dataSize + 2) {
    const storedFileCrc = view.getUint16(headerSize + dataSize, true);
    fileCrcValid = fitCrc16(bytes.slice(0, headerSize + dataSize)) === storedFileCrc;
  }

  let messages = {}, parseError = null, summary = null;
  try {
    messages = parseFit(buffer);
    summary = summarizeFit(messages, fileMeta);
  } catch (e) { parseError = e.message; }

  const messageInventory = Object.keys(messages).sort((a, b) => messages[b].length - messages[a].length).map(name => {
    const m = /^unknown_(\d+)$/.exec(name);
    return { name, count: messages[name].length, known: !m, globalMsgNum: m ? Number(m[1]) : null };
  });

  const records = messages.record || [];
  const coverageFields = [
    ['heart_rate','Fréquence cardiaque'], ['power','Puissance'], ['cadence','Cadence'],
    ['altitude','Altitude'], ['enhanced_altitude','Altitude (enhanced)'], ['speed','Vitesse'],
    ['enhanced_speed','Vitesse (enhanced)'], ['distance','Distance'], ['temperature','Température'],
  ];
  const recordCoverage = records.length ? coverageFields.map(([key, label]) => {
    const n = records.filter(r => r[key] != null).length;
    return { key, label, count: n, total: records.length, pct: Math.round(n / records.length * 1000) / 10 };
  }) : [];
  const gpsCount = records.filter(r => r.position_lat != null && r.position_long != null).length;
  if (records.length) recordCoverage.unshift({ key:'gps', label:'Position GPS', count: gpsCount, total: records.length, pct: Math.round(gpsCount / records.length * 1000) / 10 });

  const developerFields = (messages.field_description || []).map(d => ({
    name: d.field_name, developerDataIndex: d.developer_data_index, fieldDefinitionNumber: d.field_definition_number,
    units: d.units || null, scale: d.scale ?? null, offset: d.offset ?? null,
  }));

  return {
    file: {
      filename: fileMeta.name || null, sizeBytes: buffer.byteLength,
      headerSize, protocolVersion, profileVersion, dataSize, signature,
      signatureValid: signature === '.FIT', truncated, headerCrcValid, fileCrcValid, expectedSize,
    },
    parseError,
    summary,
    messageInventory,
    recordCoverage,
    developerFields,
    devices: summary ? summary.devices : [],
    laps: (messages.lap || []).length,
    events: (messages.event || []).length,
  };
}

/* --------------------------- 3) STOCKAGE --------------------------- */
// Version affichée en page Paramètres — source unique, jamais dupliquée ailleurs. Aucune version
// n'existait avant cette page (ni manifest.json, ni code) : c'est la première déclaration réelle.
const APP_VERSION = '1.0.0';
const STORAGE_PREFIX = 'trail:';
const IDX_KEY = STORAGE_PREFIX + 'index';
const PLAN_KEY = STORAGE_PREFIX + 'plan';
const PLAN_NOTES_KEY = STORAGE_PREFIX + 'planNotes';
const KEY_KEY = STORAGE_PREFIX + 'apikey';
const RACES_KEY = STORAGE_PREFIX + 'races';
const PROFILE_KEY = STORAGE_PREFIX + 'profile';
const GEAR_KEY = STORAGE_PREFIX + 'gear';

function storageAvailable() { try { const k='__test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }
function loadIndex() { try { return JSON.parse(localStorage.getItem(IDX_KEY) || '[]'); } catch (e) { console.error('Index illisible', e); return []; } }
function saveIndex(ids) { try { localStorage.setItem(IDX_KEY, JSON.stringify(ids)); scheduleSync(); return true; } catch (e) { console.error(e); return false; } }
function loadSession(id) { try { const raw = localStorage.getItem(STORAGE_PREFIX + 'seance:' + id); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
// Une écriture qui échoue est presque toujours un dépassement du quota du navigateur (5 à 10 Mo
// selon les navigateurs). Mesuré en QA : 280 séances occupent ~12 Mo, soit la limite atteinte
// vers 120 à 200 séances — deux à trois saisons. L'échec était signalé comme un « échec » sans
// cause, ce qui ne dit pas à l'utilisateur quoi faire. `lastStorageError` porte la raison
// jusqu'au message d'import.
let lastStorageError = null;
function isQuotaError(e) {
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);
}
function saveSession(id, data) {
  try { localStorage.setItem(STORAGE_PREFIX + 'seance:' + id, JSON.stringify(data)); scheduleSync(); lastStorageError = null; return true; }
  catch (e) {
    console.error(e);
    lastStorageError = isQuotaError(e)
      ? 'Le stockage de ce navigateur est plein. Exporte tes données puis supprime les séances les plus anciennes (Paramètres → Données), ou active la synchronisation pour les conserver dans le cloud.'
      : ('Écriture impossible : ' + e.message);
    return false;
  }
}
function deleteSession(id) { try { localStorage.removeItem(STORAGE_PREFIX + 'seance:' + id); scheduleSync(); } catch (e) {} }
function loadAllSessions() { return loadIndex().map(loadSession).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)); }
// Dernier appareil ayant enregistré une séance importée (page Profil, carte Connectivité) — lecture
// seule des `devices` déjà extraits par le parser FIT à l'import, aucune nouvelle intégration. N'affiche
// que si le fichier .fit fournissait un nom lisible (`product_name`) : un code fabricant/produit brut
// serait illisible et n'est jamais montré tel quel (voir CLAUDE.md).
function getLastDetectedDevice() {
  const sessions = loadAllSessions();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const named = (sessions[i].devices || []).find(d => d.productName);
    if (named) return { name: named.productName, date: sessions[i].date };
  }
  return null;
}

function getPlan() { try { const raw = localStorage.getItem(PLAN_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function savePlan(plan) { try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); scheduleSync(); return true; } catch (e) { return false; } }
function clearPlan() { try { localStorage.removeItem(PLAN_KEY); scheduleSync(); } catch (e) {} }
function findPlannedSession(dateISO) { const plan = getPlan(); if (!plan) return null; return plan.find(p => p.date === dateISO) || null; }
// Note libre sur le plan (page Plan, onglet Ajustements) — texte manuel de l'utilisateur, jamais généré.
function getPlanNotes() { try { return localStorage.getItem(PLAN_NOTES_KEY) || ''; } catch (e) { return ''; } }
function savePlanNotes(text) { try { localStorage.setItem(PLAN_NOTES_KEY, text || ''); scheduleSync(); return true; } catch (e) { return false; } }
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
// Course "objectif par défaut" à mettre en avant (page Profil) : la principale à venir, sinon la
// prochaine à venir, sinon la plus récente déjà passée — même logique que objectifs.html
// (defaultRaceId), pas réutilisée en amont sur Accueil/Objectifs pour ne rien changer à leur
// comportement actuel (voir CLAUDE.md, refonte Profil).
function getMainObjectiveRace() {
  const today = new Date().toISOString().slice(0,10);
  const races = getRaces().filter(r => !r.archived);
  if (!races.length) return null;
  const upcoming = races.filter(r => r.date >= today).sort((a,b) => a.date.localeCompare(b.date));
  const principal = upcoming.find(r => r.statut === 'principal');
  if (principal) return principal;
  if (upcoming.length) return upcoming[0];
  return races.slice().sort((a,b) => b.date.localeCompare(a.date))[0];
}

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
  { nom:'', naissance:'', sante:'', records:[], objectifsAutres:'', apropos:'', createdAt:null, hrZoneMode:'karvonen', customHrZones:null },
  ...PROFILE_FIELD_GROUPS.flatMap(g => g.fields.map(([key]) => ({ [key]: '' })))
);
function getProfile() { try { const raw = localStorage.getItem(PROFILE_KEY); return raw ? Object.assign({}, DEFAULT_PROFILE, JSON.parse(raw)) : Object.assign({}, DEFAULT_PROFILE); } catch (e) { return Object.assign({}, DEFAULT_PROFILE); } }
// Fusionne partiellement le profil (édition par carte, page Profil) plutôt que d'exiger un formulaire
// global — lit l'état courant, applique le correctif, sauvegarde l'ensemble (saveProfile reste inchangée).
function patchProfile(partial) { saveProfile(Object.assign({}, getProfile(), partial)); }
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
// Zones de FC réellement actives pour tout ELEV (Accueil, Objectifs, Analyse, Plan, Détail séance,
// Profil) : personnalisées si `hrZoneMode === 'custom'` et des bornes existent, sinon calcul Karvonen
// habituel — substitut direct de karvonenZones(fcMax, fcRepos) partout où les zones étaient lues
// depuis FC max/repos seules. Jamais d'ambiguïté sur la source active (voir CLAUDE.md, passe
// simplification Profil).
function getActiveHrZones(profile) {
  if (profile && profile.hrZoneMode === 'custom' && profile.customHrZones) {
    return KARVONEN_ZONES.map(z => {
      const c = profile.customHrZones[z.key];
      return c ? { key: z.key, label: z.label, low: c.low, high: c.high } : null;
    }).filter(Boolean);
  }
  return karvonenZones(parseFloat(profile && profile.fcMax), parseFloat(profile && profile.fcRepos));
}

// Repère RPE (perception d'effort, échelle de Borg 1-10) — table FIXE et informative, volontairement
// distincte des zones de FC (perception vs mesure physiologique, voir CLAUDE.md). Aucune séance n'est
// notée en RPE dans l'app aujourd'hui : ce n'est donc jamais un calcul, juste un repère de lecture
// affiché en page Profil à côté des zones de FC mesurées.
const RPE_ZONES = [
  { key:'z1', label:'Z1', range:'1–2', desc:'Très facile' },
  { key:'z2', label:'Z2', range:'3–4', desc:'Facile' },
  { key:'z3', label:'Z3', range:'5–6', desc:'Modéré' },
  { key:'z4', label:'Z4', range:'7–8', desc:'Difficile' },
  { key:'z5', label:'Z5', range:'9–10', desc:'Très difficile' },
];

// --- Équipements (chaussures, montres/GPS, accessoires, autres) ---
// Même stockage qu'avant (trail:gear, inclus dans buildSyncPayload) — pas de table Supabase dédiée,
// le lien séance↔équipement est déjà normalisé via `session.gearId` (colonne `gear_id` de la table
// `activities`). category ajoutée avec défaut 'chaussures' pour rester compatible avec les paires déjà
// enregistrées avant cette passe (voir CLAUDE.md, refonte Équipements).
function getGear() { try { return JSON.parse(localStorage.getItem(GEAR_KEY) || '[]'); } catch (e) { return []; } }
function saveGear(list) { try { localStorage.setItem(GEAR_KEY, JSON.stringify(list)); scheduleSync(); return true; } catch (e) { return false; } }
function upsertGearItem(item) {
  const list = getGear();
  if (!item.id) item.id = 'equip-' + Date.now();
  const i = list.findIndex(g => g.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
  saveGear(list);
  return item;
}
function deleteGearItem(id) { saveGear(getGear().filter(g => g.id !== id)); }
// Km parcourus par un équipement = km de base saisi manuellement + somme des séances qui lui sont associées.
function gearKmFromSessions(gearId) {
  return loadAllSessions().filter(s => s.gearId === gearId).reduce((sum, s) => sum + (s.distanceKm || 0), 0);
}

// Seuils d'état automatique (chaussures uniquement — kilométrage vs repère configuré), centralisés ici
// pour n'être calculés qu'à un seul endroit (voir CLAUDE.md — pas de score d'usure inventé ailleurs).
const EQUIPMENT_STATUS_THRESHOLDS = { warn: 0.75, danger: 0.95 };

// Usage complet d'un équipement : kilométrage (si chaussures), statut (auto pour les chaussures — override
// manuel prioritaire si renseigné ; manuel uniquement pour les autres catégories), dernière utilisation et
// nombre de séances associées. Un seul helper réutilisé partout sur la page (voir CLAUDE.md §64).
function getEquipmentUsage(item) {
  const sessions = loadAllSessions().filter(s => s.gearId === item.id);
  const lastSession = sessions.length ? sessions[sessions.length - 1] : null;
  const isDistanceTracked = (item.category || 'chaussures') === 'chaussures';
  let km = null, pct = null, autoStatus = null;
  if (isDistanceTracked) {
    km = (item.kmInitial || 0) + sessions.reduce((sum, s) => sum + (s.distanceKm || 0), 0);
    const seuil = item.seuilKm || 700;
    pct = seuil > 0 ? Math.round((km / seuil) * 100) : null;
    if (pct != null) autoStatus = pct >= EQUIPMENT_STATUS_THRESHOLDS.danger * 100 ? 'remplacer' : (pct >= EQUIPMENT_STATUS_THRESHOLDS.warn * 100 ? 'surveiller' : 'bon');
  }
  const status = !item.actif ? 'archive' : (item.manualStatus || autoStatus || 'bon');
  return {
    km, pct, autoStatus, status, isDistanceTracked,
    sessionsCount: sessions.length,
    lastUsedDate: lastSession ? lastSession.date : null,
    lastSession,
  };
}

// Vérification d'intégrité simple (page Paramètres) : uniquement ce qui est réellement vérifiable en
// local — séances dont le gearId pointe vers un équipement supprimé (référence orpheline). Volontairement
// limité, pas de contrôle inventé sur des structures qui n'existent pas (voir CLAUDE.md).
function checkDataIntegrity() {
  const gearIds = new Set(getGear().map(g => g.id));
  const orphanSessions = loadAllSessions().filter(s => s.gearId && !gearIds.has(s.gearId));
  return { orphanGearRefs: orphanSessions.length, ok: orphanSessions.length === 0 };
}

// Appareils FIT récemment détectés (montre/GPS) qui ne sont pas encore enregistrés comme équipement —
// pour proposer "Ajouter à mes équipements" sans jamais créer automatiquement (confirmation utilisateur
// obligatoire). Réutilise les `devices` déjà extraits par le parser, aucune nouvelle intégration.
function getDetectedDevices(n) {
  const known = new Set(getGear().filter(g => g.category === 'montre').map(g => (g.nom || '').toLowerCase()));
  const seen = new Set();
  const out = [];
  const sessions = loadAllSessions();
  for (let i = sessions.length - 1; i >= 0 && out.length < (n || 3); i--) {
    (sessions[i].devices || []).forEach(d => {
      if (!d.productName || seen.has(d.productName) || known.has(d.productName.toLowerCase())) return;
      seen.add(d.productName);
      out.push({ name: d.productName, date: sessions[i].date });
    });
  }
  return out;
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
// Normalise un intitulé de colonne de plan : minuscules, BOM et espaces retirés, accents
// supprimés. Permet d'écrire les tests de reconnaissance sans accent tout en acceptant les
// intitulés français réels.
function normalizePlanHeader(h) {
  return String(h).replace(/^﻿/, '').trim().toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '');
}

// Lit un nombre dans une cellule de plan écrite en langage humain. `parseFloat` exige que la
// chaîne COMMENCE par un chiffre : « ≈9 km » et « ≈250 m » donnaient donc NaN, ramené à 0 par le
// `|| 0` d'origine. Le plan s'importait alors en apparence correctement, avec toutes les
// distances et tous les dénivelés à zéro — une corruption silencieuse qui fausse ensuite chaque
// comparaison réalisé/planifié. On cherche donc le premier nombre où qu'il soit dans la cellule.
function parsePlanNumber(v) {
  if (v == null) return 0;
  // Espaces (normaux ou insécables) utilisés comme séparateurs de milliers : « 1 700 » -> « 1700 ».
  const cleaned = String(v).replace(/(\d)[\s ](?=\d)/g, '$1');
  const m = cleaned.match(/-?\d+(?:[.,]\d+)?/);
  return m ? (parseFloat(m[0].replace(',', '.')) || 0) : 0;
}

function parsePlanCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const delimiter = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
  // En-têtes normalisés : BOM retiré et ACCENTS supprimés avant comparaison. Les tests ci-dessous
  // sont écrits sans accent ('duree', 'echauffement') alors que les intitulés français en portent
  // naturellement ('Durée totale', 'FC échauffement') : ces deux colonnes n'étaient donc jamais
  // trouvées, et leur contenu était perdu en silence à chaque import.
  const header = parseCsvLine(lines[0], delimiter).map(h => normalizePlanHeader(h));
  const idx = {
    semaine: header.findIndex(h => h.includes('semaine')),
    bloc: header.findIndex(h => h.includes('bloc')),
    // La comparaison était STRICTEMENT égale à 'date' : un intitulé aussi courant que
    // « Date (JJ/MM/AAAA) » n'était pas reconnu, aucune ligne n'obtenait de date, et le fichier
    // entier était rejeté — 58 lignes pour 0 séance importée (mesuré).
    date: header.findIndex(h => h.startsWith('date')),
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
      distanceKm: parsePlanNumber(cols[idx.distance]),
      deniveleM: parsePlanNumber(cols[idx.denivele]),
      descenteM: idx.descente >= 0 ? parsePlanNumber(cols[idx.descente]) : null,
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
// Décale une date ISO (YYYY-MM-DD) de n jours — utilitaire partagé (Plan, Objectifs).
function addDaysIso(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
// Parseur tolérant d'une durée texte libre du plan CSV ("1h15", "1h", "45min", "45 min", "1:30"...).
// Retourne des minutes, ou null si le format n'est pas reconnu — jamais une estimation approximative.
function parseDureeToMin(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  let m = s.match(/^(\d+)\s*h\s*(\d{1,2})?$/);
  if (m) return parseInt(m[1],10)*60 + (m[2]?parseInt(m[2],10):0);
  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1],10)*60 + parseInt(m[2],10);
  m = s.match(/^(\d+)\s*min$/);
  if (m) return parseInt(m[1],10);
  return null;
}
/* Formateur de durée UNIQUE de l'application (36 appels sur 7 pages) — corrigé lors de la passe
   "narration objectif" : l'ancienne version produisait "1h00" et "0min00", des formats collés que
   la typographie du site rend difficiles à lire (le 0 se confond avec un o : "1hoo"). Format
   retenu : "0 min", "15 min", "1 h 00", "1 h 42", "12 h 08". Les espaces sont insécables pour
   qu'une valeur ne se coupe jamais en fin de ligne ("1 h" d'un côté, "42" de l'autre).
   Les secondes ne sont plus affichées : aucune lecture du site ne se joue à la seconde près
   (volumes hebdomadaires, durées de séance, durées planifiées). */
const NBSP = ' ';
function fmtDuration(s) {
  if (s == null || isNaN(s)) return 'Non disponible';
  const total = Math.max(0, Math.round(s));
  const h = Math.floor(total / 3600);
  let m = Math.round((total % 3600) / 60);
  // 59 min 40 s arrondit à 60 min : on reporte sur l'heure plutôt que d'afficher "0 h 60".
  if (m === 60) return (h + 1) + NBSP + 'h' + NBSP + '00';
  return h > 0 ? (h + NBSP + 'h' + NBSP + String(m).padStart(2, '0')) : (m + NBSP + 'min');
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
  // `planYear` était sauvegardé par savePlanYear() AVEC un scheduleSync(), mais n'a jamais figuré
  // dans ce payload : le réglage déclenchait donc une synchronisation complète sans jamais être
  // lui-même synchronisé. C'est une vraie donnée de configuration (elle sert à dater les séances
  // d'un CSV de plan qui ne porte que jour/mois, voir parsePlanCsv).
  return { sessions: loadAllSessions(), plan: getPlan(), races: getRaces(), profile: getProfile(), gear: getGear(), planNotes: getPlanNotes(), planYear: getPlanYear() };
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
    // Règle appliquée ci-dessous : on distingue « la clé est absente du payload » (payload ancien
    // ou partiel — on ne touche à rien en local) de « la clé est présente et vide » (l'utilisateur
    // a réellement tout supprimé sur l'autre appareil — la suppression doit se propager).
    // Auparavant `if (payload.plan)` et `if (... && payload.races.length)` traitaient les deux cas
    // de la même façon : supprimer toutes ses courses sur un appareil ne se propageait jamais, et
    // l'appareil resté en arrière renvoyait ensuite sa liste périmée, ressuscitant les courses
    // supprimées. Le même raisonnement vaut pour un plan effacé via clearPlan().
    if ('plan' in payload) { if (payload.plan) savePlan(payload.plan); else clearPlan(); }
    if (Array.isArray(payload.races)) saveRaces(payload.races);
    if (payload.profile) saveProfile(payload.profile);
    if (Array.isArray(payload.gear)) saveGear(payload.gear);
    if (typeof payload.planNotes === 'string') savePlanNotes(payload.planNotes);
    if (Number.isFinite(payload.planYear)) savePlanYear(payload.planYear);
  } finally { _applyingRemote = false; }
}

let _syncTimer = null;
// Appelé automatiquement par les fonctions de sauvegarde locales — programme un envoi vers
// Supabase avec un léger délai (pour regrouper plusieurs modifications rapprochées).
function scheduleSync() {
  if (_applyingRemote) return;
  if (!getSupabaseClient()) return;
  clearTimeout(_syncTimer);
  // Le résultat de syncPush() était jeté : un envoi refusé (session expirée, RLS, réseau coupé,
  // table absente) ne laissait AUCUNE trace, ni console, ni interface. L'utilisateur croyait ses
  // données synchronisées alors qu'elles ne quittaient pas l'appareil. On consigne désormais
  // l'issue du dernier envoi, que la page Paramètres affiche.
  _syncTimer = setTimeout(() => {
    syncPush().then(res => {
      if (!res.ok && res.reason !== 'not-configured' && res.reason !== 'not-logged-in') {
        console.error('Synchronisation ELEV : envoi refusé —', res.reason);
      }
    });
  }, 1500);
}
// Annule un envoi programmé mais pas encore parti. Indispensable avant une réinitialisation
// locale : les suppressions appellent scheduleSync(), et cet envoi différé pouvait partir APRÈS
// le vidage du stockage local, donc écraser les données du cloud par un état vide — exactement
// l'inverse de ce que promet le message « tes données synchronisées resteront disponibles ».
function cancelPendingSync() { clearTimeout(_syncTimer); _syncTimer = null; }
function getSyncMeta() {
  try { return JSON.parse(localStorage.getItem(SUPA_META_KEY) || '{}'); } catch (e) { return {}; }
}
function setSyncMeta(patch) {
  try { localStorage.setItem(SUPA_META_KEY, JSON.stringify(Object.assign(getSyncMeta(), patch))); } catch (e) {}
}
async function syncPush() {
  const client = getSupabaseClient();
  if (!client) return { ok:false, reason:'not-configured' };
  const user = await supaGetUser();
  if (!user) return { ok:false, reason:'not-logged-in' };
  const nowIso = new Date().toISOString();
  const { error } = await client.from('trail_data').upsert({ user_id: user.id, payload: buildSyncPayload(), updated_at: nowIso });
  if (error) {
    setSyncMeta({ lastPushAt: nowIso, lastPushOk: false, lastPushError: error.message });
    return { ok:false, reason: error.message };
  }
  setSyncMeta({ lastRemoteUpdatedAt: nowIso, lastPushAt: nowIso, lastPushOk: true, lastPushError: null });
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
  // setSyncMeta (fusion) et non un remplacement complet : ecraser l'objet effacerait l'issue du
  // dernier envoi que la page Parametres affiche.
  setSyncMeta({ lastRemoteUpdatedAt: data.updated_at });
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
  const meta = getSyncMeta();
  if (meta.lastRemoteUpdatedAt && new Date(data.updated_at) <= new Date(meta.lastRemoteUpdatedAt)) return;
  const guardKey = 'trail:autoPullGuard';
  if (sessionStorage.getItem(guardKey) === data.updated_at) return; // évite une boucle de rechargement
  const res = await syncPull();
  if (res.ok) { sessionStorage.setItem(guardKey, data.updated_at); location.reload(); }
}

/* --------------------------- SYNCHRO PAR SÉANCE (table `activities` + fichiers .fit) ---------------------------
   S'ajoute à la synchro globale ci-dessus (`trail_data`, qui reste le mécanisme principal de secours
   entre appareils). Ici : une ligne par séance dans Supabase + le fichier .fit original conservé en
   Storage, pour ne plus jamais avoir à redemander une réimportation si l'analyse s'améliore plus tard.
   Entièrement silencieux si la synchro n'est pas configurée ou l'utilisateur non connecté — l'import
   local (localStorage) fonctionne toujours, avec ou sans ceci. */
// Supabase Storage n'accepte que des clés "sûres" pour une URL (pas d'accents ni de caractères
// spéciaux) — l'identifiant de séance (client_id), lui, peut contenir des accents (ex. "Course à
// pied" issu du libellé de sport FIT), donc on le nettoie uniquement pour construire le chemin de
// stockage, sans toucher à l'identifiant utilisé partout ailleurs dans l'appli.
const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');
function sanitizeStorageKey(s) {
  return String(s).normalize('NFD').replace(DIACRITICS_RE, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}
async function uploadFitFile(client, userId, clientId, arrayBuffer) {
  const path = userId + '/' + sanitizeStorageKey(clientId) + '.fit';
  const { error } = await client.storage.from('fit-files').upload(path, arrayBuffer, {
    contentType: 'application/octet-stream', upsert: true,
  });
  if (error) { console.error('Upload du fichier .fit échoué :', error.message); return null; }
  return path;
}
// Construction de la ligne `activities` à partir d'une séance. Extraite de pushActivityRow pour
// être vérifiable seule et confrontable à activityRowToSession : c'est l'aller d'un aller-retour,
// et tout champ absent ici est un champ DÉTRUIT au retour (voir syncActivitiesWithSupabase, qui
// réécrit le cache local à partir des lignes Supabase).
function sessionToActivityRow(session, userId, fitFilePath) {
  return {
    user_id: userId,
    client_id: session.id,
    date: session.date,
    sport: session.sport,
    distance_km: session.distanceKm,
    duration_s: session.durationS,
    ascent_m: session.ascent,
    descent_m: session.descent,
    avg_hr: session.avgHr,
    max_hr: session.maxHr,
    avg_pace_sec_km: session.avgPaceSecPerKm,
    avg_power: session.avgPower,
    max_power: session.maxPower,
    avg_temp: session.avgTemp,
    calories: session.calories,
    cadence_spm: session.cadenceSpm,
    gear_id: session.gearId || null,
    // La note de contexte saisie par l'utilisateur s'appelle `contexte` PARTOUT dans l'application
    // (activite.html l'écrit et la relit sous ce nom, et le prompt Coach ELEV la consomme). Cette
    // fonction lisait `session.context`, qui n'existe nulle part : la colonne recevait donc
    // toujours null, et activityRowToSession réécrivait ensuite la séance locale SANS la note.
    // La note de l'utilisateur était donc détruite au premier rechargement d'une page synchronisée.
    // `session.context` reste accepté en second choix au cas où une ligne l'aurait déjà porté.
    context: session.contexte ?? session.context ?? null,
    ai_feedback: session.aiFeedback || null,
    series: session.series || null,
    laps: session.laps || null,
    // `clientMeta` : champs propres au client qui n'ont pas de colonne dédiée. Sans cela ils étaient
    // perdus à l'aller-retour — `fileName` alimente pourtant la RECHERCHE de la page Activités
    // (historique.html), et `dateApprox` l'astérisque affiché sur 4 pages. Les loger dans `raw`,
    // déjà en jsonb et déjà prévu pour « ce qui n'entre pas dans les colonnes ci-dessus », évite
    // d'exiger une migration : la correction est effective sans aucune action dans Supabase.
    raw: Object.assign(
      {
        events: session.events || [],
        devices: session.devices || [],
        clientMeta: {
          fileName: session.fileName ?? null,
          importedAt: session.importedAt ?? null,
          dateApprox: session.dateApprox ?? null,
        },
      },
      session.raw || {}
    ),
    fit_file_path: fitFilePath,
    updated_at: new Date().toISOString(),
  };
}

async function pushActivityRow(session, fitArrayBuffer) {
  const client = getSupabaseClient();
  if (!client) return { ok:false, reason:'not-configured' };
  const user = await supaGetUser();
  if (!user) return { ok:false, reason:'not-logged-in' };
  let fitFilePath = null;
  if (fitArrayBuffer) fitFilePath = await uploadFitFile(client, user.id, session.id, fitArrayBuffer);
  const row = sessionToActivityRow(session, user.id, fitFilePath);
  // Ne jamais écraser par null un chemin de fichier déjà enregistré : cette fonction est aussi
  // appelée SANS fichier (resynchronisation d'une séance importée avant la mise en place du
  // Storage). `upsert` remplace la ligne entière, un null effacerait donc le lien vers le .fit.
  if (fitFilePath == null) delete row.fit_file_path;
  const { error } = await client.from('activities').upsert(row, { onConflict: 'user_id,client_id' });
  if (error) return { ok:false, reason: error.message };
  return { ok:true };
}

// Reconstruit un objet "séance" (même forme que summarizeFit()) à partir d'une ligne Supabase —
// l'inverse de la construction faite dans pushActivityRow.
function activityRowToSession(row) {
  return {
    id: row.client_id,
    date: row.date,
    sport: row.sport,
    distanceKm: row.distance_km,
    durationS: row.duration_s,
    ascent: row.ascent_m,
    descent: row.descent_m,
    avgHr: row.avg_hr,
    maxHr: row.max_hr,
    avgPaceSecPerKm: row.avg_pace_sec_km,
    avgPower: row.avg_power,
    maxPower: row.max_power,
    avgTemp: row.avg_temp,
    calories: row.calories,
    cadenceSpm: row.cadence_spm,
    gearId: row.gear_id || undefined,
    // Relu sous le nom utilisé par l'application (`contexte`), pas sous le nom de la colonne :
    // c'est ce décalage qui faisait disparaître la note de l'utilisateur à chaque resynchro.
    contexte: row.context || undefined,
    aiFeedback: row.ai_feedback || undefined,
    series: row.series || [],
    laps: row.laps || [],
    events: (row.raw && row.raw.events) || [],
    devices: (row.raw && row.raw.devices) || [],
    // Champs client sans colonne dédiée (voir sessionToActivityRow). Restitués s'ils sont
    // présents ; absents pour les lignes écrites avant cette correction, auquel cas la séance
    // locale garde simplement la valeur qu'elle avait déjà (voir mergeSessionFromRemote).
    fileName: (row.raw && row.raw.clientMeta && row.raw.clientMeta.fileName) || undefined,
    importedAt: (row.raw && row.raw.clientMeta && row.raw.clientMeta.importedAt) || undefined,
    dateApprox: (row.raw && row.raw.clientMeta && row.raw.clientMeta.dateApprox) || undefined,
    // Conservé pour que l'application sache qu'un fichier .fit original existe côté Storage.
    fitFilePath: row.fit_file_path || undefined,
    raw: row.raw || {},
  };
}

// Fusion d'une séance venue de Supabase avec celle déjà présente en cache local.
// syncActivitiesWithSupabase écrasait la séance locale par la version reconstruite : tout champ
// que la ligne Supabase ne portait pas (parce qu'écrite avant une correction, ou parce qu'aucune
// colonne ne l'accueille) était donc SUPPRIMÉ du cache local. On ne remplace désormais une valeur
// locale que par une valeur distante réellement renseignée.
function mergeSessionFromRemote(local, remote) {
  if (!local) return remote;
  const merged = Object.assign({}, local);
  Object.keys(remote).forEach(k => {
    const v = remote[k];
    if (v === undefined || v === null) return;
    if (Array.isArray(v) && v.length === 0 && Array.isArray(merged[k]) && merged[k].length) return;
    merged[k] = v;
  });
  return merged;
}
// Supabase = source de vérité pour les séances (table `activities`), localStorage = cache local.
// 1) pousse les séances locales pas encore connues côté Supabase (cas des séances importées avant
//    la mise en place de cette synchro, ou importées hors-ligne) ; 2) recharge la liste complète
//    depuis Supabase pour reconstruire le cache local — garantit la cohérence entre appareils.
// Silencieux si Supabase n'est pas configuré / pas connecté (ne devrait pas arriver sur les pages
// protégées par la garde d'accès, mais reste sûr si appelé ailleurs).
async function syncActivitiesWithSupabase() {
  const client = getSupabaseClient();
  if (!client) return { ok:false, reason:'not-configured' };
  const user = await supaGetUser();
  if (!user) return { ok:false, reason:'not-logged-in' };

  const localSessions = loadAllSessions();
  const { data: existing, error: existingErr } = await client.from('activities').select('client_id').eq('user_id', user.id);
  if (!existingErr) {
    const existingIds = new Set((existing || []).map(r => r.client_id));
    for (const s of localSessions) {
      if (!existingIds.has(s.id)) await pushActivityRow(s, null);
    }
  }

  const { data: rows, error } = await client.from('activities').select('*').eq('user_id', user.id).order('date', { ascending: true });
  if (error || !rows) return { ok:false, reason: error ? error.message : 'empty' };
  const ids = [];
  rows.forEach(row => {
    const remote = activityRowToSession(row);
    // Fusion plutôt que remplacement : une ligne écrite avant les corrections de mapping ne porte
    // ni la note de contexte, ni le nom de fichier, ni l'indicateur de date approximative. Les
    // écraser reviendrait à détruire en local des données que Supabase n'a jamais reçues.
    saveSession(remote.id, mergeSessionFromRemote(loadSession(remote.id), remote));
    ids.push(remote.id);
  });
  saveIndex(ids);
  return { ok:true, count: rows.length };
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

// Répartition course / marche / arrêt sur une séance (ELEV, déterministe, source = elev — distincte
// d'une éventuelle classification Garmin, non décodée pour l'instant : les messages "split" bruts du
// fichier .fit existent mais leur mise en correspondance exacte des champs n'est pas encore fiable,
// voir FIT Import Inspector). Basée sur la cadence plutôt que sur l'allure seule : en trail, une
// montée raide se court souvent à une allure aussi lente qu'une marche, la cadence reste le signal
// le plus fiable pour distinguer les deux. Seuils simples et documentés :
const RUNWALK_CADENCE_THRESHOLD = 140; // pas/min — en dessous : marche
const RUNWALK_STOP_SPEED_KMH = 1.5;    // en dessous : arrêt (quelle que soit la cadence)
const RUNWALK_FALLBACK_PACE_S_KM = 510; // repli si cadence absente sur ce point (8:30/km)
// N'est retournée que si la cadence est disponible sur au moins 60 % de la séance : en dessous,
// la classification par l'allure seule est trop approximative en trail pour être présentée comme fiable.
const RUNWALK_MIN_CADENCE_COVERAGE = 0.6;
function computeRunWalkBreakdown(session) {
  const series = (session && session.series) || [];
  if (series.length < 2) return null;
  let secRun = 0, secWalk = 0, secStop = 0, distRun = 0, distWalk = 0, totalSec = 0;
  let withCadence = 0, totalIntervals = 0;
  for (let i = 1; i < series.length; i++) {
    const p0 = series[i - 1], p1 = series[i];
    const dt = p1.t - p0.t; if (!dt || dt <= 0 || dt > 120) continue;
    if (p0.distKm == null || p1.distKm == null) continue;
    const dDist = Math.max(0, p1.distKm - p0.distKm);
    totalIntervals++;
    const speedKmh = dDist / (dt / 3600);
    const cad = (p0.cadenceSpm != null && p1.cadenceSpm != null) ? (p0.cadenceSpm + p1.cadenceSpm) / 2 : null;
    if (cad != null) withCadence++;
    let state;
    if (speedKmh < RUNWALK_STOP_SPEED_KMH) state = 'stop';
    else if (cad != null) state = cad < RUNWALK_CADENCE_THRESHOLD ? 'walk' : 'run';
    else state = (speedKmh > 0 ? 3600 / speedKmh : Infinity) > RUNWALK_FALLBACK_PACE_S_KM ? 'walk' : 'run';
    totalSec += dt;
    if (state === 'run') { secRun += dt; distRun += dDist; }
    else if (state === 'walk') { secWalk += dt; distWalk += dDist; }
    else secStop += dt;
  }
  if (totalSec <= 0 || totalIntervals === 0 || withCadence / totalIntervals < RUNWALK_MIN_CADENCE_COVERAGE) return null;
  return {
    run: { sec: secRun, km: distRun, pct: Math.round(secRun / totalSec * 100) },
    walk: { sec: secWalk, km: distWalk, pct: Math.round(secWalk / totalSec * 100) },
    stop: { sec: secStop, pct: Math.round(secStop / totalSec * 100) },
    totalSec,
  };
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
// Retourne jusqu'à 3 observations {title, text} — mêmes règles/seuils déterministes qu'avant,
// juste enrichies d'un court titre pour l'affichage (voir renderInsight dans activite.html).
function generateSessionInsight(session, zoneDist, climbs) {
  const bullets = [];

  if (zoneDist) {
    const z1z2 = zoneDist.slice(0, 2).reduce((a, z) => a + z.pct, 0);
    const z3plus = zoneDist.slice(2).reduce((a, z) => a + z.pct, 0);
    if (z3plus >= 55) bullets.push({ title: 'Intensité soutenue', text: z3plus + '% du temps a été passé en zones Z3, Z4 et Z5.' });
    else if (z1z2 >= 65) bullets.push({ title: 'Sortie endurance', text: z1z2 + '% du temps a été passé en zones Z1 et Z2 : sortie principalement axée endurance.' });
  }

  if (climbs && climbs.length) {
    const withHr = climbs.filter(c => c.avgHr != null);
    if (withHr.length && session.avgHr != null) {
      const avgClimbHr = Math.round(withHr.reduce((a, c) => a + c.avgHr, 0) / withHr.length);
      if (avgClimbHr - session.avgHr >= 8) bullets.push({ title: 'FC en montée', text: 'Nettement plus élevée dans les montées (' + avgClimbHr + ' bpm en moyenne) que sur l\'ensemble de la séance (' + session.avgHr + ' bpm).' });
    }
    const withVam = climbs.filter(c => c.vamMh != null && c.gainM != null);
    if (withVam.length) {
      const totalGain = withVam.reduce((a, c) => a + c.gainM, 0);
      const avgVam = Math.round(withVam.reduce((a, c) => a + c.vamMh * c.gainM, 0) / totalGain);
      bullets.push({ title: 'Montées', text: 'VAM moyenne : ' + avgVam + ' m/h sur ' + withVam.length + ' montée' + (withVam.length > 1 ? 's' : '') + ' détectée' + (withVam.length > 1 ? 's' : '') + '.' });
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
    if (cv < 0.06) bullets.push({ title: 'Régularité', text: 'Ton allure est restée relativement stable sur les portions de terrain comparables.' });
  }

  return bullets.slice(0, 3);
}

/* --------------------------- ANALYSE GLOBALE (page Analyse, multi-séances) ---------------------------
   Distinct des fonctions ci-dessus (qui portent sur UNE séance) : ici on agrège plusieurs séances sur
   une période pour en tirer des tendances. Rien de fictif — voir CLAUDE.md : uniquement des métriques
   réellement calculables à partir de `activities`/localStorage, jamais de score de forme/récupération
   inventé. */

const ANALYSIS_PERIODS = {
  '4w': { label: '4 sem.', days: 28 },
  '12w': { label: '12 sem.', days: 84 },
  '6m': { label: '6 mois', days: 182 },
  '1y': { label: '1 an', days: 365 },
  'all': { label: 'Tout', days: null },
};
function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); }

// Résout une période "rapide" (ou personnalisée) en bornes ISO [from, to]. "Tout" s'appuie sur la
// première séance réellement connue, jamais une date arbitraire.
function resolveAnalysisRange(key, customFrom, customTo, sessions) {
  const today = new Date().toISOString().slice(0,10);
  if (key === 'custom' && customFrom && customTo) return { fromISO: customFrom, toISO: customTo };
  const def = ANALYSIS_PERIODS[key] || ANALYSIS_PERIODS['12w'];
  if (def.days == null) return { fromISO: sessions.length ? sessions[0].date : today, toISO: today };
  return { fromISO: isoDaysAgo(def.days), toISO: today };
}
// Période précédente de même durée, immédiatement avant fromISO — pour la comparaison automatique.
function previousAnalysisRange(fromISO, toISO) {
  const from = new Date(fromISO + 'T00:00:00Z'), to = new Date(toISO + 'T00:00:00Z');
  const spanDays = Math.max(1, Math.round((to - from) / 86400000));
  const prevTo = new Date(from); prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setUTCDate(prevFrom.getUTCDate() - spanDays);
  return { fromISO: prevFrom.toISOString().slice(0,10), toISO: prevTo.toISOString().slice(0,10) };
}
function filterSessionsByRange(sessions, fromISO, toISO) {
  return sessions.filter(s => s.date >= fromISO && s.date <= toISO);
}

// Regroupe des séances par semaine ISO (lundi-dimanche) : distance/D+/D-/durée/nb de séances, plus
// une VAM moyenne pondérée par le D+ des montées détectées (voir detectClimbs) — jamais calculée sur
// la sortie entière. `fromISO`/`toISO` (optionnels) étendent le résultat à TOUTES les semaines de cet
// intervalle, pas seulement celles où une séance existe : une semaine sans séance À L'INTÉRIEUR d'une
// période réellement suivie est une vraie donnée à 0 (voir CLAUDE.md — distinction donnée absente /
// donnée à zéro), affichée comme telle plutôt que silencieusement omise. Sans bornes, comportement
// inchangé (une semaine sans séance n'apparaît pas).
function groupByWeek(sessions, fromISO, toISO) {
  const map = new Map();
  sessions.forEach(s => {
    const ws = isoWeek(s.date);
    if (!map.has(ws)) map.set(ws, { startISO: ws, km: 0, durationS: 0, ascent: 0, descent: 0, count: 0, climbs: [] });
    const w = map.get(ws);
    w.km += s.distanceKm || 0;
    w.durationS += s.durationS || 0;
    w.ascent += s.ascent || 0;
    w.descent += s.descent || 0;
    w.count += 1;
    if (Array.isArray(s.series) && s.series.length > 2) w.climbs.push(...detectClimbs(s.series));
  });
  if (fromISO && toISO) {
    let cursor = new Date(isoWeek(fromISO) + 'T00:00:00Z');
    const last = new Date(isoWeek(toISO) + 'T00:00:00Z');
    while (cursor <= last) {
      const ws = cursor.toISOString().slice(0,10);
      if (!map.has(ws)) map.set(ws, { startISO: ws, km: 0, durationS: 0, ascent: 0, descent: 0, count: 0, climbs: [] });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }
  return [...map.values()].sort((a,b) => a.startISO.localeCompare(b.startISO)).map(w => {
    const withVam = w.climbs.filter(c => c.vamMh != null && c.gainM);
    const totalGain = withVam.reduce((a,c) => a + c.gainM, 0);
    const vamAvg = totalGain > 0 ? Math.round(withVam.reduce((a,c) => a + c.vamMh * c.gainM, 0) / totalGain) : null;
    return { startISO: w.startISO, shortLabel: w.startISO.slice(8,10)+'/'+w.startISO.slice(5,7), km: w.km, durationS: w.durationS, ascent: w.ascent, descent: w.descent, count: w.count, vamAvg };
  });
}

// Somme/moyennes d'une période (KPI + comparaison). null si aucune séance.
function aggregatePeriod(sessions) {
  if (!sessions.length) return null;
  const distanceKm = sessions.reduce((a,s) => a + (s.distanceKm||0), 0);
  const ascent = sessions.reduce((a,s) => a + (s.ascent||0), 0);
  const durationS = sessions.reduce((a,s) => a + (s.durationS||0), 0);
  const withHr = sessions.filter(s => s.avgHr != null && s.durationS);
  const totalHrDuration = withHr.reduce((a,s) => a + s.durationS, 0);
  const avgHr = withHr.length ? Math.round(withHr.reduce((a,s) => a + s.avgHr * s.durationS, 0) / totalHrDuration) : null;
  let totalGain = 0, gainVam = 0;
  sessions.forEach(s => {
    if (!Array.isArray(s.series) || s.series.length < 3) return;
    detectClimbs(s.series).forEach(c => { if (c.vamMh != null && c.gainM) { totalGain += c.gainM; gainVam += c.vamMh * c.gainM; } });
  });
  const vamAvg = totalGain > 0 ? Math.round(gainVam / totalGain) : null;
  return { distanceKm, ascent, durationS, avgHr, vamAvg, count: sessions.length };
}
function pctDelta(cur, prev) { if (cur == null || prev == null || prev === 0) return null; return Math.round((cur - prev) / prev * 100); }
// Compare deux agrégats de période (courante / précédente de même durée). Ne calcule un delta que
// pour les métriques où une hausse a un sens univoque à colorer (distance/D+/durée/VAM) — la FC et
// le nombre de séances restent gérés à l'affichage sans jugement automatique de couleur (voir CLAUDE.md).
function comparePeriods(current, previous) {
  if (!current) return null;
  return {
    current, previous,
    deltas: {
      distanceKm: previous ? pctDelta(current.distanceKm, previous.distanceKm) : null,
      ascent: previous ? pctDelta(current.ascent, previous.ascent) : null,
      durationS: previous ? pctDelta(current.durationS, previous.durationS) : null,
      vamAvg: previous ? pctDelta(current.vamAvg, previous.vamAvg) : null,
    },
  };
}

// Répartition du temps en zones FC (Karvonen) cumulée sur une période — somme de
// computeSessionZoneDistribution sur toutes les séances où elle est calculable.
function aggregateZones(sessions, zones) {
  if (!zones) return null;
  const secByZone = zones.map(() => 0);
  let total = 0;
  sessions.forEach(s => {
    const dist = computeSessionZoneDistribution(s, zones);
    if (!dist) return;
    dist.forEach((z,i) => { secByZone[i] += z.sec; total += z.sec; });
  });
  if (!total) return null;
  return zones.map((z,i) => ({ key: z.key, label: z.label, sec: secByZone[i], pct: Math.round(secByZone[i]/total*100) }));
}

// Répartition course/marche/arrêt cumulée sur une période (voir computeRunWalkBreakdown, par séance).
function aggregateLocomotion(sessions) {
  const sec = { run: 0, walk: 0, stop: 0 };
  let any = false;
  sessions.forEach(s => {
    const b = computeRunWalkBreakdown(s);
    if (!b) return;
    any = true;
    sec.run += b.run.sec; sec.walk += b.walk.sec; sec.stop += b.stop.sec;
  });
  if (!any) return null;
  const total = sec.run + sec.walk + sec.stop;
  if (!total) return null;
  return {
    run: { sec: sec.run, pct: Math.round(sec.run/total*100) },
    walk: { sec: sec.walk, pct: Math.round(sec.walk/total*100) },
    stop: { sec: sec.stop, pct: Math.round(sec.stop/total*100) },
    totalSec: total,
  };
}

// Tranches de pente utilisées pour la répartition par pente et le run/walk par pente. Pente en
// valeur absolue (montée et descente confondues) : convention documentée à l'affichage.
const GRADE_BUCKETS = [
  { key: 'g0', label: '0–5 %', min: 0, max: 5 },
  { key: 'g5', label: '5–10 %', min: 5, max: 10 },
  { key: 'g10', label: '10–15 %', min: 10, max: 15 },
  { key: 'g15', label: '15–20 %', min: 15, max: 20 },
  { key: 'g20', label: '> 20 %', min: 20, max: Infinity },
];
function gradeBucketIndex(pct) {
  const abs = Math.abs(pct);
  const i = GRADE_BUCKETS.findIndex(b => abs >= b.min && abs < b.max);
  return i < 0 ? GRADE_BUCKETS.length - 1 : i;
}

// Répartition du temps EN MOUVEMENT (arrêts exclus) par tranche de pente, cumulée sur une période.
// Convention : % du temps en mouvement, pas % de la distance.
function aggregateGradeBuckets(sessions) {
  const secByBucket = GRADE_BUCKETS.map(() => 0);
  let total = 0;
  sessions.forEach(s => {
    const series = (s.series || []).filter(p => p.alt != null && p.distKm != null && p.t != null);
    for (let i = 1; i < series.length; i++) {
      const p0 = series[i-1], p1 = series[i];
      const dt = p1.t - p0.t; if (!dt || dt <= 0 || dt > 120) continue;
      const dDistKm = p1.distKm - p0.distKm; if (dDistKm <= 0) continue;
      const speedKmh = dDistKm / (dt/3600);
      if (speedKmh < RUNWALK_STOP_SPEED_KMH) continue;
      const gradePct = ((p1.alt - p0.alt) / (dDistKm * 1000)) * 100;
      secByBucket[gradeBucketIndex(gradePct)] += dt; total += dt;
    }
  });
  if (!total) return null;
  return GRADE_BUCKETS.map((b,i) => ({ key: b.key, label: b.label, sec: secByBucket[i], pct: Math.round(secByBucket[i]/total*100) }));
}

// Course vs marche par tranche de pente — estimation ELEV basée cadence (mêmes seuils que
// computeRunWalkBreakdown). N'utilise que les intervalles où la cadence est réellement disponible
// (jamais de repli sur l'allure ici, pour ne pas empiler une estimation sur une estimation).
function aggregateRunWalkByGrade(sessions) {
  const runByBucket = GRADE_BUCKETS.map(() => 0), walkByBucket = GRADE_BUCKETS.map(() => 0);
  let anyCadence = false;
  sessions.forEach(s => {
    const series = (s.series || []).filter(p => p.alt != null && p.distKm != null && p.t != null);
    for (let i = 1; i < series.length; i++) {
      const p0 = series[i-1], p1 = series[i];
      const dt = p1.t - p0.t; if (!dt || dt <= 0 || dt > 120) continue;
      const dDistKm = p1.distKm - p0.distKm; if (dDistKm <= 0) continue;
      const speedKmh = dDistKm / (dt/3600);
      if (speedKmh < RUNWALK_STOP_SPEED_KMH) continue;
      const cad = (p0.cadenceSpm != null && p1.cadenceSpm != null) ? (p0.cadenceSpm + p1.cadenceSpm) / 2 : null;
      if (cad == null) continue;
      anyCadence = true;
      const gradePct = ((p1.alt - p0.alt) / (dDistKm * 1000)) * 100;
      const bi = gradeBucketIndex(gradePct);
      if (cad < RUNWALK_CADENCE_THRESHOLD) walkByBucket[bi] += dt; else runByBucket[bi] += dt;
    }
  });
  if (!anyCadence) return null;
  return GRADE_BUCKETS.map((b,i) => {
    const totalSec = runByBucket[i] + walkByBucket[i];
    return { key: b.key, label: b.label, totalSec, runPct: totalSec ? Math.round(runByBucket[i]/totalSec*100) : null, walkPct: totalSec ? Math.round(walkByBucket[i]/totalSec*100) : null };
  }).filter(b => b.totalSec > 0);
}

function bestByKey(sessions, key, better) {
  const withVal = sessions.filter(s => s[key] != null);
  if (!withVal.length) return null;
  return withVal.reduce((a,b) => better(a[key], b[key]) ? a : b);
}
// "Repères de la période" (jamais "records") : volontairement pas des performances comparables au
// sens absolu — l'allure et la FC dépendent trop du terrain d'une sortie à l'autre pour ça (voir
// CLAUDE.md). Chaque entrée garde l'id de la séance source pour pouvoir l'ouvrir.
function computePeriodBests(sessions) {
  if (!sessions.length) return [];
  const out = [];
  const longest = bestByKey(sessions, 'distanceKm', (a,b) => a > b);
  if (longest) out.push({ label: 'Plus longue sortie', value: fmtNum(longest.distanceKm, ' km', 1), date: fmtDate(longest.date), activityId: longest.id });
  const mostAscent = bestByKey(sessions, 'ascent', (a,b) => a > b);
  if (mostAscent) out.push({ label: 'Plus gros D+', value: fmtNum(mostAscent.ascent, ' m', 0), date: fmtDate(mostAscent.date), activityId: mostAscent.id });
  let bestVam = null;
  sessions.forEach(s => {
    if (!Array.isArray(s.series) || s.series.length < 3) return;
    detectClimbs(s.series).forEach(c => { if (c.vamMh != null && (!bestVam || c.vamMh > bestVam.vamMh)) bestVam = { vamMh: c.vamMh, session: s }; });
  });
  if (bestVam) out.push({ label: 'VAM la plus élevée', value: bestVam.vamMh + ' m/h', date: fmtDate(bestVam.session.date), activityId: bestVam.session.id });
  const fastestPace = bestByKey(sessions, 'avgPaceSecPerKm', (a,b) => a < b);
  if (fastestPace) out.push({ label: 'Allure moyenne la plus rapide', value: fmtPace(fastestPace.avgPaceSecPerKm), date: fmtDate(fastestPace.date), activityId: fastestPace.id });
  const lowestHr = bestByKey(sessions, 'avgHr', (a,b) => a < b);
  if (lowestHr) out.push({ label: 'FC moyenne la plus basse', value: lowestHr.avgHr + ' bpm', date: fmtDate(lowestHr.date), activityId: lowestHr.id });
  return out;
}

// Insight ELEV de la page Analyse (tendance multi-séances) — distinct de generateElevInsight()
// (Accueil, charge aiguë/chronique) et generateSessionInsight() (une séance). Déterministe, aucun
// appel réseau, ne conclut que ce que les données permettent réellement d'établir. Jusqu'à 5
// candidats possibles (volume, VAM/montées, locomotion, verticalité, intensité) sont évalués puis
// classés par un poids indicatif (grandeur de l'écart ou pertinence du signal) : les 3 plus forts
// sont retenus, jamais deux fois la même catégorie — pour éviter de toujours répéter les mêmes.
function generateGlobalAnalysisInsight(deltas, runWalkByGrade, gradeBuckets, zoneDist) {
  const candidates = [];
  if (deltas.distanceKm != null && Math.abs(deltas.distanceKm) >= 8) {
    candidates.push({ weight: Math.abs(deltas.distanceKm), title: deltas.distanceKm > 0 ? 'Volume en progression' : 'Volume en retrait',
      text: 'Ton volume total a ' + (deltas.distanceKm > 0 ? 'augmenté' : 'diminué') + ' de ' + Math.abs(deltas.distanceKm) + '% par rapport à la période précédente de même durée.' });
  }
  if (deltas.ascent != null && deltas.vamAvg != null && deltas.ascent >= 8 && Math.abs(deltas.vamAvg) <= 5) {
    candidates.push({ weight: 55, title: 'Montées', text: 'Ta VAM moyenne reste stable malgré une hausse du D+ de ' + deltas.ascent + '% sur la période.' });
  } else if (deltas.vamAvg != null && Math.abs(deltas.vamAvg) >= 8) {
    candidates.push({ weight: Math.abs(deltas.vamAvg), title: deltas.vamAvg > 0 ? 'VAM en progression' : 'VAM en retrait', text: 'Ta VAM moyenne a ' + (deltas.vamAvg > 0 ? 'augmenté' : 'diminué') + ' de ' + Math.abs(deltas.vamAvg) + '% par rapport à la période précédente.' });
  }
  if (runWalkByGrade && runWalkByGrade.length) {
    const tip = runWalkByGrade.find(b => b.walkPct != null && b.walkPct >= b.runPct);
    if (tip) candidates.push({ weight: 45, title: 'Locomotion', text: 'La marche devient majoritaire à partir de ' + tip.label + ' de pente (estimation ELEV, basée cadence).' });
  }
  if (gradeBuckets) {
    const steepPct = gradeBuckets.filter(b => b.key === 'g15' || b.key === 'g20').reduce((a,b) => a + b.pct, 0);
    if (steepPct >= 15) candidates.push({ weight: 40 + steepPct, title: 'Verticalité', text: steepPct + '% du temps en mouvement a été passé sur des pentes de plus de 15%.' });
  }
  if (zoneDist) {
    const z3plus = zoneDist.slice(2).reduce((a,z) => a + z.pct, 0);
    const z1z2 = zoneDist.slice(0,2).reduce((a,z) => a + z.pct, 0);
    if (z3plus >= 55) candidates.push({ weight: 35 + z3plus, title: 'Intensité', text: z3plus + '% du temps avec FC disponible a été passé en zones Z3 à Z5.' });
    else if (z1z2 >= 65) candidates.push({ weight: 35 + z1z2, title: 'Intensité', text: z1z2 + '% du temps avec FC disponible a été passé en zones Z1-Z2 : période orientée endurance fondamentale.' });
  }
  return candidates.sort((a,b) => b.weight - a.weight).slice(0, 3).map(({ title, text }) => ({ title, text }));
}

/* --------------------------- 6) UTILITAIRES DOM --------------------------- */

/* Navigation partagée (sidebar desktop + barre mobile à 5 destinations + panneau "Plus").
   Source unique de la liste des pages : avant, chacune des 9 pages HTML dupliquait sa propre
   copie figée du menu (libellés, icônes, classe "active"), ce qui les faisait dériver au fil
   des refontes successives. Desktop : liste complète, inchangée dans son contenu. Mobile :
   la barre ne peut raisonnablement afficher que ~5 entrées sur un écran de poche (au-delà, les
   libellés se tassent ou se tronquent) — Plan/Profil/Équipements/Paramètres rejoignent donc un
   panneau "Plus" accessible (focus renvoyé au bouton à la fermeture, Échap, clic extérieur). */
const NAV_ITEMS = [
  { href: 'index.html', icon: 'home', label: "Aujourd'hui", mobile: true },
  { href: 'historique.html', icon: 'route', label: 'Activités', mobile: true },
  { href: 'analyse.html', icon: 'trending-up', label: 'Progression', mobile: true },
  { href: 'objectifs.html', icon: 'target', label: 'Objectif', mobile: true },
  { href: 'plan.html', icon: 'calendar', label: 'Plan', mobile: false },
  { href: 'profil.html', icon: 'user', label: 'Profil', mobile: false, sep: true },
  { href: 'equipements.html', icon: 'footprints', label: 'Équipements', mobile: false },
  { href: 'parametres.html', icon: 'settings', label: 'Paramètres', mobile: false },
];
/* ============================================================================================
   ICÔNES — servies EN LOCAL (phase 17 du plan d'action).
   Elles étaient toutes chargées depuis un CDN tiers, une requête par icône : 15 allers-retours
   vers unpkg.com sur un chargement d'Accueil, mesurés — soit la majorité des requêtes de la page.
   Trois problèmes, dont deux qui dépassent la performance :
     1. ELEV est une PWA installable. Hors ligne, TOUTES les icônes disparaissaient — y compris
        celles de la barre de navigation, qui devenait une rangée de libellés sans repère.
     2. L'URL pointait sur `lucide-static@latest` : le contenu pouvait changer, ou disparaître,
        au gré d'un tiers et sans prévenir.
     3. 15 requêtes réseau, avec négociation DNS et TLS, avant le premier rendu complet.
   Les tracés ci-dessous sont les sources RÉELLES de Lucide (licence ISC), récupérées telles
   quelles, jamais redessinées de mémoire. Poids total ~4 ko, dans un fichier déjà chargé.
   `lucideIconUrl` retombe sur le CDN pour tout nom absent de cette table : ajouter une icône
   ailleurs dans l'application ne peut donc rien casser, elle sera simplement distante.
   ============================================================================================ */
const LUCIDE_PATHS = {
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'backpack': '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 10h8"/><path d="M8 18h8"/><path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  'calendar': '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  'flag': '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  'footprints': '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
  'gauge': '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  'heart-pulse': '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/><path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  'home': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'more-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'mountain-snow': '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/>',
  'package': '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'watch': '<path d="M12 10v2.2l1.6 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/><circle cx="12" cy="12" r="6"/>',
  'route': '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  'settings': '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'trending-up': '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'zap': '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
};
const _lucideCache = {};
function lucideIconUrl(name) {
  if (!LUCIDE_PATHS[name]) return 'https://unpkg.com/lucide-static@latest/icons/' + name + '.svg';
  if (!_lucideCache[name]) {
    // Attributs identiques a ceux des fichiers Lucide d'origine : le rendu ne change pas, et les
    // filtres CSS de colorisation deja en place continuent de s'appliquer (ce sont des <img>).
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"' +
      ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
      ' stroke-linejoin="round">' + LUCIDE_PATHS[name] + '</svg>';
    _lucideCache[name] = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  return _lucideCache[name];
}
function navIconUrl(name) { return lucideIconUrl(name); }

// Lien d'évitement + nommage des repères de page. Mesuré en phase 16 : il fallait 11 tabulations
// pour atteindre le contenu, sur CHAQUE page, sans aucun moyen de sauter la navigation
// (WCAG 2.4.1 Bypass Blocks, niveau A). Posé ici plutôt que dans les 9 fichiers HTML, pour la même
// raison que le menu lui-même : une source unique, sinon les copies divergent.
function installSkipLink() {
  const main = document.querySelector('main');
  if (!main) return;
  if (!main.id) main.id = 'contenu';
  // Sans `tabindex="-1"`, plusieurs navigateurs déplacent la vue sans déplacer le focus : la
  // tabulation suivante repartirait du début de la navigation, donc le lien ne servirait à rien.
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

  // Deux <nav> sans nom se lisent « navigation » deux fois dans la liste des repères.
  const sidebarNav = document.getElementById('sidebarNav');
  if (sidebarNav && !sidebarNav.getAttribute('aria-label')) sidebarNav.setAttribute('aria-label', 'Navigation principale');
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav && !mobileNav.getAttribute('aria-label')) mobileNav.setAttribute('aria-label', 'Navigation principale (mobile)');

  if (document.getElementById('skipToContent')) return;
  const link = document.createElement('a');
  link.id = 'skipToContent';
  link.className = 'skip-link';
  link.href = '#' + main.id;
  link.textContent = 'Aller au contenu principal';
  document.body.insertBefore(link, document.body.firstChild);
}

// activeHref : à passer explicitement par les pages qui ne correspondent à aucune entrée du menu
// telles quelles (ex. activite.html?id=... doit surligner "Activités", pas rester sans repère).
function renderAppNav(activeHref) {
  const current = activeHref || (location.pathname.split('/').pop() || 'index.html');
  installSkipLink();

  // Le sommet de la sidebar : son `src` n'est plus ecrit en dur dans les 9 pages, il vient de la
  // meme source locale que le reste des icones. `width`/`height` restent dans le HTML pour que la
  // place soit reservee avant meme l'execution du script.
  const brand = document.getElementById('brandMark');
  if (brand && !brand.getAttribute('src')) brand.src = lucideIconUrl('mountain-snow');

  const sidebarEl = document.getElementById('sidebarNav');
  if (sidebarEl) {
    sidebarEl.innerHTML = NAV_ITEMS.map(item => {
      const active = item.href === current;
      return (item.sep ? '<div class="sidebar-nav-sep"></div>' : '') +
        '<a href="' + item.href + '" class="sidebar-link' + (active ? ' active' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' +
        '<img src="' + navIconUrl(item.icon) + '" alt="">' + escapeHtml(item.label) + '</a>';
    }).join('');
  }

  const mobileEl = document.getElementById('mobileNav');
  if (!mobileEl) return;
  const mobileItems = NAV_ITEMS.filter(i => i.mobile);
  const moreItems = NAV_ITEMS.filter(i => !i.mobile);
  const moreActive = moreItems.some(i => i.href === current);
  mobileEl.innerHTML = mobileItems.map(item => {
    const active = item.href === current;
    return '<a href="' + item.href + '" class="' + (active ? 'active' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' +
      '<img src="' + navIconUrl(item.icon) + '" alt="">' + escapeHtml(item.label) + '</a>';
  }).join('') +
    '<button type="button" id="navMoreBtn" class="' + (moreActive ? 'active' : '') + '" aria-haspopup="true" aria-expanded="false" aria-controls="navMoreSheet">' +
    '<img src="' + navIconUrl('more-horizontal') + '" alt="">Plus</button>';

  // Panneau "Plus" : un seul construit par page (pas un par appel), attaché au body pour ne pas
  // hériter d'un empilement/overflow imprévu d'un conteneur parent.
  let backdrop = document.getElementById('navMoreBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'navMoreBackdrop';
    backdrop.className = 'nav-sheet-backdrop';
    document.body.appendChild(backdrop);
  }
  let sheet = document.getElementById('navMoreSheet');
  if (!sheet) {
    sheet = document.createElement('nav');
    sheet.id = 'navMoreSheet';
    sheet.className = 'nav-sheet';
    sheet.setAttribute('aria-label', 'Plus de pages');
    document.body.appendChild(sheet);
  }
  sheet.innerHTML = '<div class="nav-sheet-handle" aria-hidden="true"></div>' + moreItems.map(item => {
    const active = item.href === current;
    return '<a href="' + item.href + '" class="' + (active ? 'active' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' +
      '<img src="' + navIconUrl(item.icon) + '" alt="">' + escapeHtml(item.label) + '</a>';
  }).join('');

  const moreBtn = document.getElementById('navMoreBtn');
  function onSheetKeydown(e) { if (e.key === 'Escape') closeSheet(); }
  function openSheet() {
    backdrop.classList.add('open'); sheet.classList.add('open');
    moreBtn.setAttribute('aria-expanded', 'true');
    const firstLink = sheet.querySelector('a');
    if (firstLink) firstLink.focus();
    document.addEventListener('keydown', onSheetKeydown);
  }
  function closeSheet() {
    backdrop.classList.remove('open'); sheet.classList.remove('open');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.focus();
    document.removeEventListener('keydown', onSheetKeydown);
  }
  moreBtn.addEventListener('click', () => { sheet.classList.contains('open') ? closeSheet() : openSheet(); });
  backdrop.addEventListener('click', closeSheet);
}

// Bloc utilisateur de la sidebar (avatar initiale + prénom) — identique à celui de l'Accueil,
// réutilisé par les autres pages migrées vers la sidebar harmonisée (voir CLAUDE.md section 15).
function renderSidebarUser() {
  const el = document.getElementById('sidebarUser');
  if (!el) return;
  const profile = getProfile();
  const prenom = (profile.nom || '').trim().split(/\s+/)[0];
  const initial = prenom ? prenom[0].toUpperCase() : '?';
  el.innerHTML = '<div class="avatar">' + escapeHtml(initial) + '</div>' +
    '<div class="user-info"><strong>' + escapeHtml(prenom || 'Ton profil') + '</strong><a href="profil.html">Voir mon profil</a></div>';
}

/* --------------------------- ÉTATS APPLICATIFS PARTAGÉS (Sprint 1) ---------------------------
   Le produit ne savait exprimer que « vide » (.empty-state). Il lui manquait « en cours de
   chargement » et « en erreur » : une lecture Supabase qui échouait laissait la zone vide, donc
   indiscernable d'une absence réelle de données — l'utilisateur en concluait qu'il n'avait rien
   enregistré alors qu'il s'agissait d'une panne. Ces trois fabriques produisent le même langage
   partout, plutôt qu'un rendu réinventé page par page.
   Elles retournent du HTML (comme le reste du code de rendu de ce projet) ; renderErrorState()
   pose en plus le gestionnaire du bouton « Réessayer ». */

/* Alternative tabulaire d'un graphique (phase 11 du plan d'action : « fournir une alternative
   textuelle ou tabulaire pertinente »). Aucun de nos graphiques n'en proposait : les valeurs
   n'existaient que sous forme de pixels et de bulles au survol, donc inaccessibles au clavier,
   aux lecteurs d'écran, et impossibles à relever précisément à l'œil.
   Repliée par défaut : elle ne concurrence pas la lecture visuelle, mais reste dans le DOM et
   atteignable au clavier. `columns` = intitulés, `rows` = tableau de tableaux déjà formatés. */
function chartTableHtml(caption, columns, rows) {
  if (!rows || !rows.length) return '';
  return '<details class="chart-table">' +
    '<summary>Voir les données<span class="ct-count">' + rows.length + ' lignes</span></summary>' +
    '<div class="ct-scroll"><table>' +
      '<caption class="visually-hidden">' + escapeHtml(caption || 'Données du graphique') + '</caption>' +
      '<thead><tr>' + columns.map(c => '<th scope="col">' + escapeHtml(c) + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + rows.map(r =>
        '<tr>' + r.map((cell, i) =>
          i === 0 ? '<th scope="row">' + escapeHtml(String(cell)) + '</th>'
                  : '<td>' + escapeHtml(String(cell)) + '</td>').join('') + '</tr>').join('') +
      '</tbody>' +
    '</table></div>' +
  '</details>';
}

// Squelette de chargement. `kind` reprend la géométrie du contenu attendu pour réserver la place
// et éviter le saut de mise en page : 'chart', 'row', 'metric' ou 'text'.
function skeletonHtml(kind, count) {
  const n = Math.max(1, count || 1);
  const one = {
    chart:  '<div class="skeleton skeleton-chart"></div>',
    row:    '<div class="skeleton skeleton-row"></div>',
    metric: '<div class="skeleton skeleton-metric"></div>',
    text:   '<div class="skeleton skeleton-line w-80"></div><div class="skeleton skeleton-line w-60"></div><div class="skeleton skeleton-line w-40"></div>',
  }[kind || 'text'];
  let out = '';
  for (let i = 0; i < n; i++) out += one;
  // aria-busy + libellé masqué : le lecteur d'écran annonce un chargement, il ne rencontre pas
  // une zone silencieusement vide.
  return '<div class="skeleton-group" aria-busy="true" aria-live="polite">' +
         '<span class="visually-hidden">Chargement…</span>' + out + '</div>';
}

// État d'erreur. `detail` porte le message technique (jamais inventé : on affiche ce que
// l'appel a réellement renvoyé), `retryId` ajoute un bouton de reprise.
function errorStateHtml(title, message, detail, retryId) {
  return '<div class="error-state" role="alert">' +
    '<div class="error-title">' + escapeHtml(title || 'Chargement impossible') + '</div>' +
    (message ? '<p>' + escapeHtml(message) + '</p>' : '') +
    (detail ? '<div class="error-detail">' + escapeHtml(String(detail)) + '</div>' : '') +
    (retryId ? '<button class="btn small" type="button" id="' + retryId + '">Réessayer</button>' : '') +
  '</div>';
}

// Pose l'état d'erreur dans un conteneur et branche la reprise. Renvoie false pour pouvoir
// écrire `if (error) return renderErrorState(...)`.
function renderErrorState(elId, title, message, detail, onRetry) {
  const el = document.getElementById(elId);
  if (!el) return false;
  const retryId = onRetry ? (elId + '__retry') : null;
  el.innerHTML = errorStateHtml(title, message, detail, retryId);
  if (retryId) {
    const btn = document.getElementById(retryId);
    if (btn) btn.addEventListener('click', onRetry);
  }
  return false;
}

// Mention de données partielles : NOMME ce qui manque au lieu de combler par une valeur par
// défaut, qui masquerait le trou derrière un chiffre d'apparence normale.
function partialNoteHtml(text) {
  return '<p class="partial-note">' + escapeHtml(text) + '</p>';
}

/* Résultat de la resynchronisation Supabase, affiché de la même façon sur les quatre pages qui la
   déclenchent (Accueil, Activités, Analyse, Détail). Son issue était ignorée partout : un refus
   (RLS, session expirée, réseau) laissait la page afficher son cache local sans rien signaler —
   l'utilisateur croyait consulter des données à jour.
   Silence volontaire quand il n'y a simplement rien à synchroniser (mode local, non connecté) :
   ce n'est pas une erreur, et un bandeau permanent y serait du bruit.
   `onRetry` doit relancer la synchro ; le squelette est posé pendant la nouvelle tentative pour
   que l'action ait un retour visible immédiat. */
function renderSyncState(elId, res, onRetry) {
  const el = document.getElementById(elId);
  if (!el) return;
  const silencieux = !res || res.ok || res.reason === 'not-configured' || res.reason === 'not-logged-in';
  if (silencieux) { el.innerHTML = ''; return; }
  renderErrorState(elId, 'Synchronisation impossible',
    'Les données affichées proviennent de ce navigateur et peuvent ne pas être à jour.',
    res.reason,
    onRetry ? () => { el.innerHTML = skeletonHtml('text', 1); onRetry(); } : null);
}

/* Ligne d'activité — constructeur PARTAGÉ (Sprint 2). Les pages Activités et Analyse en avaient
   chacune leur copie, et elles avaient déjà divergé : celle d'Analyse ne posait pas les attributs
   `data-l`, donc les cinq mesures s'y affichaient sans libellé dès que la disposition passait en
   cartes — cinq nombres nus dont on ne savait plus lequel était le D+ et lequel l'allure.
   `opts.arrowLabel` et `opts.showSub` couvrent les seules différences réelles entre les deux
   usages ; tout le reste est commun. */
function activityRowHtml(s, opts) {
  opts = opts || {};
  const visual = sessionPreviewSvg(s);
  const [, mo, da] = s.date.split('-');
  const dateStack = '<span class="cell-day">' + parseInt(da, 10) + '</span>' +
    '<span class="cell-month">' + FR_MONTHS_SHORT[parseInt(mo, 10) - 1].replace('.', '').toUpperCase() + '</span>' +
    '<span class="cell-year">' + s.date.slice(0, 4) + '</span>';
  const stat = (label, value) => '<span class="cell cell-stat" data-l="' + label + '">' + value + '</span>';
  return '<a class="activity-row" href="activite.html?id=' + encodeURIComponent(s.id) + '">' +
    '<span class="cell cell-date">' + dateStack + (s.dateApprox ? ' *' : '') + '</span>' +
    '<span class="cell cell-activity"><span class="row-title">' + escapeHtml(s.sport || 'Séance') + '</span>' +
      (opts.showSub && s.fileName ? '<span class="row-sub">' + escapeHtml(fmtDayMonth(s.date)) + '</span>' : '') +
    '</span>' +
    stat('Distance', fmtNum(s.distanceKm, ' km', 1)) +
    stat('D+', fmtNum(s.ascent, ' m', 0)) +
    stat('Durée', fmtDuration(s.durationS)) +
    stat('Allure', s.avgPaceSecPerKm != null ? fmtPace(s.avgPaceSecPerKm) : '—') +
    stat('FC moy.', s.avgHr != null ? s.avgHr + ' bpm' : '—') +
    '<span class="cell cell-visual">' + (visual || '') + '</span>' +
    '<span class="cell cell-arrow link-arrow">' + escapeHtml(opts.arrowLabel || 'Voir l\'analyse') + ' →</span>' +
  '</a>';
}

function showMsg(elId, text, kind) {
  const el = document.getElementById(elId);
  if (!el) return;
  // aria-live="polite" : ces messages (résultat d'import, sauvegarde, erreur...) doivent être
  // annoncés par un lecteur d'écran même si le focus reste ailleurs sur la page.
  el.innerHTML = '<div class="msg ' + kind + '" role="status" aria-live="polite">' + text + '</div>';
  if (kind === 'ok') setTimeout(() => { if (el.firstChild) el.innerHTML=''; }, 5000);
}

// Fermeture au clavier (Échap) de toute modale ouverte (.modal-backdrop.open) — geste attendu
// partout où des modales existent (Objectifs, Équipements...), auparavant seul le clic sur le
// fond ou un bouton dédié fermait. Un seul gestionnaire partagé plutôt qu'un par page/modale.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.modal-backdrop.open');
  if (open) open.classList.remove('open');
});

// Gestion du focus clavier des modales (P1 de l'audit accessibilité, voir CLAUDE.md — jusqu'ici
// seule la fermeture au clavier était gérée). Chaque page ouvre ses modales en ajoutant/retirant
// la classe 'open' sur .modal-backdrop, souvent via innerHTML dynamique : un MutationObserver
// unique détecte ces changements plutôt que d'exiger que chaque page appelle une fonction dédiée.
(function initModalFocusManagement() {
  let lastFocused = null;
  const focusableSel = 'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

  function onOpen(backdrop) {
    lastFocused = document.activeElement;
    const first = backdrop.querySelector(focusableSel);
    if (first) first.focus();
  }
  function onClose() {
    if (lastFocused && document.body.contains(lastFocused) && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }
  function watch(el) {
    if (el.dataset.elevFocusWatched) return;
    el.dataset.elevFocusWatched = '1';
    new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.attributeName !== 'class') return;
        el.classList.contains('open') ? onOpen(el) : onClose();
      });
    }).observe(el, { attributes: true });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const backdrop = document.querySelector('.modal-backdrop.open');
    if (!backdrop) return;
    const focusables = Array.from(backdrop.querySelectorAll(focusableSel)).filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // app.js est chargé dans <head> (avant que <body> n'existe) sur toutes les pages : l'observation
  // du body doit donc attendre DOMContentLoaded, contrairement au keydown ci-dessus qui peut
  // s'enregistrer immédiatement.
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList && n.classList.contains('modal-backdrop')) watch(n);
        n.querySelectorAll && n.querySelectorAll('.modal-backdrop').forEach(watch);
      }));
    }).observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('.modal-backdrop').forEach(watch);
  });
})();
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

// Borne basse d'une fenêtre d'analyse ramenée à l'historique réellement connu : une période avant la
// toute première séance importée n'est jamais traitée comme une succession de semaines à zéro (voir
// CLAUDE.md — distinction "historique indisponible" / "vraie semaine à zéro"). `sessions` doit être
// trié par date croissante (comme le retour de loadAllSessions()). Réutilisée par Analyse et
// Objectifs pour ne jamais diverger sur cette définition.
function floorToKnownHistory(fromISO, sessions) {
  if (!sessions.length) return fromISO;
  return fromISO < sessions[0].date ? sessions[0].date : fromISO;
}
// Nombre de semaines ISO (lundi-dimanche) entre deux dates, bornes incluses — dénominateur honnête
// d'une moyenne hebdomadaire "sur historique disponible" plutôt qu'un nombre de semaines fixe.
function countIsoWeeksBetween(fromISO, toISO) {
  const a = new Date(isoWeek(fromISO) + 'T00:00:00Z');
  const b = new Date(isoWeek(toISO) + 'T00:00:00Z');
  return Math.max(1, Math.round((b - a) / (7 * 86400000)) + 1);
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
  const zones = getActiveHrZones(profile);
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
  // Ce sous-score était le SEUL à produire une valeur quand aucune donnée n'existe : tous les
  // autres retournent null, lui retournait 0. Sur un compte sans aucune activité importée, il
  // devenait donc l'unique sous-score « valide », et l'indice de préparation entier tombait à
  // 0 % avec la mention « À renforcer » — une absence de données présentée comme un échec mesuré,
  // ce que le produit s'interdit partout ailleurs.
  // La distinction qui compte : « aucune séance n'a jamais été importée » (rien à dire) n'est pas
  // « des séances existent mais aucune sur la fenêtre » (0 % est alors une vraie information).
  const weeksWithSession = new Set(recent.map(s => isoWeek(s.date))).size;
  subs.push({
    key: 'regularite', label: 'Régularité',
    score: sessions.length ? clampScore(weeksWithSession / READINESS_WEEKS * 100) : null,
    detail: sessions.length
      ? (weeksWithSession + '/' + READINESS_WEEKS + ' semaines avec au moins une séance')
      : 'Aucune séance importée',
  });

  const valid = subs.filter(s => s.score != null);
  const overall = valid.length ? Math.round(valid.reduce((a,s) => a+s.score, 0) / valid.length) : null;
  const weakest = valid.length ? valid.reduce((min,s) => s.score < min.score ? s : min, valid[0]) : null;
  return { overall, subs, weakest };
}

// Libellé qualitatif de l'indice de préparation — seuils documentés (mêmes que le badge déjà utilisé
// sur la page Objectifs avant cette refonte, complétés d'un 3e palier) : jamais un mot choisi à
// l'œil, toujours dérivé du même pourcentage affiché à côté (voir CLAUDE.md — pas de score inventé).
function readinessLevelLabel(overall) {
  if (overall == null) return null;
  if (overall >= 85) return 'Excellente préparation';
  if (overall >= 60) return 'Sur la bonne voie';
  return 'À renforcer';
}

/* --------------------------- PAGE OBJECTIFS — cockpit de préparation par course --------------------------- */
// Regroupe les entrées du plan (une ligne par séance planifiée) par semaine ISO, dans le même format
// que groupByWeek() côté séances réalisées — permet de superposer "réalisé vs planifié" sur le même
// axe de semaines. Retourne null si aucun plan n'est importé (jamais une cible dessinée sans donnée
// réelle, voir CLAUDE.md).
function groupPlanByWeek(plan, fromISO, toISO) {
  if (!plan || !plan.length) return null;
  const map = new Map();
  plan.forEach(p => {
    if (p.date < fromISO || p.date > toISO) return;
    const ws = isoWeek(p.date);
    if (!map.has(ws)) map.set(ws, { km: 0, ascent: 0 });
    const w = map.get(ws);
    w.km += p.distanceKm || 0;
    w.ascent += p.deniveleM || 0;
  });
  return map;
}

// Les N sorties les plus longues d'une fenêtre de séances (page Objectifs, onglet "Sorties longues").
function getLongestRuns(sessions, n) {
  return sessions.filter(s => s.distanceKm != null).slice().sort((a,b) => b.distanceKm - a.distanceKm).slice(0, n || 6);
}

// Libellé + texte court par dimension de préparation, réutilisés pour construire les recommandations
// déterministes (voir getGoalRecommendations) — le texte reste générique, le repère chiffré vient
// toujours du sous-score réel (sub.detail), jamais fabriqué ici.
const GOAL_REC_TEXT = {
  volume: { title: 'Construire l’endurance', text: 'Maintiens une hausse progressive du volume hebdomadaire pour consolider ta base.' },
  dplus: { title: 'Développer le dénivelé', text: 'Continue d’augmenter le D+ hebdomadaire pour te rapprocher du terrain de la course.' },
  longues: { title: 'Allonger les sorties', text: 'Les sorties longues restent en retrait par rapport à la distance de l’objectif.' },
  intensite: { title: 'Optimiser l’intensité', text: 'Le temps passé en intensité (zones 3 et plus) peut encore progresser.' },
  regularite: { title: 'Renforcer la régularité', text: 'La régularité des sorties sur les dernières semaines peut encore progresser.' },
};
// Recommandations déterministes : reprend les sous-scores réels de computeRaceReadiness(), classés
// du plus faible au plus fort, sans inventer de nouvelle métrique — le repère affiché est toujours
// `sub.detail`, déjà calculé par computeRaceReadiness (comparaison au plan si disponible, sinon repère
// générique documenté). Les dimensions déjà quasi complètes (score ≥ 95) ne sont pas mises en avant.
function getGoalRecommendations(readiness) {
  if (!readiness || !readiness.subs) return [];
  const withScore = readiness.subs.filter(s => s.score != null && s.score < 95);
  return withScore.sort((a,b) => a.score - b.score).slice(0, 4).map(s => {
    const meta = GOAL_REC_TEXT[s.key] || { title: s.label, text: '' };
    return { key: s.key, title: meta.title, text: meta.text, detail: s.detail, score: s.score };
  });
}

// Insight ELEV court pour la page Objectifs (1 à 2 observations max) — déterministe, réutilise
// uniquement le point faible déjà identifié par computeRaceReadiness et le repère de sortie longue
// déjà utilisé pour ce sous-score, sans nouvelle métrique ni appel réseau.
function generateGoalInsight(readiness, race) {
  const bullets = [];
  if (readiness && readiness.weakest) {
    bullets.push({ title: 'Priorité', text: readiness.weakest.label + ' reste actuellement la dimension la plus faible de ta préparation (' + readiness.weakest.score + '%).' });
  }
  const longuesSub = readiness && readiness.subs.find(s => s.key === 'longues');
  if (longuesSub && longuesSub.score != null && race && race.distanceKm) {
    const target = race.distanceKm * READINESS_LONG_RUN_RATIO;
    bullets.push({ title: 'Sorties longues', text: 'Ta plus longue sortie récente représente ' + Math.min(999, longuesSub.score) + '% du repère actuel (' + target.toFixed(0) + ' km).' });
  }
  return bullets.slice(0, 2);
}

/* --------------------------- PAGE PLAN — cockpit d'exécution de la préparation ---------------------------
   Toutes les fonctions ci-dessous lisent le plan importé (getPlan(), une seule liste de séances planifiées,
   voir parsePlanCsv) et les séances réelles (loadAllSessions()). Aucune ne fabrique de donnée : une valeur
   absente du CSV (phase, séance clé...) reste absente ici plutôt que d'être inventée pour remplir l'UI. */

// Bornes réelles du plan importé (première et dernière date planifiée). null si aucun plan.
function getPlanDateRange(plan) {
  if (!plan || !plan.length) return null;
  const dates = plan.map(p => p.date).sort();
  return { fromISO: dates[0], toISO: dates[dates.length - 1] };
}

// Progression du plan = semaines ISO écoulées / semaines ISO totales couvertes par le plan (jamais une
// pondération de séances inventée). status distingue "pas encore commencé" / "en cours" / "terminé".
function getPlanProgress(plan) {
  const range = getPlanDateRange(plan);
  if (!range) return null;
  const today = new Date().toISOString().slice(0,10);
  const totalWeeks = countIsoWeeksBetween(range.fromISO, range.toISO);
  let weeksElapsed, status;
  if (today < range.fromISO) { weeksElapsed = 0; status = 'not_started'; }
  else if (today > range.toISO) { weeksElapsed = totalWeeks; status = 'finished'; }
  else { weeksElapsed = countIsoWeeksBetween(range.fromISO, today); status = 'in_progress'; }
  return {
    fromISO: range.fromISO, toISO: range.toISO, totalWeeks, weeksElapsed,
    weeksRemaining: Math.max(0, totalWeeks - weeksElapsed),
    pct: Math.round(Math.min(100, weeksElapsed / totalWeeks * 100)),
    status,
  };
}

// Phases du plan = suites contiguës de séances partageant le même "bloc" (colonne texte libre du CSV,
// ex. "Général"/"Spécifique"...). Aucune liste fixe de phases n'est codée en dur : si le CSV de
// l'utilisateur ne renseigne pas au moins 2 blocs distincts, on ne trace pas de timeline (voir CLAUDE.md
// — ne pas inventer une segmentation qui n'existe pas dans les données).
function getPlanPhases(plan) {
  if (!plan || !plan.length) return null;
  const sorted = plan.slice().sort((a,b) => a.date.localeCompare(b.date));
  const runs = [];
  sorted.forEach(p => {
    if (!p.bloc) return;
    const last = runs[runs.length - 1];
    if (last && last.label === p.bloc) last.toDate = p.date;
    else runs.push({ label: p.bloc, fromDate: p.date, toDate: p.date });
  });
  if (runs.length < 2) return null;
  const range = getPlanDateRange(plan);
  return runs.map(r => ({
    label: r.label, fromDate: r.fromDate, toDate: r.toDate,
    fromWeek: countIsoWeeksBetween(range.fromISO, r.fromDate),
    toWeek: countIsoWeeksBetween(range.fromISO, r.toDate),
  }));
}
function getCurrentPlanPhase(phases) {
  if (!phases) return null;
  const today = new Date().toISOString().slice(0,10);
  return phases.find(ph => today >= ph.fromDate && today <= ph.toDate) || null;
}

// Séances planifiées de la semaine ISO courante, avec le numéro de semaine dérivé du début réel du plan
// (pas d'un "semaine 1" arbitraire). null si aucun plan importé.
function getCurrentPlanWeek(plan) {
  if (!plan || !plan.length) return null;
  const range = getPlanDateRange(plan);
  const today = new Date().toISOString().slice(0,10);
  const startISO = isoWeek(today);
  const endISO = addDaysIso(startISO, 6);
  const items = plan.filter(p => p.date >= startISO && p.date <= endISO);
  return {
    startISO, endISO, items,
    weekNum: countIsoWeeksBetween(range.fromISO, startISO),
    totalWeeks: countIsoWeeksBetween(range.fromISO, range.toISO),
    semaineLabel: (items.find(p => p.semaine) || {}).semaine || '',
    bloc: (items.find(p => p.bloc) || {}).bloc || '',
    inRange: today >= range.fromISO && today <= range.toISO,
  };
}

// Statut d'un jour du plan : compare le nombre de séances planifiées à celui des séances réalisées ce
// jour (matching strict par date, seule logique disponible — voir CLAUDE.md, pas de correspondance
// approximative inventée). "Manqué" seulement si la date est passée ET que le nombre de séances
// réalisées est inférieur au nombre de séances planifiées ce jour-là — couvre correctement le cas
// (rare) de plusieurs séances planifiées le même jour, où seule une partie aurait été réalisée.
function getPlanDayStatus(dateISO, plannedCount, doneCount) {
  if (!plannedCount) return doneCount ? 'done' : 'rest';
  if (doneCount >= plannedCount) return 'done';
  const today = new Date().toISOString().slice(0,10);
  return dateISO < today ? 'missed' : 'todo';
}

// Volume/D+/durée/séances réalisé vs prévu sur une semaine du plan. Statut "Dans les clous"/"En
// retard"/"En avance" : mêmes seuils que computePrepStatus (60%/130%), pour rester cohérent avec le
// reste du site plutôt que d'introduire une nouvelle règle. plannedDurationMin reste null si au moins
// une séance de la semaine a une durée non reconnue par parseDureeToMin (jamais un total partiel).
function calculateWeekProgress(week, sessions) {
  if (!week) return null;
  const doneItems = sessions.filter(s => s.date >= week.startISO && s.date <= week.endISO);
  const plannedKm = week.items.reduce((s,p) => s + (p.distanceKm||0), 0);
  const doneKm = doneItems.reduce((s,x) => s + (x.distanceKm||0), 0);
  const plannedDplus = week.items.reduce((s,p) => s + (p.deniveleM||0), 0);
  const doneDplus = doneItems.reduce((s,x) => s + (x.ascent||0), 0);
  const doneDurationS = doneItems.reduce((s,x) => s + (x.durationS||0), 0);
  const durMins = week.items.map(p => parseDureeToMin(p.dureeDetail));
  const plannedDurationMin = (durMins.length && durMins.every(v => v != null)) ? durMins.reduce((a,b)=>a+b,0) : null;
  const dayGroups = new Map();
  week.items.forEach(p => dayGroups.set(p.date, (dayGroups.get(p.date)||0) + 1));
  let missedCount = 0;
  dayGroups.forEach((plannedForDay, date) => {
    const doneForDay = doneItems.filter(s => s.date === date).length;
    if (getPlanDayStatus(date, plannedForDay, doneForDay) === 'missed') missedCount += (plannedForDay - doneForDay);
  });
  const pctKm = plannedKm > 0 ? Math.round(doneKm/plannedKm*100) : null;
  const pctDplus = plannedDplus > 0 ? Math.round(doneDplus/plannedDplus*100) : null;
  let statusLabel = null;
  if (pctKm != null) statusLabel = pctKm < 60 ? 'En retard' : (pctKm > 130 ? 'En avance' : 'Dans les clous');
  return {
    doneItems, plannedKm, doneKm, plannedDplus, doneDplus, doneDurationS, plannedDurationMin, missedCount,
    plannedCount: week.items.length, doneCount: doneItems.length,
    pctSessions: week.items.length ? Math.round(doneItems.length/week.items.length*100) : null,
    pctKm, pctDplus, statusLabel,
  };
}

// Associe chaque séance planifiée aux séances réelles de la même date (0, 1 ou plusieurs) — même
// convention que findPlannedSession, généralisée à une liste. Pas de tolérance de date : une séance
// réalisée un autre jour que prévu n'est pas rattachée (aucune logique de rattrapage dans les données).
function matchActivitiesToPlannedSessions(plannedItems, sessions) {
  return plannedItems.map(p => ({ planned: p, done: sessions.filter(s => s.date === p.date) }));
}

// Prochaine séance planifiée non encore réalisée (date >= aujourd'hui, aucune séance réelle à cette
// date). Pas de notion de "séance clé" dans le modèle de données — voir getKeyPlannedSessions pour une
// liste de séances importantes, distincte de "la prochaine".
function getNextPlanSession(plan, sessions) {
  if (!plan || !plan.length) return null;
  const today = new Date().toISOString().slice(0,10);
  const upcoming = plan.filter(p => p.date >= today && !sessions.some(s => s.date === p.date)).sort((a,b) => a.date.localeCompare(b.date));
  return upcoming[0] || null;
}

// Repères hebdomadaires du plan : moyenne du volume/D+ planifiés par semaine sur l'ensemble du plan, et
// la plus longue séance planifiée. Une moyenne globale plutôt qu'une fourchette min/max : le CSV ne
// porte qu'une seule valeur cible par semaine, jamais une plage (voir CLAUDE.md).
function getPlanTargets(plan) {
  if (!plan || !plan.length) return null;
  const weeksMap = new Map();
  plan.forEach(p => {
    const ws = isoWeek(p.date);
    if (!weeksMap.has(ws)) weeksMap.set(ws, { km: 0, dplus: 0 });
    const w = weeksMap.get(ws);
    w.km += p.distanceKm || 0; w.dplus += p.deniveleM || 0;
  });
  const weeks = [...weeksMap.values()];
  const longest = plan.reduce((max,p) => (p.distanceKm||0) > (max ? max.distanceKm||0 : 0) ? p : max, null);
  return {
    avgWeeklyKm: weeks.reduce((a,w) => a+w.km, 0) / weeks.length,
    avgWeeklyDplus: weeks.reduce((a,w) => a+w.dplus, 0) / weeks.length,
    longestPlannedKm: longest ? longest.distanceKm : null,
  };
}

// Séances "importantes" du plan (onglet Sorties clés) : détection déterministe par mot-clé du type de
// séance (sortie longue, seuil/tempo, côtes, VMA, fractionné) ou par volume nettement au-dessus de la
// moyenne hebdomadaire — jamais un flag arbitraire, la règle est documentée ici et nulle part ailleurs.
const KEY_SESSION_TYPE_RE = /(longue|seuil|tempo|c[oô]te|vma|fractionn)/i;
function getKeyPlannedSessions(plan) {
  if (!plan || !plan.length) return [];
  const targets = getPlanTargets(plan);
  return plan.filter(p => {
    if (KEY_SESSION_TYPE_RE.test(p.type || '')) return true;
    if (targets && targets.avgWeeklyKm && (p.distanceKm||0) >= 0.5 * targets.avgWeeklyKm) return true;
    return false;
  }).sort((a,b) => a.date.localeCompare(b.date));
}

// Vue d'ensemble par semaine (onglet Semaines) : une ligne par semaine du plan, prévu + réalisé si
// connu. Semaines futures : uniquement le prévu (voir rendu, pas de "réalisé 0" affiché comme un échec).
function getPlanWeeksOverview(plan) {
  if (!plan || !plan.length) return [];
  const sessions = loadAllSessions();
  const today = new Date().toISOString().slice(0,10);
  const todayWeek = isoWeek(today);
  const weeksMap = new Map();
  plan.forEach(p => {
    const ws = isoWeek(p.date);
    if (!weeksMap.has(ws)) weeksMap.set(ws, []);
    weeksMap.get(ws).push(p);
  });
  const sortedWeeks = [...weeksMap.entries()].sort((a,b) => a[0].localeCompare(b[0]));
  return sortedWeeks.map(([startISO, items], i) => {
    const endISO = addDaysIso(startISO, 6);
    const doneInWeek = sessions.filter(s => s.date >= startISO && s.date <= endISO);
    return {
      startISO, endISO, weekNum: i + 1, totalWeeks: sortedWeeks.length,
      semaineLabel: (items.find(p => p.semaine) || {}).semaine || '',
      bloc: (items.find(p => p.bloc) || {}).bloc || '',
      plannedKm: items.reduce((s,p) => s+(p.distanceKm||0), 0),
      plannedDplus: items.reduce((s,p) => s+(p.deniveleM||0), 0),
      plannedCount: items.length,
      doneKm: doneInWeek.reduce((s,x) => s+(x.distanceKm||0), 0),
      doneDplus: doneInWeek.reduce((s,x) => s+(x.ascent||0), 0),
      doneCount: doneInWeek.length,
      isPast: startISO < todayWeek, isCurrent: startISO === todayWeek, isFuture: startISO > todayWeek,
    };
  });
}

// Insight ELEV du plan (1 à 3 puces max) — priorité : séance manquée cette semaine > volume hors cible
// (28 derniers jours, computePrepStatus déjà utilisé par Objectifs/Accueil) > dynamique de charge
// (getTrainingTrend, déjà utilisé par l'Accueil). Aucun nouveau calcul : uniquement du texte dérivé de
// fonctions déjà existantes et validées ailleurs sur le site.
function getPlanInsights(plan, sessions) {
  const bullets = [];
  if (plan && plan.length) {
    const week = getCurrentPlanWeek(plan);
    if (week && week.inRange) {
      // Même règle que les badges de la semaine (getPlanDayStatus, via calculateWeekProgress) — pas de
      // double logique, voir CLAUDE.md.
      const wp = calculateWeekProgress(week, sessions);
      if (wp.missedCount) {
        bullets.push({ title: 'Séances', text: wp.missedCount + ' séance' + (wp.missedCount>1?'s':'') + ' prévue' + (wp.missedCount>1?'s':'') + ' cette semaine n\'' + (wp.missedCount>1?'ont':'a') + ' pas été associée' + (wp.missedCount>1?'s':'') + ' à une activité réalisée.' });
      }
    }
    if (bullets.length < 3) {
      const prep = computePrepStatus();
      if (prep) {
        if (prep.level === 'low') bullets.push({ title: 'Volume', text: 'Le volume réalisé reste sous la cible du plan sur les 4 dernières semaines (' + prep.pct + '%).' });
        else if (prep.level === 'high') bullets.push({ title: 'Volume', text: 'Le volume réalisé dépasse nettement la cible du plan sur les 4 dernières semaines (' + prep.pct + '%).' });
        else if (prep.pctDplus != null && prep.pctDplus < 60) bullets.push({ title: 'Dénivelé', text: 'Le D+ réalisé reste sous la cible du plan sur les 4 dernières semaines (' + prep.pctDplus + '%).' });
      }
    }
  }
  if (bullets.length < 3) {
    const trend = getTrainingTrend();
    if (trend) {
      const texts = {
        rising: 'Le volume hebdomadaire réalisé suit une progression régulière.',
        rising_fast: 'La charge récente augmente rapidement — pense à surveiller la récupération.',
        stable: 'Le volume hebdomadaire réalisé reste stable par rapport aux dernières semaines.',
        falling: 'Le volume récent est en retrait par rapport aux semaines précédentes.',
      };
      bullets.push({ title: 'Dynamique', text: texts[trend.level] });
    }
  }
  return bullets.slice(0, 3);
}

// Objectif lié au plan : seulement s'il existe un unique objectif "principal" non archivé — jamais un
// lien deviné entre plusieurs candidats ambigus (le plan n'a pas de champ de liaison stocké).
function getLinkedPlanGoal() {
  const principals = getRaces().filter(r => !r.archived && r.statut === 'principal');
  return principals.length === 1 ? principals[0] : null;
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
  // Jours réellement écoulés dans la semaine en cours (1 = on est lundi).
  const daysElapsed = Math.round((new Date(today) - new Date(weekStart)) / 86400000) + 1;
  const isPartialWeek = daysElapsed < 7;
  // COMPARAISON À NOMBRE DE JOURS ÉGAL. L'ancienne version comparait la semaine en cours
  // (partielle) à la semaine précédente ENTIÈRE : un mardi, le volume de 2 jours était comparé à
  // celui de 7, ce qui affichait mécaniquement une chute de 70 à 100 % et faisait conclure "En
  // baisse" alors que la semaine commençait à peine. On compare désormais les mêmes N premiers
  // jours de la semaine précédente. Le total de la semaine précédente complète reste exposé
  // séparément (`prevFull`) pour pouvoir l'afficher comme repère, sans servir de base au delta.
  const prevSameSpanEnd = addDaysIso(prevWeekStart, daysElapsed - 1);
  const current = sessions.filter(s => s.date >= weekStart && s.date <= today);
  const previousSameSpan = sessions.filter(s => s.date >= prevWeekStart && s.date <= prevSameSpanEnd);
  const previousFull = sessions.filter(s => s.date >= prevWeekStart && s.date < weekStart);
  const sum = (arr, key) => arr.reduce((a,s) => a + (s[key] || 0), 0);
  const deltaPct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const distanceKm = sum(current, 'distanceKm');
  const ascent = sum(current, 'ascent');
  const durationS = sum(current, 'durationS');
  return {
    distanceKm: +distanceKm.toFixed(1), distanceDeltaPct: deltaPct(distanceKm, sum(previousSameSpan, 'distanceKm')),
    ascent: Math.round(ascent), ascentDeltaPct: deltaPct(ascent, sum(previousSameSpan, 'ascent')),
    durationS, durationDeltaPct: deltaPct(durationS, sum(previousSameSpan, 'durationS')),
    sessionsCount: current.length, sessionsDeltaPct: deltaPct(current.length, previousSameSpan.length),
    // Contexte de lecture : indispensable pour ne jamais présenter une semaine à peine commencée
    // comme un résultat définitif (voir renderTrajectory, index.html).
    weekStartISO: weekStart, daysElapsed: daysElapsed, isPartialWeek: isPartialWeek,
    prevFull: {
      distanceKm: +sum(previousFull, 'distanceKm').toFixed(1),
      ascent: Math.round(sum(previousFull, 'ascent')),
      durationS: sum(previousFull, 'durationS'),
      sessionsCount: previousFull.length,
    },
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
/* Tendance d'une série hebdomadaire quelconque — mêmes seuils que getTrainingTrend(), qui ne
   savait raisonner que sur le volume. Extrait ici pour pouvoir interpréter AUSSI le dénivelé,
   sans dupliquer la règle ni en inventer une seconde qui pourrait la contredire.
   `values` va du plus ancien au plus récent. Retourne null si la moyenne est nulle : sans
   référence, il n'y a rien à comparer, et un pourcentage y serait une division par zéro déguisée. */
function weeklyTrend(values) {
  if (!values || values.length < 2) return null;
  const acute = values[values.length - 1];
  const chronic = values.reduce((a, b) => a + b, 0) / values.length;
  if (chronic <= 0) return null;
  const ratio = +(acute / chronic).toFixed(2);
  let level;
  if (ratio >= TREND_RISING_FAST_RATIO) level = 'rising_fast';
  else if (ratio >= TREND_RISING_RATIO) level = 'rising';
  else if (ratio <= TREND_FALLING_RATIO) level = 'falling';
  else level = 'stable';
  return { level, ratio, acute, chronic, deltaPct: Math.round((acute / chronic - 1) * 100) };
}

/* Observations complémentaires de l'Accueil (phase 12 du plan d'action : passer de « montrer les
   données » à « les interpréter »). L'interprétation de l'Accueil ne portait QUE sur le volume,
   alors que le dénivelé est la mesure qui définit le trail et que la sortie longue conditionne la
   préparation à une course.
   Chaque observation suit le même contrat : un constat quantifié, ET la référence à laquelle il
   se compare — sans référence explicite, un pourcentage n'est pas interprétable.
   Rien n'est inventé : tout vient de getRecentWeeklyVolumes(), déjà calculé pour le graphique de
   la page. Aucune observation sur la récupération : l'application ne suit ni sommeil ni FC de
   repos dans le temps, il n'y a donc rien à en dire. */
function generateElevSideInsights() {
  const weeks = getRecentWeeklyVolumes(5);
  if (!weeks || weeks.length < 3) return [];
  const out = [];

  const dTrend = weeklyTrend(weeks.map(w => w.dplus));
  if (dTrend && dTrend.chronic >= 100) { // sous 100 m/sem. de moyenne, un ratio n'a pas de sens
    const signe = dTrend.deltaPct >= 0 ? '+' : '';
    out.push({
      key: 'dplus',
      title: dTrend.level === 'falling' ? 'Dénivelé en retrait'
        : (dTrend.level === 'stable' ? 'Dénivelé stable' : 'Dénivelé en hausse'),
      text: Math.round(dTrend.acute) + ' m cette semaine, ' + signe + dTrend.deltaPct +
            ' % par rapport à ta moyenne des ' + weeks.length + ' dernières semaines (' +
            Math.round(dTrend.chronic) + ' m).',
    });
  }

  // Sortie longue : le maximum de la semaine face au meilleur des semaines précédentes.
  const sessions = loadAllSessions();
  const debutSemaine = weeks[weeks.length - 1].startISO;
  const longueSemaine = Math.max(0, ...sessions.filter(s => s.date >= debutSemaine).map(s => s.distanceKm || 0));
  const longuePrecedente = Math.max(0, ...sessions.filter(s => s.date < debutSemaine &&
    s.date >= weeks[0].startISO).map(s => s.distanceKm || 0));
  if (longueSemaine > 0 && longuePrecedente > 0) {
    const ecart = Math.round((longueSemaine / longuePrecedente - 1) * 100);
    out.push({
      key: 'longue',
      title: ecart >= 0 ? 'Sortie longue en progression' : 'Sortie longue plus courte',
      text: longueSemaine.toFixed(1) + ' km cette semaine, contre ' + longuePrecedente.toFixed(1) +
            ' km au mieux sur les ' + (weeks.length - 1) + ' semaines précédentes.',
    });
  }

  return out.slice(0, 2);
}

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
// `size` optionnel (défaut 44px, utilisé par les KPI de l'Accueil) — la page Objectifs passe une
// taille plus grande (voir `.goal-ring-big`) pour son score de préparation en position de hero.
// `centerText` optionnel : dessine une valeur au centre de l'anneau (ex. "75%") pour réunir
// visuellement le score et sa jauge plutôt que de les afficher côte à côte (voir CLAUDE.md).
function ringSvg(pct, size, centerText) {
  size = size || 44;
  const stroke = Math.max(4, Math.round(size * 0.09)), r = (size - stroke) / 2, c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);
  // Le score au centre de l'anneau est une DONNÉE CHIFFRÉE : il suit donc la règle du 2026-08-21
  // (IBM Plex Mono pour les chiffres, cf. divergence 5 de design-system/readme.md), comme le grand
  // score de préparation de l'Accueil. Il était en Raleway 800, une voix de titre — les héros
  // Objectifs et Plan annonçaient donc le même indicateur que l'Accueil dans une autre typographie.
  // Poids 600 : IBM Plex Mono est chargée en 500/600, au-delà le navigateur synthétiserait la graisse.
  const text = centerText ? '<text x="'+c+'" y="'+(c + size*0.09)+'" text-anchor="middle" font-family="var(--font-mono)" font-weight="600" font-size="'+(size*0.24).toFixed(1)+'" fill="var(--text)">'+escapeHtml(centerText)+'</text>' : '';
  return '<svg class="kpi-ring" viewBox="0 0 '+size+' '+size+'">' +
    '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="rgba(244,247,245,.09)" stroke-width="'+stroke+'"/>' +
    // L'anneau de progression garde le vert de marque : le §3 réserve explicitement le vert vif
    // à « la progression positive », c'est un signal, pas un graphique secondaire.
    '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="var(--accent)" stroke-width="'+stroke+'" stroke-linecap="round" ' +
      'stroke-dasharray="'+circumference.toFixed(1)+'" stroke-dashoffset="'+offset.toFixed(1)+'" transform="rotate(-90 '+c+' '+c+')"/>' +
    text +
  '</svg>';
}

// Donut de répartition (zones FC d'une séance) avec une valeur libre au centre (ex. durée totale).
// Même technique que ringSvg (arcs superposés via stroke-dasharray/dashoffset) mais multi-segments.
// Couleurs des arcs de zone FC — consomment désormais les MÊMES tokens que les pastilles de
// légende (.zone-dot.z1-z5, assets/style.css). Elles définissaient auparavant une échelle
// catégorielle indépendante (gris / vert clair / vert / ambre / saumon) : sur le même composant,
// côte à côte, la pastille et l'arc qu'elle décrit n'avaient la même couleur pour AUCUNE des
// 5 zones, et les deux rampes allaient en sens inverse. La légende textuelle (intitulé +
// pourcentage) reste affichée : la couleur n'est jamais le seul véhicule de sens.
const ZONE_DONUT_COLORS = { z1:'var(--zone-1)', z2:'var(--zone-2)', z3:'var(--zone-3)', z4:'var(--zone-4)', z5:'var(--zone-5)' };
function zoneDonutSvg(dist, centerValue, centerLabel) {
  if (!dist || !dist.length) return '';
  const size = 118, stroke = 15, r = (size - stroke) / 2, c = size / 2;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  const arcs = dist.filter(z => z.pct > 0).map(z => {
    const len = circumference * (z.pct / 100);
    const arc = '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + (ZONE_DONUT_COLORS[z.key] || 'var(--accent)') + '" stroke-width="' + stroke + '" ' +
      'stroke-dasharray="' + len.toFixed(1) + ' ' + (circumference - len).toFixed(1) + '" stroke-dashoffset="' + (-cumulative).toFixed(1) + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>';
    cumulative += len;
    return arc;
  }).join('');
  return '<svg class="zone-donut" viewBox="0 0 ' + size + ' ' + size + '">' + arcs +
    '<text x="' + c + '" y="' + (c - 3) + '" text-anchor="middle" font-family="var(--font-display)" font-weight="700" font-size="16" fill="var(--text)">' + escapeHtml(centerValue) + '</text>' +
    '<text x="' + c + '" y="' + (c + 14) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + escapeHtml(centerLabel) + '</text>' +
  '</svg>';
}

// Donut générique (page Analyse — répartition locomotion) : même technique que zoneDonutSvg mais
// couleurs fournies par l'appelant plutôt que fixées aux zones FC.
function genericDonutSvg(segments, centerValue, centerLabel) {
  if (!segments || !segments.length) return '';
  const size = 100, stroke = 13, r = (size - stroke) / 2, c = size / 2;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  const arcs = segments.filter(s => s.pct > 0).map(s => {
    const len = circumference * (s.pct / 100);
    const arc = '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="' + stroke + '" ' +
      'stroke-dasharray="' + len.toFixed(1) + ' ' + (circumference - len).toFixed(1) + '" stroke-dashoffset="' + (-cumulative).toFixed(1) + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>';
    cumulative += len;
    return arc;
  }).join('');
  return '<svg class="zone-donut" viewBox="0 0 ' + size + ' ' + size + '">' + arcs +
    '<text x="' + c + '" y="' + (c - 2) + '" text-anchor="middle" font-family="var(--font-display)" font-weight="700" font-size="14" fill="var(--text)">' + escapeHtml(centerValue) + '</text>' +
    '<text x="' + c + '" y="' + (c + 12) + '" text-anchor="middle" font-size="8" fill="var(--muted)">' + escapeHtml(centerLabel) + '</text>' +
  '</svg>';
}

// Graphique combiné "Évolution du volume" (page Analyse) : barres = distance (échelle affichée en
// axe Y), ligne = durée normalisée sur sa propre plage — pas de second axe superposé (même convention
// que le fond de terrain en arrière-plan des autres graphiques : repère de tendance, pas une lecture
// exacte au pixel près ; le détail exact reste dans le tooltip).
/* ------------------------- GRAPHIQUES CONSCIENTS DE LEUR CONTENEUR -------------------------
   `chartViewboxWidth()` ci-dessous raisonne sur la largeur de FENETRE. C'est une approximation
   qui ne tient que tant qu'un graphique occupe toute la largeur disponible : des que deux
   graphiques se partagent une ligne, chaque conteneur fait la moitie de ce que la fonction
   suppose, l'echelle du SVG s'effondre et le texte des axes redevient illisible.

   Le registre ci-dessous supprime l'approximation. Un appelant enregistre son conteneur avec une
   fonction de rendu prenant une largeur ; le conteneur est mesure APRES insertion dans le DOM et
   redessine a sa largeur reelle, puis a chaque redimensionnement utile. L'echelle du SVG vaut
   alors 1 et un font-size="13" rend a 13px, quelle que soit la mise en page.

   Le contenu est remplace A L'INTERIEUR du conteneur, jamais le conteneur lui-meme : les
   info-bulles sont posees dessus en delegation (voir initChartTooltips et son garde
   `dataset.tooltipWired`), elles survivent donc au redessin sans etre rearmees.

   Meme principe que initTerrainProfiles() pour les labels du profil : mesurer le rendu reel
   plutot que de le deviner. */
const _responsiveCharts = new Map();

function registerResponsiveChart(el, render) {
  if (!el || typeof render !== 'function') return;
  _responsiveCharts.set(el, render);
  _drawResponsiveChart(el);
  // La mise en page n'est pas toujours stabilisee au premier appel (scenes pleine largeur
  // dimensionnees en JS) : on repasse une fois la frame suivante, puis un peu plus tard.
  requestAnimationFrame(function () { _drawResponsiveChart(el); });
  setTimeout(function () { _drawResponsiveChart(el); }, 220);
}

function _drawResponsiveChart(el) {
  const render = _responsiveCharts.get(el);
  if (!render || !el.isConnected) return;
  const w = Math.round(el.clientWidth);
  if (!w) return;                                   // pas encore mis en page
  if (el.dataset.chartWidth === String(w)) return;  // deja dessine a cette largeur
  el.dataset.chartWidth = String(w);
  el.innerHTML = render(w);
}

function refreshResponsiveCharts() {
  _responsiveCharts.forEach(function (fn, el) {
    if (!el.isConnected) { _responsiveCharts.delete(el); return; }
    _drawResponsiveChart(el);
  });
}

// Un seul ecouteur de redimensionnement pour tous les graphiques de la page, debounce.
(function () {
  if (typeof window === 'undefined') return;
  let t = null;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(refreshResponsiveCharts, 150);
  });
})();

/* Largeur du viewBox d'un graphique, adaptee a l'ecran.
   Un viewBox fixe de 620 rend le texte illisible sur telephone : le SVG est ramene a ~343px de
   large, soit une echelle de 0,55, et un font-size="13" arrive a 7,2px reels (mesure). Ce n'est
   pas une valeur trop petite, c'est une mise a l'echelle. En rapprochant la largeur du viewBox de
   la largeur reellement disponible, l'echelle revient pres de 1 et le texte retrouve sa taille
   nominale. Les coordonnees internes suivent, la geometrie est inchangee. */
function chartViewboxWidth(opts) {
  if (opts && opts.width) return opts.width;
  return (typeof window !== 'undefined' && window.innerWidth < 640) ? 330 : 620;
}
function volumeChartSvg(weeks, opts) {
  opts = opts || {};
  const titleHtml = opts.hideTitle ? '' : '<h3>Évolution du volume</h3>';
  if (weeks.length < 2) return '<div class="chart-box">' + titleHtml + '<div class="empty">Pas encore assez de séances pour ce graphique (2 semaines minimum).</div></div>';
  // `opts.height` (défaut 260, comportement inchangé partout où l'option n'est pas passée) :
  // permet à une page de traiter ce graphique comme son graphique PRINCIPAL en lui donnant plus
  // de hauteur, sans dupliquer la fonction. Utilisé par la hiérarchie L1/L2 de la page Analyse.
  const w = chartViewboxWidth(opts), h = opts.height || 260, padL = 40, padR = 10, padT = 18, padB = 30;
  const maxKm = Math.max(1, ...weeks.map(x => x.km));
  const maxDurH = Math.max(1, ...weeks.map(x => x.durationS / 3600));
  const groupW = (w - padL - padR) / weeks.length;
  const barW = Math.min(groupW * 0.55, 46);
  const syDur = v => (h - padB) - (v / maxDurH) * (h - padT - padB);
  let bars = '';
  weeks.forEach((wk, i) => {
    const x = padL + i * groupW + (groupW - barW) / 2;
    const bh = (wk.km / maxKm) * (h - padT - padB);
    const y = (h - padB) - bh;
    const tip = escapeHtml('Semaine du ' + fmtDate(wk.startISO) + ' — ' + wk.km.toFixed(1) + ' km · ' + fmtDuration(wk.durationS) + ' · ' + wk.count + ' séance' + (wk.count > 1 ? 's' : ''));
    bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(bh, 1).toFixed(1) + '" rx="2" fill="var(--accent)" data-tooltip="' + tip + '"/>';
    if (weeks.length <= 9 || i % Math.ceil(weeks.length / 8) === 0) {
      bars += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (h - 10) + '" class="c-tick" text-anchor="middle">' + wk.shortLabel + '</text>';
    }
  });
  const linePts = weeks.map((wk, i) => [padL + i * groupW + groupW / 2, syDur(wk.durationS / 3600)]);
  const linePath = linePts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const legend = '<div class="chart-legend"><span><span class="dot" style="background:var(--accent)"></span>Distance (km)</span><span><span class="dot" style="background:var(--secondary)"></span>Durée</span></div>';
  return '<div class="chart-box">' + titleHtml + legend + '<svg viewBox="0 0 ' + w + ' ' + h + '">' +
    '<line x1="' + padL + '" y1="' + (h - padB) + '" x2="' + (w - padR) + '" y2="' + (h - padB) + '" stroke="var(--border)"/>' +
    '<text x="2" y="' + (padT + 6) + '" class="c-axis">' + maxKm.toFixed(0) + ' km</text>' +
    bars +
    '<path d="' + linePath + '" fill="none" stroke="var(--secondary)" stroke-width="2" stroke-linecap="round"/>' +
  '</svg></div>';
}

// Graphique "réalisé vs planifié" (page Objectifs — Volume/D+ de la préparation) : barres = réalisé,
// ligne pointillée = cible planifiée — seulement si un plan est réellement importé (`planMap` vient de
// groupPlanByWeek, null si aucun plan). Jamais de cible dessinée sans donnée réelle.
// opts.mutedPlanned / opts.futureFromISO : options utilisées uniquement par la page Plan (voir CLAUDE.md,
// micro-passe finition Plan) pour accentuer le contraste réalisé/planifié et estomper la partie future
// de la ligne cible — non passées par Objectifs, dont le rendu reste strictement inchangé par défaut.
function goalTrendChartSvg(weeks, planMap, key, opts) {
  opts = opts || {};
  const titleHtml = opts.hideTitle ? '' : '<h3>' + escapeHtml(opts.title || '') + '</h3>';
  if (weeks.length < 2) return '<div class="chart-box">' + titleHtml + '<div class="empty">Pas encore assez de séances sur cette fenêtre pour ce graphique.</div></div>';
  const w = chartViewboxWidth(opts), h = opts.height || 220, padL = 44, padR = 10, padT = 18, padB = 30;
  const fmt = opts.fmt || (v => Math.round(v));
  const realizedVals = weeks.map(x => x[key] || 0);
  const plannedVals = planMap ? weeks.map(x => (planMap.get(x.startISO) || {})[key] || 0) : [];
  const maxV = Math.max(1, ...realizedVals, ...plannedVals);
  const groupW = (w - padL - padR) / weeks.length;
  const barW = Math.min(groupW * 0.55, 46);
  const sy = v => (h - padB) - (v / maxV) * (h - padT - padB);
  let bars = '';
  weeks.forEach((wk, i) => {
    const x = padL + i * groupW + (groupW - barW) / 2;
    const val = wk[key] || 0;
    const bh = (val / maxV) * (h - padT - padB);
    const y = (h - padB) - bh;
    const plannedVal = planMap ? ((planMap.get(wk.startISO) || {})[key] || 0) : null;
    const delta = plannedVal != null ? (val - plannedVal) : null;
    const tip = escapeHtml(opts.mutedPlanned && plannedVal != null
      ? ('Semaine du ' + fmtDate(wk.startISO) + ' — réalisé ' + fmt(val) + ' · planifié ' + fmt(plannedVal) + ' · écart ' + (delta>=0?'+':'') + fmt(delta))
      : ('Semaine du ' + fmtDate(wk.startISO) + ' — réalisé ' + fmt(val) + (plannedVal != null ? (' · cible ' + fmt(plannedVal)) : '')));
    bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(bh, 1).toFixed(1) + '" rx="2" fill="var(--accent)" data-tooltip="' + tip + '"/>';
    if (weeks.length <= 9 || i % Math.ceil(weeks.length / 8) === 0) {
      bars += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (h - 10) + '" class="c-tick" text-anchor="middle">' + wk.shortLabel + '</text>';
    }
  });
  let planLine = '', legend = '<div class="chart-legend"><span><span class="dot" style="background:var(--accent)"></span>Réalisé</span>';
  if (planMap) {
    const plannedColor = opts.mutedPlanned ? 'var(--muted-2)' : 'var(--secondary)';
    const dash = opts.mutedPlanned ? '3,4' : '4,3';
    const pts = weeks.map((wk, i) => [padL + i * groupW + groupW / 2, sy((planMap.get(wk.startISO) || {})[key] || 0)]);
    const pathOf = arr => arr.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const splitIdx = opts.futureFromISO ? weeks.findIndex(wk => wk.startISO >= opts.futureFromISO) : -1;
    if (splitIdx > 0 && splitIdx < weeks.length) {
      planLine = '<path d="' + pathOf(pts.slice(0, splitIdx + 1)) + '" fill="none" stroke="' + plannedColor + '" stroke-width="2" stroke-dasharray="' + dash + '"/>' +
        '<path d="' + pathOf(pts.slice(splitIdx)) + '" fill="none" stroke="' + plannedColor + '" stroke-width="2" stroke-dasharray="' + dash + '" opacity="0.5"/>';
    } else if (splitIdx === 0) {
      planLine = '<path d="' + pathOf(pts) + '" fill="none" stroke="' + plannedColor + '" stroke-width="2" stroke-dasharray="' + dash + '" opacity="0.5"/>';
    } else {
      planLine = '<path d="' + pathOf(pts) + '" fill="none" stroke="' + plannedColor + '" stroke-width="2" stroke-dasharray="' + dash + '"/>';
    }
    legend += '<span><span class="dot" style="background:' + plannedColor + '"></span>' + (opts.mutedPlanned ? 'Planifié' : 'Cible planifiée') + '</span>';
  }
  legend += '</div>';
  return '<div class="chart-box">' + titleHtml + legend + '<svg viewBox="0 0 ' + w + ' ' + h + '">' +
    '<line x1="' + padL + '" y1="' + (h - padB) + '" x2="' + (w - padR) + '" y2="' + (h - padB) + '" stroke="var(--border)"/>' +
    // Quatre graduations + lignes de grille au lieu d'une seule valeur maximale : sans elles, la
    // seule facon de lire une valeur etait le tooltip, ce que le skill dataviz interdit
    // (« un tooltip n'est jamais le seul moyen de lire une valeur »).
    [0.25, 0.5, 0.75].map(function (frac) {
      const gy = (h - padB) - frac * (h - padT - padB);
      return '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) + '" stroke="var(--chart-grid)" stroke-width="1"/>' +
        '<text x="2" y="' + (gy + 4).toFixed(1) + '" class="c-axis">' + fmt(maxV * frac) + '</text>';
    }).join('') +
    '<text x="2" y="' + (padT + 6) + '" class="c-axis">' + fmt(maxV) + '</text>' +
    '<text x="2" y="' + (h - padB + 4) + '" class="c-axis">0</text>' +
    bars + planLine +
  '</svg></div>';
}

// Aperçu visuel d'une séance pour la carte "Dernière activité" : trace GPS si les coordonnées sont
// disponibles, sinon profil altimétrique, sinon rien — jamais d'image générique. Fonction de rendu
// pure, sans dépendance à un fond de carte externe (contrairement à la carte Leaflet du détail de séance).
// `opts.forceAltitude` : ignore le tracé GPS même s'il est disponible et rend directement le profil
// altimétrique (utilisé par la carte "Sortie longue" de la page Objectifs, qui veut spécifiquement
// le relief de la sortie plutôt que sa forme sur la carte — voir CLAUDE.md). Comportement par défaut
// inchangé pour l'Accueil/Activités (GPS en priorité).
function sessionPreviewSvg(session, opts) {
  opts = opts || {};
  const series = Array.isArray(session.series) ? session.series : [];
  const w = 160, h = 100, pad = 10;
  const withGps = opts.forceAltitude ? [] : series.filter(p => p.lat != null && p.lon != null);
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
      '<polyline points="'+pointsAttr+'" fill="none" stroke="var(--chart-line)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
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
      '<path d="'+path+'" fill="none" stroke="var(--chart-line)" stroke-width="2"/>' +
    '</svg>';
  }
  return '';
}

/* --------------------------- ELEV TERRAIN PROFILE (composant partagé) ---------------------------
   Silhouette d'altitude "brillante" — UN SEUL composant réutilisé partout où un profil d'altitude
   doit s'afficher (aujourd'hui : Performance Pulse et Target Summit de l'Accueil).

   RÈGLE ABSOLUE : l'axe X est TOUJOURS la distance cumulée réelle et l'axe Y l'altitude réelle.
   Jamais un index de point (une série FIT est échantillonnée dans le TEMPS : tracer par index
   donne un profil temps/altitude, pas distance/altitude — bug réel corrigé lors de cette passe),
   jamais une autre métrique (readiness, volume, charge, tendance hebdomadaire).

   Aucun profil n'est dessiné sans série valide : `validateTerrainSeries()` est le seul point
   d'entrée et retourne `null` dès qu'une condition minimale manque — l'appelant affiche alors un
   état vide honnête plutôt qu'un relief fabriqué.

   Les labels (Départ / Point culminant / Arrivée...) ne vivent PAS dans le SVG : le SVG est étiré
   (`preserveAspectRatio="none"`, nécessaire pour occuper toute la largeur), ce qui déformerait
   horizontalement leur texte. Ils sont rendus en HTML au-dessus du SVG et positionnés par
   `initTerrainProfiles()` (mesure réelle + résolution de collisions), ce qui garde le texte dans
   le DOM (accessible, traduisible) — les assets elev-label-*.svg fournis servent de référence
   visuelle, leurs icônes sont reprises, jamais leur texte figé. */

// Fenêtre de lissage (moyenne mobile) appliquée à l'altitude avant tracé — réduit le bruit GPS/
// baro (quelques mètres d'écart point à point) sans changer le relief réel, même principe déjà
// utilisé pour l'allure sur le détail de séance (voir CLAUDE.md). Purement un traitement de
// rendu : la donnée source (min/max/D+ affichés en texte) n'est jamais recalculée dessus.
function _smoothAltitudes(values, windowSize) {
  if (values.length < windowSize * 2) return values.slice();
  const half = Math.floor(windowSize / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half), end = Math.min(values.length, i + half + 1);
    const slice = values.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/* Validation de la série d'altitude AVANT tout rendu (exigence explicite : « si cette série
   n'existe pas, NE DESSINE AUCUN PROFIL »). Accepte des points `{distKm, alt}` (+ champs
   optionnels hr/paceSecKm/cadenceSpm conservés pour le tooltip). Retourne `null` — jamais un
   objet partiel — si l'une des conditions minimales n'est pas réunie :
     - au moins 4 points exploitables (2 points ne décrivent pas un relief) ;
     - distances numériques, positives et croissantes (un recul de distance = série corrompue) ;
     - altitudes numériques et plausibles (-500 m à 9000 m) ;
     - distance totale d'au moins 200 m ;
     - amplitude d'altitude d'au moins 5 m (un tapis de course / une piste plate n'a pas de
       profil à montrer — l'étirer donnerait un faux relief).
   Les doublons de distance (points à l'arrêt) sont ignorés, pas rejetés. */
/* Lecture stricte d'une valeur numérique de série. Retourne un nombre fini, ou `null` pour toute
   valeur non exploitable. Ne JAMAIS remplacer par `Number(x)` : `Number(null)`, `Number('')`,
   `Number('  ')`, `Number(true)` et `Number([])` renvoient tous un nombre fini alors qu'aucune de
   ces valeurs ne décrit une altitude ou une distance mesurée. */
function _terrainNum(x) {
  if (x == null || typeof x === 'boolean') return null;
  if (typeof x === 'string' && x.trim() === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
const TERRAIN_MIN_POINTS = 4;
const TERRAIN_MIN_TOTAL_KM = 0.2;
const TERRAIN_MIN_ALT_RANGE_M = 5;
function validateTerrainSeries(rawPoints) {
  if (!Array.isArray(rawPoints) || rawPoints.length < TERRAIN_MIN_POINTS) return null;
  const pts = [];
  let lastD = -Infinity;
  for (const p of rawPoints) {
    if (!p) continue;
    const d = _terrainNum(p.distKm), a = _terrainNum(p.alt);
    // null / undefined / '' / NaN / booléen : le point est IGNORÉ (exigence §10 du brief). Il ne
    // devient jamais 0 — `Number(null)` et `Number('')` valent 0 et `Number.isFinite(0)` est vrai,
    // ce qui faisait entrer des altitudes fantômes à 0 m (écrasant minAlt, donc toute l'échelle
    // verticale du tracé) et des distances fantômes à 0 km (interprétées comme un recul, ce qui
    // rejetait la série entière). Bug réel, reproduit par les cas 5/8/9/10/11 du jeu de test.
    if (d == null || a == null) continue;
    if (d < 0 || a < -500 || a > 9000) return null;      // donnée aberrante : on ne devine pas
    if (d < lastD) return null;                          // distance qui recule : série non fiable
    if (d === lastD) continue;                           // point à l'arrêt : ignoré, pas rejeté
    pts.push({ distKm: d, alt: a, hr: p.hr != null ? p.hr : null, paceSecKm: p.paceSecKm != null ? p.paceSecKm : null, cadenceSpm: p.cadenceSpm != null ? p.cadenceSpm : null });
    lastD = d;
  }
  if (pts.length < TERRAIN_MIN_POINTS) return null;
  const totalKm = pts[pts.length - 1].distKm;
  if (!(totalKm >= TERRAIN_MIN_TOTAL_KM)) return null;
  const alts = pts.map(p => p.alt);
  const minAlt = Math.min.apply(null, alts), maxAlt = Math.max.apply(null, alts);
  if (maxAlt - minAlt < TERRAIN_MIN_ALT_RANGE_M) return null;
  let peakIdx = 0, gain = 0, loss = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].alt > pts[peakIdx].alt) peakIdx = i;
    if (i > 0) { const d = pts[i].alt - pts[i - 1].alt; if (d > 0) gain += d; else loss += -d; }
  }
  return { points: pts, totalKm: totalKm, minAlt: minAlt, maxAlt: maxAlt, peakIdx: peakIdx, gain: Math.round(gain), loss: Math.round(loss) };
}

// Amplitude visuelle minimale (mètres) utilisée pour l'échelle du tracé — un profil de faible
// dénivelé ne doit jamais être étiré pour remplir toute la hauteur disponible, ce qui le ferait
// ressembler à un relief accidenté qu'il n'est pas. Un profil vraiment montagneux (amplitude >
// ce seuil) continue d'utiliser toute la hauteur normalement.
const TERRAIN_MIN_VISUAL_SPAN_M = 80;
// Géométrie interne du viewBox (unités SVG) — largeur fixe, hauteur variable, le SVG est ensuite
// étiré à la largeur réelle du conteneur (preserveAspectRatio="none").
const TERRAIN_VB_W = 1000;

/* Calcule la géométrie du tracé : points en unités viewBox ET en fractions (0-1), ces dernières
   servant à positionner labels/curseur en HTML par-dessus le SVG étiré. */
function _terrainGeometry(v, h) {
  const smoothed = _smoothAltitudes(v.points.map(p => p.alt), 5);
  const minA = Math.min.apply(null, smoothed), maxA = Math.max.apply(null, smoothed);
  const realSpan = maxA - minA;
  // Marge interne verticale généreuse : le tracé occupe une bande maîtrisée, jamais bord à bord.
  const padTop = h * 0.30, padBottom = h * 0.10;
  const drawH = h - padTop - padBottom;
  const span = Math.max(realSpan, TERRAIN_MIN_VISUAL_SPAN_M);
  // Centre la portion réellement occupée quand le span visuel dépasse le span réel (profil peu
  // accidenté) — sinon le relief se retrouverait plaqué en bas de la bande.
  const visualOffset = (span - realSpan) / 2;
  const total = v.totalKm || 1;
  return v.points.map(function (p, i) {
    // X = DISTANCE CUMULÉE réelle (jamais l'index du point).
    const x = (p.distKm / total) * TERRAIN_VB_W;
    const y = h - padBottom - (((smoothed[i] - minA) + visualOffset) / span) * drawH;
    return { x: x, y: y, xf: x / TERRAIN_VB_W, yf: y / h };
  });
}

/* Détection grossière des montées (hystérésis de 12 m, gain minimum 30 m) — sert UNIQUEMENT à
   choisir le fond atmosphérique A/B, jamais à afficher une donnée. Volontairement plus simple
   que `detectClimbs()` (analyse de séance), qui travaille sur distance + pente. */
function _terrainClimbGains(alts) {
  const sm = _smoothAltitudes(alts, 9);
  const HYST = 12, MIN_GAIN = 30, climbs = [];
  let base = sm[0], top = sm[0];
  for (let i = 1; i < sm.length; i++) {
    const a = sm[i];
    if (a > top) { top = a; continue; }
    if (top - a >= HYST) {
      if (top - base >= MIN_GAIN) climbs.push(top - base);
      base = a; top = a; continue;
    }
    if (a < base) base = a;
  }
  if (top - base >= MIN_GAIN) climbs.push(top - base);
  return climbs;
}
/* Choix du fond atmosphérique du profil parmi les 2 assets fournis. C'est un choix d'AMBIANCE :
   ces images ne représentent jamais la donnée et ne sont jamais alignées sur la silhouette réelle
   (voir consigne « fond terrain = atmosphère, profil SVG = information »).
     - 'a' (elev-profile-terrain-a) : ultra-trail / panoramique, plusieurs sommets.
     - 'b' (elev-profile-terrain-b) : ascension dominante, un sommet principal. */
function pickTerrainBackdrop(v) {
  if (!v) return 'a';
  const climbs = _terrainClimbGains(v.points.map(p => p.alt));
  if (v.totalKm >= 40) return 'a';                        // ultra : lecture panoramique
  if (climbs.length <= 1) return 'b';
  const sum = climbs.reduce(function (a, b) { return a + b; }, 0);
  return (Math.max.apply(null, climbs) / sum) > 0.55 ? 'b' : 'a';  // une montée porte l'essentiel du D+
}

/* SVG du tracé seul (5 couches concentriques sur LE MÊME chemin géométrique : remplissage → halo
   extérieur → halo intérieur → ligne principale → cœur clair). `variant` règle l'intensité :
   'hero' (grande scène), 'compact' (liste), 'ghost' (pure matière). Décoratif : l'information est
   portée par le texte des labels et par `elevTerrainDescription`. */
let _terrainProfileId = 0;
function elevTerrainLineSvg(v, opts) {
  opts = opts || {};
  if (!v || !v.points || v.points.length < 2) return '';
  const id = 'tp' + (_terrainProfileId++);
  const variant = opts.variant || 'hero';
  const h = opts.height || 220;
  const geom = opts.geom || _terrainGeometry(v, h);
  const path = geom.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  const area = path + ' L' + TERRAIN_VB_W + ',' + h + ' L0,' + h + ' Z';

  let contourSvg = '';
  if (opts.contour) {
    contourSvg = [0.3, 0.55, 0.8].map(function (f) {
      const cy = (h * f).toFixed(1);
      return '<line x1="0" y1="' + cy + '" x2="' + TERRAIN_VB_W + '" y2="' + cy + '" stroke="var(--text)" stroke-width="1.5" stroke-dasharray="3,5" opacity="0.55"/>';
    }).join('');
  }

  const glowOuterW = variant === 'hero' ? 18 : variant === 'compact' ? 8 : 0;
  const glowInnerW = variant === 'hero' ? 8 : variant === 'compact' ? 5 : 0;
  const lineW = variant === 'ghost' ? 1.5 : variant === 'compact' ? 2 : 3;
  const coreW = variant === 'ghost' ? 0 : variant === 'compact' ? 0.8 : 1.1;
  const areaOpacity = variant === 'ghost' ? 0.5 : 1;

  return '<svg class="terrain-line-svg terrain-line-svg--' + variant + '" viewBox="0 0 ' + TERRAIN_VB_W + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
    '<defs>' +
      '<linearGradient id="' + id + 'Area" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#5BFF8D" stop-opacity="' + (0.18 * areaOpacity).toFixed(2) + '"/>' +
        '<stop offset="40%" stop-color="#37B868" stop-opacity="' + (0.07 * areaOpacity).toFixed(2) + '"/>' +
        '<stop offset="100%" stop-color="#0B0F0E" stop-opacity="0"/>' +
      '</linearGradient>' +
      (glowOuterW ? '<filter id="' + id + 'Outer" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>' : '') +
      (glowInnerW ? '<filter id="' + id + 'Inner" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.5"/></filter>' : '') +
    '</defs>' +
    contourSvg +
    '<path class="terrain-fill" fill="url(#' + id + 'Area)" d="' + area + '"/>' +
    (glowOuterW ? '<path fill="none" stroke="rgba(69,255,124,.16)" stroke-width="' + glowOuterW + '" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + id + 'Outer)" d="' + path + '"/>' : '') +
    (glowInnerW ? '<path fill="none" stroke="rgba(78,255,132,.35)" stroke-width="' + glowInnerW + '" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + id + 'Inner)" d="' + path + '"/>' : '') +
    '<path class="terrain-stroke" fill="none" stroke="#4FE67B" stroke-width="' + lineW + '" stroke-linecap="round" stroke-linejoin="round" d="' + path + '"/>' +
    (coreW ? '<path fill="none" stroke="rgba(220,255,229,.88)" stroke-width="' + coreW + '" stroke-linecap="round" stroke-linejoin="round" d="' + path + '"/>' : '') +
  '</svg>';
}

// Icônes reprises des assets fournis (elev-label-*.svg) — mêmes tracés, recentrés sur (0,0) dans
// un petit viewBox pour être réutilisés en HTML. Un seul point de vérité pour le style des labels.
// `prio` : 1 = label principal (jamais masqué), 2 = label secondaire (masqué si collision
// irrésolvable, cas typique du point culminant sur petit écran).
const TERRAIN_LABEL_KINDS = {
  depart: { prio: 1, align: 'start',
    icon: '<circle cx="0" cy="0" r="5" fill="#0B0F0E" stroke="#BFFFD0" stroke-width="1.5"/><path d="M-2 3V-5l7 2.5-7 2.5" stroke="#BFFFD0" stroke-width="1.4" stroke-linejoin="round" fill="none"/>' },
  arrivee: { prio: 1, align: 'end',
    icon: '<path d="M-5-5h10v10h-10z" stroke="#D6FFE0" stroke-width="1.2" fill="none"/><path d="M-5-5h5v5h-5m5 0h5v5h-5m0 0h-5v-5h5m0 0v-5h5" stroke="#D6FFE0" stroke-width="1.1" fill="none"/>' },
  culminant: { prio: 2, align: 'center',
    icon: '<path d="m-8 5 7.5-12 3.3 5.1 2.1-2.8 4.1 9.7h-17Z" fill="#5BFF8D" fill-opacity=".18" stroke="#D6FFE0" stroke-width="1.5" stroke-linejoin="round"/><circle cx="-.5" cy="-7" r="1.8" fill="#E7F8EC"/>' },
  sommet: { prio: 2, align: 'center',
    icon: '<path d="m-8 5 7.5-12 3.3 5.1 2.1-2.8 4.1 9.7h-17Z" fill="#5BFF8D" fill-opacity=".18" stroke="#D6FFE0" stroke-width="1.5" stroke-linejoin="round"/>' },
  checkpoint: { prio: 2, align: 'center',
    icon: '<circle cx="0" cy="0" r="6" fill="none" stroke="#D6FFE0" stroke-width="1.4"/><circle cx="0" cy="0" r="2" fill="#D6FFE0"/>' },
  ravitaillement: { prio: 2, align: 'center',
    icon: '<circle cx="0" cy="0" r="6" fill="none" stroke="#D6FFE0" stroke-width="1.3"/><path d="M-2.5-2.5v5M0-3v6M2.5-2.5v5" stroke="#D6FFE0" stroke-width="1.2"/>' },
  objectif: { prio: 1, align: 'center',
    icon: '<circle cx="0" cy="0" r="7" fill="none" stroke="#D6FFE0" stroke-width="1.3"/><circle cx="0" cy="0" r="3.4" fill="none" stroke="#D6FFE0" stroke-width="1.1"/><circle cx="0" cy="0" r="1" fill="#E7F8EC"/>' },
};

/* Repères réels d'une série validée. Chaque label est ancré à un point RÉELLEMENT déterminé :
   premier point (départ), altitude maximale (point culminant), dernier point (arrivée). Aucun
   checkpoint/ravitaillement n'est inventé — ces types existent dans TERRAIN_LABEL_KINDS mais ne
   sont affichés que si un appelant fournit de vrais points nommés (aucune donnée de ce type
   aujourd'hui : les GPX testés ne contiennent pas de <wpt> exploitables). */
/* Deux repères occupent-ils « le même endroit » du point de vue du lecteur ? Vrai si les valeurs
   affichées seraient indiscernables : moins de 1,5 % de la distance totale d'écart (plancher 80 m,
   pour qu'une sortie très courte ne masque pas tout) ET moins de 3 m d'altitude d'écart. Les deux
   conditions sont requises : un vrai sommet situé près de l'arrivée mais nettement plus haut reste
   un repère légitime et continue d'être affiché. */
function _terrainSamePlace(a, b, v) {
  const distTol = Math.max(0.4, (v.totalKm || 0) * 0.05);
  return Math.abs(a.alt - b.alt) < 3 && Math.abs(a.distKm - b.distKm) < distTol;
}
function terrainDefaultLabels(v) {
  const first = v.points[0], last = v.points[v.points.length - 1], peak = v.points[v.peakIdx];
  const labels = [
    { idx: 0, kind: 'depart', title: 'Départ', alt: first.alt, distKm: first.distKm },
    { idx: v.points.length - 1, kind: 'arrivee', title: 'Arrivée', alt: last.alt, distKm: last.distKm },
  ];
  /* Le point culminant n'est un repère distinct que s'il ne se confond pas avec le départ ou
     l'arrivée. La proximité se mesure en DISTANCE RÉELLE et en ALTITUDE, jamais en écart d'index :
     une série FIT est échantillonnée dans le temps, donc « 2 points avant la fin » peut représenter
     quelques secondes et quelques mètres. C'est ce qui produisait deux labels aux valeurs
     stricement identiques (« 103 m · km 7,9 » en Point culminant ET en Arrivée), symptôme décrit
     au §10 du brief. Le point SVG réel n'est jamais déplacé : seul l'affichage du label est en jeu. */
  const nearStart = _terrainSamePlace(peak, first, v), nearEnd = _terrainSamePlace(peak, last, v);
  if (!nearStart && !nearEnd) {
    labels.push({ idx: v.peakIdx, kind: 'culminant', title: 'Point culminant', alt: peak.alt, distKm: peak.distKm });
  }
  return labels;
}

/* Bloc HTML complet du profil : fond atmosphérique (optionnel) + SVG du tracé + labels HTML +
   curseur/tooltip d'interaction. La géométrie est mémorisée dans `_terrainRegistry` et exploitée
   par `initTerrainProfiles()` — à appeler après insertion dans le DOM. */
const _terrainRegistry = new Map();
let _terrainInstanceId = 0;
function elevTerrainProfile(v, opts) {
  opts = opts || {};
  if (!v) return '';
  const h = opts.height || 220;
  const id = 'terrain' + (_terrainInstanceId++);
  const geom = _terrainGeometry(v, h);
  const labels = opts.labels || terrainDefaultLabels(v);
  _terrainRegistry.set(id, { v: v, geom: geom, height: h });

  // Fond atmosphérique : très sombre, purement décoratif, jamais aligné sur la silhouette réelle.
  let bgHtml = '';
  if (opts.backdrop !== false) {
    const variant = opts.backdrop || pickTerrainBackdrop(v);
    // `eagerBackdrop` pour un profil au-dessus de la ligne de flottaison (hero) : le fond ne doit
    // pas apparaître après coup. Les profils plus bas dans la page restent en chargement paresseux.
    const loading = opts.eagerBackdrop ? 'eager' : 'lazy';
    bgHtml = '<div class="terrain-profile-bg" aria-hidden="true">' +
      '<img src="assets/images/elev-profile-terrain-' + variant + '.webp" alt="" loading="' + loading + '" decoding="async">' +
      '<span class="terrain-profile-bg-mask"></span>' +
    '</div>';
  }

  const labelsHtml = labels.map(function (l) {
    const def = TERRAIN_LABEL_KINDS[l.kind];
    if (!def || geom[l.idx] == null) return '';
    const g = geom[l.idx];
    // Décimale seulement quand elle apporte quelque chose : "km 0" et "km 23", pas "km 0.0".
    const vals = [
      l.alt != null ? Math.round(l.alt) + ' m' : null,
      l.distKm != null ? 'km ' + fmtNum(l.distKm, '', (l.distKm === 0 || l.distKm >= 10) ? 0 : 1) : null,
    ].filter(Boolean).join(' · ');
    return '<div class="terrain-label terrain-label--' + l.kind + '" data-xf="' + g.xf.toFixed(5) + '" data-yf="' + g.yf.toFixed(5) + '"' +
        ' data-prio="' + def.prio + '" data-align="' + def.align + '">' +
      '<span class="tl-icon" aria-hidden="true"><svg viewBox="-10 -10 20 20">' + def.icon + '</svg></span>' +
      '<span class="tl-body"><strong>' + escapeHtml(l.title) + '</strong>' +
        (vals ? '<span class="tl-vals">' + escapeHtml(vals) + '</span>' : '') + '</span>' +
    '</div>';
  }).join('');

  // tabindex/role : le profil est explorable au clavier (flèches) comme au pointeur/toucher.
  return '<div class="terrain-profile' + (opts.className ? ' ' + opts.className : '') + '" data-terrain="' + id + '"' +
      ' style="--tp-ratio:' + (h / TERRAIN_VB_W).toFixed(4) + '"' +
      ' tabindex="0" role="img" aria-label="' + escapeHtml(elevTerrainDescription(v)) + '">' +
    bgHtml +
    elevTerrainLineSvg(v, { height: h, variant: opts.variant || 'hero', geom: geom, contour: opts.contour }) +
    '<svg class="terrain-stems" aria-hidden="true" focusable="false"></svg>' +
    '<div class="terrain-labels">' + labelsHtml + '</div>' +
    '<div class="terrain-cursor" aria-hidden="true" hidden><span class="tc-line"></span><span class="tc-dot"></span></div>' +
    '<div class="terrain-tip" aria-hidden="true" hidden></div>' +
    '<p class="visually-hidden terrain-live" role="status" aria-live="polite"></p>' +
  '</div>';
}

/* Description accessible du profil : les couches visuelles (halo, labels) sont décoratives, cette
   phrase porte l'information réelle pour les lecteurs d'écran (et sert d'aria-label au conteneur). */
function elevTerrainDescription(v) {
  if (!v) return '';
  return 'Profil altimétrique réel : ' + [
    fmtNum(v.totalKm, ' km', 1),
    'D+ ' + v.gain + ' m',
    'D- ' + v.loss + ' m',
    'altitude ' + Math.round(v.minAlt) + ' à ' + Math.round(v.maxAlt) + ' m',
  ].join(', ') + '.';
}

/* --------------------------- PLACEMENT DES LABELS + INTERACTION ---------------------------
   Placement anti-collision RÉEL : les labels sont mesurés dans le DOM (largeur/hauteur réelles,
   qui dépendent du texte et de la taille d'écran), puis placés par priorité en essayant plusieurs
   registres verticaux au-dessus du point, puis en dessous. Un label secondaire qui ne trouve
   aucune place libre est masqué plutôt que superposé à un autre. Chaque label garde un connecteur
   tracé jusqu'à son point réel, donc son ancrage reste lisible même déporté. */
const TERRAIN_LABEL_GAP = 14;      // distance minimale label <-> point ancré
const TERRAIN_LABEL_PAD = 8;       // marge de non-chevauchement entre deux labels
function _terrainLayoutLabels(wrap) {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const stems = wrap.querySelector('.terrain-stems');
  const labels = Array.prototype.slice.call(wrap.querySelectorAll('.terrain-label'));
  if (!W || !H || !labels.length) return;

  // Mesure : on rend mesurable sans afficher (visibility) pour obtenir des dimensions réelles.
  labels.forEach(function (el) { el.style.visibility = 'hidden'; el.classList.remove('is-hidden'); });
  const items = labels.map(function (el) {
    return {
      el: el,
      ax: (+el.dataset.xf) * W,
      ay: (+el.dataset.yf) * H,
      w: el.offsetWidth, h: el.offsetHeight,
      prio: +el.dataset.prio || 1,
      align: el.dataset.align || 'center',
    };
    // Un label rendu inopérant par le CSS (display:none) mesure 0×0 : on l'écarte plutôt que de
    // lui réserver une place fantôme et de lui tracer un connecteur sans label au bout.
  }).filter(function (it) {
    if (it.w > 0 && it.h > 0) return true;
    it.el.style.visibility = '';
    return false;
  });
  if (!items.length) { if (stems) stems.innerHTML = ''; return; }
  // Les labels principaux (départ/arrivée) sont placés d'abord : ce sont eux qui gardent leur
  // position naturelle, un label secondaire cède la place.
  const order = items.slice().sort(function (a, b) { return a.prio - b.prio || a.ax - b.ax; });

  const placed = [];
  function hits(r) {
    return placed.some(function (p) {
      return !(r.x + r.w + TERRAIN_LABEL_PAD < p.x || p.x + p.w + TERRAIN_LABEL_PAD < r.x ||
               r.y + r.h + TERRAIN_LABEL_PAD < p.y || p.y + p.h + TERRAIN_LABEL_PAD < r.y);
    });
  }
  order.forEach(function (it) {
    // X : le départ s'aligne à gauche de son point, l'arrivée à droite, le reste est centré —
    // c'est ce qui pousse naturellement DÉPART vers le bord gauche et ARRIVÉE vers le bord droit.
    let x = it.align === 'start' ? it.ax - 6 : it.align === 'end' ? it.ax - it.w + 6 : it.ax - it.w / 2;
    x = Math.max(2, Math.min(W - it.w - 2, x));
    // Registres candidats : au-dessus (de plus en plus haut), puis en dessous du point.
    const candidates = [];
    for (let tier = 0; tier < 3; tier++) candidates.push(it.ay - TERRAIN_LABEL_GAP - it.h - tier * (it.h + TERRAIN_LABEL_PAD));
    candidates.push(it.ay + TERRAIN_LABEL_GAP);
    candidates.push(it.ay + TERRAIN_LABEL_GAP + it.h + TERRAIN_LABEL_PAD);
    let chosen = null;
    for (let ci = 0; ci < candidates.length; ci++) {
      const y = candidates[ci];
      if (y < 2 || y + it.h > H - 2) continue;           // hors du cadre du profil
      if (!hits({ x: x, y: y, w: it.w, h: it.h })) { chosen = y; break; }
    }
    if (chosen == null) {
      // Aucun registre libre : un label secondaire disparaît (jamais deux labels fusionnés dans
      // la même surface), un label principal est forcé au registre le plus haut tenable.
      if (it.prio >= 2) { it.el.classList.add('is-hidden'); it.el.style.visibility = ''; it.hidden = true; return; }
      chosen = Math.max(2, Math.min(H - it.h - 2, it.ay - TERRAIN_LABEL_GAP - it.h));
    }
    it.el.style.left = x.toFixed(1) + 'px';
    it.el.style.top = chosen.toFixed(1) + 'px';
    it.el.style.visibility = '';
    it.x = x; it.y = chosen;
    placed.push({ x: x, y: chosen, w: it.w, h: it.h });
  });

  // Connecteurs : du bord du label jusqu'au point réel sur la courbe (+ pastille sur le point).
  if (stems) {
    stems.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    stems.setAttribute('width', W); stems.setAttribute('height', H);
    stems.innerHTML = items.filter(function (it) { return !it.hidden; }).map(function (it) {
      const cx = Math.max(it.x + 10, Math.min(it.x + it.w - 10, it.ax));
      const cy = it.y > it.ay ? it.y : it.y + it.h;      // bord du label le plus proche du point
      return '<line x1="' + cx.toFixed(1) + '" y1="' + cy.toFixed(1) + '" x2="' + it.ax.toFixed(1) + '" y2="' + it.ay.toFixed(1) + '" stroke="#5BFF8D" stroke-opacity=".5" stroke-width="1"/>' +
        '<circle cx="' + it.ax.toFixed(1) + '" cy="' + it.ay.toFixed(1) + '" r="2.8" fill="#D6FFE0"/>';
    }).join('');
  }
}

/* Interaction : survol / toucher / clavier lisent le point réel le plus proche sur la courbe et
   affichent distance + altitude (+ allure/FC/cadence uniquement si ces champs existent vraiment
   dans la série — un GPX d'objectif n'en a pas). Le tooltip est épinglé en bas du profil : il ne
   peut donc jamais recouvrir les labels, qui vivent au-dessus de la courbe. */
function _terrainNearestIndex(geom, xf) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < geom.length; i++) {
    const d = Math.abs(geom[i].xf - xf);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
function _terrainInitInteraction(wrap) {
  const reg = _terrainRegistry.get(wrap.dataset.terrain);
  if (!reg) return;
  const cursor = wrap.querySelector('.terrain-cursor');
  const dot = wrap.querySelector('.tc-dot');
  const tip = wrap.querySelector('.terrain-tip');
  const live = wrap.querySelector('.terrain-live');
  if (!cursor || !tip) return;
  let idx = null;

  function textFor(p) {
    const parts = ['km ' + fmtNum(p.distKm, '', p.distKm >= 10 ? 1 : 2), Math.round(p.alt) + ' m'];
    if (p.paceSecKm != null) parts.push(fmtPace(p.paceSecKm));
    if (p.hr != null) parts.push(p.hr + ' bpm');
    if (p.cadenceSpm != null) parts.push(p.cadenceSpm + ' ppm');
    return parts;
  }
  function show(i) {
    if (i == null || !reg.geom[i]) return;
    idx = i;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const g = reg.geom[i], p = reg.v.points[i];
    const x = g.xf * W, y = g.yf * H;
    cursor.hidden = false;
    cursor.style.left = x.toFixed(1) + 'px';
    if (dot) dot.style.top = y.toFixed(1) + 'px';       // la pastille suit la VRAIE courbe
    const parts = textFor(p);
    tip.hidden = false;
    tip.innerHTML = '<strong>' + escapeHtml(parts[0]) + '</strong>' +
      parts.slice(1).map(function (s) { return '<span>' + escapeHtml(s) + '</span>'; }).join('');
    // Maintenu dans les limites du profil (jamais un tooltip qui sort du viewport).
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(W - tw - 4, x - tw / 2)).toFixed(1) + 'px';
    if (live) live.textContent = parts.join(', ');
  }
  function hide() {
    idx = null; cursor.hidden = true; tip.hidden = true;
    if (live) live.textContent = '';
  }
  function fromClientX(clientX) {
    const r = wrap.getBoundingClientRect();
    if (!r.width) return;
    show(_terrainNearestIndex(reg.geom, (clientX - r.left) / r.width));
  }
  wrap.addEventListener('pointermove', function (e) { fromClientX(e.clientX); });
  wrap.addEventListener('pointerdown', function (e) { fromClientX(e.clientX); });   // tap simple au toucher
  wrap.addEventListener('pointerleave', hide);
  wrap.addEventListener('blur', hide);
  wrap.addEventListener('keydown', function (e) {
    const n = reg.geom.length, step = Math.max(1, Math.round(n / 40));
    let next = null;
    if (e.key === 'ArrowRight') next = Math.min(n - 1, (idx == null ? -1 : idx) + step);
    else if (e.key === 'ArrowLeft') next = Math.max(0, (idx == null ? n : idx) - step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') { hide(); return; }
    else return;
    e.preventDefault();
    show(next);
  });
}

/* Initialise tous les profils présents dans le DOM (placement des labels + interaction) et
   replace les labels au redimensionnement — leur taille dépend du texte ET de la largeur d'écran,
   un placement calculé une seule fois se retrouverait faux après rotation/redimensionnement.
   Idempotent : un profil déjà initialisé n'est pas re-câblé (utile quand une page re-rend une
   partie de son contenu). */
function initTerrainProfiles(root) {
  const wraps = (root || document).querySelectorAll('.terrain-profile[data-terrain]');
  wraps.forEach(function (wrap) {
    if (!wrap.dataset.terrainReady) {
      wrap.dataset.terrainReady = '1';
      _terrainInitInteraction(wrap);
    }
    _terrainLayoutLabels(wrap);
    // La largeur/hauteur peut encore bouger (chargement de la photo de fond, polices) : on
    // repasse une fois la mise en page stabilisée, comme pour les fonds full-bleed.
    requestAnimationFrame(function () { _terrainLayoutLabels(wrap); });
    setTimeout(function () { _terrainLayoutLabels(wrap); }, 250);
  });
  if (!initTerrainProfiles._resizeBound) {
    initTerrainProfiles._resizeBound = true;
    let ticking = false;
    const relayoutAll = function () {
      document.querySelectorAll('.terrain-profile[data-terrain]').forEach(_terrainLayoutLabels);
      ticking = false;
    };
    window.addEventListener('resize', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(relayoutAll);
    }, { passive: true });
    // Filet de sécurité : `requestAnimationFrame` ne s'exécute PAS tant que la page est masquée
    // (onglet en arrière-plan, fenêtre réduite). Un redimensionnement survenu pendant ce temps
    // laisserait donc les labels à leur position d'avant. On les replace au retour de visibilité.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { ticking = false; relayoutAll(); }
    });
  }
}

/* --------------------------- ELEV TERRAIN BACKDROP (Home WOW Pass) ---------------------------
   Environnement visuel du hero de l'Accueil : ciel dégradé + 3 chaînes de montagnes en silhouette
   (profondeur/matière) + 2 arcs topographiques très discrets. Entièrement décoratif (aria-hidden),
   PAS de photographie — choix délibéré (voir CLAUDE.md/rapport de session) : impossible de garantir
   les droits d'usage d'une image trouvée en ligne, et une dépendance distante fragile/lourde va à
   l'encontre des contraintes de performance et de simplicité du projet. Les silhouettes sont
   générées par un générateur pseudo-aléatoire à seed fixe (déterministe : même rendu à chaque
   chargement, jamais un relief "vivant" qui pourrait se confondre avec une vraie donnée). La vraie
   Terrain Line (altitude réelle, voir elevTerrainLineSvg) reste une couche distincte au-dessus,
   volontairement plus nette (trait plus contrasté) pour qu'on ne confonde jamais matière et donnée. */
function _elevRidgePath(seed, w, baseline, amp, segments) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1103515245 + 12345) >>> 0; return (s % 10000) / 10000; };
  const step = w / segments;
  let d = 'M0,' + baseline.toFixed(1);
  let prevX = 0, prevY = baseline;
  for (let i = 1; i <= segments; i++) {
    const x = i * step;
    const y = baseline - rand() * amp;
    const cx = (prevX + x) / 2;
    d += ' Q' + cx.toFixed(1) + ',' + prevY.toFixed(1) + ' ' + x.toFixed(1) + ',' + y.toFixed(1);
    prevX = x; prevY = y;
  }
  return d;
}
let _terrainBackdropId = 0;
// `opts.contourOnly` (Home Final WOW Pass) : quand une vraie photo de montagne sert de fond
// (voir index.html, .tb-photo), les silhouettes de montagnes SVG deviendraient un doublon visuel
// avec le relief réel de la photo — seules la teinte de ciel et les 2 arcs topographiques
// (cartographie, transition photo → terrain → donnée) restent. Sans photo (fallback), le rendu
// complet avec les 3 chaînes de montagnes est conservé.
function elevMountainBackdropSvg(opts) {
  opts = opts || {};
  const id = 'tb' + (_terrainBackdropId++);
  const w = 1200, h = 480;
  const sky = '<rect x="0" y="0" width="' + w + '" height="' + (h * 0.65) + '" fill="url(#' + id + 'Sky)"/>' +
    '<path class="tb-contour" d="M0,110 Q300,80 600,120 T' + w + ',100" fill="none" stroke="var(--text)" stroke-width="1" stroke-dasharray="2,7" opacity="0.1"/>' +
    '<path class="tb-contour" d="M0,165 Q300,132 600,172 T' + w + ',150" fill="none" stroke="var(--text)" stroke-width="1" stroke-dasharray="2,7" opacity="0.1"/>';
  let ridges = '';
  if (!opts.contourOnly) {
    const back = _elevRidgePath(7, w, 200, 65, 7);
    const mid = _elevRidgePath(23, w, 288, 105, 6);
    const front = _elevRidgePath(41, w, 392, 132, 5);
    ridges =
      '<path class="tb-ridge tb-ridge-back" d="' + back + ' L' + w + ',' + h + ' L0,' + h + ' Z" fill="var(--accent)" opacity="0.09"/>' +
      '<path class="tb-ridge tb-ridge-mid" d="' + mid + ' L' + w + ',' + h + ' L0,' + h + ' Z" fill="var(--accent)" opacity="0.15"/>' +
      '<path class="tb-ridge tb-ridge-front" d="' + front + ' L' + w + ',' + h + ' L0,' + h + ' Z" fill="url(#' + id + 'Front)"/>';
  }
  return '<svg class="terrain-backdrop-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">' +
    '<defs>' +
      '<linearGradient id="' + id + 'Sky" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--accent)" stop-opacity="' + (opts.contourOnly ? '0.06' : '0.18') + '"/>' +
        '<stop offset="45%" stop-color="var(--accent)" stop-opacity="0.02"/>' +
        '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + id + 'Front" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.32"/>' +
        '<stop offset="100%" stop-color="var(--bg)" stop-opacity="1"/>' +
      '</linearGradient>' +
    '</defs>' +
    sky + ridges +
  '</svg>';
}

/* Transition "MOUNTAIN → TERRAIN → DATA" au scroll (Home WOW Pass) : le backdrop s'estompe et
   remonte très légèrement tandis qu'on quitte le premier viewport — jamais de scroll détourné
   (aucune interception de la molette/du geste, juste une opacité/transform dérivée de la position
   de scroll), coût quasi nul (2 propriétés, throttlé par requestAnimationFrame). Inactif sous
   prefers-reduced-motion : le backdrop reste alors visible et statique. */
function initHeroTerrainTransition() {
  const backdrop = document.querySelector('.terrain-backdrop');
  if (!backdrop || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const range = 560;
  let ticking = false;
  function apply() {
    const p = Math.max(0, Math.min(1, window.scrollY / range));
    backdrop.style.opacity = String(1 - p * 0.85);
    backdrop.style.transform = 'translateY(' + (p * 40).toFixed(1) + 'px)';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });
  apply();
}

/* --------------------------- IMPORT GPX (objectifs) ---------------------------
   Parse un fichier GPX (trkpt lat/lon/ele) pour préremplir la distance/D+ d'un objectif ET
   conserver le vrai profil distance→altitude (jamais transformé en image — les points restent
   des données, régénérables en SVG/carte à tout moment). Distance cumulée calculée par haversine
   (mètres), jamais par simple index — un GPX a des points inégalement espacés. Le fichier peut
   contenir plusieurs milliers de points : simplifié à ~300 points par échantillonnage régulier en
   DISTANCE (pas en index) pour rester léger côté stockage/rendu tout en préservant sommets/creux
   significatifs à cette résolution. */
function _haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function parseGpxText(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) return null;
  const trkpts = Array.from(xml.querySelectorAll('trkpt'));
  if (trkpts.length < 2) return null;
  const raw = trkpts.map(pt => {
    const lat = parseFloat(pt.getAttribute('lat')), lon = parseFloat(pt.getAttribute('lon'));
    const eleEl = pt.querySelector('ele');
    const alt = eleEl ? parseFloat(eleEl.textContent) : null;
    return { lat, lon, alt };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.alt));
  if (raw.length < 2) return null;

  let distM = 0;
  const withDist = raw.map((p, i) => {
    if (i > 0) distM += _haversineM(raw[i-1].lat, raw[i-1].lon, p.lat, p.lon);
    return { distKm: distM / 1000, alt: p.alt, lat: p.lat, lon: p.lon };
  });

  // Échantillonnage régulier en distance (~300 points cible) — préserve la silhouette réelle.
  const totalKm = withDist[withDist.length - 1].distKm;
  const targetPoints = 300;
  const stepKm = totalKm / targetPoints;
  const points = [];
  let nextD = 0, wi = 0;
  for (let i = 0; i < withDist.length; i++) {
    if (withDist[i].distKm >= nextD || i === withDist.length - 1) {
      points.push(withDist[i]);
      nextD += stepKm;
    }
  }
  if (points[points.length - 1] !== withDist[withDist.length - 1]) points.push(withDist[withDist.length - 1]);

  // D+/D- calculés sur l'altitude LISSÉE (moyenne mobile) avant sommation des deltas — sur
  // altitude brute, le bruit GPS/baro (quelques mètres d'écart point à point, avec ~1700 points)
  // s'accumule et gonfle artificiellement le dénivelé total (mesuré : 5011 m calculé en brut sur
  // ce fichier réel contre ~3500 m officiellement documentés pour cette course). Même logique que
  // le lissage du tracé affiché (_smoothAltitudes) — la donnée de distance/altitude par point
  // n'est elle-même jamais modifiée, seul le calcul de gain/perte l'utilise lissée.
  const smoothedForGainLoss = _smoothAltitudes(withDist.map(p => p.alt), 9);
  let gain = 0, loss = 0;
  for (let i = 1; i < smoothedForGainLoss.length; i++) {
    const d = smoothedForGainLoss[i] - smoothedForGainLoss[i-1];
    if (d > 0) gain += d; else loss += -d;
  }
  const alts = withDist.map(p => p.alt);
  const lats = withDist.map(p => p.lat), lons = withDist.map(p => p.lon);
  // `bounds` : emprise géographique du tracé (utile pour cadrer une carte plus tard). Conservée
  // ici parce qu'elle se déduit du fichier sans calcul supplémentaire — elle n'est pas affichée
  // aujourd'hui, aucune carte d'objectif n'existe encore.
  return {
    points: points.map(p => ({ distKm: +p.distKm.toFixed(3), alt: Math.round(p.alt), lat: p.lat, lon: p.lon })),
    distanceKm: +totalKm.toFixed(2),
    denivele: Math.round(gain),
    deniveleNeg: Math.round(loss),
    altMin: Math.round(Math.min(...alts)),
    altMax: Math.round(Math.max(...alts)),
    pointCount: points.length,
    sourcePointCount: raw.length,
    bounds: {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLon: Math.min(...lons), maxLon: Math.max(...lons),
    },
  };
}

/* --------------------------- FULL-BLEED (Home Terrain Experience) ---------------------------
   `<main>` reste centré avec une largeur max (`max-width:1360px;margin:0 auto`) sur toutes les
   pages — comportement volontairement inchangé partout ailleurs. Sur l'Accueil, les 3 grandes
   scènes signatures (Performance Pulse / Training Landscape / Target Summit) doivent au contraire
   occuper TOUTE la zone disponible après la sidebar : non seulement leur photo de fond, mais aussi
   leur composition interne (métriques, profil altimétrique, labels) — c'était le principal reproche
   de la passe précédente, où seule l'image débordait et le contenu restait dans un container centré.

   Un calcul CSS pur (`calc(50vw - 50%)`) se trompe ici car `<main>` n'est pas centré dans TOUT le
   viewport (la sidebar occupe déjà 220px à gauche). On mesure donc réellement `.app-main` (qui
   occupe exactement l'espace entre la sidebar et le bord droit du viewport) ainsi que la boîte de
   contenu de `<main>`, et on expose l'écart sous forme de deux variables CSS posées sur `<main>` :
     --bleed-l / --bleed-r
   Le CSS s'en sert ensuite en marges négatives (voir `.rail-stop`, assets/style.css), ce qui rend
   l'effet robuste au re-rendu : les variables vivent sur `<main>`, qui n'est jamais reconstruit,
   au lieu d'être des styles inline posés sur des éléments régénérés à chaque `renderAll()`
   (bug réel de la version précédente : le fond de Target Summit se retrouvait à width:0 après
   re-rendu, parce que les styles inline calculés en JS avaient été effacés avec l'innerHTML).

   Valeur de repli CSS = le padding horizontal de `<main>` : correcte tant que la largeur max de
   `<main>` n'est pas atteinte (la grande majorité des écrans). Le JS ne fait que l'affiner au-delà. */
function initHomeBleed() {
  const appMain = document.querySelector('.app-main');
  const mainEl = document.querySelector('main');
  if (!appMain || !mainEl) return;
  let ticking = false;
  function apply() {
    const outer = appMain.getBoundingClientRect();
    const inner = mainEl.getBoundingClientRect();
    if (!outer.width || !inner.width) return; // mise en page pas encore stable, un rappel réessaiera
    const cs = getComputedStyle(mainEl);
    const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    const contentL = inner.left + padL, contentR = inner.right - padR;
    mainEl.style.setProperty('--bleed-l', Math.max(0, contentL - outer.left).toFixed(2) + 'px');
    mainEl.style.setProperty('--bleed-r', Math.max(0, outer.right - contentR).toFixed(2) + 'px');
    ticking = false;
  }
  // Premier calcul potentiellement trop tôt (avant le premier paint / chargement des images) : on
  // le répète volontairement via rAF + un court délai, en plus du calcul immédiat — coût
  // négligeable (quelques lectures de layout), robustesse réelle.
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 200);
  window.addEventListener('resize', function () {
    if (!ticking) { requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });
}

/* --------------------------- RÉVÉLATION AU SCROLL (Phase 2, contrôlée) ---------------------------
   Adapte le principe "scroll reveal" identifié via ui-ux-pro-max (domaine gsap : fade + léger
   déplacement vertical au passage dans le viewport) sans dépendance externe (pas de GSAP/Framer) —
   IntersectionObserver natif, un seul déclenchement par élément, jamais de scroll détourné ni de
   pinning. Sous prefers-reduced-motion, tout est affiché immédiatement (voir CSS `.reveal-on-scroll`).
   Appelée une fois par page depuis le script de chaque page concernée. */
function initScrollReveal(selector) {
  const els = document.querySelectorAll(selector || '.reveal-on-scroll');
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}

/* --------------------------- GRAPHIQUE SIGNATURE ELEV (Altitude / Allure / FC) ---------------------------
   Un seul rendu partagé par les 3 courbes de séance, pour qu'elles appartiennent visuellement à la
   même famille : ligne continue, remplissage léger en dégradé, axes discrets, un seul curseur au
   survol (jamais de forêt de points fixes — un survol lit tous les champs disponibles du point le
   plus proche, pas seulement le signal de CE graphique). `key` sélectionne le signal principal
   (alt/paceSecKm/hr...) ; `invertY` inverse l'axe (utilisé pour l'allure : plus rapide = plus haut) ;
   `backgroundKey` affiche un signal secondaire en silhouette très légère (ex. altitude derrière FC). */
let _elevChartId = 0;
function elevChartSvg(points, opts) {
  opts = opts || {};
  const id = 'elevChart' + (_elevChartId++);
  const key = opts.key;
  const w = 1000, h = opts.height || 220, padL = 46, padR = 14, padT = 14, padB = 26;
  const xs = points.map(p => p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const spanX = (maxX - minX) || 1;
  const yVals = points.map(p => p[key]).filter(v => v != null);
  if (yVals.length < 2) return '';
  let minY = opts.yMin ?? Math.min(...yVals), maxY = opts.yMax ?? Math.max(...yVals);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const spanY = (maxY - minY) || 1;
  const sx = x => padL + (x - minX) / spanX * (w - padL - padR);
  // Clampé au domaine [minY,maxY] : si l'échelle est resserrée (percentile robuste, voir Allure),
  // un point ponctuel hors domaine s'aplatit proprement au bord plutôt que de sortir du cadre.
  const sy = y => {
    const yc = Math.min(maxY, Math.max(minY, y));
    return opts.invertY
      ? padT + (yc - minY) / spanY * (h - padT - padB)
      : (h - padB) - (yc - minY) / spanY * (h - padT - padB);
  };

  // Découpe en segments continus : jamais de faux raccord au-dessus d'une valeur manquante
  // (ex. pause sans allure exploitable) — un vrai vide dans la courbe plutôt qu'une donnée inventée.
  const runsFor = k => {
    const runs = []; let cur = [];
    points.forEach(p => { if (p[k] == null) { if (cur.length) runs.push(cur); cur = []; } else cur.push(p); });
    if (cur.length) runs.push(cur);
    return runs;
  };
  const pathFor = (runs, yOf) => runs.filter(r => r.length >= 2).map(run =>
    run.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p.x).toFixed(1) + ',' + yOf(p).toFixed(1)).join(' ')
  ).join(' ');
  const areaFor = (runs, yOf) => runs.filter(r => r.length >= 2).map(run => {
    const line = run.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p.x).toFixed(1) + ',' + yOf(p).toFixed(1)).join(' ');
    return line + ' L' + sx(run[run.length - 1].x).toFixed(1) + ',' + (h - padB) + ' L' + sx(run[0].x).toFixed(1) + ',' + (h - padB) + ' Z';
  }).join(' ');

  const runs = runsFor(key);
  const path = pathFor(runs, p => sy(p[key]));
  const areaPath = areaFor(runs, p => sy(p[key]));

  let backgroundSvg = '';
  if (opts.backgroundKey) {
    const bgVals = points.map(p => p[opts.backgroundKey]).filter(v => v != null);
    if (bgVals.length >= 2) {
      const bgMin = Math.min(...bgVals), bgMax = Math.max(...bgVals), bgSpan = (bgMax - bgMin) || 1;
      const bgSy = y => (h - padB) - (y - bgMin) / bgSpan * (h - padT - padB);
      const bgArea = areaFor(runsFor(opts.backgroundKey), p => bgSy(p[opts.backgroundKey]));
      backgroundSvg = '<path d="' + bgArea + '" fill="var(--muted-2)" opacity="0.16" stroke="none"/>';
    }
  }

  // Signature "relief" (profil altimétrique uniquement, opts.terrain) — évoque la montagne sans
  // être une illustration : lignes de niveau discrètes façon carte topographique, une silhouette
  // "à l'arrière" plus compressée pour donner de la profondeur (comme des chaînes de montagnes qui
  // s'estompent), et un repère sur le point culminant. Aucun changement pour Allure/FC (opts.terrain
  // absent) — même rendu qu'avant.
  let terrainBackSvg = '', contourSvg = '', peakSvg = '';
  if (opts.terrain) {
    const backSy = y => sy(minY + (y - minY) * 0.5);
    terrainBackSvg = '<path d="' + areaFor(runs, p => backSy(p[key])) + '" fill="var(--accent)" opacity="0.07" stroke="none" transform="translate(0,-6)"/>';
    contourSvg = [0.25, 0.5, 0.75].map(f => {
      const cy = (padT + (h - padB - padT) * f).toFixed(1);
      return '<line x1="' + padL + '" y1="' + cy + '" x2="' + (w - padR) + '" y2="' + cy + '" stroke="var(--border)" stroke-dasharray="2,4" opacity="0.6"/>';
    }).join('');
    const peak = points.reduce((best, p) => (p[key] != null && (!best || p[key] > best[key])) ? p : best, null);
    if (peak) {
      const px = sx(peak.x).toFixed(1), py = sy(peak[key]).toFixed(1);
      peakSvg = '<circle cx="' + px + '" cy="' + py + '" r="3.5" fill="var(--accent-light)" stroke="var(--panel)" stroke-width="1.5"/>' +
        '<text x="' + px + '" y="' + (Number(py) - 9) + '" font-size="12" fill="var(--accent-light)" text-anchor="middle" font-weight="600">' + Math.round(peak[key]) + ' m</text>';
    }
  }

  const fmtY = v => opts.yFormat ? opts.yFormat(v) : Math.round(v);
  const yTopLabel = opts.invertY ? fmtY(minY) : fmtY(maxY);
  const yBottomLabel = opts.invertY ? fmtY(maxY) : fmtY(minY);

  return '<div class="elev-chart-wrap" id="' + id + '" ' +
    'data-key="' + key + '" data-min-x="' + minX + '" data-max-x="' + maxX + '" data-padl="' + padL + '" data-padr="' + padR + '" data-w="' + w + '" ' +
    'data-min-y="' + minY + '" data-max-y="' + maxY + '" data-h="' + h + '" data-padt="' + padT + '" data-padb="' + padB + '" data-invert="' + (opts.invertY ? '1' : '0') + '">' +
    (opts.axisHint ? '<div class="elev-chart-hint">' + escapeHtml(opts.axisHint) + '</div>' : '') +
    '<svg viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="' + id + 'Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--chart-fill-top)"/><stop offset="100%" stop-color="var(--chart-fill-bottom)"/></linearGradient></defs>' +
      contourSvg +
      backgroundSvg +
      terrainBackSvg +
      '<path d="' + areaPath + '" fill="url(#' + id + 'Fill)" stroke="none"/>' +
      '<line x1="' + padL + '" y1="' + (h - padB) + '" x2="' + (w - padR) + '" y2="' + (h - padB) + '" stroke="var(--border)"/>' +
      '<text x="4" y="' + (padT + 10) + '" class="c-axis">' + yTopLabel + '</text>' +
      '<text x="4" y="' + (h - padB + 2) + '" class="c-axis">' + yBottomLabel + '</text>' +
      '<text x="' + padL + '" y="' + (h - 8) + '" class="c-axis">' + minX.toFixed(1) + ' km</text>' +
      '<text x="' + (w - padR - 50) + '" y="' + (h - 8) + '" class="c-axis">' + maxX.toFixed(1) + ' km</text>' +
      '<path d="' + path + '" fill="none" stroke="var(--chart-line)" stroke-width="2.5"/>' +
      peakSvg +
      '<line class="sync-cursor" x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (h - padB) + '" stroke="var(--text)" stroke-dasharray="3,3" opacity="0"/>' +
      '<circle class="sync-dot" r="5" fill="var(--accent)" stroke="var(--panel)" stroke-width="1.5" opacity="0"/>' +
    '</svg>' +
    '<div class="sync-tooltip" data-tooltip-for="' + id + '" style="display:none;"></div>' +
  '</div>';
}

// Contenu du tooltip commun aux 3 graphiques signature : n'affiche que les champs réellement
// disponibles sur le point survolé, quel que soit le graphique à l'origine du survol.
function elevChartTooltipText(p) {
  // Point marqué comme pause (voir renderAllureTab) : jamais de valeur d'allure fabriquée pendant
  // un arrêt, on l'indique explicitement à la place.
  if (p.isPause) {
    const parts = ['Pause', p.distKm != null ? p.distKm.toFixed(2) + ' km' : null];
    if (p.pauseDurationS) parts.push('durée ' + fmtDuration(p.pauseDurationS));
    return parts.filter(Boolean).join(' · ');
  }
  const parts = [];
  if (p.distKm != null) parts.push(p.distKm.toFixed(2) + ' km');
  if (p.alt != null) parts.push(Math.round(p.alt) + ' m');
  if (p.paceSecKm != null) parts.push(fmtPace(p.paceSecKm));
  if (p.hr != null) parts.push(p.hr + ' bpm');
  if (p.cadenceSpm != null) parts.push(p.cadenceSpm + ' spm');
  if (p.power != null) parts.push(p.power + ' W');
  return parts.join(' · ');
}

// Percentile linéaire sur un tableau trié croissant (méthode standard, interpolation entre les
// deux valeurs encadrantes) — utilisé pour une échelle robuste (voir renderAllureTab).
function percentileOf(sortedVals, p) {
  if (!sortedVals.length) return null;
  const idx = (sortedVals.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedVals[lo];
  return sortedVals[lo] + (sortedVals[hi] - sortedVals[lo]) * (idx - lo);
}

// Câble le survol (souris + tactile) d'un graphique produit par elevChartSvg. `onMove(point)` est
// appelé à chaque déplacement (utilisé côté page pour synchroniser le repère sur la carte GPS).
function initElevChart(wrapper, points, onMove) {
  if (!wrapper) return;
  const key = wrapper.dataset.key;
  const minX = parseFloat(wrapper.dataset.minX), maxX = parseFloat(wrapper.dataset.maxX);
  const padL = parseFloat(wrapper.dataset.padl), padR = parseFloat(wrapper.dataset.padr), w = parseFloat(wrapper.dataset.w);
  const minY = parseFloat(wrapper.dataset.minY), maxY = parseFloat(wrapper.dataset.maxY);
  const h = parseFloat(wrapper.dataset.h), padT = parseFloat(wrapper.dataset.padt), padB = parseFloat(wrapper.dataset.padb);
  const invert = wrapper.dataset.invert === '1';
  const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
  const svg = wrapper.querySelector('svg');
  const cursor = svg.querySelector('.sync-cursor'), dot = svg.querySelector('.sync-dot');
  const tooltip = wrapper.querySelector('.sync-tooltip');

  function nearestIndex(distKm) {
    let best = 0, bestDiff = Infinity;
    points.forEach((p, i) => { if (p.x == null) return; const diff = Math.abs(p.x - distKm); if (diff < bestDiff) { bestDiff = diff; best = i; } });
    return best;
  }
  function updateAt(clientX) {
    const rect = wrapper.getBoundingClientRect();
    if (!rect.width) return;
    const scale = w / rect.width;
    let xVb = (clientX - rect.left) * scale;
    xVb = Math.max(padL, Math.min(w - padR, xVb));
    const distKm = minX + (xVb - padL) / (w - padL - padR) * spanX;
    const p = points[nearestIndex(distKm)];
    cursor.setAttribute('x1', xVb.toFixed(1)); cursor.setAttribute('x2', xVb.toFixed(1)); cursor.setAttribute('opacity', '1');
    if (p[key] != null) {
      const syVal = invert ? padT + (p[key] - minY) / spanY * (h - padT - padB) : (h - padB) - (p[key] - minY) / spanY * (h - padT - padB);
      dot.setAttribute('cx', xVb.toFixed(1)); dot.setAttribute('cy', syVal.toFixed(1)); dot.setAttribute('opacity', '1');
    } else {
      dot.setAttribute('opacity', '0');
    }
    tooltip.textContent = elevChartTooltipText(p);
    tooltip.style.display = 'block';
    if (onMove) onMove(p);
  }
  wrapper.addEventListener('mousemove', e => updateAt(e.clientX));
  wrapper.addEventListener('touchmove', e => { if (e.touches[0]) updateAt(e.touches[0].clientX); }, { passive: true });
  wrapper.addEventListener('mouseleave', () => {
    cursor.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); tooltip.style.display = 'none';
  });
}

let _chartGradientId = 0;
function lineChartSvg(title, points, opts) {
  opts = opts || {};
  if (points.length < 2) return svgEmpty(title);
  const w = chartViewboxWidth(opts), h = opts.height || 280, padL = 54, padR = 18, padT = 20, padB = 36;
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
      '<circle class="chart-dot" cx="'+cx+'" cy="'+cy+'" r="4" fill="var(--accent)" style="pointer-events:none;"/>';
  }).join('');
  const firstLabel = points[0].xLabel, lastLabel = points[points.length-1].xLabel;
  // Silhouette de terrain optionnelle en arrière-plan (ex. altitude derrière l'allure ou la FC) —
  // normalisée sur sa propre échelle Y (jamais affichée, pas d'axe) pour rester un simple repère
  // visuel du relief, sans laisser croire à un second axe superposé au même repère que la donnée
  // principale (cf. "évite les doubles axes illisibles").
  let backgroundPath = '';
  if (opts.background && opts.background.length >= 2) {
    const bgYs = opts.background.map(p => p.y);
    const bgMinY = Math.min(...bgYs), bgMaxY = Math.max(...bgYs);
    const bgSpanY = (bgMaxY - bgMinY) || 1;
    const bgSy = y => (h - padB) - (y - bgMinY) / bgSpanY * (h - padT - padB);
    const bgLine = opts.background.map((p,i) => (i===0?'M':'L') + sx(p.x).toFixed(1) + ',' + bgSy(p.y).toFixed(1)).join(' ');
    const bgArea = bgLine + ' L' + sx(opts.background[opts.background.length-1].x).toFixed(1) + ',' + (h-padB) + ' L' + sx(opts.background[0].x).toFixed(1) + ',' + (h-padB) + ' Z';
    backgroundPath = '<path d="' + bgArea + '" fill="var(--muted-2)" opacity="0.18" stroke="none"/>';
  }
  return '<div class="chart-box' + (opts.hideTitle ? ' no-title' : '') + '">' + (opts.hideTitle ? '' : '<h3>' + title + '</h3>') + '<svg viewBox="0 0 '+w+' '+h+'">' +
    '<defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--chart-fill-top)"/><stop offset="100%" stop-color="var(--chart-fill-bottom)"/>' +
    '</linearGradient></defs>' +
    backgroundPath +
    '<path d="'+areaPath+'" fill="url(#'+gradId+')" stroke="none"/>' +
    // Grille en trait PLEIN : un tireté sur une ligne de grille se lit comme un seuil ou une
    // projection alors que ce n'est qu'un repère (anti-pattern documenté du skill dataviz).
    '<line x1="'+padL+'" y1="'+sy(midY).toFixed(1)+'" x2="'+(w-padR)+'" y2="'+sy(midY).toFixed(1)+'" stroke="var(--chart-grid)" stroke-width="1"/>' +
    '<line x1="'+padL+'" y1="'+(h-padB)+'" x2="'+(w-padR)+'" y2="'+(h-padB)+'" stroke="var(--border)"/>' +
    '<line x1="'+padL+'" y1="'+padT+'" x2="'+padL+'" y2="'+(h-padB)+'" stroke="var(--border)"/>' +
    '<text x="4" y="'+(padT+6)+'" class="c-axis">'+(opts.yMaxLabel ?? maxY.toFixed(opts.decimals??0))+'</text>' +
    '<text x="4" y="'+(sy(midY)-5).toFixed(1)+'" class="c-axis">'+midY.toFixed(opts.decimals??0)+'</text>' +
    '<text x="4" y="'+(h-padB+2)+'" class="c-axis">'+(opts.yMinLabel ?? minY.toFixed(opts.decimals??0))+'</text>' +
    '<text x="'+padL+'" y="'+(h-8)+'" class="c-axis">'+firstLabel+'</text>' +
    '<text x="'+(w-padR-50)+'" y="'+(h-8)+'" class="c-axis">'+lastLabel+'</text>' +
    '<path d="'+path+'" fill="none" stroke="var(--chart-line)" stroke-width="2.5"/>' + dots +
  '</svg></div>';
}
function groupedBarChartSvg(title, weeks, series, opts) {
  opts = opts || {};
  if (!weeks.length) return svgEmpty(title);
  const w = chartViewboxWidth(opts), h = opts.height || 290, padL = 54, padR = 18, padT = 20, padB = 44;
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
      bars += '<text x="'+(groupX+groupW*0.35).toFixed(1)+'" y="'+(h-14)+'" class="c-tick" text-anchor="middle">'+wk.shortLabel+'</text>';
    }
  });
  // Pas de legende pour une serie unique : le titre la nomme deja. Une legende a une entree est
  // du bruit (regle du skill dataviz : legende obligatoire des 2 series, aucune pour une seule).
  const legend = series.length > 1
    ? '<div class="chart-legend">' + series.map(s => '<span><span class="dot" style="background:'+s.color+'"></span>'+s.name+'</span>').join('') + '</div>'
    : '';
  return '<div class="chart-box' + (opts.hideTitle ? ' no-title' : '') + '">' + (opts.hideTitle ? '' : '<h3>' + title + '</h3>') + legend + '<svg viewBox="0 0 '+w+' '+h+'">' +
    '<line x1="'+padL+'" y1="'+(h-padB)+'" x2="'+(w-padR)+'" y2="'+(h-padB)+'" stroke="var(--border)"/>' +
    // Graduations intermediaires + lignes de grille. Avant : une seule valeur (le maximum), donc
    // aucune valeur lisible sans survoler une barre — ce que le skill dataviz interdit
    // explicitement (« un tooltip n'est jamais le seul moyen de lire une valeur »).
    [0.25,0.5,0.75].map(function(frac){
      const gy=(h-padB)-frac*(h-padT-padB);
      return '<line x1="'+padL+'" y1="'+gy.toFixed(1)+'" x2="'+(w-padR)+'" y2="'+gy.toFixed(1)+'" stroke="var(--chart-grid)" stroke-width="1"/>' +
        '<text x="4" y="'+(gy+4).toFixed(1)+'" class="c-axis">'+(maxV*frac).toFixed(0)+'</text>';
    }).join('') +
    '<text x="4" y="'+(padT+6)+'" class="c-axis">'+maxV.toFixed(0)+'</text>' +
    '<text x="4" y="'+(h-padB+4)+'" class="c-axis">0</text>' +
    bars +
  '</svg></div>';
}

function radarChartSvg(axes, scores) {
  const id = 'radar' + (_elevChartId++);
  const w = 340, h = 340, cx = w/2, cy = h/2, r = 120;
  const n = axes.length;
  const angle = i => -Math.PI/2 + i * (2*Math.PI/n);
  const pt = (i, frac) => [cx + Math.cos(angle(i)) * r * frac, cy + Math.sin(angle(i)) * r * frac];
  // Anneaux de repère à 25/50/75/100% — bandes alternées très discrètes entre chaque niveau pour
  // donner de la profondeur (comme des courbes de niveau), plutôt que de simples traits plats.
  // L'anneau extérieur (100%) est le seul à ressortir davantage : c'est la limite du repère.
  let rings = '';
  const levels = [0.25, 0.5, 0.75, 1];
  levels.forEach((frac, li) => {
    const poly = axes.map((_, i) => pt(i, frac).join(',')).join(' ');
    if (li % 2 === 1) rings += '<polygon points="'+poly+'" fill="rgba(244,247,245,.015)" stroke="none"/>';
    rings += '<polygon points="'+poly+'" fill="none" stroke="var(--border)" stroke-width="'+(frac===1?1.4:1)+'" opacity="'+(frac===1?0.9:0.55)+'"/>';
  });
  // Point le plus faible mis en évidence (même logique que "point faible" ailleurs sur le site) —
  // jamais alarmant (accent-light, pas rouge), juste un repère visuel là où progresser en priorité.
  let weakKey = null, weakVal = Infinity;
  axes.forEach(ax => { const v = scores[ax.key]; if (v != null && v < weakVal) { weakVal = v; weakKey = ax.key; } });
  let spokes = '', labels = '';
  axes.forEach((ax, i) => {
    const [x, y] = pt(i, 1);
    const isWeak = ax.key === weakKey;
    spokes += '<line x1="'+cx+'" y1="'+cy+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--border)" stroke-width="1"/>';
    const [lx, ly] = pt(i, 1.16);
    const score = scores[ax.key];
    labels += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" font-size="12" fill="'+(isWeak?'var(--warn)':'var(--text)')+'" font-weight="'+(isWeak?'700':'400')+'" text-anchor="middle" dominant-baseline="middle">'+ax.label+(score!=null?' ('+score+')':' (n/d)')+'</text>';
  });
  const dataPts = axes.map((ax, i) => pt(i, (scores[ax.key] ?? 0) / 100));
  const dataPoly = dataPts.map(p => p.join(',')).join(' ');
  const dots = axes.map((ax, i) => {
    const [x, y] = dataPts[i];
    const score = scores[ax.key];
    const tip = escapeHtml(ax.label + ' : ' + (score!=null ? score+'/100' : 'donnée insuffisante'));
    return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="10" fill="transparent" data-tooltip="'+tip+'"/>' +
      '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="4" fill="var(--accent-light)" stroke="var(--panel)" stroke-width="1.5" style="pointer-events:none;"/>';
  }).join('');
  return '<div class="chart-box radar-box"><h3>Profil de performance <small style="font-weight:400;">(estimé sur les '+RADAR_WEEKS+' dernières semaines)</small></h3>' +
    '<svg viewBox="0 0 '+w+' '+h+'">' +
    '<defs><radialGradient id="'+id+'Fill" cx="50%" cy="50%" r="65%"><stop offset="0%" stop-color="var(--accent-light)" stop-opacity="0.38"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0.08"/></radialGradient></defs>' +
    rings + spokes +
    '<polygon points="'+dataPoly+'" fill="url(#'+id+'Fill)" stroke="var(--chart-line)" stroke-width="2.5"/>' +
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
  // applyTheme() ci-dessus s'exécute au chargement du script, donc depuis le <head> : le bouton
  // n'existe pas encore et la branche qui pose l'icône, l'aria-label et le title était toujours
  // sautée. Résultat mesuré : aria-label absent sur les 9 pages (bouton sans nom accessible), et
  // libellé figé sur le texte écrit en dur dans le HTML — « ☀ Clair » sur 8 pages, qui débordait
  // du bouton rond de 34px et continuait d'annoncer « clair » alors que le thème clair était déjà
  // actif. On rejoue donc l'application du thème une fois le DOM prêt.
  applyTheme(getTheme());
  if (!storageAvailable()) {
    document.querySelectorAll('.storage-warning-target').forEach(el => {
      el.innerHTML = '<div class="msg err">Le stockage local du navigateur n\'est pas disponible (navigation privée ?) — les données ne seront pas conservées après fermeture de la page.</div>';
    });
  }
  autoPullIfNewer();
  initTopbarScrollState();
  initSpotlight();
  initCommandPalette();
});

/* Palette de commandes (Ctrl/Cmd+K) — P3 volontairement optionnel : la navigation normale
   (sidebar, barre mobile) reste toujours l'unique voie nécessaire, ceci n'est qu'un raccourci en
   plus. Ne s'affiche que si NAV_ITEMS existe (toutes les pages qui appellent renderAppNav()) et
   qu'aucun champ de saisie n'a déjà le focus (pour ne jamais voler un raccourci Ctrl+K natif d'un
   champ de texte). Réutilise .modal-backdrop : la gestion du focus déjà en place (voir plus haut)
   s'applique automatiquement, aucune duplication de logique.
*/
function initCommandPalette() {
  if (typeof NAV_ITEMS === 'undefined' || document.getElementById('cmdkBackdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop cmdk-backdrop';
  backdrop.id = 'cmdkBackdrop';
  backdrop.innerHTML =
    '<div class="modal cmdk-modal">' +
      '<input type="text" class="cmdk-input" id="cmdkInput" placeholder="Aller à…" aria-label="Rechercher une page" autocomplete="off">' +
      '<div class="cmdk-list" id="cmdkList"></div>' +
    '</div>';
  document.body.appendChild(backdrop);

  const input = backdrop.querySelector('#cmdkInput');
  const list = backdrop.querySelector('#cmdkList');
  let activeIdx = 0;

  function renderList(query) {
    const q = (query || '').trim().toLowerCase();
    const items = NAV_ITEMS.filter(it => !q || it.label.toLowerCase().includes(q));
    activeIdx = 0;
    list.innerHTML = items.length ? items.map((it, i) =>
      '<a href="' + it.href + '" class="cmdk-item' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '">' +
        '<img src="' + navIconUrl(it.icon) + '" alt="">' + escapeHtml(it.label) +
      '</a>'
    ).join('') : '<div class="cmdk-empty">Aucune page ne correspond.</div>';
    list.dataset.hrefs = JSON.stringify(items.map(it => it.href));
  }
  function move(delta) {
    const links = list.querySelectorAll('.cmdk-item');
    if (!links.length) return;
    links[activeIdx]?.classList.remove('active');
    activeIdx = (activeIdx + delta + links.length) % links.length;
    links[activeIdx].classList.add('active');
    links[activeIdx].scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    renderList('');
    input.value = '';
    backdrop.classList.add('open');
  }
  document.addEventListener('keydown', (e) => {
    const isTypingField = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '') && document.activeElement !== input;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !isTypingField) {
      e.preventDefault();
      backdrop.classList.contains('open') ? backdrop.classList.remove('open') : openPalette();
    }
  });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.remove('open'); });
  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      const hrefs = JSON.parse(list.dataset.hrefs || '[]');
      if (hrefs[activeIdx]) location.href = hrefs[activeIdx];
    }
  });
}

/* Spotlight au pointeur (carte Objectif principal, cartes KPI) — un seul listener delegue au
   document plutot qu'un par carte, desactive d'office sur tactile/pointeur imprecis/reduced-motion
   (voir la media query miroir dans assets/style.css). Cout minime : juste deux variables CSS mises
   a jour au survol, aucune mesure de layout couteuse (pas de resize observer). */
function initSpotlight() {
  if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  let raf = null, pending = null;
  document.addEventListener('mousemove', (e) => {
    const card = e.target.closest && e.target.closest('.objective-card,.kpi-card');
    if (!card) return;
    pending = { card, e };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      if (!pending) return;
      const { card, e } = pending;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  }, { passive: true });
}

/* Topbar sticky : bascule .scrolled dès que le contenu défile derrière elle (voile + flou,
   voir assets/style.css). `main` est le conteneur qui défile réellement sur ces pages
   (body ne scrolle pas), donc l'écoute cible `main`, pas `window`. */
function initTopbarScrollState() {
  const topbar = document.querySelector('header.app-topbar');
  if (!topbar) return;
  const update = () => topbar.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', update, { passive: true });
  update();
}
