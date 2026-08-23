/* =============================================================================
   ELEV — registre des métriques
   Audit scientifique ELEV Insight V2 (23 août 2026), §9.2, §10.1 et §13 (P1).

   Ce que ce fichier apporte, et que rien ne portait avant lui : la FORMULE, l'UNITÉ, les MINIMUMS
   et la POLITIQUE DE VALEUR MANQUANTE de chaque métrique, sous forme déclarative et versionnée.
   Ces informations existaient uniquement dans le code qui les calcule, donc nulle part où on
   puisse les lire, les comparer ou les afficher.

   Deux usages réels, pas un module abstrait :
     · le volet de preuve d'un insight affiche la formule et l'unité de la métrique citée ;
     · les tests vérifient qu'une métrique déclare bien sa règle de valeur manquante.

   Ce fichier ne CALCULE rien. Les calculs restent dans assets/app.js et elev-terrain.js ; les
   dupliquer ici créerait deux définitions concurrentes, exactement le défaut que l'audit relève
   ailleurs. Le registre décrit, il n'exécute pas.

   Chargé APRÈS elev-evidence.js, AVANT elev-insight.js.
   ============================================================================= */

/* `missingPolicy` dit ce qu'il advient d'une valeur absente. C'est le point le plus important du
   registre : l'audit répète qu'une absence ne doit jamais devenir un zéro (§9.1, principe 5). */
const METRIC_MISSING_POLICY = {
  unavailable: "La métrique n'est pas calculée : la valeur reste indisponible, jamais remplacée par zéro.",
  zero_is_real: "Un zéro saisi ou mesuré est une vraie valeur, distincte d'une absence.",
};

const ELEV_METRICS = {
  'terrain.vam.aggregate': {
    version: '2.0.0',
    label: 'Vitesse verticale agrégée',
    unit: 'm/h',
    formula: 'somme des dénivelés positifs / somme des durées de montée × 3600',
    requiredFields: ['segment.gainM', 'segment.durationS'],
    missingPolicy: 'unavailable',
    minimums: { segments: 1 },
    knownLimits: ['Mélange de pentes', 'Surface et météo inconnues', 'Dépend de la détection des montées'],
    claimId: 'CLAIM-VAM-WITHIN-RUNNER',
    // Corrigé le 2026-08-23 : c'était une moyenne des VAM pondérée par le D+, qui surestime.
    note: "Une vitesse verticale agrégée n'est pas la moyenne des vitesses des segments.",
  },
  'session.elevation.rebuilt': {
    version: '2.0.0',
    label: 'Dénivelé reconstruit',
    unit: 'm',
    formula: "altitude lissée sur 30 m, puis somme des variations dépassant 3 m",
    requiredFields: ['record.altitude'],
    missingPolicy: 'unavailable',
    minimums: { points: 3 },
    knownLimits: ["N'est pas le dénivelé fourni par l'appareil", 'Dépend de la qualité du baromètre ou du GPS'],
    claimId: 'CLAIM-DIRECT-MEASURE',
  },
  'session.average.timeWeighted': {
    version: '2.0.0',
    label: 'Moyenne pondérée par le temps',
    unit: 'variable',
    formula: 'intégration par trapèzes sur le temps, intervalles de plus de 120 s exclus',
    requiredFields: ['record.timestamp', 'record.<signal>'],
    missingPolicy: 'unavailable',
    minimums: { intervals: 1 },
    knownLimits: ['Un trou de plus de 120 s est exclu plutôt qu\'interpolé'],
    claimId: 'CLAIM-DIRECT-MEASURE',
  },
  'load.volume.ratio': {
    version: '2.0.0',
    label: 'Rapport de volume récent',
    unit: 'sans unité',
    formula: 'volume des 7 derniers jours / moyenne des 4 fenêtres de 7 jours',
    requiredFields: ['session.distanceKm', 'session.date'],
    missingPolicy: 'unavailable',
    minimums: { weeksCovered: 4, weeksNonEmpty: 3 },
    knownLimits: ['Le kilomètre ne représente pas la charge totale en trail', 'Ne prédit aucun risque de blessure'],
    claimId: 'CLAIM-LOAD-DESCRIPTIVE',
  },
  'plan.alignment': {
    version: '2.0.0',
    label: 'Écart au plan',
    unit: '%',
    formula: 'volume réalisé / volume planifié sur la fenêtre, borné par les dates du plan',
    requiredFields: ['plan.distanceKm', 'session.distanceKm'],
    missingPolicy: 'unavailable',
    minimums: { plannedKm: 0.001 },
    knownLimits: ['Mesure une conformité au document importé, pas une préparation',
                  'Au-delà de 140 %, aucun score n\'est produit'],
    claimId: 'CLAIM-PLAN-ADHERENCE',
  },
  'readiness.subscore': {
    version: '2.0.0',
    label: 'Sous-score de préparation',
    unit: '%',
    formula: 'valeur réalisée / cible, plafonnée à 100',
    requiredFields: ['session.*', 'race.distanceKm'],
    missingPolicy: 'unavailable',
    minimums: { dimensions: 3 },
    knownLimits: ["Les repères génériques n'entrent pas dans l'indice global",
                  'Aucun score simple ne décrit une préparation trail'],
    claimId: 'CLAIM-NO-TRAIL-READINESS-SCORE',
  },
  'readiness.longrun': {
    version: '2.0.0',
    label: 'Sortie longue face à la cible',
    unit: '%',
    formula: 'plus longue sortie de la fenêtre / cible (plus longue séance planifiée, sinon repère ELEV)',
    requiredFields: ['session.distanceKm'],
    missingPolicy: 'unavailable',
    minimums: { sessions: 1 },
    knownLimits: ['La distance seule ignore dénivelé, durée et terrain',
                  'Le repère de 60 % de la distance de course n\'est validé par aucune étude'],
    claimId: 'CLAIM-NO-TRAIL-READINESS-SCORE',
  },
  'plan.missed': {
    version: '2.0.0',
    label: 'Séances sans activité associée',
    unit: 'séances',
    formula: 'séances planifiées de la semaine sans rapprochement sûr avec une activité',
    requiredFields: ['plan.date', 'session.date'],
    missingPolicy: 'unavailable',
    minimums: { planned: 1 },
    knownLimits: ['Un rapprochement douteux reste en attente de confirmation, ni réalisé ni manqué'],
    claimId: 'CLAIM-PLAN-ADHERENCE',
  },
};

function elevMetric(metricId) { return (metricId && ELEV_METRICS[metricId]) || null; }

/* Description lisible d'une métrique, pour le volet de preuve. Retourne null quand la métrique
   n'est pas déclarée : mieux vaut ne rien afficher qu'une définition approximative. */
function elevMetricSummary(metricId) {
  const m = elevMetric(metricId);
  if (!m) return null;
  return m.label + ' (' + m.unit + ') — ' + m.formula + '.';
}

if (typeof window !== 'undefined') {
  window.ELEV_METRICS = ELEV_METRICS;
  window.METRIC_MISSING_POLICY = METRIC_MISSING_POLICY;
}
