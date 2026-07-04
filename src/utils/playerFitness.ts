import { ClubMemoryDraft, Player } from '../types';

interface FitnessMatchContext {
  opponent: string;
  round: number;
  startedIds: string[];
  playedIds: string[];
}

export interface PlayerFitnessStatus {
  restThreshold: number;
  consecutiveStarts: number;
  overload: number;
  needsRest: boolean;
  performancePenalty: number;
  injuryRisk: number;
  label: 'Fresco' | 'Gestibile' | 'Da ruotare' | 'Sovraccarico';
}

export interface LineupFitnessReport {
  performanceSwing: number;
  tacticalDisorderSwing: number;
  injuryRisk: number;
  notes: string[];
  playerModifiers: Record<string, number>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 37 + seed.charCodeAt(i)) % 1000003;
  }
  return hash / 1000003;
};

const seeded = (seed: string, label: string, min: number, max: number) => {
  return Math.round(min + hashRatio(`${seed}-${label}`) * (max - min));
};

const roleLoad = (role: Player['role']) => {
  if (role === 'GK') return 2;
  if (role === 'LW' || role === 'RW' || role === 'LB' || role === 'RB') return -0.5;
  if (role === 'ST' || role === 'CM') return -0.2;
  return 0;
};

export const buildPlayerStamina = (
  seed: Pick<Player, 'id' | 'name' | 'role' | 'age' | 'overall'>,
  clubName: string,
  index = 0
) => {
  const base = `${clubName}-${seed.name}-${seed.role}-${seed.age}-${index}-stamina`;
  const ageCurve =
    seed.age <= 21 ? 5 :
    seed.age <= 27 ? 10 :
    seed.age <= 31 ? 3 :
    seed.age <= 34 ? -7 :
    -14;
  const roleBonus =
    seed.role === 'GK' ? 12 :
    seed.role === 'CM' || seed.role === 'DM' ? 4 :
    seed.role === 'LW' || seed.role === 'RW' ? -2 :
    0;
  const elitePreparation = seed.overall >= 84 ? 4 : seed.overall >= 78 ? 2 : 0;
  return clamp(seeded(base, 'base', 48, 86) + ageCurve + roleBonus + elitePreparation, 35, 96);
};

export const normalizeCareerMemory = (player: Player) => ({
  seasonsAtClub: player.careerMemory?.seasonsAtClub ?? 1,
  appearances: player.careerMemory?.appearances ?? 0,
  goals: player.careerMemory?.goals ?? 0,
  consecutiveStarts: player.careerMemory?.consecutiveStarts ?? 0,
  consecutiveAppearances: player.careerMemory?.consecutiveAppearances ?? 0,
  iconicMoments: player.careerMemory?.iconicMoments ?? 0,
  benchComplaints: player.careerMemory?.benchComplaints ?? 0,
  promisesKept: player.careerMemory?.promisesKept ?? 0,
  promisesBroken: player.careerMemory?.promisesBroken ?? 0,
  pressureCarryover: player.careerMemory?.pressureCarryover ?? 0,
  overuseWarnings: player.careerMemory?.overuseWarnings ?? 0,
  injuryWeeks: player.careerMemory?.injuryWeeks ?? 0,
  legendScore: player.careerMemory?.legendScore ?? 0
});

export const getRestThreshold = (player: Player) => {
  const agePenalty = player.age >= 34 ? 1.1 : player.age >= 31 ? 0.65 : 0;
  const professionBonus = player.personality ? (player.personality.professionalism - 58) / 42 : 0;
  const raw = 2.45 + player.stamina / 24 + professionBonus + roleLoad(player.role) - agePenalty;
  return Math.round(clamp(raw, player.role === 'GK' ? 4 : 2, player.role === 'GK' ? 8 : 6));
};

export const getPlayerFitnessStatus = (player: Player): PlayerFitnessStatus => {
  const restThreshold = getRestThreshold(player);
  const consecutiveStarts = player.careerMemory?.consecutiveStarts ?? 0;
  const overload = Math.max(0, consecutiveStarts - restThreshold + 1);
  const lowCondition = Math.max(0, 64 - player.condition);
  const ageRisk = player.age >= 34 ? 4 : player.age >= 31 ? 2 : 0;
  const staminaRisk = Math.max(0, 68 - player.stamina) * 0.08;
  const performancePenalty = overload <= 0
    ? Math.max(0, lowCondition * 0.035)
    : overload * 1.15 + lowCondition * 0.075 + Math.max(0, 58 - player.stamina) * 0.018;
  const injuryRisk = overload <= 0
    ? clamp(lowCondition * 0.08 + ageRisk, 0, 9)
    : clamp(5 + overload * 5.4 + lowCondition * 0.22 + staminaRisk + ageRisk + (player.status === 'Stanco' ? 4 : 0), 4, 38);
  const label =
    overload >= 2 || injuryRisk >= 22 ? 'Sovraccarico' :
    overload >= 1 || consecutiveStarts >= restThreshold ? 'Da ruotare' :
    player.condition < 72 ? 'Gestibile' :
    'Fresco';

  return {
    restThreshold,
    consecutiveStarts,
    overload,
    needsRest: consecutiveStarts >= restThreshold,
    performancePenalty: Number(performancePenalty.toFixed(2)),
    injuryRisk: Math.round(injuryRisk),
    label
  };
};

export const evaluateLineupFitness = (starters: Player[]): LineupFitnessReport => {
  const statuses = starters.map(player => ({ player, status: getPlayerFitnessStatus(player) }));
  const playerModifiers = Object.fromEntries(statuses.map(({ player, status }) => [
    player.id,
    Number((-status.performancePenalty).toFixed(2))
  ]));
  const totalPenalty = statuses.reduce((sum, item) => sum + item.status.performancePenalty, 0);
  const highRisk = statuses.filter(item => item.status.injuryRisk >= 18);
  const needsRest = statuses.filter(item => item.status.needsRest);
  const maxRisk = statuses.reduce((max, item) => Math.max(max, item.status.injuryRisk), 0);
  const notes = [
    needsRest[0] ? `${needsRest[0].player.name} ha ${needsRest[0].status.consecutiveStarts} titolarita di fila: dovrebbe riposare.` : '',
    highRisk[0] ? `${highRisk[0].player.name} e a rischio infortunio da sovraccarico (${highRisk[0].status.injuryRisk}%).` : '',
    needsRest.length >= 3 ? `${needsRest.length} titolari sono in zona rotazione: la prestazione collettiva cala.` : ''
  ].filter(Boolean);

  return {
    performanceSwing: Number(clamp(-totalPenalty * 0.22, -7, 0).toFixed(2)),
    tacticalDisorderSwing: Number(clamp(needsRest.length * 0.35 + highRisk.length * 0.55, 0, 5).toFixed(2)),
    injuryRisk: maxRisk,
    notes,
    playerModifiers
  };
};

export const resolvePostMatchFitness = (players: Player[], context: FitnessMatchContext) => {
  const memories: ClubMemoryDraft[] = [];
  const news: { title: string; content: string }[] = [];

  const updatedPlayers = players.map(player => {
    const started = context.startedIds.includes(player.id);
    const played = context.playedIds.includes(player.id);
    const beforeStatus = getPlayerFitnessStatus(player);
    let careerMemory = normalizeCareerMemory(player);
    let condition = player.condition;
    let morale = player.morale;
    let status = player.status;

    if (careerMemory.injuryWeeks > 0 && !played) {
      careerMemory.injuryWeeks = Math.max(0, careerMemory.injuryWeeks - 1);
      if (careerMemory.injuryWeeks === 0) {
        status = condition >= 70 ? 'Disponibile' : 'Stanco';
        condition = Math.max(condition, 68);
      }
    }

    if (started) {
      careerMemory.consecutiveStarts += 1;
      careerMemory.consecutiveAppearances += 1;
      if (beforeStatus.needsRest) careerMemory.overuseWarnings += 1;

      const roll = Math.random() * 100;
      if (beforeStatus.injuryRisk >= 12 && roll < beforeStatus.injuryRisk) {
        const injuryWeeks = beforeStatus.injuryRisk >= 28 ? 5 : beforeStatus.injuryRisk >= 20 ? 3 : 2;
        careerMemory.injuryWeeks = injuryWeeks;
        careerMemory.consecutiveStarts = 0;
        careerMemory.consecutiveAppearances = 0;
        status = 'Infortunato';
        condition = Math.max(25, condition - 28);
        morale = Math.max(10, morale - 6);
        const title = `Infortunio da sovraccarico: ${player.name}`;
        const content = `${player.name} ha forzato troppe gare consecutive. Stop stimato: ${injuryWeeks} settimane.`;
        news.push({ title, content });
        memories.push({
          season: '2026/27',
          category: 'locker',
          title,
          description: content,
          importance: 72,
          fanImpact: -3,
          dressingRoomImpact: -4,
          tags: ['infortunio', 'sovraccarico', `player:${player.name}`],
          playerNames: [player.name],
          opponent: context.opponent
        });
      } else if (beforeStatus.needsRest) {
        status = 'Stanco';
        morale = Math.max(10, morale - 2);
        if (careerMemory.overuseWarnings >= 2) {
          memories.push({
            season: '2026/27',
            category: 'locker',
            title: `Allarme rotazioni: ${player.name}`,
            description: `${player.name} continua a giocare oltre la sua soglia fisica. La prestazione cala e lo staff chiede riposo.`,
            importance: 60,
            fanImpact: 0,
            dressingRoomImpact: -2,
            tags: ['rotazioni', 'sovraccarico', `player:${player.name}`],
            playerNames: [player.name],
            opponent: context.opponent
          });
        }
      }
    } else if (played) {
      careerMemory.consecutiveStarts = 0;
      careerMemory.consecutiveAppearances += 1;
    } else {
      careerMemory.consecutiveStarts = 0;
      careerMemory.consecutiveAppearances = 0;
      careerMemory.overuseWarnings = Math.max(0, careerMemory.overuseWarnings - 1);
      if (status === 'Stanco' && condition >= 70 && careerMemory.injuryWeeks === 0) status = 'Disponibile';
    }

    return {
      ...player,
      condition,
      morale,
      status,
      careerMemory
    };
  });

  return { players: updatedPlayers, memories, news };
};
