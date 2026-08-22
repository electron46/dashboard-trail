/* =============================================================================
   ELEV — contrat de qualité de la donnée
   Audit ELEV 2.0, §5.2, §5.5, §6.3 — exigences DATA-01 à DATA-04.

   Pourquoi ce fichier existe séparément d'assets/app.js : l'audit (§12) demande
   un découpage progressif par responsabilité, et la couverture d'un signal est
   consommée par TROIS familles de code qui n'ont sinon rien en commun (le
   moteur terrain, le moteur d'insight, le rendu des pages). L'écrire dans
   app.js l'aurait posée à côté d'un consommateur particulier, ce qui est
   exactement la faiblesse relevée : « certaines règles métier vivent près du
   rendu et gagnent une autorité visuelle sans contrat de confiance ».

   Règle fondatrice, valable pour tout ce fichier : on ne devine JAMAIS.
   Si un fichier .fit ne dit pas qu'une FC vient d'une ceinture, ELEV ne le sait
   pas et l'écrit « source inconnue ». Une absence de donnée n'est pas un
   mauvais résultat (§6.3) — c'est une absence, et elle se nomme.

   Chargé AVANT assets/app.js par toutes les pages.
   ============================================================================= */

/* --------------------------- vocabulaire partagé ---------------------------
   Trois échelles distinctes qui étaient jusqu'ici confondues dans le produit :

   - PROVENANCE : d'où sort le nombre ? (mesuré / calculé / estimé / absent)
   - COUVERTURE : sur quelle part de la séance ou de la fenêtre est-il défini ?
   - CONFIANCE  : quel crédit accorder à la conclusion qu'on en tire ?

   Une donnée mesurée à 100 % peut porter une conclusion à confiance faible si
   la comparaison manque de références. L'inverse n'existe pas : une couverture
   insuffisante plafonne toujours la confiance. */

const ELEV_PROVENANCE = {
  observed:    { key:'observed',    label:'Mesuré',      short:'mesuré',      symbol:'●', desc:"Valeur lue directement dans le fichier de la séance." },
  computed:    { key:'computed',    label:'Calculé',     short:'calculé',     symbol:'▲', desc:"Valeur dérivée d'autres mesures par une règle explicite." },
  inferred:    { key:'inferred',    label:'Estimation',  short:'estimation',  symbol:'◆', desc:"Valeur estimée : elle repose sur une hypothèse, pas sur une mesure." },
  unavailable: { key:'unavailable', label:'Indisponible',short:'indisponible',symbol:'—', desc:"La donnée n'existe pas dans les fichiers importés." },
};

const ELEV_CONFIDENCE = {
  high:   { key:'high',   label:'Confiance haute',   short:'haute',   symbol:'●●●', rank:3 },
  medium: { key:'medium', label:'Confiance moyenne', short:'moyenne', symbol:'●●○', rank:2 },
  low:    { key:'low',    label:'Confiance faible',  short:'faible',  symbol:'●○○', rank:1 },
  none:   { key:'none',   label:'Non conclu',        short:'non conclu', symbol:'○○○', rank:0 },
};

/* Le symbole n'est pas décoratif : l'audit (§6.3, §10) interdit de porter la
   confiance par la seule couleur. Le texte et le symbole suffisent à lire le
   statut sans distinguer les teintes. */
function elevConfidenceLabel(key) { return (ELEV_CONFIDENCE[key] || ELEV_CONFIDENCE.none).label; }
function elevProvenanceLabel(key) { return (ELEV_PROVENANCE[key] || ELEV_PROVENANCE.unavailable).label; }

/* Seuils de couverture. Choisis pour rester cohérents avec le seul seuil que le
   produit s'imposait déjà — les 60 % de cadence de computeRunWalkBreakdown, qui
   était le bon réflexe appliqué à un seul endroit. */
const ELEV_COVERAGE_THRESHOLDS = {
  high: 0.85,   // au-dessus : la couverture ne limite plus la conclusion
  usable: 0.60, // au-dessus : exploitable, mais la confiance est plafonnée à « moyenne »
  // en dessous de `usable` : aucune conclusion n'est tirée de ce signal
};

function elevCoverageLevel(ratio) {
  if (ratio == null || !isFinite(ratio)) return 'none';
  if (ratio >= ELEV_COVERAGE_THRESHOLDS.high) return 'high';
  if (ratio >= ELEV_COVERAGE_THRESHOLDS.usable) return 'usable';
  return 'insufficient';
}

/* Plafond de confiance imposé par la couverture. C'est le garde-fou central :
   aucun calcul en aval ne peut annoncer une confiance supérieure à ce que sa
   couverture autorise. */
function elevCapConfidence(wanted, coverageRatio) {
  const lvl = elevCoverageLevel(coverageRatio);
  if (lvl === 'insufficient' || lvl === 'none') return 'none';
  if (lvl === 'usable' && wanted === 'high') return 'medium';
  return wanted;
}

/* --------------------------- couverture par signal ---------------------------
   Matrice demandée par l'audit §5.2. Un signal est « couvert » sur la part du
   TEMPS de la séance où il est défini, pas sur la part des points : deux points
   espacés de 30 s ne pèsent pas comme deux points espacés d'une seconde.

   `usage` dit ce que la couverture mesurée autorise — et le dit en clair, pour
   que l'interface n'ait pas à réinventer la règle à chaque écran. */

const ELEV_SIGNALS = [
  { key:'alt',        field:'alt',         label:'Altitude',           usage:'Profil, D+, pente' },
  { key:'hr',         field:'hr',          label:'Fréquence cardiaque', usage:'Zones, effort' },
  { key:'cadence',    field:'cadenceSpm',  label:'Cadence',             usage:'Course / marche' },
  { key:'gps',        field:'lat',         label:'GPS',                 usage:'Carte, segments comparables' },
  { key:'power',      field:'power',       label:'Puissance',           usage:'Effort externe' },
];

/* Durée totale réellement échantillonnée : somme des intervalles plausibles.
   Un trou de plus de 120 s (pause longue, perte de capteur) n'est compté ni au
   numérateur ni au dénominateur — le compter au dénominateur ferait chuter la
   couverture d'une séance parfaitement mesurée entrecoupée d'une pause. */
function elevSeriesCoverage(series, field) {
  const pts = Array.isArray(series) ? series : [];
  if (pts.length < 2) return { ratio: null, sec: 0, totalSec: 0 };
  let sec = 0, totalSec = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i].t - pts[i - 1].t;
    if (!dt || dt <= 0 || dt > 120) continue;
    totalSec += dt;
    if (pts[i][field] != null && pts[i - 1][field] != null) sec += dt;
  }
  return { ratio: totalSec > 0 ? sec / totalSec : null, sec, totalSec };
}

/* Couverture complète d'une séance, signal par signal.
   `source` reste volontairement inconnue : le parser conserve bien les messages
   `device_info` du fichier, mais rien n'y relie un appareil à un CHAMP précis
   (une ceinture peut être appairée sans fournir la FC enregistrée). Annoncer
   « ceinture » ou « poignet » serait exactement la supposition que l'audit
   interdit (§5.2, DATA-04). Le champ existe donc, et vaut null. */
function elevSessionCoverage(session) {
  const series = (session && session.series) || [];
  const out = { signals: {}, points: series.length };
  ELEV_SIGNALS.forEach(sig => {
    const cov = elevSeriesCoverage(series, sig.field);
    out.signals[sig.key] = {
      key: sig.key,
      label: sig.label,
      usage: sig.usage,
      ratio: cov.ratio,
      pct: cov.ratio == null ? null : Math.round(cov.ratio * 100),
      level: elevCoverageLevel(cov.ratio),
      sec: cov.sec,
      totalSec: cov.totalSec,
      source: null, // jamais deviné — voir commentaire ci-dessus
      provenance: cov.ratio ? 'observed' : 'unavailable',
    };
  });
  return out;
}

/* Couverture d'un signal sur un ENSEMBLE de séances (page Analyse, Objectifs).
   Pondérée par le temps, pas par le nombre de séances : une sortie de 4 h sans
   cadence pèse plus qu'une sortie de 30 min avec cadence. */
function elevAggregateCoverage(sessions, signalKey) {
  const sig = ELEV_SIGNALS.find(s => s.key === signalKey);
  if (!sig) return { ratio: null, level: 'none' };
  let sec = 0, totalSec = 0;
  (sessions || []).forEach(s => {
    const cov = elevSeriesCoverage((s && s.series) || [], sig.field);
    sec += cov.sec; totalSec += cov.totalSec;
  });
  const ratio = totalSec > 0 ? sec / totalSec : null;
  return { ratio, pct: ratio == null ? null : Math.round(ratio * 100), level: elevCoverageLevel(ratio), sec, totalSec };
}

/* --------------------------- couverture d'historique ---------------------------
   Deuxième famille de couverture, distincte de la précédente et jusqu'ici
   absente : « ai-je assez de SEMAINES pour parler d'une tendance ? »

   L'audit (P1-4, P1-5) relève deux défauts qui viennent tous les deux de là :
   des deltas de +400 % contre une période de référence quasi vide, et une
   tendance de charge produite à partir de deux séances.

   Distinction que le produit tenait déjà ailleurs et qu'il faut préserver :
   une semaine à zéro À L'INTÉRIEUR de l'historique connu est une vraie donnée ;
   une semaine ANTÉRIEURE à la première séance importée n'existe pas. */
const ELEV_TREND_MIN_WEEKS = 4;        // §6.3 : aucune tendance sous 4 semaines couvertes
const ELEV_TREND_MIN_NON_EMPTY = 3;    // §6.3 : au moins 3 semaines non vides
const ELEV_BASELINE_MIN_RATIO = 0.6;   // une référence doit couvrir 60 % de la période comparée

/* `weeks` = tableau de valeurs hebdomadaires, du plus ancien au plus récent,
   déjà limité à l'historique réellement disponible. */
function elevHistoryCoverage(weeks) {
  const arr = Array.isArray(weeks) ? weeks : [];
  const covered = arr.length;
  const nonEmpty = arr.filter(v => (typeof v === 'number' ? v : (v && v.km) || 0) > 0).length;
  return {
    covered, nonEmpty,
    enoughForTrend: covered >= ELEV_TREND_MIN_WEEKS && nonEmpty >= ELEV_TREND_MIN_NON_EMPTY,
    reason: covered < ELEV_TREND_MIN_WEEKS
      ? ('Historique de ' + covered + ' semaine' + (covered > 1 ? 's' : '') + ' seulement — il en faut ' + ELEV_TREND_MIN_WEEKS + ' pour parler de tendance.')
      : (nonEmpty < ELEV_TREND_MIN_NON_EMPTY
        ? ('Seulement ' + nonEmpty + ' semaine' + (nonEmpty > 1 ? 's' : '') + ' avec au moins une séance sur ' + covered + '.')
        : null),
  };
}

/* Une période de référence est-elle comparable à la période courante ?
   Compare des DURÉES réellement documentées, pas des durées calendaires : c'est
   précisément la confusion qui produisait les +400 %. */
function elevBaselineComparable(currentDays, previousCoveredDays) {
  if (!currentDays || currentDays <= 0) return { comparable:false, ratio:null, reason:'Période courante vide.' };
  const ratio = (previousCoveredDays || 0) / currentDays;
  if (ratio >= ELEV_BASELINE_MIN_RATIO) return { comparable:true, ratio, reason:null };
  return {
    comparable: false, ratio,
    reason: previousCoveredDays > 0
      ? 'Historique précédent incomplet : ' + Math.round(ratio * 100) + ' % de la période de comparaison est réellement documenté.'
      : 'Aucun historique avant cette période.',
  };
}

/* --------------------------- rendu partagé ---------------------------
   Une seule fabrique de badge, pour que « estimation » ait exactement la même
   apparence partout. Le symbole et le texte portent l'information ; la couleur
   ne fait que la renforcer (§6.3, INS-05). */
function elevQualityBadgeHtml(opts) {
  opts = opts || {};
  const prov = ELEV_PROVENANCE[opts.provenance] || null;
  const conf = ELEV_CONFIDENCE[opts.confidence] || null;
  const bits = [];
  if (prov) bits.push('<span class="dq-prov" data-prov="' + prov.key + '"><span class="dq-sym" aria-hidden="true">' + prov.symbol + '</span>' + prov.label + '</span>');
  if (opts.coveragePct != null) bits.push('<span class="dq-cov">Couverture ' + opts.coveragePct + '&nbsp;%</span>');
  if (conf) bits.push('<span class="dq-conf" data-conf="' + conf.key + '"><span class="dq-sym" aria-hidden="true">' + conf.symbol + '</span>' + conf.label + '</span>');
  if (!bits.length) return '';
  return '<p class="data-quality">' + bits.join('<span class="dq-sep" aria-hidden="true">·</span>') + '</p>';
}

/* Valeur indisponible : jamais un 0, jamais un tiret muet. On dit ce qui manque. */
function elevUnavailableHtml(what, why) {
  return '<p class="data-unavailable"><span class="dq-sym" aria-hidden="true">—</span> ' +
    (what || 'Donnée indisponible') + (why ? ' <span class="du-why">' + why + '</span>' : '') + '</p>';
}

if (typeof window !== 'undefined') {
  window.ELEV_PROVENANCE = ELEV_PROVENANCE;
  window.ELEV_CONFIDENCE = ELEV_CONFIDENCE;
  window.ELEV_SIGNALS = ELEV_SIGNALS;
}
