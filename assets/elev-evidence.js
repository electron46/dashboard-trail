/* =============================================================================
   ELEV — registre de preuve scientifique
   Audit scientifique ELEV Insight V2 (23 août 2026), §5.1, §6, §10.3 et §13 (P1).

   Pourquoi ce fichier existe. L'application savait dire « confiance haute » — mais cette confiance
   ne parlait que de la QUALITÉ DE LA DONNÉE (couverture, capteur). Elle ne disait rien de la
   solidité de l'affirmation elle-même. Une mesure parfaitement propre peut soutenir une conclusion
   scientifiquement fragile : c'est exactement le cas du rapport de charge aiguë/chronique, dont les
   données sont exactes et dont l'usage prédictif n'est pas soutenu par la littérature.

   Le registre sépare donc ce qui était confondu :
     · la PREUVE de la méthode      → ce fichier (niveaux A/B/C/D/X)
     · la QUALITÉ de la donnée      → elev-data-quality.js (couverture, provenance)
     · la CONFIANCE de la conclusion → elev-insight.js, plafonnée par la plus faible des deux

   Les 19 sources sont celles relevées par l'audit §6, avec leurs identifiants tels qu'il les
   donne. AUCUNE référence n'est inventée ici : une affirmation sans source prend le niveau C
   (« repère ELEV ») et le dit, plutôt que de s'adosser à une citation fabriquée.

   Chargé APRÈS elev-data-quality.js, AVANT elev-insight.js.
   ============================================================================= */

/* --------------------------- échelle de preuve (§5.1) --------------------------- */
const EVIDENCE_GRADES = {
  A: { key:'A', score:1.00, label:'Mesure directe',        publish:'observation + interprétation prudente',
       desc:"Mesure directe ou identité mathématique traçable, ou affirmation soutenue par une preuve forte directement applicable." },
  B: { key:'B', score:0.75, label:'Preuve indirecte',      publish:'interprétation avec limites visibles',
       desc:"Preuve cohérente mais indirecte : population ou conditions partiellement différentes." },
  C: { key:'C', score:0.45, label:'Repère ELEV',           publish:'observation étiquetée « repère ELEV »',
       desc:"Heuristique produit plausible, non calibrée sur un résultat mesuré." },
  D: { key:'D', score:0.20, label:'Expérimental',          publish:'zone expérimentale, aucune prescription',
       desc:"Hypothèse ou modèle non validé." },
  X: { key:'X', score:0.00, label:'Non publiable',         publish:'ne pas publier',
       desc:"Conclusion non soutenable avec les données présentes, ou langage médical/prédictif interdit." },
};

/* --------------------------- sources (§6) ---------------------------
   Reprises telles que l'audit les documente. `id` sert de clé interne, jamais affiché brut. */
const EVIDENCE_SOURCES = {
  'impellizzeri-2020': { authors:'Impellizzeri FM et al.', year:2020, title:'Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls', journal:'Int J Sports Physiol Perform', doi:'10.1123/ijspp.2019-0864', pmid:'32502973' },
  'damsted-2018':      { authors:'Damsted C et al.',       year:2018, title:'Is There Evidence for an Association Between Changes in Training Load and Running-Related Injuries?', journal:'Int J Sports Phys Ther', pmid:'30534459', pmcid:'PMC6253751' },
  'buist-2008':        { authors:'Buist I et al.',         year:2008, title:'No Effect of a Graded Training Program on the Number of Running-Related Injuries in Novice Runners', journal:'Am J Sports Med', doi:'10.1177/0363546507307505', pmid:'17940147' },
  'soligard-2016':     { authors:'Soligard T et al.',      year:2016, title:'How Much Is Too Much? (Part 1) IOC Consensus Statement on Load in Sport and Risk of Injury', journal:'Br J Sports Med', doi:'10.1136/bjsports-2016-096581', pmid:'27535989' },
  'drew-2016':         { authors:'Drew MK, Finch CF.',     year:2016, title:'The Relationship Between Training Load and Injury, Illness and Soreness', journal:'Sports Med', doi:'10.1007/s40279-015-0459-8', pmid:'26822969' },
  'meeusen-2013':      { authors:'Meeusen R et al.',       year:2013, title:'Prevention, Diagnosis and Treatment of the Overtraining Syndrome (ECSS/ACSM consensus)', journal:'Med Sci Sports Exerc', doi:'10.1249/MSS.0b013e318279a10a', pmid:'23247672' },
  'saw-2016':          { authors:'Saw AE et al.',          year:2016, title:'Monitoring the Athlete Training Response: Subjective Self-Reported Measures Trump Commonly Used Objective Measures', journal:'Br J Sports Med', doi:'10.1136/bjsports-2015-094758', pmid:'26423706' },
  'haddad-2017':       { authors:'Haddad M et al.',        year:2017, title:'Session-RPE Method for Training Load Monitoring', journal:'Front Neurosci', doi:'10.3389/fnins.2017.00612', pmid:'29163016' },
  'dewaal-2021':       { authors:'de Waal SJ et al.',      year:2021, title:'Physiological Indicators of Trail Running Performance: A Systematic Review', journal:'Int J Sports Physiol Perform', doi:'10.1123/ijspp.2020-0812', pmid:'33508776' },
  'sabater-2022':      { authors:'Sabater Pastor F et al.',year:2022, title:'Performance Determinants in Trail-Running Races of Different Distances', journal:'Int J Sports Physiol Perform', doi:'10.1123/ijspp.2021-0362', pmid:'35213820' },
  'vernillo-2017':     { authors:'Vernillo G et al.',      year:2017, title:'Biomechanics and Physiology of Uphill and Downhill Running', journal:'Sports Med', doi:'10.1007/s40279-016-0605-y', pmid:'27501719' },
  'giovanelli-2016':   { authors:'Giovanelli N et al.',    year:2016, title:'Energetics of Vertical Kilometer Foot Races; Is Steeper Cheaper?', journal:'J Appl Physiol', doi:'10.1152/japplphysiol.00546.2015', pmid:'26607247' },
  'finiel-2026':       { authors:'Finiel L et al.',        year:2026, title:'Energetic Cost of Locomotion Closely Aligns with the Preferred Uphill Walk-Run Transition', journal:'Eur J Appl Physiol', doi:'10.1007/s00421-026-06363-x', pmid:'42530641' },
  'swain-1998':        { authors:'Swain DP et al.',        year:1998, title:'Relationship Between % Heart Rate Reserve and % VO2 Reserve in Treadmill Exercise', journal:'Med Sci Sports Exerc', doi:'10.1097/00005768-199802000-00022', pmid:'9502363' },
  'achten-2003':       { authors:'Achten J, Jeukendrup AE.',year:2003,title:'Heart Rate Monitoring: Applications and Limitations', journal:'Sports Med', doi:'10.2165/00007256-200333070-00004', pmid:'12762827' },
  'zhang-2020':        { authors:'Zhang Y et al.',         year:2020, title:'Validity of Wrist-Worn Photoplethysmography Devices to Measure Heart Rate', journal:'J Sports Sci', doi:'10.1080/02640414.2020.1767348', pmid:'32552580' },
  'souissi-2021':      { authors:'Souissi A et al.',       year:2021, title:'A New Perspective on Cardiovascular Drift During Prolonged Exercise', journal:'Life Sci', doi:'10.1016/j.lfs.2021.120109', pmid:'34717912' },
  'wingo-2012':        { authors:'Wingo JE et al.',        year:2012, title:'Cardiovascular Drift During Heat Stress: Implications for Exercise Prescription', journal:'Exerc Sport Sci Rev', doi:'10.1097/JES.0b013e31824c43af', pmid:'22410803' },
  'oliveira-2024':     { authors:'Oliveira PS et al.',     year:2024, title:'Comparison of Polarized Versus Other Types of Endurance Training Intensity Distribution', journal:'Sports Med', doi:'10.1007/s40279-024-02034-z', pmid:'38717713', pmcid:'PMC11329428' },
};

/* --------------------------- affirmations (§10.3) ---------------------------
   Chaque `claim` relie une famille de conclusion à son niveau de preuve, ses sources, ses limites
   et sa DATE DE REVUE. La date n'est pas décorative : une règle sans échéance de relecture devient
   silencieusement périmée. */
const EVIDENCE_REVIEWED_AT = '2026-08-23';
const EVIDENCE_REVIEW_DUE  = '2027-08-23';

function _claim(o) {
  return Object.assign({ reviewedAt: EVIDENCE_REVIEWED_AT, reviewDueAt: EVIDENCE_REVIEW_DUE, limitations: [], sources: [] }, o);
}

const EVIDENCE_CLAIMS = {
  /* --- mesures directes --- */
  'CLAIM-DIRECT-MEASURE': _claim({
    claim: "Une distance, une durée, un dénivelé fourni par l'appareil ou un temps par zone sont des mesures directes.",
    grade: 'A', direction: 'measurement',
    limitations: ["La qualité dépend du capteur ; un dénivelé reconstruit n'est pas un dénivelé mesuré."],
  }),
  'CLAIM-ARITHMETIC-DELTA': _claim({
    claim: "Une variation entre deux périodes suffisamment couvertes est une observation arithmétique.",
    grade: 'A', direction: 'measurement',
    limitations: ["Ne dit rien de la cause de la variation.", "Exige une référence réellement comparable."],
  }),

  /* --- charge : la littérature interdit l'usage prédictif --- */
  'CLAIM-LOAD-DESCRIPTIVE': _claim({
    claim: "Un rapport entre volume récent et volume moyen décrit une variation de charge externe.",
    grade: 'C', direction: 'description',
    sources: ['impellizzeri-2020', 'soligard-2016', 'drew-2016'],
    limitations: [
      "Le kilomètre ne représente pas la charge totale en trail (dénivelé, intensité, autres sports).",
      "Les seuils employés sont des repères produit, pas des frontières de sécurité.",
    ],
  }),
  'CLAIM-ACWR-NO-INJURY-PREDICTION': _claim({
    claim: "Un rapport de charge ne doit pas servir à prédire un risque de blessure individuel.",
    grade: 'A', direction: 'prohibition',
    sources: ['impellizzeri-2020', 'damsted-2018', 'buist-2008'],
    limitations: ["N'interdit pas le suivi descriptif de la charge."],
  }),
  'CLAIM-NO-OVERTRAINING-DIAGNOSIS': _claim({
    claim: "Le surentraînement ne peut pas être établi à partir des données d'entraînement seules.",
    grade: 'A', direction: 'prohibition',
    sources: ['meeusen-2013'],
    limitations: ["Le diagnostic implique une maladaptation prolongée et l'exclusion d'autres causes."],
  }),
  'CLAIM-NO-RECOVERY-INFERENCE': _claim({
    claim: "Aucun état de récupération ne peut être déduit sans sommeil, bien-être déclaré, FC de repos ou VFC.",
    grade: 'A', direction: 'prohibition',
    sources: ['saw-2016', 'meeusen-2013'],
    limitations: ["Les mesures subjectives déclarées seraient le premier signal utile, si elles étaient recueillies."],
  }),

  /* --- terrain et locomotion --- */
  'CLAIM-UPHILL-DOWNHILL-DISTINCT': _claim({
    claim: "Montée et descente imposent des contraintes distinctes et ne se résument pas à une seule aptitude.",
    grade: 'B', direction: 'support',
    sources: ['vernillo-2017'],
    limitations: ["La descente ne se réduit pas à une vitesse : la technicité du terrain n'est pas connue."],
  }),
  'CLAIM-WALKING-UPHILL-EFFICIENT': _claim({
    claim: "Marcher en forte pente peut être moins coûteux que courir ; ce n'est pas une faiblesse.",
    grade: 'B', direction: 'support',
    sources: ['giovanelli-2016', 'finiel-2026'],
    limitations: ["Le seuil dépend de l'individu et des conditions ; un seuil de cadence fixe ne le détermine pas."],
  }),
  'CLAIM-WALKRUN-CADENCE-ESTIMATE': _claim({
    claim: "Classer course et marche par un seuil de cadence fixe est une estimation, pas une mesure.",
    grade: 'D', direction: 'experimental',
    sources: ['giovanelli-2016', 'finiel-2026'],
    limitations: ["La transition est individuelle et dépend de la pente.", "Doit toujours être nommée « estimation »."],
  }),
  'CLAIM-VAM-WITHIN-RUNNER': _claim({
    claim: "Comparer des vitesses verticales n'a de sens qu'entre segments réellement comparables, et sans conclusion de progression.",
    grade: 'C', direction: 'description',
    sources: ['vernillo-2017'],
    limitations: ["Surface, météo et fatigue ne sont pas contrôlées.", "Aucun seuil de changement significatif n'est établi."],
  }),
  'CLAIM-NO-TRAIL-READINESS-SCORE': _claim({
    claim: "Aucun score simple ne décrit la préparation à un trail.",
    grade: 'A', direction: 'prohibition',
    sources: ['dewaal-2021', 'sabater-2022'],
    limitations: ["Les déterminants varient avec la distance ; aucun modèle linéaire universel n'a été retenu."],
  }),

  /* --- fréquence cardiaque --- */
  'CLAIM-HRR-INTENSITY-PROXY': _claim({
    claim: "Les zones fondées sur la réserve cardiaque sont un repère d'intensité, pas des seuils physiologiques individuels.",
    grade: 'B', direction: 'support',
    sources: ['swain-1998'],
    limitations: ["Ne remplace pas une détermination individuelle des seuils."],
  }),
  'CLAIM-HR-CONFOUNDED': _claim({
    claim: "Température, déshydratation et variabilité quotidienne modifient la relation entre fréquence cardiaque et effort.",
    grade: 'B', direction: 'support',
    sources: ['achten-2003', 'souissi-2021', 'wingo-2012'],
    limitations: ["Une dérive observée ne peut pas être attribuée à la condition physique."],
  }),
  'CLAIM-WRIST-HR-LIMITED': _claim({
    claim: "La mesure de FC au poignet est acceptable en agrégat mais varie selon l'activité et l'appareil.",
    grade: 'B', direction: 'support',
    sources: ['zhang-2020'],
    limitations: ["La source du capteur est rarement connue par séance, ce qui plafonne la confiance."],
  }),
  'CLAIM-INTENSITY-NO-UNIVERSAL-TARGET': _claim({
    claim: "Aucune répartition d'intensité universelle ne valide une préparation.",
    grade: 'A', direction: 'prohibition',
    sources: ['oliveira-2024'],
    limitations: ["Un repère fixe de temps en zone haute ne peut pas servir de note de préparation."],
  }),

  /* --- conformité au plan --- */
  'CLAIM-PLAN-ADHERENCE': _claim({
    claim: "Comparer le réalisé au plan mesure une conformité au document importé, pas une préparation.",
    grade: 'C', direction: 'description',
    limitations: ["Une séance de remplacement pertinente peut apparaître comme un écart.", "Le plan lui-même n'est pas validé."],
  }),
  'CLAIM-RACE-TIME-UNCALIBRATED': _claim({
    claim: "Une estimation de temps de course sans modèle calibré ni erreur mesurée reste expérimentale.",
    grade: 'D', direction: 'experimental',
    sources: ['dewaal-2021', 'sabater-2022'],
    limitations: ["Aucun backtest, aucun intervalle de prédiction, aucun parcours comparable.", "Ne doit jamais renseigner automatiquement un objectif."],
  }),
};

/* --------------------------- accès --------------------------- */
function evidenceClaim(claimId) { return (claimId && EVIDENCE_CLAIMS[claimId]) || null; }
function evidenceGrade(claimId) {
  const c = evidenceClaim(claimId);
  return EVIDENCE_GRADES[c ? c.grade : 'C'] || EVIDENCE_GRADES.C;
}
function evidenceSources(claimId) {
  const c = evidenceClaim(claimId);
  return c ? (c.sources || []).map(id => EVIDENCE_SOURCES[id]).filter(Boolean) : [];
}
/* Référence lisible, sans jargon inutile : auteurs, année, revue, puis l'identifiant qui permet
   de la retrouver. Jamais un lien fabriqué. */
function evidenceCitation(src) {
  if (!src) return '';
  const ref = src.doi ? ('doi:' + src.doi) : (src.pmid ? ('PMID ' + src.pmid) : '');
  return src.authors + ' (' + src.year + '). ' + src.title + '. ' + src.journal + (ref ? '. ' + ref : '.');
}

/* Une action ne peut être recommandée que sur une preuve A ou B (§9.1, principe 6 : « l'action est
   plus exigeante que l'observation »). Un repère produit peut être MONTRÉ, jamais prescrit. */
function evidenceAllowsAction(claimId) {
  const g = evidenceGrade(claimId).key;
  return g === 'A' || g === 'B';
}

if (typeof window !== 'undefined') {
  window.EVIDENCE_GRADES = EVIDENCE_GRADES;
  window.EVIDENCE_CLAIMS = EVIDENCE_CLAIMS;
  window.EVIDENCE_SOURCES = EVIDENCE_SOURCES;
}
