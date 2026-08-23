/* =============================================================================
   ELEV — politique de sortie IA
   Audit scientifique ELEV Insight V2 (23 août 2026), §9.7, §11.1 et §14 lot 4.

   Constat de départ (§4.3) : les deux sorties IA — coach post-séance et estimation de temps de
   course — recevaient un résumé textuel et rendaient du texte libre. Le modèle CALCULAIT et
   INTERPRÉTAIT donc lui-même, sans objet de preuve, hors du contrat commun et hors de tous les
   garde-fous. L'exemple du prompt coach allait jusqu'à prescrire « Prioriser la récupération » et
   « 48 h de vigilance » — un délai inventé, alors qu'ELEV ne mesure ni sommeil, ni FC de repos,
   ni ressenti, et n'a donc aucune donnée de récupération.

   Le principe appliqué ici est celui de l'audit (§9.1) : LE CALCUL PRÉCÈDE LE TEXTE. Un objet
   déterministe est construit d'abord ; l'IA ne reçoit que lui ; elle peut reformuler, condenser
   et hiérarchiser ; elle ne peut ajouter ni mesure, ni cause, ni délai, ni recommandation.

   Ce module ne parle à aucun réseau. Il construit l'objet autorisé et valide ce qui revient.
   La façade serveur (supabase/functions/ai-proxy) et ses protections sont inchangées : aucun
   secret n'entre dans le navigateur.

   Chargé APRÈS elev-insight.js, AVANT assets/app.js.
   ============================================================================= */

/* --------------------------- ce que l'IA n'a jamais le droit d'écrire ---------------------------
   Étend le vocabulaire déjà interdit aux insights déterministes (INSIGHT_FORBIDDEN) aux
   formulations que seul un modèle génératif produit : délais de récupération, pronostics,
   causalité affirmée. Chaque entrée correspond à un cas relevé par l'audit, pas à une prudence
   générale. */
const AI_FORBIDDEN = [
  { re: /\bsurentra[îi]nement\b/i,                          why: '« surentraînement » présenté comme un fait' },
  { re: /\brisque de blessure\b|\btu vas te blesser\b/i,     why: 'prédiction de blessure' },
  { re: /\bblessure imminente\b/i,                           why: 'prédiction de blessure' },
  { re: /\bfragilis[ée]e?\b/i,                               why: "affirmation sur l'état d'une zone du corps" },
  { re: /\bdiagnostic\b|\bpathologie\b|\bsympt[ôo]me\b/i,    why: 'langage diagnostique' },
  // §7.1 : « 48 h de vigilance » — un délai que rien ne mesure.
  { re: /\b\d+\s*(h|heures?|jours?)\s+(de\s+)?(r[ée]cup[ée]ration|repos|vigilance|coupure)\b/i, why: 'délai de récupération prescrit' },
  { re: /\bprioriser la r[ée]cup[ée]ration\b|\bprends? du repos\b|\brepose[- ]toi\b/i,          why: 'consigne de récupération sans donnée de récupération' },
  { re: /\btu es (fatigu|[ée]puis)/i,                        why: 'état de fatigue affirmé, non mesuré' },
  { re: /\bta r[ée]cup[ée]ration est\b/i,                    why: 'état de récupération affirmé, non mesuré' },
];

/* Termes de causalité. L'audit (§6.3, réf. Achten 2003, Souissi 2021, Wingo 2012) insiste : une
   dérive de FC ne s'explique pas par la condition physique, la chaleur et l'hydratation n'étant
   pas connues. L'IA ne doit donc pas relier deux observations par un lien de cause. */
const AI_CAUSAL = /\b(donc|à cause de|parce que tu|ce qui prouve|s'explique par|est d[ûu] à|entra[îi]ne une?)\b/i;

/* --------------------------- l'objet déterministe autorisé ---------------------------
   §9.7 : « Toute sortie IA doit être comparée aux identifiants, valeurs, unités et actions
   autorisées de l'objet source. » `buildAllowedFacts` construit cet objet : les nombres que le
   texte a le droit d'employer, et rien d'autre. */
function _pushNum(set, v, digits) {
  if (v == null || !isFinite(v)) return;
  set.add(+Number(v).toFixed(digits == null ? 0 : digits));
  set.add(Math.round(Number(v)));
}

function buildAllowedFacts(spec) {
  spec = spec || {};
  const numbers = new Set();
  const fields = [];

  (spec.values || []).forEach(v => {
    if (v == null) return;
    if (typeof v === 'number') { _pushNum(numbers, v, 1); _pushNum(numbers, v, 0); }
  });

  const addSession = (s, prefix) => {
    if (!s) return;
    /* Les deux côtés ne nomment pas leurs champs pareil : une séance RÉALISÉE porte `ascent` et
       `descent`, une séance PLANIFIÉE porte `deniveleM` et `descenteM` (voir parsePlanCsv). Oublier
       les seconds revenait à interdire au modèle de citer la cible du plan — donc à rejeter une
       réponse parfaitement correcte. */
    [['distanceKm', 1], ['ascent', 0], ['descent', 0], ['deniveleM', 0], ['descenteM', 0],
     ['avgHr', 0], ['maxHr', 0], ['cadenceSpm', 0], ['avgPower', 0], ['avgTemp', 0]].forEach(([k, d]) => {
      if (s[k] != null) { _pushNum(numbers, s[k], d); fields.push(prefix + '.' + k); }
    });
    /* Une durée et une allure s'ÉCRIVENT décomposées : « 4h21 », « 6:30/km ». Le texte porte donc
       deux nombres pour une seule mesure, et refuser la décomposition revenait à interdire d'écrire
       une durée. */
    if (s.durationS != null) {
      _pushNum(numbers, Math.round(s.durationS / 60));
      _pushNum(numbers, Math.floor(s.durationS / 3600));
      _pushNum(numbers, Math.round((s.durationS % 3600) / 60));
      fields.push(prefix + '.durationS');
    }
    if (s.avgPaceSecPerKm != null) {
      _pushNum(numbers, s.avgPaceSecPerKm);
      _pushNum(numbers, Math.floor(s.avgPaceSecPerKm / 60));
      _pushNum(numbers, Math.round(s.avgPaceSecPerKm % 60));
      fields.push(prefix + '.avgPaceSecPerKm');
    }
  };
  addSession(spec.session, 'session');
  addSession(spec.planned, 'planned');
  (spec.history || []).forEach((h, i) => addSession(h, 'history[' + i + ']'));
  // Un compte est vérifiable : « 3 séances comparables » se lit dans les données fournies.
  if (Array.isArray(spec.history)) _pushNum(numbers, spec.history.length);
  if (Array.isArray(spec.zones)) _pushNum(numbers, spec.zones.length);
  Object.values(spec.counts || {}).forEach(v => _pushNum(numbers, v));

  /* ÉCARTS ENTRE RÉALISÉ ET PRÉVU. C'est la correction la plus importante de ce fichier, et elle
     vient d'un rejet observé en usage réel : la réponse citait « 16 », valeur absente de la liste,
     et le retour a été perdu.

     Or le prompt DEMANDE au modèle d'interpréter l'écart au plan. Un pourcentage calculé à partir
     de deux valeurs autorisées n'est pas une invention : c'est une dérivation vérifiable, que
     n'importe qui peut refaire. L'interdire revenait à demander une analyse tout en refusant le
     seul chiffre qui l'exprime. La règle §9.7 vise les faits INVENTÉS, pas l'arithmétique sur des
     faits fournis. */
  if (spec.session && spec.planned) {
    [['distanceKm', 'distanceKm'], ['ascent', 'deniveleM'], ['descent', 'descenteM'], ['durationS', 'durationS']]
      .forEach(([kReel, kPrevu]) => {
        const x = spec.session[kReel], y = spec.planned[kPrevu];
        if (x == null || y == null || !y) return;
        const pct = (x - y) / y * 100;
        _pushNum(numbers, pct); _pushNum(numbers, Math.abs(pct));
        _pushNum(numbers, x - y, 1); _pushNum(numbers, Math.abs(x - y), 1);
        _pushNum(numbers, x / y * 100); // « 110 % de la cible »
      });
  }

  // Valeurs portées par les insights déterministes : elles sont calculées, donc citables.
  (spec.insights || []).forEach(ins => {
    if (!ins) return;
    if (ins.delta != null) _pushNum(numbers, ins.delta);
    if (ins.coverage != null) _pushNum(numbers, Math.round(ins.coverage * 100));
    Object.values(ins.values || {}).forEach(v => { if (typeof v === 'number') { _pushNum(numbers, v, 1); _pushNum(numbers, v, 0); } });
  });

  /* Zones : le pourcentage du temps, mais aussi les BORNES et le numéro de zone. Une phrase comme
     « 88 % du temps entre 150 et 165 bpm, soit en zone 4 » ne cite que des valeurs fournies. */
  (spec.zones || []).forEach((z, i) => {
    if (!z) return;
    if (z.pct != null) _pushNum(numbers, z.pct);
    if (z.low != null) _pushNum(numbers, z.low);
    if (z.high != null) _pushNum(numbers, z.high);
    if (z.sec != null) { _pushNum(numbers, Math.round(z.sec / 60)); _pushNum(numbers, z.sec); }
    _pushNum(numbers, i + 1);
  });

  /* Une recommandation ne peut porter que sur des actions dont ELEV dispose réellement des
     données. La récupération n'en fait jamais partie aujourd'hui : rien ne la mesure. */
  const actions = Array.isArray(spec.allowedActions) ? spec.allowedActions.slice() : [];

  return {
    numbers: [...numbers].sort((a, b) => a - b),
    fields,
    actions,
    hasRecoveryData: !!spec.hasRecoveryData,
  };
}

/* --------------------------- schéma de sortie ---------------------------
   Strict : tout champ hors de cette liste fait rejeter la réponse. Un modèle qui ajoute une clé
   ajoute une affirmation que rien n'a validée. */
const AI_COACH_SCHEMA = {
  resume:    { type: 'string', required: true,  maxLen: 240 },
  analyse:   { type: 'array',  required: true,  maxItems: 4, maxLen: 180 },
  positif:   { type: 'array',  required: true,  maxItems: 4, maxLen: 180 },
  vigilance: { type: 'array',  required: false, maxItems: 3, maxLen: 180 },
  suite:     { type: 'array',  required: true,  maxItems: 4, maxLen: 180 },
};

/* Extrait le premier objet JSON d'une réponse, même si le modèle l'a entouré de texte ou d'un
   bloc de code. On ne « répare » rien d'autre : une réponse illisible est rejetée, pas devinée. */
function _extractJson(text) {
  if (typeof text !== 'string') return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{'), end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch (e) { return null; }
}

/* Nombres réellement écrits dans un texte. Les nombres collés à un mot (« Z3 », « 5x1000 ») sont
   des étiquettes, pas des mesures : on ne les compare pas. */
/* MESURES écrites dans un texte — et elles seules.

   Première version : tout nombre rencontré était confronté à la liste autorisée. Trop fragile par
   construction, et vérifié deux fois en usage réel. Un modèle qui rédige une analyse écrit
   forcément des nombres qui ne sont PAS des mesures : « 3 séances », « 2 fois plus », « la 4e
   semaine », un ordinal, une date. Chacun faisait perdre l'analyse entière.

   Ce que l'audit interdit (§9.7) est d'inventer une MESURE — une valeur physique présentée comme
   lue dans les données. Le critère devient donc l'UNITÉ : un nombre suivi de km, m, bpm, %, h,
   min, kcal, W… est une mesure et doit être justifié ; un nombre nu ne l'est pas.

   C'est plus permissif sur ce qui ne risque rien, et tout aussi strict sur ce qui compte : « 2400
   kcal », « 72 h », « 180 bpm » restent refusés s'ils ne viennent pas des données. */
const AI_MEASURE_UNIT = /^\s*(kcal|cal|kilocalories?|bpm|puls|km\/h|m\/h|km|kms|m\b|mètres?|metres?|%|pourcent|h\b|heures?|min\b|minutes?|sec\b|secondes?|kg|w\b|watts?|°c|pas\/min|spm)/i;

function _measuresIn(text) {
  const s = String(text || '');
  const out = [];
  const push = (v, raw) => { if (isFinite(v)) out.push({ value: v, raw }); };

  /* Durées et allures composées : « 4h21 », « 13:15/km ». Elles portent DEUX nombres pour une
     seule mesure — les traiter séparément ferait rejeter une allure parfaitement exacte. */
  const compose = /(\d{1,3})\s*(?:h|:)\s*(\d{1,2})\b/gi;
  let c;
  const consommees = [];
  while ((c = compose.exec(s))) {
    push(parseFloat(c[1]), c[0]); push(parseFloat(c[2]), c[0]);
    consommees.push([c.index, c.index + c[0].length]);
  }

  const re = /(?:^|[\s(«"'‑–—-])(\d+(?:[.,]\d+)?)/g;
  let m;
  while ((m = re.exec(s))) {
    const debut = m.index + m[0].length - m[1].length;
    if (consommees.some(([a, b]) => debut >= a && debut < b)) continue; // déjà traité ci-dessus
    const suite = s.slice(debut + m[1].length);
    const u = suite.match(AI_MEASURE_UNIT);
    if (!u) continue; // nombre sans unité : ce n'est pas une mesure, on ne le juge pas
    push(parseFloat(m[1].replace(',', '.')), m[1] + (u[1] || ''));
  }
  return out;
}

/* Tolérance d'arrondi. Elle était FIXE à 1, ce qui interdisait d'arrondir une grande valeur :
   « 1452 m » écrit « 1450 m » était rejeté comme une invention, alors que c'est la même mesure
   arrondie. La tolérance devient relative — 1 unité, ou 2 % de la valeur si c'est plus large. */
const AI_NUMBER_TOLERANCE = 1;
const AI_NUMBER_TOLERANCE_PCT = 0.02;
function _numberAllowed(n, allowedNumbers) {
  return allowedNumbers.some(a => {
    const tol = Math.max(AI_NUMBER_TOLERANCE, Math.abs(a) * AI_NUMBER_TOLERANCE_PCT);
    return Math.abs(a - n) <= tol;
  });
}

function validateAiOutput(rawText, allowed, opts) {
  opts = opts || {};
  const schema = opts.schema || AI_COACH_SCHEMA;
  const reasons = [];
  const data = _extractJson(rawText);
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { ok: false, data: null, reasons: ["La réponse n'est pas un objet JSON exploitable."] };

  // 1. Aucun champ en trop : une clé inconnue est une affirmation hors contrat.
  Object.keys(data).forEach(k => { if (!schema[k]) reasons.push('Champ non autorisé : « ' + k + ' ».'); });

  // 2. Types, présence et longueurs.
  const textes = [];
  Object.entries(schema).forEach(([k, rule]) => {
    const v = data[k];
    if (v == null) { if (rule.required) reasons.push('Champ obligatoire manquant : « ' + k + ' ».'); return; }
    if (rule.type === 'string') {
      if (typeof v !== 'string') { reasons.push('« ' + k + ' » doit être un texte.'); return; }
      if (v.length > rule.maxLen) reasons.push('« ' + k + ' » dépasse ' + rule.maxLen + ' caractères.');
      textes.push(v);
    } else {
      if (!Array.isArray(v)) { reasons.push('« ' + k + ' » doit être une liste.'); return; }
      if (v.length > rule.maxItems) reasons.push('« ' + k + ' » dépasse ' + rule.maxItems + ' entrées.');
      v.forEach(x => {
        if (typeof x !== 'string') { reasons.push('« ' + k + ' » ne doit contenir que du texte.'); return; }
        if (x.length > rule.maxLen) reasons.push('Une entrée de « ' + k + ' » dépasse ' + rule.maxLen + ' caractères.');
        textes.push(x);
      });
    }
  });

  const tout = textes.join(' \n ');

  // 3. Vocabulaire interdit — la règle vaut pour l'IA comme pour les insights déterministes.
  AI_FORBIDDEN.forEach(f => { if (f.re.test(tout)) reasons.push('Formulation interdite — ' + f.why + '.'); });

  // 4. Causalité. L'IA décrit, elle n'explique pas : les facteurs ne sont pas contrôlés.
  const mCause = tout.match(AI_CAUSAL);
  if (mCause) reasons.push('Lien de cause affirmé (« ' + mCause[0] + ' ») alors que les facteurs ne sont pas contrôlés.');

  /* 5. Nombres. Le cœur de la règle §9.7 : « un texte contenant un nombre absent de l'objet est
        rejeté ». C'est ce qui empêche le modèle de recalculer, d'extrapoler ou d'inventer un délai. */
  /* Une mesure non justifiée ne fait plus perdre TOUTE la réponse.

     Le rejet global partait d'une bonne intention (§8.3) mais se retournait contre son but : une
     seule puce douteuse effaçait une analyse entière, et un garde-fou qu'on subit trop souvent
     finit par être désactivé. La phrase fautive est RETIRÉE, le reste est conservé, et le motif
     est journalisé — aucune valeur inventée n'est jamais affichée, ce qui est l'exigence réelle.

     Une seule exception : si c'est le résumé qui est fautif, la réponse entière tombe. Le résumé
     est la conclusion de l'analyse ; l'amputer laisserait un objet incohérent. */
  const mesuresRefusees = [];
  if (allowed && Array.isArray(allowed.numbers)) {
    const suspecte = txt => _measuresIn(txt).filter(x => !_numberAllowed(x.value, allowed.numbers));

    const mauvaisResume = typeof data.resume === 'string' ? suspecte(data.resume) : [];
    if (mauvaisResume.length) {
      mesuresRefusees.push(...mauvaisResume.map(x => x.raw));
      reasons.push('Le résumé cite une valeur absente des données : ' + mauvaisResume.map(x => x.raw).join(', ') + '.');
    }

    ['analyse', 'positif', 'vigilance', 'suite'].forEach(k => {
      if (!Array.isArray(data[k])) return;
      const gardees = [];
      data[k].forEach(ligne => {
        const mauvais = typeof ligne === 'string' ? suspecte(ligne) : [];
        if (mauvais.length) mesuresRefusees.push(...mauvais.map(x => x.raw));
        else gardees.push(ligne);
      });
      data[k] = gardees;
    });

    // Si tout a été retiré, il ne reste rien à montrer : autant le dire.
    const resteQuelqueChose = ['analyse', 'positif', 'suite'].some(k => Array.isArray(data[k]) && data[k].length);
    if (!resteQuelqueChose && !reasons.length)
      reasons.push('Toutes les observations citaient des valeurs absentes des données : ' + mesuresRefusees.slice(0, 4).join(', ') + '.');
  }

  // 6. Aucune consigne de récupération tant qu'aucune donnée de récupération n'est suivie.
  if (allowed && !allowed.hasRecoveryData && /\br[ée]cup[ée]ration\b|\brepos\b/i.test(String(data.suite || '') + ' ' + (Array.isArray(data.suite) ? data.suite.join(' ') : '')))
    reasons.push('Conseil de récupération alors qu\'aucune donnée de récupération n\'est suivie.');

  /* `dropped` remonte ce qui a été retiré : la page peut le dire à l'utilisateur, et la console le
     journalise. Une observation écartée en silence serait aussi opaque qu'une valeur inventée. */
  return { ok: reasons.length === 0, data: reasons.length ? null : data, reasons, dropped: mesuresRefusees };
}

/* Consigne commune ajoutée à tout prompt IA. Écrite ici plutôt que dans chaque page : deux copies
   divergeraient, et c'est exactement ce que l'audit reproche au pipeline actuel. */
function aiOutputContract(allowed) {
  const nums = (allowed && allowed.numbers || []);
  /* La liste était une suite de nombres nus, difficile à exploiter pour un modèle — et c'est en
     partie ce qui produisait des rejets : il citait un écart parfaitement dérivable sans savoir
     qu'il devait le prendre dans la liste. On dit désormais quels CHAMPS sont disponibles, et on
     autorise explicitement l'arithmétique sur les valeurs fournies. */
  const champs = (allowed && allowed.fields || []);
  return [
    'RÈGLES ABSOLUES DE SORTIE.',
    "Tu reformules des observations déjà calculées. Tu n'es pas le moteur de calcul.",
    '1. Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans bloc de code.',
    '2. Clés autorisées, aucune autre : resume (texte), analyse, positif, vigilance, suite (listes de textes courts).',
    '3. CHIFFRES. Tu ne peux employer que les valeurs présentes dans les données ci-dessus'
      + (champs.length ? ' (champs fournis : ' + champs.slice(0, 40).join(', ') + ')' : '')
      + ', ou un écart calculé ENTRE deux de ces valeurs (différence, pourcentage, rapport).'
      + " N'introduis aucune valeur venue d'ailleurs : ni durée de repos, ni délai, ni objectif chiffré, ni estimation."
      + (nums.length ? ' Valeurs et dérivations reconnues : [' + nums.join(', ') + '].' : ''),
    "4. N'affirme aucune cause (pas de « donc », « à cause de », « s'explique par ») : les facteurs ne sont pas contrôlés.",
    '5. Aucun délai, aucune consigne de récupération, de repos ou de coupure : ELEV ne mesure ni sommeil, ni fréquence cardiaque de repos, ni ressenti.',
    "6. Aucun diagnostic, aucune mention de blessure, de surentraînement ou d'état de fatigue.",
    "7. Si une donnée manque, dis-le. N'invente jamais pour combler.",
    "8. En cas de doute sur un chiffre, écris la phrase SANS le chiffre plutôt que de l'approximer.",
  ].join('\n');
}

if (typeof window !== 'undefined') {
  window.AI_COACH_SCHEMA = AI_COACH_SCHEMA;
  window.AI_FORBIDDEN = AI_FORBIDDEN;
}
