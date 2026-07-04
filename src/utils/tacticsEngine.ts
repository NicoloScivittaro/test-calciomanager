import { Player, Tactic, TacticalPrinciple } from '../types';
import { evaluateLineupPersonalities } from './playerPersonality';

export interface TacticalSlot {
  x: number;
  y: number;
  role: Player['role'];
}

export interface SlotFit {
  playerId: string;
  playerName: string;
  playerRole: Player['role'];
  slotRole: Player['role'];
  score: number;
  label: 'Perfetto' | 'Adattato' | 'Rischio';
}

export interface TacticalEvaluation {
  compatibility: number;
  cohesion: number;
  attack: number;
  midfield: number;
  defense: number;
  matchScore: number;
  automatisms: number;
  fatigueLoad: number;
  chanceQuality: number;
  foulRisk: number;
  opponentRisk: number;
  warnings: string[];
  explanations: string[];
  principleReports: {
    key: TacticalPrinciple;
    label: string;
    score: number;
    note: string;
  }[];
  slotFits: SlotFit[];
}

export const POSITION_PRESETS: Record<Tactic['module'], TacticalSlot[]> = {
  '4-3-3': [
    { x: 50, y: 88, role: 'GK' },
    { x: 35, y: 72, role: 'CB' },
    { x: 65, y: 72, role: 'CB' },
    { x: 15, y: 66, role: 'LB' },
    { x: 85, y: 66, role: 'RB' },
    { x: 50, y: 55, role: 'DM' },
    { x: 32, y: 44, role: 'CM' },
    { x: 68, y: 44, role: 'CM' },
    { x: 20, y: 22, role: 'LW' },
    { x: 80, y: 22, role: 'RW' },
    { x: 50, y: 14, role: 'ST' }
  ],
  '4-2-3-1': [
    { x: 50, y: 88, role: 'GK' },
    { x: 35, y: 72, role: 'CB' },
    { x: 65, y: 72, role: 'CB' },
    { x: 15, y: 66, role: 'LB' },
    { x: 85, y: 66, role: 'RB' },
    { x: 38, y: 56, role: 'DM' },
    { x: 62, y: 56, role: 'DM' },
    { x: 50, y: 38, role: 'AM' },
    { x: 20, y: 22, role: 'LW' },
    { x: 80, y: 22, role: 'RW' },
    { x: 50, y: 14, role: 'ST' }
  ],
  '3-5-2': [
    { x: 50, y: 88, role: 'GK' },
    { x: 50, y: 74, role: 'CB' },
    { x: 28, y: 72, role: 'CB' },
    { x: 72, y: 72, role: 'CB' },
    { x: 50, y: 54, role: 'DM' },
    { x: 32, y: 44, role: 'CM' },
    { x: 68, y: 44, role: 'CM' },
    { x: 15, y: 36, role: 'LB' },
    { x: 85, y: 36, role: 'RB' },
    { x: 38, y: 16, role: 'ST' },
    { x: 62, y: 16, role: 'ST' }
  ]
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 68;

export const buildLineup = (players: Player[], starterIds: string[]) =>
  starterIds.map(id => players.find(player => player.id === id)).filter(Boolean) as Player[];

export const getRoleFitScore = (playerRole: Player['role'], slotRole: Player['role']) => {
  if (playerRole === slotRole) return 1;
  if (slotRole === 'GK') return playerRole === 'GK' ? 1 : 0.08;
  if (playerRole === 'GK') return 0.08;

  const matrix: Record<Player['role'], Partial<Record<Player['role'], number>>> = {
    GK: {},
    CB: { LB: 0.72, RB: 0.72, DM: 0.64 },
    LB: { CB: 0.58, RB: 0.68, LW: 0.52, DM: 0.48 },
    RB: { CB: 0.58, LB: 0.68, RW: 0.52, DM: 0.48 },
    DM: { CB: 0.68, CM: 0.82, AM: 0.54, LB: 0.52, RB: 0.52 },
    CM: { DM: 0.84, AM: 0.82, LW: 0.46, RW: 0.46 },
    AM: { CM: 0.76, DM: 0.52, LW: 0.72, RW: 0.72, ST: 0.66 },
    LW: { RW: 0.74, AM: 0.72, ST: 0.55, LB: 0.55 },
    RW: { LW: 0.74, AM: 0.72, ST: 0.55, RB: 0.55 },
    ST: { AM: 0.66, LW: 0.56, RW: 0.56 }
  };

  return matrix[playerRole][slotRole] ?? 0.35;
};

export const getPlayerSlotFitScore = (player: Player, slotRole: Player['role']) => {
  const naturalFit = getRoleFitScore(player.role, slotRole);
  const trainedFit = player.secondaryRoles?.includes(slotRole) ? 0.88 : 0;
  const progressFit = ((player.positionTraining?.[slotRole] ?? 0) / 100) * 0.22 + naturalFit;
  return clamp(Math.max(naturalFit, trainedFit, progressFit), 0.08, 1);
};

const fitLabel = (score: number): SlotFit['label'] => {
  if (score >= 0.92) return 'Perfetto';
  if (score >= 0.65) return 'Adattato';
  return 'Rischio';
};

const roleScore = (lineup: Player[], roles: Player['role'][]) => {
  const picked = lineup.filter(player => roles.includes(player.role));
  return average((picked.length ? picked : lineup).map(player => player.overall));
};

const hasAnyRole = (lineup: Player[], roles: Player['role'][]) => lineup.some(player => roles.includes(player.role));

const principleLabels: Record<TacticalPrinciple, string> = {
  overlaps: 'Sovrapposizioni',
  falseNine: 'Falso nove',
  mezzalaRuns: 'Mezzala inserimento',
  deepPlaymaker: 'Regista basso',
  manMarkKey: 'Marcatore chiave'
};

interface PrincipleImpact {
  attack: number;
  midfield: number;
  defense: number;
  fatigue: number;
  chanceQuality: number;
  foulRisk: number;
  opponentRisk: number;
  reports: TacticalEvaluation['principleReports'];
  warnings: string[];
  explanations: string[];
}

const createEmptyPrincipleImpact = (): PrincipleImpact => ({
  attack: 0,
  midfield: 0,
  defense: 0,
  fatigue: 0,
  chanceQuality: 0,
  foulRisk: 0,
  opponentRisk: 0,
  reports: [],
  warnings: [],
  explanations: []
});

const evaluatePrinciples = (
  lineup: Player[],
  tactic: Tactic,
  compatibility: number,
  avgCondition: number
): PrincipleImpact => {
  const impact = createEmptyPrincipleImpact();
  const principles = tactic.principles ?? [];

  principles.forEach(principle => {
    if (principle === 'overlaps') {
      const widePower = roleScore(lineup, ['LB', 'RB', 'LW', 'RW']);
      const context =
        (tactic.attackingFocus === 'Fasce' ? 11 : 0) +
        (tactic.chanceCreation === 'Cross' ? 9 : 0) +
        (tactic.width - 50) * 0.22 +
        (avgCondition - 70) * 0.12 +
        (compatibility - 75) * 0.08;
      const score = Math.round(clamp(widePower - 5 + context, 30, 96));
      impact.attack += (score - 62) * 0.08;
      impact.chanceQuality += (score - 62) * 0.06;
      impact.fatigue += 3.2;
      impact.opponentRisk += score >= 68 ? 1.2 : 4.5;
      impact.reports.push({
        key: principle,
        label: principleLabels[principle],
        score,
        note: score >= 68
          ? 'Terzini e ali danno ampiezza reale: puoi creare superiorita sulle corsie.'
          : 'Le corsie non reggono ancora il principio: rischi fatica e ripartenze subite.'
      });
      if (score < 58) impact.warnings.push('Sovrapposizioni poco supportate: servono esterni forti e condizione alta.');
      return;
    }

    if (principle === 'falseNine') {
      const linkPower = roleScore(lineup, ['ST', 'AM', 'CM']);
      const hasConnector = hasAnyRole(lineup, ['ST', 'AM']);
      const context =
        (tactic.buildUp === 'Manovrata' ? 8 : tactic.buildUp === 'Mista' ? 3 : -4) +
        (tactic.chanceCreation === 'Passaggi Filtranti' ? 8 : tactic.chanceCreation === 'Tagli Interni' ? 5 : 0) -
        (tactic.chanceCreation === 'Cross' ? 13 : 0) -
        Math.max(0, tactic.tempo - 72) * 0.12 +
        (compatibility - 75) * 0.08;
      const score = Math.round(clamp(linkPower - 3 + context + (hasConnector ? 0 : -16), 24, 95));
      impact.attack += (score - 64) * 0.07;
      impact.midfield += (score - 64) * 0.07;
      impact.chanceQuality += (score - 64) * 0.08;
      impact.reports.push({
        key: principle,
        label: principleLabels[principle],
        score,
        note: score >= 68
          ? 'La punta viene incontro e libera i tagli: il centro crea piu linee di passaggio.'
          : 'Il falso nove non lega bene: se continui a crossare o manca tecnica, perdi presenza in area.'
      });
      if (score < 56) impact.warnings.push('Falso nove fragile: pochi collegamenti tra punta, trequartista e mezzali.');
      return;
    }

    if (principle === 'mezzalaRuns') {
      const runnerPower = roleScore(lineup, ['CM', 'AM']);
      const coverPower = roleScore(lineup, ['DM', 'CB']);
      const context =
        (tactic.attackingFocus === 'Centro' ? 7 : 0) +
        (tactic.chanceCreation === 'Tiri da Fuori' || tactic.chanceCreation === 'Passaggi Filtranti' ? 6 : 0) +
        (tactic.tempo - 50) * 0.1 +
        (tactic.riskLevel - 50) * 0.08 -
        Math.max(0, 74 - coverPower) * 0.2;
      const score = Math.round(clamp(runnerPower - 2 + context, 28, 95));
      impact.attack += (score - 63) * 0.08;
      impact.chanceQuality += (score - 63) * 0.07;
      impact.fatigue += 2.4;
      impact.opponentRisk += tactic.riskLevel > 62 || tactic.defensiveLine > 66 ? 3.4 : 1.2;
      impact.reports.push({
        key: principle,
        label: principleLabels[principle],
        score,
        note: score >= 68
          ? 'Le mezzali attaccano l area con tempi buoni: aumentano inserimenti e seconde palle.'
          : 'Gli inserimenti spaccano troppo la squadra: senza copertura il contropiede avversario pesa.'
      });
      if (score < 58) impact.warnings.push('Mezzala di inserimento rischiosa: manca copertura dietro la corsa.');
      return;
    }

    if (principle === 'deepPlaymaker') {
      const registaPower = roleScore(lineup, ['DM', 'CM']);
      const hasRegistaZone = hasAnyRole(lineup, ['DM', 'CM']);
      const context =
        (tactic.buildUp === 'Manovrata' ? 10 : tactic.buildUp === 'Mista' ? 5 : -7) +
        (tactic.tempo <= 58 ? 5 : tactic.tempo >= 76 ? -5 : 1) +
        (tactic.defensiveLine <= 65 ? 3 : -2) +
        (compatibility - 75) * 0.1;
      const score = Math.round(clamp(registaPower + context + (hasRegistaZone ? 0 : -20), 25, 96));
      impact.midfield += (score - 62) * 0.08;
      impact.defense += (score - 62) * 0.04;
      impact.chanceQuality += (score - 62) * 0.04;
      impact.opponentRisk -= score >= 68 ? 3.5 : 0.8;
      impact.reports.push({
        key: principle,
        label: principleLabels[principle],
        score,
        note: score >= 68
          ? 'Il primo passaggio e ordinato: perdi meno palloni nella zona centrale.'
          : 'Il regista basso non ha abbastanza appoggi: il possesso puo diventare lento e leggibile.'
      });
      if (score < 55) impact.warnings.push('Regista basso senza struttura: serve un DM/CM affidabile e distanze corte.');
      return;
    }

    if (principle === 'manMarkKey') {
      const duelsPower = roleScore(lineup, ['DM', 'CB', 'CM']);
      const context =
        (tactic.marking === 'Uomo' ? 10 : tactic.marking === 'Mista' ? 6 : -5) +
        (avgCondition - 72) * 0.14 +
        (tactic.pressing - 50) * 0.06 +
        (compatibility - 75) * 0.08;
      const score = Math.round(clamp(duelsPower - 4 + context, 28, 95));
      impact.defense += (score - 60) * 0.09;
      impact.opponentRisk -= score >= 66 ? 5 : 1.5;
      impact.foulRisk += 2.8;
      impact.fatigue += 1.8;
      impact.reports.push({
        key: principle,
        label: principleLabels[principle],
        score,
        note: score >= 66
          ? 'Il creativo rivale riceve meno pulito tra le linee, ma i duelli aumentano.'
          : 'La marcatura chiave e intermittente: se il mediano si stacca, il trequartista riceve libero.'
      });
      if (score < 56) impact.warnings.push('Marcatore chiave poco credibile: rischio falli senza chiudere il loro uomo tra le linee.');
    }
  });

  if (principles.length === 0) {
    impact.explanations.push('Nessun principio speciale: piano semplice, leggibile, ma con meno armi specifiche.');
  } else {
    const best = [...impact.reports].sort((a, b) => b.score - a.score)[0];
    const weakest = [...impact.reports].sort((a, b) => a.score - b.score)[0];
    if (best) impact.explanations.push(`${best.label}: principio piu coerente oggi (${best.score}/100).`);
    if (weakest && weakest.score < 58) impact.explanations.push(`${weakest.label}: punto da correggere, perche abbassa la pulizia del piano.`);
  }

  return impact;
};

const attackingWidthBonus = (lineup: Player[], tactic: Tactic) => {
  const wingPower = roleScore(lineup, ['LW', 'RW', 'LB', 'RB']);
  const centralPower = roleScore(lineup, ['AM', 'CM', 'ST']);
  const widthNeed = tactic.attackingFocus === 'Fasce' || tactic.chanceCreation === 'Cross';
  const centerNeed = tactic.attackingFocus === 'Centro' || tactic.chanceCreation === 'Passaggi Filtranti';

  if (widthNeed) return (wingPower - 74) * 0.28 + (tactic.width - 50) * 0.08;
  if (centerNeed) return (centralPower - 74) * 0.25 + (50 - Math.abs(tactic.width - 48)) * 0.04;
  return (average([wingPower, centralPower]) - 74) * 0.2;
};

export const evaluateTactic = (players: Player[], starterIds: string[], tactic: Tactic): TacticalEvaluation => {
  const lineup = buildLineup(players, starterIds).slice(0, 11);
  const slots = POSITION_PRESETS[tactic.module];
  const slotFits: SlotFit[] = lineup.map((player, index) => {
    const slot = slots[index] ?? slots[slots.length - 1];
    const score = getPlayerSlotFitScore(player, slot.role);
    return {
      playerId: player.id,
      playerName: player.name,
      playerRole: player.role,
      slotRole: slot.role,
      score,
      label: fitLabel(score)
    };
  });

  const avgOverall = average(lineup.map(player => player.overall));
  const avgForm = average(lineup.map(player => player.form * 10));
  const avgMorale = average(lineup.map(player => player.morale));
  const avgCondition = average(lineup.map(player => player.condition));
  const avgFit = average(slotFits.map(fit => fit.score));
  const compatibility = Math.round(avgFit * 100);
  const automatisms = Math.round(clamp(tactic.familiarity ?? 35, 0, 100));
  const automatismCohesionBonus = (automatisms - 50) * 0.08;
  const automatismMatchBonus = (automatisms - 50) * 0.055;
  const automatismRiskRelief = Math.max(0, automatisms - 60) * 0.08;
  const personalityReport = evaluateLineupPersonalities(lineup, [], {
    opponentRating: avgOverall,
    isHome: true,
    round: 1
  });
  const principleImpact = evaluatePrinciples(lineup, tactic, compatibility, avgCondition);

  const defenseBase = roleScore(lineup, ['GK', 'CB', 'LB', 'RB', 'DM']);
  const midfieldBase = roleScore(lineup, ['DM', 'CM', 'AM']);
  const attackBase = roleScore(lineup, ['LW', 'RW', 'ST', 'AM']);

  const pressingReward = (tactic.pressing - 50) * (avgCondition >= 72 ? 0.08 : -0.04);
  const highLineRisk = Math.max(0, tactic.defensiveLine - 62) * (compatibility < 78 ? 0.12 : 0.05);
  const lowBlockBonus = tactic.defensiveLine < 42 && tactic.mentality === 'Difensiva' ? 2.5 : 0;
  const riskAttackBonus = (tactic.riskLevel - 50) * 0.08;
  const riskDefensePenalty = Math.max(0, tactic.riskLevel - 55) * 0.09;

  const buildUpBonus =
    tactic.buildUp === 'Manovrata' ? (midfieldBase - 74) * 0.18 + (100 - tactic.tempo) * 0.025 :
    tactic.buildUp === 'Lancio Lungo' ? (roleScore(lineup, ['ST', 'LW', 'RW']) - 74) * 0.18 + tactic.tempo * 0.025 :
    1.2;

  const chanceBonus =
    tactic.chanceCreation === 'Cross' ? (roleScore(lineup, ['LW', 'RW', 'LB', 'RB', 'ST']) - 74) * 0.2 :
    tactic.chanceCreation === 'Tagli Interni' ? (roleScore(lineup, ['LW', 'RW', 'AM']) - 74) * 0.24 :
    tactic.chanceCreation === 'Tiri da Fuori' ? (roleScore(lineup, ['CM', 'AM']) - 74) * 0.22 :
    (roleScore(lineup, ['AM', 'ST', 'CM']) - 74) * 0.24;

  const markingBonus =
    tactic.marking === 'Zona' ? compatibility * 0.025 :
    tactic.marking === 'Uomo' ? avgCondition * 0.025 - Math.max(0, tactic.pressing - 65) * 0.03 :
    1.4;

  const transitionBonus =
    tactic.transition === 'Contropiede' ? (tactic.tempo + roleScore(lineup, ['LW', 'RW', 'ST']) - 124) * 0.05 :
    tactic.transition === 'Riaggressione' ? (tactic.pressing + avgCondition - 130) * 0.05 :
    (100 - tactic.riskLevel) * 0.035;

  const mentalityAttack = tactic.mentality === 'Offensiva' ? 3 : tactic.mentality === 'Difensiva' ? -2 : 0.8;
  const mentalityDefense = tactic.mentality === 'Difensiva' ? 3 : tactic.mentality === 'Offensiva' ? -2.2 : 0.8;
  const widthBonus = attackingWidthBonus(lineup, tactic);

  const attack = clamp(
    attackBase + buildUpBonus + chanceBonus + transitionBonus + widthBonus + mentalityAttack + riskAttackBonus +
    principleImpact.attack + automatismMatchBonus * 0.45 + personalityReport.chanceSwing * 0.4,
    45,
    95
  );
  const midfield = clamp(
    midfieldBase + buildUpBonus * 0.6 + markingBonus * 0.4 + (tactic.tempo - 50) * 0.03 +
    principleImpact.midfield + automatismMatchBonus * 0.5,
    45,
    95
  );
  const defense = clamp(
    defenseBase + markingBonus + lowBlockBonus + mentalityDefense + pressingReward - highLineRisk - riskDefensePenalty +
    principleImpact.defense + automatismMatchBonus * 0.35,
    45,
    95
  );
  const cohesion = clamp(avgMorale * 0.28 + avgForm * 0.18 + avgCondition * 0.16 + compatibility * 0.38 + automatismCohesionBonus + personalityReport.cohesionSwing, 35, 100);

  const fatigueLoad = clamp(
    8 + tactic.pressing * 0.09 + tactic.tempo * 0.05 + tactic.defensiveLine * 0.03 + tactic.riskLevel * 0.04 +
    (100 - compatibility) * 0.11 + principleImpact.fatigue - Math.max(0, automatisms - 65) * 0.035 -
    personalityReport.performanceSwing * 0.12,
    8,
    36
  );
  const chanceQuality = clamp(attack * 0.72 + midfield * 0.18 + compatibility * 0.1 + principleImpact.chanceQuality + automatismMatchBonus * 0.5 + personalityReport.chanceSwing, 35, 96);
  const foulRisk = clamp(5 + tactic.pressing * 0.08 + (tactic.marking === 'Uomo' ? 4 : 0) + (100 - compatibility) * 0.04 + principleImpact.foulRisk + personalityReport.foulSwing, 3, 28);
  const opponentRisk = clamp(48 + tactic.riskLevel * 0.12 + tactic.defensiveLine * 0.09 - defense * 0.18 - compatibility * 0.08 + principleImpact.opponentRisk - automatismRiskRelief, 22, 84);
  const matchScore = clamp(avgOverall * 0.32 + attack * 0.24 + midfield * 0.2 + defense * 0.18 + cohesion * 0.06 + automatismMatchBonus + personalityReport.performanceSwing * 0.55, 45, 94);

  const warnings = slotFits
    .filter(fit => fit.score < 0.65)
    .slice(0, 4)
    .map(fit => `${fit.playerName}: ${fit.playerRole} schierato da ${fit.slotRole}`);

  if (tactic.pressing > 78 && avgCondition < 75) warnings.push('Pressing alto con condizione bassa: calo fisico probabile nel finale.');
  if (tactic.defensiveLine > 76 && defense < 76) warnings.push('Linea alta senza copertura solida: gli avversari troveranno spazio alle spalle.');
  if (tactic.chanceCreation === 'Cross' && roleScore(lineup, ['ST']) < 76) warnings.push('Tanti cross senza una punta dominante: qualita occasioni ridotta.');
  if (tactic.attackingFocus === 'Fasce' && roleScore(lineup, ['LW', 'RW', 'LB', 'RB']) < 75) warnings.push('Focus sulle fasce con pochi specialisti: manovra prevedibile.');
  principleImpact.warnings.slice(0, 3).forEach(warning => warnings.push(warning));
  personalityReport.notes.slice(0, 3).forEach(note => warnings.push(note));

  const explanations = [
    automatisms >= 75
      ? 'Automatismi alti: il blocco conosce distanze e tempi, quindi il piano e piu stabile sotto pressione.'
      : automatisms <= 38
        ? 'Automatismi bassi: il piano puo funzionare, ma cambi frequenti e stile nuovo creano esitazioni.'
        : 'Automatismi in crescita: il piano e leggibile, ma non ancora automatico nei momenti sporchi.',
    ...principleImpact.explanations
  ];

  if (opponentRisk >= 70) {
    explanations.push('Rischio avversario alto: se perdi palla, c e spazio tra centrocampo e difesa.');
  } else if (chanceQuality >= 78 && compatibility >= 76) {
    explanations.push('Qualita occasioni buona: ruoli e istruzioni stanno creando tiri piu puliti.');
  }

  return {
    compatibility,
    cohesion: Math.round(cohesion),
    attack: Math.round(attack),
    midfield: Math.round(midfield),
    defense: Math.round(defense),
    matchScore: Math.round(matchScore),
    automatisms,
    fatigueLoad: Math.round(fatigueLoad),
    chanceQuality: Math.round(chanceQuality),
    foulRisk: Math.round(foulRisk),
    opponentRisk: Math.round(opponentRisk),
    warnings,
    explanations,
    principleReports: principleImpact.reports,
    slotFits
  };
};
