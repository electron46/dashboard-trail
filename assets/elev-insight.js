/* =============================================================================
   ELEV Insight 2.0 — contrat, garde-fous, priorisation
   Audit ELEV 2.0, §6 — exigences INS-01 à INS-07.

   Constat de départ (§12) : cinq moteurs d'insight coexistaient — séance,
   analyse, accueil, objectif, plan — chacun avec sa propre notion de ce qu'est
   une observation valable, et aucun ne portait sa référence ni sa confiance.
   Le texte avait donc l'autorité visuelle d'une conclusion sans en avoir le
   contrat. Ce fichier est ce contrat.

   Ce que ce module fait :
     - impose une forme unique à toute observation (makeInsight) ;
     - refuse celles qui violent un garde-fou, AVANT tout affichage ;
     - les classe par importance produit, pas par ordre d'écriture ;
     - limite chaque écran à 1 principal + 2 secondaires, familles distinctes.

   Ce que ce module ne fait pas : décider du texte. Chaque page reste maîtresse
   de ce qu'elle observe — elle ne l'est plus de ce qu'elle a le droit d'en
   conclure.

   Chargé APRÈS elev-data-quality.js, AVANT assets/app.js.
   ============================================================================= */

/* --------------------------- familles ---------------------------
   Une famille = un type de sujet. La règle « jamais deux messages de la même
   famille sur le même écran » (§6.4) empêche trois variantes du même constat de
   volume d'occuper les trois emplacements disponibles. */
const INSIGHT_FAMILIES = {
  data:      { key:'data',      label:'Qualité de donnée' },
  terrain:   { key:'terrain',   label:'Terrain' },
  effort:    { key:'effort',    label:'Effort' },
  load:      { key:'load',      label:'Charge' },
  plan:      { key:'plan',      label:'Plan' },
  objective: { key:'objective', label:'Objectif' },
  compare:   { key:'compare',   label:'Comparaison' },
};

/* --------------------------- importance ---------------------------
   Ordre imposé par l'audit §6.4. Une alerte de qualité de donnée passe AVANT
   une recommandation sportive : conseiller quoi que ce soit à partir d'une
   donnée qu'on sait douteuse est pire que se taire. */
const INSIGHT_IMPORTANCE = {
  critical:  { key:'critical',  label:'Critique',  rank:5 },
  attention: { key:'attention', label:'Attention', rank:4 },
  notable:   { key:'notable',   label:'Notable',   rank:3 },
  progress:  { key:'progress',  label:'Progrès',   rank:2 },
  context:   { key:'context',   label:'Contexte',  rank:1 },
};

/* Rang de famille, départage à importance égale (§6.4, ordre 1 à 5). */
const INSIGHT_FAMILY_RANK = { data:5, plan:4, objective:4, terrain:3, effort:3, compare:3, load:2 };

/* --------------------------- le contrat ---------------------------
   `makeInsight` est le SEUL constructeur autorisé. Un objet littéral fabriqué
   ailleurs ne passera pas insightIsValid(), donc ne s'affichera pas.

   Champs (§6.2) :
     id          identifiant stable — sert aux tests et au retour utilisateur
     family      voir INSIGHT_FAMILIES
     observation le fait mesuré, quantifié
     reference   à quoi il est comparé — sans référence, un écart n'est pas lisible
     delta       l'écart lui-même, quand il a un sens
     coverage    part des données réellement exploitables (0 à 1)
     confidence  high | medium | low  (jamais porté par la seule couleur)
     importance  voir INSIGHT_IMPORTANCE
     why         la conséquence pour la lecture
     action      facultative, et seulement si elle est justifiée
     limits      ce que l'observation ne dit PAS
     evidence    identifiants de séances et champs sources
     method      comment le nombre a été obtenu
     window      la fenêtre temporelle couverte
*/
function makeInsight(spec) {
  spec = spec || {};
  return {
    id: spec.id || null,
    family: spec.family || null,
    title: spec.title || null,
    observation: spec.observation || null,
    reference: spec.reference || null,
    delta: spec.delta != null ? spec.delta : null,
    coverage: spec.coverage != null ? spec.coverage : null,
    confidence: spec.confidence || 'low',
    importance: spec.importance || 'context',
    why: spec.why || null,
    action: spec.action || null,
    limits: spec.limits || null,
    evidence: Array.isArray(spec.evidence) ? spec.evidence : [],
    method: spec.method || null,
    window: spec.window || null,
  };
}

/* --------------------------- garde-fous ---------------------------
   §6.3. Chaque règle correspond à un défaut réellement observé dans l'audit,
   pas à un principe général. `insightRejectionReason` retourne null si
   l'observation est publiable, sinon la raison — utile en test comme en
   débogage, et jamais affichée telle quelle à l'utilisateur. */

const INSIGHT_MIN_COMPARABLE = 3; // §6.3 : aucune comparaison sous 3 références comparables

/* Vocabulaire interdit. La liste ne vise pas la prudence en général : chaque
   entrée cible une famille de phrase que le produit a réellement affichée ou
   pouvait afficher, et que l'audit relève (§6.3, garde-fous scientifiques). */
const INSIGHT_FORBIDDEN = [
  { re:/\bsurentra[îi]nement\b/i,                   why:"« surentraînement » présenté comme un fait acquis" },
  { re:/\brisque de blessure\b|\btu vas te blesser\b/i, why:"prédiction de blessure" },
  { re:/\bblessure imminente\b|\bpr[ée]vient une blessure\b/i, why:"prédiction de blessure" },
  { re:/\bfragilis[ée]e?\b/i,                        why:"affirmation sur l'état d'une zone du corps" },
  { re:/\bdiagnostic\b|\bpathologie\b|\bsympt[ôo]me\b/i, why:"langage diagnostique" },
];

/* La récupération n'est PAS suivie par ELEV : ni sommeil, ni VFC quotidienne,
   ni FC de repos dans le temps, ni ressenti. Toute phrase qui conseille de la
   surveiller prétend donc lire une donnée absente (P1-5, §5.4). */
const INSIGHT_RECOVERY_RE = /\br[ée]cup[ée]ration\b|\bre?pos\b(?!\s*card)|\bfatigue\b/i;

function insightRejectionReason(ins, ctx) {
  ctx = ctx || {};
  if (!ins || !ins.id || !ins.family) return 'insight sans identifiant ou sans famille';
  if (!INSIGHT_FAMILIES[ins.family]) return 'famille inconnue : ' + ins.family;
  if (!INSIGHT_IMPORTANCE[ins.importance]) return 'importance inconnue : ' + ins.importance;
  if (!ins.observation) return 'aucune observation';

  // §6.2 : un écart sans référence n'est pas interprétable.
  if (ins.delta != null && !ins.reference) return 'un delta est annoncé sans référence';

  // §6.3 : couverture insuffisante = aucune conclusion, quelle que soit la confiance demandée.
  if (ins.coverage != null && elevCoverageLevel(ins.coverage) === 'insufficient')
    return 'couverture insuffisante (' + Math.round(ins.coverage * 100) + ' %)';

  // §6.3 : pas de comparaison sous 3 références comparables.
  if (ctx.comparableCount != null && ctx.comparableCount < INSIGHT_MIN_COMPARABLE)
    return 'seulement ' + ctx.comparableCount + ' référence(s) comparable(s), minimum ' + INSIGHT_MIN_COMPARABLE;

  // §6.3 : aucune tendance sous 4 semaines couvertes / 3 non vides.
  if (ctx.history && !ctx.history.enoughForTrend) return 'historique insuffisant pour une tendance';

  const texte = [ins.title, ins.observation, ins.why, ins.action, ins.reference].filter(Boolean).join(' ');

  const forbidden = INSIGHT_FORBIDDEN.find(f => f.re.test(texte));
  if (forbidden) return 'langage interdit — ' + forbidden.why;

  // §6.3 : aucun conseil de récupération sans données de récupération. On ne
  // bloque que la partie ACTION : décrire une charge en hausse reste légitime,
  // c'est en tirer une consigne de repos qui ne l'est pas.
  if (ins.action && INSIGHT_RECOVERY_RE.test(ins.action) && !ctx.hasRecoveryData)
    return 'conseil de récupération alors qu\'aucune donnée de récupération n\'est suivie';

  // §6.3 : toute estimation porte le mot « estimation ».
  if (ins.provenance === 'inferred' && !/estimation/i.test(texte + ' ' + (ins.method || '')))
    return 'estimation non nommée comme telle';

  return null;
}

function insightIsValid(ins, ctx) { return insightRejectionReason(ins, ctx) === null; }

/* --------------------------- priorisation ---------------------------
   Trie, filtre les invalides, dédoublonne par famille, et découpe en
   1 principal + 2 secondaires (§6.4). Le reste n'est pas perdu : il part dans
   `dropped`, ce qui permet à une page « Analyse avancée » de le montrer et aux
   tests de vérifier qu'on n'a pas silencieusement jeté une alerte. */
function prioritizeInsights(list, ctx) {
  ctx = ctx || {};
  const rejected = [];
  const valid = (list || []).filter(ins => {
    const reason = insightRejectionReason(ins, (ctx.perInsight && ctx.perInsight[ins && ins.id]) || ctx);
    if (reason) { rejected.push({ id: ins && ins.id, reason }); return false; }
    return true;
  });

  valid.sort((a, b) => {
    const ia = INSIGHT_IMPORTANCE[a.importance].rank, ib = INSIGHT_IMPORTANCE[b.importance].rank;
    if (ia !== ib) return ib - ia;
    const fa = INSIGHT_FAMILY_RANK[a.family] || 0, fb = INSIGHT_FAMILY_RANK[b.family] || 0;
    if (fa !== fb) return fb - fa;
    const ca = (ELEV_CONFIDENCE[a.confidence] || ELEV_CONFIDENCE.none).rank;
    const cb = (ELEV_CONFIDENCE[b.confidence] || ELEV_CONFIDENCE.none).rank;
    return cb - ca;
  });

  const seen = new Set(), kept = [], dropped = [];
  valid.forEach(ins => {
    if (seen.has(ins.family)) { dropped.push(ins); return; }
    seen.add(ins.family); kept.push(ins);
  });

  return {
    primary: kept[0] || null,
    secondary: kept.slice(1, 3),
    dropped: dropped.concat(kept.slice(3)),
    rejected,
  };
}

/* --------------------------- retour utilisateur (local) ---------------------------
   §17, exigence EXT-06. Purement local : rien n'est envoyé nulle part, ce qui
   respecte « private by default ». Sert à masquer une famille d'observation que
   l'utilisateur juge inutile, et à mesurer plus tard laquelle porte réellement.
   La remontée distante, elle, demanderait une décision explicite. */
const INSIGHT_FEEDBACK_KEY = 'trail:insightFeedback';
function getInsightFeedback() {
  try { return JSON.parse(localStorage.getItem(INSIGHT_FEEDBACK_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
function setInsightFeedback(id, verdict) {
  if (!id) return false;
  try {
    const all = getInsightFeedback();
    if (verdict == null) delete all[id]; else all[id] = { verdict, at: new Date().toISOString() };
    localStorage.setItem(INSIGHT_FEEDBACK_KEY, JSON.stringify(all));
    return true;
  } catch (e) { return false; }
}

/* --------------------------- rendu partagé (InsightCard) ---------------------------
   §10, composant InsightCard. Un seul rendu pour toutes les pages : c'est ce
   qui garantit que la référence et la confiance ne peuvent pas être « oubliées »
   sur un écran particulier — elles font partie du composant, pas du texte.

   « Pourquoi ? » et les preuves vivent dans un <details> : présents pour qui
   veut vérifier, absents du premier coup d'œil. */
function insightCardHtml(ins, opts) {
  if (!ins) return '';
  opts = opts || {};
  const fam = INSIGHT_FAMILIES[ins.family] || { label: '' };
  const imp = INSIGHT_IMPORTANCE[ins.importance] || INSIGHT_IMPORTANCE.context;
  const conf = ELEV_CONFIDENCE[ins.confidence] || ELEV_CONFIDENCE.none;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  const meta = [];
  if (ins.window) meta.push('<span class="ins-window">' + esc(ins.window) + '</span>');
  if (ins.coverage != null) meta.push('<span class="ins-cov">Couverture ' + Math.round(ins.coverage * 100) + '&nbsp;%</span>');
  meta.push('<span class="ins-conf" data-conf="' + conf.key + '"><span class="dq-sym" aria-hidden="true">' + conf.symbol + '</span>' + esc(conf.label) + '</span>');

  const detail = [];
  if (ins.why) detail.push('<p><strong>Pourquoi&nbsp;:</strong> ' + esc(ins.why) + '</p>');
  if (ins.method) detail.push('<p><strong>Méthode&nbsp;:</strong> ' + esc(ins.method) + '</p>');
  if (ins.limits) detail.push('<p><strong>Ce que cela ne dit pas&nbsp;:</strong> ' + esc(ins.limits) + '</p>');
  if (ins.evidence && ins.evidence.length)
    detail.push('<p><strong>Preuves&nbsp;:</strong> ' + esc(ins.evidence.length) + ' séance' + (ins.evidence.length > 1 ? 's' : '') + ' et champs sources utilisés.</p>');

  const h = opts.headingLevel || 3;
  return '<article class="insight-card' + (opts.primary ? ' insight-card--primary' : '') + '" data-family="' + esc(ins.family) + '" data-importance="' + esc(ins.importance) + '" data-insight-id="' + esc(ins.id) + '">' +
    '<p class="ins-eyebrow"><span class="ins-fam">' + esc(fam.label) + '</span>' +
      (imp.rank >= 4 ? '<span class="ins-imp" data-imp="' + imp.key + '">' + esc(imp.label) + '</span>' : '') + '</p>' +
    '<h' + h + ' class="ins-title">' + esc(ins.title || ins.observation) + '</h' + h + '>' +
    (ins.title ? '<p class="ins-obs">' + esc(ins.observation) + '</p>' : '') +
    (ins.reference ? '<p class="ins-ref">Comparé à&nbsp;: ' + esc(ins.reference) + '</p>' : '') +
    (ins.action ? '<p class="ins-action">' + esc(ins.action) + '</p>' : '') +
    '<p class="ins-meta">' + meta.join('<span class="dq-sep" aria-hidden="true">·</span>') + '</p>' +
    (detail.length ? '<details class="ins-detail"><summary>Comment ELEV le sait</summary>' + detail.join('') + '</details>' : '') +
  '</article>';
}

/* Rend un bloc complet (1 principal + 2 secondaires) ou un état honnête quand
   rien n'est publiable — jamais une carte vide conservée pour remplir (§7). */
function insightBlockHtml(result, opts) {
  opts = opts || {};
  if (!result || (!result.primary && !(result.secondary || []).length)) {
    return '<div class="insight-empty"><p>' + (opts.emptyText ||
      "Pas encore assez de données pour une observation fiable. ELEV préfère ne rien conclure plutôt que d'avancer un chiffre que tes séances ne soutiennent pas.") + '</p></div>';
  }
  return (result.primary ? insightCardHtml(result.primary, { primary: true, headingLevel: opts.headingLevel }) : '') +
    ((result.secondary || []).length
      ? '<div class="insight-secondary">' + result.secondary.map(i => insightCardHtml(i, { headingLevel: (opts.headingLevel || 3) + 1 })).join('') + '</div>'
      : '');
}

if (typeof window !== 'undefined') {
  window.INSIGHT_FAMILIES = INSIGHT_FAMILIES;
  window.INSIGHT_IMPORTANCE = INSIGHT_IMPORTANCE;
  window.INSIGHT_MIN_COMPARABLE = INSIGHT_MIN_COMPARABLE;
}
