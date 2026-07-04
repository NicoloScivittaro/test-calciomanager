import { ClubMemoryDraft, MatchEvent, Player, PlayerCareerMemory, PlayerPersonality, PlayerRelationships } from '../types';
import { buildPlayerStamina, normalizeCareerMemory } from './playerFitness';
import { getPlayerProjectRole } from './playerProjectRole';

type PlayerSeed = Pick<Player, 'id' | 'name' | 'role' | 'age' | 'nationality' | 'overall' | 'potential'>;

interface PersonalityMatchContext {
  opponent: string;
  round: number;
  isHome: boolean;
  opponentRating: number;
  scoreUser: number;
  scoreOpponent: number;
  events: MatchEvent[];
  playedIds: string[];
  starterIds: string[];
}

export interface LineupPersonalityReport {
  performanceSwing: number;
  cohesionSwing: number;
  tacticalDisorderSwing: number;
  chanceSwing: number;
  foulSwing: number;
  notes: string[];
  playerModifiers: Record<string, number>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 1000003;
  }
  return hash / 1000003;
};

const seeded = (seed: string, label: string, min: number, max: number) => {
  return Math.round(min + hashRatio(`${seed}-${label}`) * (max - min));
};

const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 58;

const roleIsAttacker = (role: Player['role']) => ['ST', 'LW', 'RW', 'AM'].includes(role);

export const buildPlayerPersonality = (seed: PlayerSeed, clubName: string, index = 0): PlayerPersonality => {
  const base = `${clubName}-${seed.name}-${seed.role}-${seed.age}-${index}`;
  const starPower = clamp((seed.overall - 72) * 2.6 + (seed.potential - seed.overall) * 1.6, -8, 34);
  const youngCeiling = seed.age <= 21 ? 14 : seed.age <= 24 ? 9 : seed.age >= 32 ? -4 : 2;
  const localBonus = seed.nationality === 'Italia' ? 8 : 0;
  const roleAggression =
    seed.role === 'CB' || seed.role === 'DM' ? 10 :
    seed.role === 'ST' ? 5 :
    seed.role === 'GK' ? -6 :
    0;
  const roleComposure = seed.role === 'GK' ? 10 : seed.role === 'CM' || seed.role === 'DM' ? 5 : 0;
  const rawAmbition = seeded(base, 'ambition', 42, 84) + starPower * 0.42 + youngCeiling;
  const rawLoyalty = seeded(base, 'loyalty', 34, 82) + localBonus + (seed.age >= 30 ? 8 : 0);
  const rawEgo = seeded(base, 'ego', 28, 78) + starPower * 0.46 + (roleIsAttacker(seed.role) ? 8 : 0);
  const rawProfessionalism = seeded(base, 'professionalism', 42, 88) + (seed.age >= 29 ? 6 : 0) - Math.max(0, rawEgo - 78) * 0.18;
  const rawComposure = seeded(base, 'composure', 38, 84) + roleComposure + (seed.age >= 29 ? 6 : 0);
  const rawAggression = seeded(base, 'aggression', 28, 82) + roleAggression;
  const rawShyness = seeded(base, 'shyness', 18, 74) - starPower * 0.22;
  const rawLeadership = seeded(base, 'leadership', 28, 78) + (seed.age >= 28 ? 12 : 0) + Math.max(0, rawProfessionalism - 68) * 0.22;
  const rawCityAttachment = seeded(base, 'cityAttachment', 28, 82) + localBonus;
  const rawBigClubDesire = rawAmbition * 0.52 + starPower * 0.48 + seeded(base, 'bigClubNoise', 0, 24);
  const rawClubLove = rawLoyalty * 0.5 + rawCityAttachment * 0.34 + seeded(base, 'clubLoveNoise', 0, 20) - Math.max(0, rawBigClubDesire - 74) * 0.16;
  const rawBenchTolerance = seeded(base, 'benchTolerance', 32, 82) + Math.max(0, rawLoyalty - 70) * 0.16 - Math.max(0, rawAmbition - 70) * 0.22 - Math.max(0, rawEgo - 72) * 0.25;
  const rawMediaPressure = seeded(base, 'mediaPressure', 28, 76) + starPower * 0.7 + Math.max(0, rawShyness - 62) * 0.28;
  const rawOneClubMan = rawLoyalty * 0.42 + rawClubLove * 0.38 + rawCityAttachment * 0.2 - Math.max(0, rawBigClubDesire - 70) * 0.22;
  const rawFinalClutch = rawComposure * 0.6 + seeded(base, 'finalClutchNoise', 0, 38) - Math.max(0, rawMediaPressure - 78) * 0.16;
  const rawConsistency = rawProfessionalism * 0.42 + rawComposure * 0.28 + seeded(base, 'consistencyNoise', 0, 35) - Math.max(0, rawAggression - 78) * 0.1;

  return {
    ambition: clamp(Math.round(rawAmbition), 0, 100),
    loyalty: clamp(Math.round(rawLoyalty), 0, 100),
    ego: clamp(Math.round(rawEgo), 0, 100),
    professionalism: clamp(Math.round(rawProfessionalism), 0, 100),
    composure: clamp(Math.round(rawComposure), 0, 100),
    aggression: clamp(Math.round(rawAggression), 0, 100),
    shyness: clamp(Math.round(rawShyness), 0, 100),
    leadership: clamp(Math.round(rawLeadership), 0, 100),
    cityAttachment: clamp(Math.round(rawCityAttachment), 0, 100),
    clubLove: clamp(Math.round(rawClubLove), 0, 100),
    benchTolerance: clamp(Math.round(rawBenchTolerance), 0, 100),
    mediaPressure: clamp(Math.round(rawMediaPressure), 0, 100),
    bigClubDesire: clamp(Math.round(rawBigClubDesire), 0, 100),
    oneClubManDesire: clamp(Math.round(rawOneClubMan), 0, 100),
    finalClutch: clamp(Math.round(rawFinalClutch), 0, 100),
    consistency: clamp(Math.round(rawConsistency), 0, 100)
  };
};

export const buildPlayerRelationships = (seed: PlayerSeed, personality: PlayerPersonality): PlayerRelationships => {
  const base = `${seed.name}-${seed.role}-relationships`;
  return {
    coach: clamp(Math.round(personality.professionalism * 0.44 + personality.ambition * 0.24 + seeded(base, 'coach', 8, 32) - personality.ego * 0.1), 0, 100),
    teammates: clamp(Math.round(personality.professionalism * 0.38 + personality.leadership * 0.26 + seeded(base, 'mates', 10, 34) - personality.ego * 0.18 - personality.aggression * 0.08), 0, 100),
    fans: clamp(Math.round(personality.clubLove * 0.42 + personality.leadership * 0.24 + seed.overall * 0.2 + seeded(base, 'fans', 0, 22)), 0, 100),
    agent: clamp(Math.round(personality.bigClubDesire * 0.45 + personality.ambition * 0.28 + personality.ego * 0.2 + seeded(base, 'agent', 0, 20)), 0, 100),
    rivalIds: [],
    bestMateIds: []
  };
};

export const buildCareerMemory = (): PlayerCareerMemory => ({
  seasonsAtClub: 1,
  appearances: 0,
  goals: 0,
  consecutiveStarts: 0,
  consecutiveAppearances: 0,
  iconicMoments: 0,
  benchComplaints: 0,
  promisesKept: 0,
  promisesBroken: 0,
  pressureCarryover: 0,
  overuseWarnings: 0,
  injuryWeeks: 0,
  legendScore: 0
});

export const assignSquadRelationships = (players: Player[]) => {
  const withBase = players.map(player => ({
    ...player,
    stamina: player.stamina ?? buildPlayerStamina(player, 'Club', 0),
    personality: player.personality ?? buildPlayerPersonality(player, 'Club', 0),
    relationships: player.relationships ?? buildPlayerRelationships(player, player.personality ?? buildPlayerPersonality(player, 'Club', 0)),
    careerMemory: player.careerMemory ? normalizeCareerMemory(player) : buildCareerMemory()
  }));

  const veterans = [...withBase]
    .filter(player => player.age >= 28 && player.personality.professionalism >= 62)
    .sort((a, b) => b.personality.leadership + b.relationships.teammates - (a.personality.leadership + a.relationships.teammates));
  const attackers = withBase.filter(player => roleIsAttacker(player.role) && player.personality.ego >= 76);

  return withBase.map(player => {
    const mentor = player.age <= 22
      ? veterans.find(veteran => veteran.id !== player.id && veteran.personality.leadership >= 64)
      : undefined;
    const rivals = attackers
      .filter(other => other.id !== player.id)
      .filter(other => player.personality.ego + other.personality.ego >= 158 || (player.role === other.role && player.relationships.teammates < 56))
      .slice(0, 2)
      .map(other => other.id);
    const bestMates = withBase
      .filter(other => other.id !== player.id)
      .filter(other => Math.abs(other.personality.professionalism - player.personality.professionalism) <= 12 && other.relationships.teammates >= 68)
      .slice(0, 2)
      .map(other => other.id);

    return {
      ...player,
      relationships: {
        ...player.relationships,
        mentorId: player.relationships.mentorId ?? mentor?.id,
        rivalIds: player.relationships.rivalIds?.length ? player.relationships.rivalIds : rivals,
        bestMateIds: player.relationships.bestMateIds?.length ? player.relationships.bestMateIds : bestMates
      }
    };
  });
};

export const ensurePlayerPersonalities = (players: Player[], clubName: string) => {
  let changed = false;
  const basePlayers = players.map((player, index) => {
    const personality = player.personality ?? buildPlayerPersonality(player, clubName, index);
    const relationships = player.relationships ?? buildPlayerRelationships(player, personality);
    const careerMemory = player.careerMemory ? normalizeCareerMemory(player) : buildCareerMemory();
    const stamina = player.stamina ?? buildPlayerStamina(player, clubName, index);
    if (
      !player.personality
      || !player.relationships
      || !player.careerMemory
      || player.stamina === undefined
      || player.careerMemory.consecutiveStarts === undefined
      || player.careerMemory.injuryWeeks === undefined
    ) changed = true;
    return { ...player, stamina, personality, relationships, careerMemory };
  });

  const withRelationships = assignSquadRelationships(basePlayers);
  const relationChanged = withRelationships.some((player, index) => (
    player.relationships.mentorId !== players[index]?.relationships?.mentorId
    || (player.relationships.rivalIds?.length ?? 0) !== (players[index]?.relationships?.rivalIds?.length ?? 0)
  ));

  return changed || relationChanged ? withRelationships : players;
};

export const getPersonalityArchetype = (player: Player) => {
  const p = player.personality;
  if (p.clubLove >= 78 && p.oneClubManDesire >= 72) return 'Bandiera potenziale';
  if (p.leadership >= 78 && p.professionalism >= 70) return 'Leader naturale';
  if (p.ego >= 84 && p.ambition >= 78) return 'Talento ingombrante';
  if (p.composure >= 78 && p.finalClutch >= 78) return 'Uomo da finali';
  if (p.mediaPressure >= 78 && p.shyness >= 62) return 'Da proteggere dai media';
  if (p.professionalism >= 78 && p.consistency >= 74) return 'Professionista affidabile';
  if (p.bigClubDesire >= 80 && p.loyalty < 55) return 'Sguardo alla big';
  if (p.aggression >= 82) return 'Competitivo ruvido';
  return 'Profilo equilibrato';
};

export const getPersonalityShortNote = (player: Player) => {
  const p = player.personality;
  if (p.ego >= 84 && player.relationships.teammates < 56) return 'Puo spaccare lo spogliatoio se non gestito.';
  if (p.benchTolerance < 42 && p.ambition >= 72) return 'Soffre la panchina e vuole minuti.';
  if (p.clubLove >= 78 && p.loyalty >= 72) return 'Si lega al club e puo diventare una leggenda.';
  if (p.finalClutch >= 80 && p.composure >= 74) return 'Cresce nelle partite piu pesanti.';
  if (p.mediaPressure >= 80 && p.composure < 62) return 'La pressione mediatica puo condizionarlo.';
  return 'Reagisce in modo coerente a risultati, ruolo e fiducia.';
};

export const evaluateLineupPersonalities = (
  starters: Player[],
  benchPlayers: Player[],
  context: { opponentRating: number; isHome: boolean; round: number }
): LineupPersonalityReport => {
  const personalities = starters.map(player => player.personality);
  const relationships = starters.map(player => player.relationships);
  const avgLeadership = average(personalities.map(p => p.leadership));
  const avgProfessionalism = average(personalities.map(p => p.professionalism));
  const avgComposure = average(personalities.map(p => p.composure));
  const avgConsistency = average(personalities.map(p => p.consistency));
  const avgAggression = average(personalities.map(p => p.aggression));
  const avgTeammates = average(relationships.map(r => r.teammates));
  const bigMatch = context.opponentRating >= 84 || context.round >= 35;
  const avgClutch = average(personalities.map(p => p.finalClutch));
  const avgMediaPressure = average(personalities.map(p => p.mediaPressure));

  const egoConflicts = starters.filter(player => (
    roleIsAttacker(player.role)
    && player.personality.ego >= 78
    && starters.some(other => other.id !== player.id && player.relationships.rivalIds?.includes(other.id))
  ));
  const protectedYoungsters = starters.filter(player => (
    player.age <= 21
    && player.relationships.mentorId
    && starters.some(other => other.id === player.relationships.mentorId)
  ));
  const restlessBench = benchPlayers.filter(player => (
    player.overall >= 78
    && player.personality.benchTolerance < 48
    && player.personality.ambition + player.personality.ego > 145
  ));

  const pressureSwing = bigMatch
    ? (avgClutch - 58) * 0.055 - Math.max(0, avgMediaPressure - avgComposure - 8) * 0.035
    : (avgConsistency - 58) * 0.025;
  const leadershipSwing = (avgLeadership - 58) * 0.035 + (avgProfessionalism - 60) * 0.03 + (avgTeammates - 58) * 0.025;
  const conflictPenalty = egoConflicts.length * 0.95 + restlessBench.length * 0.25;
  const protectionBonus = protectedYoungsters.length * 0.45;

  const playerModifiers = Object.fromEntries(starters.map(player => {
    let modifier =
      (player.personality.consistency - 55) * 0.006
      + (player.relationships.coach - 55) * 0.004
      + (player.relationships.teammates - 55) * 0.003;
    if (bigMatch) modifier += (player.personality.finalClutch - player.personality.mediaPressure) * 0.006;
    if (player.relationships.mentorId && starters.some(other => other.id === player.relationships.mentorId)) modifier += 0.15;
    if (player.relationships.rivalIds?.some(id => starters.some(other => other.id === id))) modifier -= 0.18;
    return [player.id, Number(clamp(modifier, -0.55, 0.65).toFixed(2))];
  }));

  const notes = [
    egoConflicts.length ? `${egoConflicts[0].name}: ego alto e relazione difficile con un compagno offensivo.` : '',
    protectedYoungsters.length ? `${protectedYoungsters[0].name} rende meglio protetto dal suo veterano.` : '',
    restlessBench.length ? `${restlessBench[0].name} non accetta facilmente la panchina.` : '',
    bigMatch && avgClutch >= 72 ? 'La squadra ha diversi profili da partita pesante.' : '',
    bigMatch && avgMediaPressure > avgComposure + 14 ? 'Pressione mediatica alta: alcuni giocatori rischiano di irrigidirsi.' : ''
  ].filter(Boolean);

  return {
    performanceSwing: clamp(leadershipSwing + pressureSwing + protectionBonus - conflictPenalty, -5.5, 5.5),
    cohesionSwing: clamp((avgTeammates - 58) * 0.08 + protectionBonus - conflictPenalty * 0.8, -8, 8),
    tacticalDisorderSwing: clamp(conflictPenalty * 0.8 + restlessBench.length * 0.35 - (avgProfessionalism - 60) * 0.025, -2.5, 5.5),
    chanceSwing: clamp((avgComposure - 58) * 0.03 + (bigMatch ? (avgClutch - 58) * 0.035 : 0) - egoConflicts.length * 0.2, -2.5, 3.2),
    foulSwing: clamp((avgAggression - avgProfessionalism) * 0.025, -1.8, 2.8),
    notes,
    playerModifiers
  };
};

const countPlayerGoals = (player: Player, events: MatchEvent[]) => (
  events.filter(event => event.type === 'goal' && event.team === 'user' && event.description.includes(player.name)).length
);

export const resolvePostMatchPersonalities = (
  players: Player[],
  context: PersonalityMatchContext
) => {
  const userWon = context.scoreUser > context.scoreOpponent;
  const userLost = context.scoreUser < context.scoreOpponent;
  const heavyLoss = context.scoreOpponent - context.scoreUser >= 3;
  const bigMatch = context.opponentRating >= 84 || context.round >= 35;
  const starters = players.filter(player => context.starterIds.includes(player.id));
  const matchBenchIds = players.filter(player => !context.starterIds.includes(player.id)).map(player => player.id);
  const memories: ClubMemoryDraft[] = [];

  const updatedPlayers = players.map(player => {
    const played = context.playedIds.includes(player.id);
    const started = context.starterIds.includes(player.id);
    const goals = countPlayerGoals(player, context.events);
    let morale = player.morale;
    let status = player.status;
    let personality = { ...player.personality };
    let relationships = { ...player.relationships };
    let careerMemory = { ...player.careerMemory };

    if (played) {
      careerMemory.appearances += 1;
      careerMemory.goals += goals;
      careerMemory.benchComplaints = Math.max(0, careerMemory.benchComplaints - 1);
      relationships.coach = clamp(relationships.coach + (started ? 2 : 1), 0, 100);
      relationships.fans = clamp(relationships.fans + goals * 5 + (userWon ? 2 : userLost ? -2 : 0), 0, 100);
      relationships.teammates = clamp(relationships.teammates + (userWon ? 2 : heavyLoss && personality.ego >= 78 ? -4 : 0), 0, 100);
      morale = clamp(morale + goals * 4 + (userWon ? 2 : heavyLoss ? -2 : 0) + (personality.professionalism >= 74 && userLost ? 1 : 0), 0, 100);
      careerMemory.legendScore = clamp(
        careerMemory.legendScore
        + (started ? 1.2 : 0.7)
        + goals * 2.4
        + personality.clubLove * 0.012
        + personality.leadership * 0.01,
        0,
        100
      );

      const mentor = player.relationships.mentorId
        ? starters.find(other => other.id === player.relationships.mentorId)
        : undefined;
      if (player.age <= 21 && mentor) {
        relationships.teammates = clamp(relationships.teammates + 3, 0, 100);
        relationships.coach = clamp(relationships.coach + 2, 0, 100);
        morale = clamp(morale + 2, 0, 100);
      }

      if (bigMatch && goals > 0 && personality.finalClutch >= 76) {
        careerMemory.iconicMoments += 1;
        careerMemory.legendScore = clamp(careerMemory.legendScore + 7, 0, 100);
        memories.push({
          season: '2026/27',
          category: 'legacy',
          title: `${player.name} si prende la scena`,
          description: `In una partita ad alta pressione contro ${context.opponent}, il suo carattere da finali pesa davvero.`,
          importance: clamp(70 + personality.finalClutch * 0.18, 72, 92),
          fanImpact: 4,
          dressingRoomImpact: 3,
          tags: ['carattere', 'partita-pesante', `player:${player.name}`],
          playerNames: [player.name],
          opponent: context.opponent,
          score: `${context.scoreUser}-${context.scoreOpponent}`
        });
      }
    } else {
      const projectRole = getPlayerProjectRole(player, {
        starters: context.starterIds,
        bench: matchBenchIds,
        round: context.round
      });
      const roleStress =
        projectRole.key === 'untouchableStar' || projectRole.key === 'brokenPromise' ? 12 :
        projectRole.key === 'contestedStarter' ? 6 :
        projectRole.key === 'surplus' ? -8 :
        projectRole.key === 'twelfthMan' || projectRole.key === 'silentLeader' ? -10 :
        projectRole.key === 'decliningVeteran' || projectRole.key === 'protectedYoungster' ? -5 :
        0;
      const benchStress =
        personality.ambition * 0.34
        + personality.ego * 0.28
        + personality.bigClubDesire * 0.2
        + Math.max(0, player.overall - 76) * 2.2
        + Math.max(0, player.potential - player.overall) * 0.7
        + projectRole.tension * 0.12
        + roleStress
        - personality.benchTolerance * 0.58
        - personality.loyalty * 0.12
        - (projectRole.trust >= 70 ? 5 : 0);

      if (benchStress > 34) {
        careerMemory.benchComplaints += 1;
        relationships.coach = clamp(relationships.coach - 4, 0, 100);
        relationships.agent = clamp(relationships.agent + 4, 0, 100);
        morale = clamp(morale - (benchStress > 48 ? 8 : 5), 0, 100);

        if (careerMemory.benchComplaints >= 2 && morale < 58) {
          status = 'Cedibile';
          memories.push({
            season: '2026/27',
            category: 'locker',
            title: `Caso panchina: ${player.name}`,
            description: `${player.name} soffre i pochi minuti: oggi si percepisce come ${projectRole.label.toLowerCase()}, quindi panchina e promesse pesano sul rapporto con l'allenatore.`,
            importance: clamp(58 + benchStress * 0.35, 60, 88),
            fanImpact: -1,
            dressingRoomImpact: -4,
            tags: ['panchina', 'agente', projectRole.key, `player:${player.name}`],
            playerNames: [player.name]
          });
        }
      } else if (personality.professionalism >= 76 || personality.benchTolerance >= 70) {
        relationships.coach = clamp(relationships.coach + 1, 0, 100);
        if (projectRole.key === 'silentLeader' || projectRole.key === 'decliningVeteran') {
          relationships.teammates = clamp(relationships.teammates + 1, 0, 100);
        }
        morale = clamp(morale - 1, 0, 100);
      }
    }

    const missedChance = context.events.some(event => (
      event.type === 'opportunity'
      && event.team === 'user'
      && event.description.includes(player.name)
    ));
    if (userLost && missedChance && personality.mediaPressure > personality.composure + 14) {
      careerMemory.pressureCarryover += 1;
      morale = clamp(morale - 5, 0, 100);
      memories.push({
        season: '2026/27',
        category: 'locker',
        title: `${player.name} si trascina la pressione`,
        description: `Dopo l'occasione fallita contro ${context.opponent}, media e fiducia diventano un tema da gestire.`,
        importance: clamp(58 + personality.mediaPressure * 0.2, 60, 82),
        fanImpact: -2,
        dressingRoomImpact: -2,
        tags: ['pressione', `player:${player.name}`],
        playerNames: [player.name],
        opponent: context.opponent,
        score: `${context.scoreUser}-${context.scoreOpponent}`
      });
    }

    if (careerMemory.legendScore >= 72 && personality.clubLove >= 72 && personality.oneClubManDesire >= 68) {
      memories.push({
        season: '2026/27',
        category: 'legacy',
        title: `${player.name} diventa simbolo del club`,
        description: `Presenze, attaccamento e rendimento stanno trasformando un giocatore in una figura identitaria.`,
        importance: 84,
        fanImpact: 6,
        dressingRoomImpact: 4,
        tags: ['leggenda', `player:${player.name}`],
        playerNames: [player.name]
      });
    }

    return {
      ...player,
      morale,
      status,
      personality,
      relationships,
      careerMemory
    };
  });

  return { players: updatedPlayers, memories };
};
