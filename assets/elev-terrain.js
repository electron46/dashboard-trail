/* =============================================================================
   ELEV — moteur terrain
   Audit ELEV 2.0, P1-8, §5.4, §6.5, §14 — exigences TER-01 à TER-04.

   Le terrain devient une primitive de premier ordre : c'est la thèse même du
   produit (« qu'est-ce que ce terrain a changé dans ma sortie ? »), et c'était
   pourtant la seule grandeur que le code traitait en valeur absolue.

   Trois corrections de fond par rapport à l'existant :

   1. MONTÉE ET DESCENTE NE SONT PLUS FUSIONNÉES. `gradeBucketIndex()` prenait
      Math.abs(pente) : « 15 minutes à plus de 15 % » pouvait donc désigner une
      ascension ou une descente technique, deux contraintes biomécaniques
      distinctes et documentées comme telles dans la littérature citée par
      l'audit. Un pourcentage de pente porte désormais toujours son signe.

   2. LA PENTE EST CALCULÉE SUR UNE ALTITUDE LISSÉE. Point à point, l'altitude
      d'un baromètre grand public bruite de quelques mètres ; sur un intervalle
      de 2 secondes et 4 mètres parcourus, 1 mètre de bruit produit une pente de
      25 %. Le produit classait donc du bruit. La fenêtre de lissage est
      exprimée en DISTANCE (mètres), pas en nombre de points : une série FIT est
      échantillonnée dans le temps, donc un même nombre de points couvre 30 m en
      montée raide et 200 m en descente rapide.

   3. LA COUVERTURE EST PUBLIÉE. Chaque agrégat retourne la part du temps qu'il
      a réellement pu classer. Sans elle, « 32 % du temps en montée raide » est
      invérifiable.
   ============================================================================= */

/* Distance de lissage, en mètres. 30 m est un compromis mesuré : assez long
   pour absorber le bruit baro/GPS point à point, assez court pour ne pas
   effacer un ressaut réel — une marche d'escalier de sentier fait quelques
   mètres, un raidillon en fait plusieurs dizaines. */
const TERRAIN_SMOOTH_DISTANCE_M = 30;

/* Seuil de plat. En dessous de ±3 %, la pente ne change pas significativement
   la locomotion : c'est le même seuil que celui déjà retenu par detectClimbs
   pour refuser un faux plat vallonné, réutilisé plutôt que d'en inventer un
   second qui pourrait le contredire. */
const TERRAIN_FLAT_THRESHOLD_PCT = 3;

/* Tranches de pente SIGNÉES. Le libellé porte le sens : il n'y a plus de
   convention à retenir pour lire le graphique. */
const TERRAIN_GRADE_BANDS = [
  { key:'down_steep', label:'Descente > 15 %',   dir:'down', min:-Infinity, max:-15 },
  { key:'down_mid',   label:'Descente 8–15 %',   dir:'down', min:-15,       max:-8 },
  { key:'down_soft',  label:'Descente 3–8 %',    dir:'down', min:-8,        max:-TERRAIN_FLAT_THRESHOLD_PCT },
  { key:'flat',       label:'Roulant ±3 %',      dir:'flat', min:-TERRAIN_FLAT_THRESHOLD_PCT, max:TERRAIN_FLAT_THRESHOLD_PCT },
  { key:'up_soft',    label:'Montée 3–8 %',      dir:'up',   min:TERRAIN_FLAT_THRESHOLD_PCT,  max:8 },
  { key:'up_mid',     label:'Montée 8–15 %',     dir:'up',   min:8,         max:15 },
  { key:'up_steep',   label:'Montée > 15 %',     dir:'up',   min:15,        max:Infinity },
];

function terrainBandIndex(gradePct) {
  if (gradePct == null || !isFinite(gradePct)) return -1;
  for (let i = 0; i < TERRAIN_GRADE_BANDS.length; i++) {
    const b = TERRAIN_GRADE_BANDS[i];
    if (gradePct >= b.min && gradePct < b.max) return i;
  }
  return gradePct >= 15 ? TERRAIN_GRADE_BANDS.length - 1 : 0;
}
function terrainBandLabel(key) {
  const b = TERRAIN_GRADE_BANDS.find(x => x.key === key);
  return b ? b.label : key;
}

/* --------------------------- lissage par distance ---------------------------
   Retourne une copie de la série avec `altSmooth` posé sur chaque point.
   Moyenne mobile centrée sur une fenêtre de ±(TERRAIN_SMOOTH_DISTANCE_M / 2).
   Les points sans altitude ou sans distance sont laissés tels quels et exclus
   des moyennes : lisser à travers un trou fabriquerait une pente inexistante. */
function terrainSmoothSeries(series, windowM) {
  const win = (windowM || TERRAIN_SMOOTH_DISTANCE_M) / 2 / 1000; // en km, demi-fenêtre
  const pts = (series || []).map(p => Object.assign({}, p));
  const usable = pts.filter(p => p.alt != null && p.distKm != null && isFinite(p.alt) && isFinite(p.distKm));
  if (usable.length < 3) { pts.forEach(p => { p.altSmooth = p.alt; }); return pts; }
  // Deux pointeurs : la série étant croissante en distance, la fenêtre glisse sans re-parcourir.
  let lo = 0, hi = 0;
  for (let i = 0; i < usable.length; i++) {
    const d = usable[i].distKm;
    while (lo < usable.length && usable[lo].distKm < d - win) lo++;
    while (hi < usable.length && usable[hi].distKm <= d + win) hi++;
    let sum = 0, n = 0;
    for (let j = lo; j < hi; j++) { sum += usable[j].alt; n++; }
    usable[i].altSmooth = n ? sum / n : usable[i].alt;
  }
  pts.forEach(p => { if (p.altSmooth == null) p.altSmooth = p.alt; });
  return pts;
}

/* --------------------------- intervalles classés ---------------------------
   Brique commune à tous les agrégats terrain : découpe la séance en intervalles
   exploitables et pose sur chacun sa pente signée, sa direction et sa cadence.
   Écrite une fois pour que la répartition par pente, le run/walk par pente et
   les segments comparables ne puissent pas diverger sur la définition de
   « pente » — ils avaient chacun leur propre boucle avant. */
const TERRAIN_STOP_SPEED_KMH = 1.5; // aligné sur RUNWALK_STOP_SPEED_KMH (app.js)

function terrainIntervals(session) {
  const raw = (session && session.series) || [];
  const pts = terrainSmoothSeries(raw).filter(p => p.altSmooth != null && p.distKm != null && p.t != null);
  const out = [];
  let skippedSec = 0;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const dt = p1.t - p0.t;
    if (!dt || dt <= 0 || dt > 120) continue;
    const dDistKm = p1.distKm - p0.distKm;
    if (dDistKm <= 0) { skippedSec += dt; continue; }
    const speedKmh = dDistKm / (dt / 3600);
    if (speedKmh < TERRAIN_STOP_SPEED_KMH) { skippedSec += dt; continue; }
    const gradePct = ((p1.altSmooth - p0.altSmooth) / (dDistKm * 1000)) * 100;
    const cad = (p0.cadenceSpm != null && p1.cadenceSpm != null) ? (p0.cadenceSpm + p1.cadenceSpm) / 2 : null;
    const hr = (p0.hr != null && p1.hr != null) ? (p0.hr + p1.hr) / 2 : null;
    const bi = terrainBandIndex(gradePct);
    out.push({
      sec: dt, distKm: dDistKm, speedKmh, gradePct, cad, hr,
      band: TERRAIN_GRADE_BANDS[bi].key,
      dir: TERRAIN_GRADE_BANDS[bi].dir,
      t0: p0.t, t1: p1.t, distKm0: p0.distKm, alt0: p0.altSmooth, alt1: p1.altSmooth,
    });
  }
  return { intervals: out, skippedSec };
}

/* --------------------------- répartition par pente signée ---------------------------
   Remplace aggregateGradeBuckets(). Retourne aussi la synthèse par direction,
   qui est ce que l'utilisateur lit en premier : combien de temps en montée,
   en descente, sur le plat. */
function terrainGradeDistribution(sessions) {
  const list = Array.isArray(sessions) ? sessions : [sessions];
  const secByBand = TERRAIN_GRADE_BANDS.map(() => 0);
  let total = 0, skipped = 0;
  list.forEach(s => {
    const { intervals, skippedSec } = terrainIntervals(s);
    skipped += skippedSec;
    intervals.forEach(iv => {
      const bi = TERRAIN_GRADE_BANDS.findIndex(b => b.key === iv.band);
      secByBand[bi] += iv.sec; total += iv.sec;
    });
  });
  if (!total) return null;
  const bands = TERRAIN_GRADE_BANDS.map((b, i) => ({
    key: b.key, label: b.label, dir: b.dir,
    sec: secByBand[i], pct: Math.round(secByBand[i] / total * 100),
  }));
  const byDir = ['up', 'down', 'flat'].map(d => {
    const sec = bands.filter(b => b.dir === d).reduce((a, b) => a + b.sec, 0);
    return { dir: d, label: d === 'up' ? 'Montée' : (d === 'down' ? 'Descente' : 'Roulant'), sec, pct: Math.round(sec / total * 100) };
  });
  return {
    bands, byDir, totalSec: total, excludedSec: skipped,
    method: 'Pente calculée sur altitude lissée (' + TERRAIN_SMOOTH_DISTANCE_M + ' m), arrêts exclus.',
    coverageRatio: (total + skipped) > 0 ? total / (total + skipped) : null,
  };
}

/* --------------------------- course / marche par pente signée ---------------------------
   Ne conclut RIEN sans une couverture cadence suffisante, et publie cette
   couverture (TER-03). Le repli sur l'allure de computeRunWalkBreakdown n'est
   volontairement pas repris ici : empiler une estimation de locomotion sur une
   estimation de pente rendrait la conclusion indéfendable. */
const TERRAIN_RUNWALK_CADENCE_THRESHOLD = 140; // aligné sur RUNWALK_CADENCE_THRESHOLD (app.js)
const TERRAIN_RUNWALK_MIN_COVERAGE = 0.60;

function terrainRunWalkByGrade(sessions) {
  const list = Array.isArray(sessions) ? sessions : [sessions];
  const run = TERRAIN_GRADE_BANDS.map(() => 0), walk = TERRAIN_GRADE_BANDS.map(() => 0);
  let withCad = 0, totalSec = 0;
  list.forEach(s => {
    terrainIntervals(s).intervals.forEach(iv => {
      totalSec += iv.sec;
      if (iv.cad == null) return;
      withCad += iv.sec;
      const bi = TERRAIN_GRADE_BANDS.findIndex(b => b.key === iv.band);
      if (iv.cad < TERRAIN_RUNWALK_CADENCE_THRESHOLD) walk[bi] += iv.sec; else run[bi] += iv.sec;
    });
  });
  const coverage = totalSec > 0 ? withCad / totalSec : null;
  if (coverage == null || coverage < TERRAIN_RUNWALK_MIN_COVERAGE) {
    return {
      available: false, coverage, coveragePct: coverage == null ? null : Math.round(coverage * 100),
      reason: coverage == null
        ? "Aucune donnée de cadence dans ces séances."
        : 'Cadence disponible sur ' + Math.round(coverage * 100) + ' % du temps seulement — il en faut ' + Math.round(TERRAIN_RUNWALK_MIN_COVERAGE * 100) + ' % pour distinguer course et marche de façon fiable.',
      bands: null,
    };
  }
  const bands = TERRAIN_GRADE_BANDS.map((b, i) => {
    const tot = run[i] + walk[i];
    return {
      key: b.key, label: b.label, dir: b.dir, totalSec: tot,
      runPct: tot ? Math.round(run[i] / tot * 100) : null,
      walkPct: tot ? Math.round(walk[i] / tot * 100) : null,
    };
  }).filter(b => b.totalSec > 0);
  return {
    available: true, coverage, coveragePct: Math.round(coverage * 100), bands,
    method: 'Estimation ELEV basée sur la cadence (seuil ' + TERRAIN_RUNWALK_CADENCE_THRESHOLD + ' pas/min), pente lissée sur ' + TERRAIN_SMOOTH_DISTANCE_M + ' m.',
  };
}

/* --------------------------- segments comparables ---------------------------
   Abstraction demandée par l'audit §14 et TER-04. Elle ne prétend PAS que deux
   segments sont comparables : elle décrit chaque segment par les critères qui
   décideront de sa comparabilité, et fournit un test explicite.

   Point important : ELEV ne fait pas de reconnaissance géographique de segment
   (« la même montée »). Cela demanderait d'apparier des traces GPS de qualités
   différentes, ce que l'audit lui-même classe à vérifier sur un corpus varié
   d'appareils. Ce que ce module fait est plus modeste et défendable : comparer
   des segments de MÊME NATURE (même bande de pente, durée et longueur proches),
   ce qui suffit à répondre « ma VAM a-t-elle bougé sur ce type de montée ? ». */

const TERRAIN_SEGMENT_MIN_SEC = 180;   // moins de 3 minutes : trop court pour un régime stable
const TERRAIN_SEGMENT_MIN_GAIN_M = 30; // aligné sur l'esprit de detectClimbs (40 m), un cran plus permissif en descente

/* HYSTÉRÉSIS — sans quoi la segmentation ne produit que des miettes.
   Mesuré sur un fichier réel : découper naïvement à chaque changement de direction donnait
   595 segments pour 1329 intervalles, dont 281 « roulants » d'une dizaine de secondes. Une vraie
   descente de 315 m se retrouvait hachée en une dizaine de morceaux dont aucun n'atteignait
   3 minutes, et l'aptitude en descente ressortait « indisponible » sur des sorties qui en
   contenaient dix-sept. C'était un défaut de méthode, pas une absence de données.

   Deux tolérances, dans l'esprit du `reversalM` que detectClimbs applique déjà :
     - un passage à plat n'interrompt jamais un segment tant qu'il reste bref ;
     - une inversion de direction ne le clôt que si elle devient réelle, en dénivelé ou en durée. */
const TERRAIN_SEGMENT_FLAT_TOLERANCE_S = 60; // un replat de moins d'une minute appartient au segment
const TERRAIN_SEGMENT_REVERSAL_M = 15;       // 15 m de contre-pente : là, le terrain a vraiment changé
const TERRAIN_SEGMENT_REVERSAL_S = 45;

/* Découpe une séance en segments homogènes en direction (montée / descente / roulant continus),
   avec leurs mesures d'effort. */
function terrainSegments(session) {
  const { intervals } = terrainIntervals(session);
  const segs = [];
  let cur = null, buffer = [];

  const bufferDeniv = () => buffer.reduce((a, iv) => a + (iv.alt1 - iv.alt0), 0);
  const bufferSec = () => buffer.reduce((a, iv) => a + iv.sec, 0);

  const absorb = iv => {
    cur.sec += iv.sec; cur.distKm += iv.distKm; cur.altEnd = iv.alt1;
    if (iv.hr != null) { cur.hrSum += iv.hr * iv.sec; cur.hrSec += iv.sec; }
    if (iv.cad != null) { cur.cadSum += iv.cad * iv.sec; cur.cadSec += iv.sec; }
  };

  const flush = () => {
    if (!cur) return;
    const denivM = cur.altEnd - cur.altStart;
    const gain = Math.abs(denivM);
    const longEnough = cur.sec >= TERRAIN_SEGMENT_MIN_SEC;
    const bigEnough = cur.dir === 'flat' ? cur.distKm >= 1 : gain >= TERRAIN_SEGMENT_MIN_GAIN_M;
    if (longEnough && bigEnough && cur.distKm > 0) {
      const gradePct = (denivM / (cur.distKm * 1000)) * 100;
      const bi = terrainBandIndex(gradePct);
      segs.push({
        dir: cur.dir,
        band: bi >= 0 ? TERRAIN_GRADE_BANDS[bi].key : null,
        startDistKm: +cur.startDistKm.toFixed(2),
        distanceKm: +cur.distKm.toFixed(2),
        durationS: Math.round(cur.sec),
        denivM: Math.round(denivM),
        gradePct: +gradePct.toFixed(1),
        speedKmh: +(cur.distKm / (cur.sec / 3600)).toFixed(2),
        // VAM en montée uniquement — une « vitesse ascensionnelle » en descente n'a pas de sens.
        vamMh: cur.dir === 'up' && cur.sec > 0 ? Math.round(denivM / (cur.sec / 3600)) : null,
        avgHr: cur.hrSec > 0 ? Math.round(cur.hrSum / cur.hrSec) : null,
        hrCoverage: cur.sec > 0 ? +(cur.hrSec / cur.sec).toFixed(2) : null,
        avgCadence: cur.cadSec > 0 ? Math.round(cur.cadSum / cur.cadSec) : null,
        cadenceCoverage: cur.sec > 0 ? +(cur.cadSec / cur.sec).toFixed(2) : null,
        sessionId: session && session.id, date: session && session.date,
      });
    }
    cur = null;
  };

  const start = iv => {
    cur = { dir: iv.dir, sec: 0, distKm: 0, startDistKm: iv.distKm0, altStart: iv.alt0, altEnd: iv.alt1, hrSum: 0, hrSec: 0, cadSum: 0, cadSec: 0 };
    absorb(iv);
  };

  intervals.forEach(iv => {
    if (!cur) { start(iv); buffer = []; return; }

    if (iv.dir === cur.dir) {           // même direction : le tampon éventuel appartient au segment
      buffer.forEach(absorb); buffer = [];
      absorb(iv);
      return;
    }

    buffer.push(iv);
    const bSec = bufferSec(), bDeniv = bufferDeniv();

    // Un replat n'interrompt le segment que s'il dure vraiment.
    const onlyFlat = buffer.every(b => b.dir === 'flat');
    if (onlyFlat) {
      if (bSec <= TERRAIN_SEGMENT_FLAT_TOLERANCE_S) return; // on attend : il sera absorbé ou décidera
      flush(); start(buffer[0]); buffer.slice(1).forEach(absorb); buffer = [];
      return;
    }

    // Inversion franche : elle doit peser en dénivelé OU en durée pour clore le segment.
    const contraire = (cur.dir === 'up' && bDeniv <= -TERRAIN_SEGMENT_REVERSAL_M) ||
                      (cur.dir === 'down' && bDeniv >= TERRAIN_SEGMENT_REVERSAL_M) ||
                      (cur.dir === 'flat' && Math.abs(bDeniv) >= TERRAIN_SEGMENT_REVERSAL_M);
    if (contraire || bSec >= TERRAIN_SEGMENT_REVERSAL_S) {
      flush();
      const first = buffer.find(b => b.dir !== 'flat') || buffer[0];
      start(first);
      buffer.filter(b => b !== first).forEach(absorb);
      buffer = [];
    }
  });
  buffer.forEach(b => { if (cur) absorb(b); });
  flush();
  return segs;
}

/* Deux segments sont-ils comparables ? Critères explicites et symétriques.
   Retourne la raison du refus, pour que l'interface puisse l'afficher plutôt
   que de faire disparaître une comparaison sans explication. */
const TERRAIN_COMPARABLE = {
  gradeTolerancePct: 4,   // ±4 points de pente
  durationRatio: 1.6,     // le plus long ne dépasse pas 1,6× le plus court
  distanceRatio: 1.8,
};
function terrainSegmentsComparable(a, b) {
  if (!a || !b) return { comparable:false, reason:'Segment manquant.' };
  if (a.dir !== b.dir) return { comparable:false, reason:'Directions différentes (montée / descente / roulant).' };
  if (Math.abs(a.gradePct - b.gradePct) > TERRAIN_COMPARABLE.gradeTolerancePct)
    return { comparable:false, reason:'Pentes trop différentes (' + a.gradePct + ' % contre ' + b.gradePct + ' %).' };
  const dr = Math.max(a.durationS, b.durationS) / Math.max(1, Math.min(a.durationS, b.durationS));
  if (dr > TERRAIN_COMPARABLE.durationRatio) return { comparable:false, reason:'Durées trop différentes.' };
  const kr = Math.max(a.distanceKm, b.distanceKm) / Math.max(0.01, Math.min(a.distanceKm, b.distanceKm));
  if (kr > TERRAIN_COMPARABLE.distanceRatio) return { comparable:false, reason:'Longueurs trop différentes.' };
  return { comparable:true, reason:null };
}

/* Cherche, dans un historique, les segments comparables à un segment de
   référence. L'audit (§6.3) interdit de conclure sous 3 références réellement
   comparables : la fonction retourne donc toujours le compte, et c'est
   l'appelant — via le moteur d'insight — qui applique le seuil. */
function terrainFindComparableSegments(reference, sessions, opts) {
  opts = opts || {};
  const excludeSessionId = opts.excludeSessionId || (reference && reference.sessionId);
  const found = [];
  (sessions || []).forEach(s => {
    if (!s || s.id === excludeSessionId) return;
    terrainSegments(s).forEach(seg => {
      if (terrainSegmentsComparable(reference, seg).comparable) found.push(seg);
    });
  });
  return found;
}

if (typeof window !== 'undefined') {
  window.TERRAIN_GRADE_BANDS = TERRAIN_GRADE_BANDS;
  window.TERRAIN_SMOOTH_DISTANCE_M = TERRAIN_SMOOTH_DISTANCE_M;
}
