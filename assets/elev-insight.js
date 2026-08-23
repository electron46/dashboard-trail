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
/* --------------------------- V2 : provenance et quatre blocs ---------------------------
   Audit Insight V2, §1 et §13 (P0).

   DEUX CORRECTIFS DE FOND ICI.

   1. `provenance` n'était PAS conservé. Le champ était passé par les générateurs, testé par
      `insightRejectionReason` (« toute estimation porte le mot estimation »)… et perdu entre les
      deux, puisque ce constructeur ne le recopiait pas. Le garde-fou était donc mort-né : un test
      d'exécution de l'audit retournait `{"provenance":null,"rejection":null}` pour une estimation
      non nommée. Une seule ligne manquait, et elle désactivait une règle entière.

   2. Observation, interprétation, recommandation et incertitude sont désormais QUATRE champs
      distincts (§9.1, principe 2 : « une donnée n'est jamais une conclusion »). Ils étaient
      mélangés dans `observation`/`why`/`action`/`limits`, dont les noms ne disaient pas le statut
      épistémique — « why » peut aussi bien porter un fait qu'une déduction.

   Les anciens noms restent acceptés en entrée ET exposés en sortie : dix-neuf générateurs les
   emploient, et les migrer d'un bloc ferait perdre le bénéfice du contrat pendant la migration.
   `statement` porte la forme canonique, les alias plats la même valeur. */
function makeInsight(spec) {
  spec = spec || {};
  const observation    = spec.observation || null;
  const interpretation = spec.interpretation || spec.why || null;
  const recommendation = spec.recommendation || spec.action || null;
  const uncertainty    = spec.uncertainty || spec.limits || null;
  const conf = _tripleConfidence(spec);

  return {
    id: spec.id || null,
    family: spec.family || null,
    title: spec.title || null,

    // Forme canonique : le statut de chaque phrase est porté par son nom de champ.
    statement: { observation, interpretation, recommendation, uncertainty },
    // Alias plats, rétrocompatibles (rendu partagé, générateurs et tests existants).
    observation, interpretation, recommendation, uncertainty,
    why: interpretation, action: recommendation, limits: uncertainty,

    reference: spec.reference || null,
    delta: spec.delta != null ? spec.delta : null,
    coverage: spec.coverage != null ? spec.coverage : null,
    /* La confiance affichee est la RESULTANTE plafonnee par la plus faible des trois
       dimensions (donnee, inference, preuve scientifique). Jamais une moyenne : moyenner
       remonterait une conclusion fragile des que la donnee est propre. */
    confidence: conf.overall,
    importance: spec.importance || 'context',
    // LE correctif : la provenance survit désormais au constructeur.
    provenance: spec.provenance || null,
    evidence: Array.isArray(spec.evidence) ? spec.evidence : [],
    method: spec.method || null,
    window: spec.window || null,

    /* Traçabilité (§10.2). Facultatifs : un insight qui ne les porte pas reste valide, mais
       celui qui les porte devient vérifiable — on peut remonter du texte affiché à la métrique,
       à sa version et aux valeurs qui l'ont produit. */
    metricId: spec.metricId || null,
    definitionVersion: spec.definitionVersion || null,
    values: spec.values || null,
    claimId: spec.claimId || null,

    /* TROIS CONFIANCES SÉPARÉES (§9.1 principe 3, §10.2, P1-C).

       « Données propres » ne signifie pas « conclusion solide ». Le rapport de charge en est
       l'exemple type : ses données sont exactes (confiance de donnée haute) et son usage
       prédictif n'est pas soutenu par la littérature (preuve scientifique faible). Une seule
       jauge confondait les deux et donnait à la seconde l'autorité de la première.

       `confidence` reste le champ historique et devient la RÉSULTANTE : jamais supérieure à la
       plus faible des trois. Un plafond, jamais une moyenne — moyenner remonterait une conclusion
       fragile dès que la donnée est propre. */
    confidenceDetail: conf,
  };
}

const _CONF_ORDER = ['none', 'low', 'medium', 'high'];
function _confFromScore(score) {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}
function _tripleConfidence(spec) {
  const data = spec.dataConfidence || spec.confidence || 'low';
  const inference = spec.inferenceConfidence || data;
  /* La dimension scientifique ne plafonne QUE si elle est réellement déclarée. Sans `claimId`,
     elle est inconnue — et plafonner sur une information qu'on n'a pas serait aussi faux que de
     l'ignorer quand on l'a. C'est ce qui permet d'attacher les preuves progressivement, sans
     dégrader d'un coup toutes les observations qui n'en portent pas encore. */
  const grade = (spec.claimId && typeof evidenceGrade === 'function') ? evidenceGrade(spec.claimId) : null;
  const science = grade ? _confFromScore(grade.score) : null;
  const dims = [data, inference].concat(science ? [science] : []);
  const overall = dims.reduce((min, c) => (_CONF_ORDER.indexOf(c) < _CONF_ORDER.indexOf(min) ? c : min), 'high');
  return {
    data, inference, science, overall,
    grade: grade ? grade.key : null,
    gradeLabel: grade ? grade.label : null,
    claimId: spec.claimId || null,
  };
}

/* Confiance affichable d'un insight : la résultante plafonnée quand le détail existe, sinon le
   champ historique. Les pages n'ont donc pas à connaître la règle du plafond. */
function insightConfidence(ins) {
  return (ins && ins.confidenceDetail && ins.confidenceDetail.overall) || (ins && ins.confidence) || 'none';
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

  // Le vocabulaire interdit est cherché dans TOUT ce qui sera lu, incertitude comprise : une
  // phrase de prudence peut nommer un diagnostic aussi sûrement qu'une conclusion.
  const texte = [ins.title, ins.observation, ins.interpretation, ins.recommendation, ins.uncertainty, ins.reference]
    .filter(Boolean).join(' ');

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

  /* §9.1 principe 6 : « l'action est plus exigeante que l'observation ». Un constat de niveau C
     (repère produit) peut être AFFICHÉ ; il ne peut pas fonder une consigne. Un niveau D ne peut
     jamais devenir une recommandation, même avec des données parfaites (§9.4). Sans `claimId`
     déclaré, la règle ne s'applique pas — on ne juge pas une preuve qu'on n'a pas énoncée. */
  if (ins.recommendation && ins.claimId && typeof evidenceAllowsAction === 'function'
      && !evidenceAllowsAction(ins.claimId)) {
    const g = typeof evidenceGrade === 'function' ? evidenceGrade(ins.claimId).key : '?';
    return 'recommandation adossée à une preuve de niveau ' + g + ' (une action exige A ou B)';
  }

  // §5.1 : un niveau X n'est jamais publiable, quelle que soit sa priorité.
  if (ins.claimId && typeof evidenceGrade === 'function' && evidenceGrade(ins.claimId).key === 'X')
    return 'affirmation de niveau X : non publiable';

  return null;
}

/* --------------------------- contradictions (§8.3, P1-D) ---------------------------
   « Les signaux opposés restent visibles et ne sont pas moyennés jusqu'à disparaître. »

   Deux situations sont réellement détectables avec les données d'ELEV — les autres cas du tableau
   §8.3 supposent un bien-être déclaré, qui n'existe pas encore :

   1. une alerte de QUALITÉ DE DONNÉE coexiste avec une conclusion tirée de ce même signal
      (« capteur FC incertain mais zones disponibles ») ;
   2. deux observations de la même famille pointent dans des directions opposées.

   La fonction ne masque rien : elle NOMME la tension pour que l'écran l'affiche. */
function detectInsightContradictions(list) {
  const items = (list || []).filter(Boolean);
  const out = [];

  const alertesDonnee = items.filter(i => i.family === 'data');
  const conclusionsEffort = items.filter(i => i.family === 'effort' || i.family === 'compare');
  if (alertesDonnee.length && conclusionsEffort.length) {
    out.push({
      kind: 'data-vs-conclusion',
      between: [alertesDonnee[0].id, conclusionsEffort[0].id],
      text: "Une alerte de qualité de donnée coexiste avec une conclusion tirée de ce même signal : lis la seconde en gardant la première à l'esprit.",
    });
  }

  const parFamille = new Map();
  items.forEach(i => {
    if (i.delta == null) return;
    const k = i.family;
    if (!parFamille.has(k)) parFamille.set(k, []);
    parFamille.get(k).push(i);
  });
  parFamille.forEach((groupe, famille) => {
    const positifs = groupe.filter(i => i.delta > 0), negatifs = groupe.filter(i => i.delta < 0);
    if (positifs.length && negatifs.length) {
      out.push({
        kind: 'opposite-directions', famille,
        between: [positifs[0].id, negatifs[0].id],
        text: 'Deux observations de la même famille vont en sens contraire. ELEV les affiche toutes les deux plutôt que d\'en faire une moyenne rassurante.',
      });
    }
  });

  return out;
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

  /* Score de priorité (§9.4) :
       priorité = impact × confiance de donnée × confiance scientifique × actionabilité × nouveauté

     Multiplicatif, et c'est le point : un facteur nul annule le tout. Une somme pondérée
     laisserait une conclusion sans preuve remonter grâce à ses autres facteurs — exactement ce que
     l'audit reproche aux scores agrégés.

     RÈGLE DE SÉCURITÉ (§9.4) : une alerte critique ou d'attention n'est JAMAIS effacée par la
     nouveauté. Son facteur de nouveauté est maintenu au plafond, sinon un problème persistant
     disparaîtrait précisément parce qu'il dure. */
  const feedback = ctx.feedback || (typeof getInsightFeedback === 'function' ? getInsightFeedback() : {});
  const now = ctx.now ? new Date(ctx.now) : new Date();

  valid.forEach(ins => { ins._priority = insightPriorityScore(ins, feedback, now); });

  valid.sort((a, b) => {
    // L'importance reste la première clé : une alerte de qualité de donnée passe avant tout.
    const ia = INSIGHT_IMPORTANCE[a.importance].rank, ib = INSIGHT_IMPORTANCE[b.importance].rank;
    if (ia !== ib) return ib - ia;
    if (Math.abs(b._priority.score - a._priority.score) > 0.001) return b._priority.score - a._priority.score;
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
    /* Les tensions sont cherchées sur TOUTES les observations valides, pas seulement sur celles
       retenues à l'affichage. La règle « une observation par famille » est faite pour éviter trois
       variantes du même constat — mais deux constats de la même famille qui vont en sens CONTRAIRE
       sont précisément ce qu'il ne faut pas laisser disparaître. Les détecter après déduplication
       revenait à les masquer par un effet de bord. */
    contradictions: detectInsightContradictions(valid),
  };
}

/* --------------------------- priorité et répétition (§9.4, §9.5) --------------------------- */
const INSIGHT_IMPACT = { critical: 5, attention: 4, notable: 3, progress: 2, context: 1 };
const CONF_WEIGHT = { high: 1, medium: 0.7, low: 0.4, none: 0 };

/* Délais de répétition par importance (§9.5). Paramètres PRODUIT à tester, pas des seuils
   scientifiques — et l'audit le dit explicitement. */
const INSIGHT_COOLDOWN_DAYS = { critical: 0, attention: 7, notable: 14, progress: 14, context: 28 };

function insightPriorityScore(ins, feedback, now) {
  const fb = (feedback && feedback[ins.id]) || null;
  const impact = (INSIGHT_IMPACT[ins.importance] || 1) / 5;
  const detail = ins.confidenceDetail || {};
  const dataConf = CONF_WEIGHT[detail.data || ins.confidence] != null ? CONF_WEIGHT[detail.data || ins.confidence] : 0.4;
  // Sans preuve déclarée, la dimension scientifique est neutre (0,7) : ni bonus, ni pénalité.
  const sciConf = detail.science ? CONF_WEIGHT[detail.science] : 0.7;
  // Une observation sans action possible reste utile à lire, mais passe après une actionnable.
  const actionability = ins.recommendation ? 1 : 0.6;

  // Nouveauté : décroît pendant le délai de répétition, puis revient au plafond.
  let novelty = 1, cooldownLeft = 0;
  const cd = INSIGHT_COOLDOWN_DAYS[ins.importance] != null ? INSIGHT_COOLDOWN_DAYS[ins.importance] : 14;
  if (fb && fb.lastShownAt && cd > 0) {
    const jours = (now - new Date(fb.lastShownAt)) / 86400000;
    if (jours >= 0 && jours < cd) {
      novelty = Math.max(0.15, jours / cd);
      cooldownLeft = Math.ceil(cd - jours);
      // Un changement matériel rouvre le sujet avant la fin du délai (§9.5).
      if (fb.lastCalculationHash && ins.values && fb.lastCalculationHash !== JSON.stringify(ins.values)) {
        novelty = 1; cooldownLeft = 0;
      }
    }
  }
  // Sécurité : une alerte importante ne s'efface pas parce qu'elle dure.
  if (ins.importance === 'critical' || ins.importance === 'attention') { novelty = 1; cooldownLeft = 0; }
  // Un insight que l'utilisateur a masqué ne remonte pas — sauf s'il est critique.
  if (fb && fb.verdict === 'hidden' && ins.importance !== 'critical') novelty = 0;

  return {
    score: +(impact * dataConf * sciConf * actionability * novelty).toFixed(4),
    impact, dataConf, sciConf, actionability, novelty, cooldownLeft,
  };
}

/* Mémorise qu'un insight a été montré : c'est ce qui alimente la nouveauté et le délai de
   répétition. Purement local, comme le retour utilisateur (§10.4). */
function noteInsightsShown(list, nowISO) {
  if (typeof getInsightFeedback !== 'function') return;
  try {
    const all = getInsightFeedback();
    const at = nowISO || new Date().toISOString();
    (list || []).filter(Boolean).forEach(ins => {
      const prev = all[ins.id] || {};
      all[ins.id] = Object.assign({}, prev, {
        firstShownAt: prev.firstShownAt || at,
        lastShownAt: at,
        shownCount: (prev.shownCount || 0) + 1,
        lastCalculationHash: ins.values ? JSON.stringify(ins.values) : (prev.lastCalculationHash || null),
      });
    });
    localStorage.setItem(INSIGHT_FEEDBACK_KEY, JSON.stringify(all));
  } catch (e) { /* le stockage peut être plein : ne jamais casser un rendu pour un compteur */ }
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

  /* Volet de preuve — InsightCard V2 (§9.6). Le premier niveau reste lisible par quelqu'un qui
     ne veut pas de science ; ce volet répond à « comment ELEV le sait » avec de quoi vérifier :
     interprétation, méthode, version de la règle, valeurs employées, niveau de preuve, sources
     réelles, limites et date de revue. */
  const detail = [];
  if (ins.interpretation) detail.push('<p><strong>Ce que cela suggère&nbsp;:</strong> ' + esc(ins.interpretation) + '</p>');
  if (ins.method) detail.push('<p><strong>Méthode&nbsp;:</strong> ' + esc(ins.method) +
    (ins.definitionVersion ? ' <span class="ins-ver">(règle v' + esc(ins.definitionVersion) + ')</span>' : '') + '</p>');

  /* Définition formelle de la métrique citée (registre elev-metrics.js) : formule, unité et
     minimums. Absente du volet quand la métrique n'est pas déclarée — mieux vaut ne rien montrer
     qu'une définition approximative. */
  if (ins.metricId && typeof elevMetric === 'function') {
    const m = elevMetric(ins.metricId);
    if (m) {
      detail.push('<p><strong>Formule&nbsp;:</strong> ' + esc(elevMetricSummary(ins.metricId)) +
        ' <span class="ins-ver">(métrique v' + esc(m.version) + ')</span></p>');
      const mins = Object.entries(m.minimums || {});
      if (mins.length)
        detail.push('<p class="ins-note">Minimums exigés&nbsp;: ' +
          esc(mins.map(([k, v]) => k + ' ≥ ' + v).join(', ')) + '. En dessous, la métrique reste indisponible plutôt que de valoir zéro.</p>');
    }
  }

  // Trois confiances séparées : une donnée propre ne fait pas une conclusion solide.
  const cd = ins.confidenceDetail;
  if (cd) {
    const l = k => (ELEV_CONFIDENCE[k] || ELEV_CONFIDENCE.none).short;
    detail.push('<p><strong>Confiance&nbsp;:</strong> donnée ' + esc(l(cd.data)) +
      ' · inférence ' + esc(l(cd.inference)) +
      (cd.science ? ' · preuve scientifique ' + esc(l(cd.science)) : ' · preuve scientifique non déclarée') +
      '. La confiance affichée est la plus faible des trois, jamais leur moyenne.</p>');
  }

  // Niveau de preuve et sources réelles. Aucune citation n'est fabriquée : sans source déclarée,
  // la carte dit qu'il s'agit d'un repère ELEV plutôt que d'inventer une référence.
  if (ins.claimId && typeof evidenceClaim === 'function') {
    const claim = evidenceClaim(ins.claimId), grade = evidenceGrade(ins.claimId);
    if (claim) {
      detail.push('<p><strong>Niveau de preuve&nbsp;:</strong> ' + esc(grade.key) + ' — ' + esc(grade.label) +
        '. ' + esc(claim.claim) + '</p>');
      const srcs = evidenceSources(ins.claimId);
      if (srcs.length)
        detail.push('<p><strong>Sources&nbsp;:</strong></p><ul class="ins-sources">' +
          srcs.map(sc => '<li>' + esc(evidenceCitation(sc)) + '</li>').join('') + '</ul>');
      else
        detail.push('<p class="ins-note">Aucune source publiée ne soutient directement ce repère&nbsp;: c\'est une convention ELEV, pas une norme.</p>');
      if (claim.limitations && claim.limitations.length)
        detail.push('<p><strong>Limites connues&nbsp;:</strong></p><ul class="ins-sources">' +
          claim.limitations.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>');
      detail.push('<p class="ins-note">Règle revue le ' + esc(claim.reviewedAt) + ', à réexaminer avant le ' + esc(claim.reviewDueAt) + '.</p>');
    }
  }

  if (ins.uncertainty) detail.push('<p><strong>Ce que cela ne dit pas&nbsp;:</strong> ' + esc(ins.uncertainty) + '</p>');
  if (ins.values && Object.keys(ins.values).length)
    detail.push('<p><strong>Valeurs utilisées&nbsp;:</strong> ' +
      esc(Object.entries(ins.values).map(([k, v]) => k + ' = ' + v).join(' · ')) + '</p>');
  if (ins.evidence && ins.evidence.length)
    detail.push('<p><strong>Séances sources&nbsp;:</strong> ' + esc(ins.evidence.length) + ' séance' + (ins.evidence.length > 1 ? 's' : '') + ' et champs utilisés.</p>');

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
  /* Contradictions (§8.3) : affichées AVANT les observations, parce qu'elles conditionnent leur
     lecture. Elles ne remplacent aucune observation et n'en masquent aucune — c'est précisément
     l'inverse de les moyenner jusqu'à ce qu'elles disparaissent. */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const contra = (result.contradictions || []).length
    ? '<div class="insight-contradiction" role="note"><p><span class="dq-sym" aria-hidden="true">⚠</span>' +
        result.contradictions.map(c => esc(c.text)).join(' ') + '</p></div>'
    : '';

  const montres = [result.primary].concat(result.secondary || []).filter(Boolean);

  /* L'historique d'affichage est écrit ICI, dans le composant partagé, et non par chaque page.
     Raison : `noteInsightsShown` a d'abord été écrite comme fonction autonome… que personne
     n'appelait. Le délai de répétition était donc inerte — le même défaut que `provenance`, un
     mécanisme complet mais débranché. Le composant est le seul endroit qui sache ce qui est
     RÉELLEMENT montré, donc le seul où l'oubli est impossible.
     `opts.silent` existe pour la page de documentation et les tests, qui rendent des exemples. */
  if (!opts.silent && montres.length) { try { noteInsightsShown(montres); } catch (e) {} }

  /* Vue avancée (§13, P1) : « montrer les insights valides non retenus ». Ils existent, ils sont
     valides, et seule la règle « une observation par famille » les écarte de la vue principale.
     Les garder invisibles reviendrait à décider à la place de l'utilisateur ce qu'il a le droit
     de lire. Repliés par défaut : ce sont des observations secondaires, pas du bruit à masquer. */
  const autres = (result.dropped || []).filter(Boolean);
  const plus = autres.length
    ? '<details class="insight-more"><summary>Autres observations (' + autres.length + ')</summary>' +
        '<p class="ins-note">Valides, mais écartées de la vue principale : ELEV n\'affiche qu\'une observation par famille pour éviter trois variantes du même constat.</p>' +
        autres.map(i => insightCardHtml(i, { headingLevel: (opts.headingLevel || 3) + 1 })).join('') +
      '</details>'
    : '';

  return contra +
    (result.primary ? insightCardHtml(result.primary, { primary: true, headingLevel: opts.headingLevel }) : '') +
    ((result.secondary || []).length
      ? '<div class="insight-secondary">' + result.secondary.map(i => insightCardHtml(i, { headingLevel: (opts.headingLevel || 3) + 1 })).join('') + '</div>'
      : '') +
    plus;
}

if (typeof window !== 'undefined') {
  window.INSIGHT_FAMILIES = INSIGHT_FAMILIES;
  window.INSIGHT_IMPORTANCE = INSIGHT_IMPORTANCE;
  window.INSIGHT_MIN_COMPARABLE = INSIGHT_MIN_COMPARABLE;
}
