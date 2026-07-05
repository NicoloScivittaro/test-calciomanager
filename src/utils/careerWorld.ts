import {
  CareerWorldState,
  ClubProfile,
  FanGroupKey,
  FanGroupState,
  FanState,
  OwnershipState,
  OwnershipType,
} from '../types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// ─── Fan Group Definitions ───

const FAN_GROUP_LABELS: Record<FanGroupKey, string> = {
  curva: 'Curva',
  tradizionali: 'Tifosi Tradizionali',
  locali: 'Tifosi Locali',
  occasionali: 'Occasionali',
  sponsor: 'Sponsor & Corporate',
};

const createFanGroup = (
  key: FanGroupKey,
  mood: number,
  patience: number,
  influence: number
): FanGroupState => ({
  key,
  label: FAN_GROUP_LABELS[key],
  mood: Math.round(clamp(mood, 0, 100)),
  patience: Math.round(clamp(patience, 0, 100)),
  influence: Math.round(clamp(influence, 0, 100)),
});

// ─── Ownership Inference from ClubProfile ───

const inferOwnershipType = (ownership: string): OwnershipType => {
  const lower = ownership.toLowerCase();
  if (lower.includes('family') || lower.includes('famiglia') || lower.includes('cairo') || lower.includes('percassi') || lower.includes('pozzo') || lower.includes('commisso') || lower.includes('saputo') || lower.includes('lotito') || lower.includes('stirpe') || lower.includes('sticchi') || lower.includes('giulini')) return 'famiglia';
  if (lower.includes('capital') || lower.includes('oaktree') || lower.includes('fund') || lower.includes('redbird') || lower.includes('exor') || lower.includes('fininvest') || lower.includes('llc')) return 'fondo';
  if (lower.includes('group') || lower.includes('djarum') || lower.includes('krause') || lower.includes('friedkin') || lower.includes('filmauro') || lower.includes('mapei') || lower.includes('newco')) return 'gruppo_industriale';
  if (lower.includes('sucu') || lower.includes('magnate')) return 'magnate';
  return 'gruppo_industriale';
};

const inferFinancialStatus = (budget: number, pressure: number): OwnershipState['financialStatus'] => {
  if (budget >= 70000000 && pressure < 85) return 'solido';
  if (budget >= 35000000) return 'equilibrato';
  if (budget >= 15000000) return 'in_tensione';
  return 'critico';
};

const inferObjectives = (club: ClubProfile): string[] => {
  const objectives: string[] = [];
  if (club.objective) objectives.push(club.objective);
  if (club.boardPromise && club.boardPromise !== club.objective) {
    objectives.push(club.boardPromise);
  }
  return objectives.length > 0 ? objectives : ['Stabilità sportiva'];
};

// ─── Fanbase Mood Derivation ───

const inferBaseMood = (club: ClubProfile): number => {
  // Start from a neutral-positive base; higher pressure = slightly lower starting mood
  // (fans are expectant but not yet disappointed)
  return clamp(62 - club.pressure * 0.12, 45, 72);
};

const inferFanbasePatience = (fanbase: string, pressure: number): number => {
  const lower = fanbase.toLowerCase();
  if (lower.includes('impazient') || lower.includes('sever') || lower.includes('pretend')) return clamp(36 - pressure * 0.06, 22, 42);
  if (lower.includes('pazient') || lower.includes('seren') || lower.includes('fedel')) return clamp(68 - pressure * 0.05, 50, 76);
  if (lower.includes('ambizios') || lower.includes('esigent')) return clamp(44 - pressure * 0.08, 28, 50);
  return clamp(52 - pressure * 0.06, 34, 62);
};

// ─── Public API ───

export const getMoodLabel = (value: number): string => {
  if (value >= 82) return 'Entusiasmo';
  if (value >= 70) return 'Fiducia';
  if (value >= 58) return 'Supporto prudente';
  if (value >= 46) return 'Attesa';
  if (value >= 34) return 'Insoddisfazione';
  if (value >= 22) return 'Delusione';
  return 'Contestazione';
};

export const createInitialCareerWorld = (club: ClubProfile): CareerWorldState => {
  const baseMood = inferBaseMood(club);
  const fanPatience = inferFanbasePatience(club.fanbase, club.pressure);
  const budgetScale = clamp(club.transferBudget / 80000000, 0.15, 1.3);

  const fanGroups: FanGroupState[] = [
    createFanGroup('curva', clamp(baseMood - 4, 30, 72), clamp(fanPatience - 8, 18, 58), 82),
    createFanGroup('tradizionali', clamp(baseMood + 2, 40, 76), clamp(fanPatience + 4, 32, 72), 72),
    createFanGroup('locali', clamp(baseMood + 4, 42, 78), clamp(fanPatience + 8, 38, 78), 56),
    createFanGroup('occasionali', clamp(baseMood + 6, 48, 80), clamp(fanPatience + 14, 46, 84), 34),
    createFanGroup('sponsor', clamp(52 + budgetScale * 12, 46, 74), 66, 62),
  ];

  const overallMood = Math.round(
    fanGroups.reduce((sum, g) => sum + g.mood * g.influence, 0) /
    Math.max(1, fanGroups.reduce((sum, g) => sum + g.influence, 0))
  );

  const fanState: FanState = {
    overallMood,
    groups: fanGroups,
    recentReactions: [],
    mostLovedPlayerIds: [],
    mostCriticizedPlayerIds: [],
  };

  const ownerType = inferOwnershipType(club.ownership);

  const ownershipState: OwnershipState = {
    ownerType,
    ambition: Math.round(clamp(42 + club.pressure * 0.45, 40, 95)),
    patience: Math.round(clamp(66 - club.pressure * 0.28, 28, 76)),
    liquidity: Math.round(clamp(28 + budgetScale * 45, 25, 92)),
    prudence: Math.round(clamp(
      ownerType === 'fondo' ? 72 :
      ownerType === 'famiglia' ? 62 :
      ownerType === 'magnate' ? 48 :
      55,
      30, 88
    )),
    boardConfidence: 58,
    financialStatus: inferFinancialStatus(club.transferBudget, club.pressure),
    currentObjectives: inferObjectives(club),
  };

  const now = new Date().toISOString();

  return {
    clubId: club.id,
    fanState,
    ownershipState,
    activeEvents: [],
    historicalEvents: [],
    createdAt: now,
    updatedAt: now,
  };
};

// ─── Normalize (migration-safe loader) ───

const normalizeFanGroup = (raw: Partial<FanGroupState>, key: FanGroupKey): FanGroupState => ({
  key,
  label: raw.label ?? FAN_GROUP_LABELS[key],
  mood: Math.round(clamp(raw.mood ?? 55, 0, 100)),
  patience: Math.round(clamp(raw.patience ?? 50, 0, 100)),
  influence: Math.round(clamp(raw.influence ?? 50, 0, 100)),
  lastReaction: raw.lastReaction,
});

const ALL_FAN_KEYS: FanGroupKey[] = ['curva', 'tradizionali', 'locali', 'occasionali', 'sponsor'];

const VALID_OWNERSHIP_TYPES: OwnershipType[] = ['famiglia', 'fondo', 'magnate', 'azionariato', 'gruppo_industriale'];
const VALID_FINANCIAL_STATUSES: OwnershipState['financialStatus'][] = ['solido', 'equilibrato', 'in_tensione', 'critico'];

export const normalizeCareerWorld = (value: unknown, club: ClubProfile): CareerWorldState => {
  if (!value || typeof value !== 'object') return createInitialCareerWorld(club);

  const raw = value as Record<string, unknown>;
  if (raw.clubId !== club.id) return createInitialCareerWorld(club);

  const fallback = createInitialCareerWorld(club);

  // Normalize fan groups
  const rawFan = (raw.fanState ?? {}) as Record<string, unknown>;
  const rawGroups = Array.isArray(rawFan.groups) ? rawFan.groups as Partial<FanGroupState>[] : [];
  const groupByKey = new Map(rawGroups.map(g => [g.key, g]));

  const groups = ALL_FAN_KEYS.map(key => {
    const existing = groupByKey.get(key);
    if (existing) return normalizeFanGroup(existing, key);
    const fb = fallback.fanState.groups.find(g => g.key === key);
    return fb ?? normalizeFanGroup({}, key);
  });

  const overallMood = Math.round(
    groups.reduce((sum, g) => sum + g.mood * g.influence, 0) /
    Math.max(1, groups.reduce((sum, g) => sum + g.influence, 0))
  );

  const fanState: FanState = {
    overallMood: typeof rawFan.overallMood === 'number' ? Math.round(clamp(rawFan.overallMood, 0, 100)) : overallMood,
    groups,
    recentReactions: Array.isArray(rawFan.recentReactions) ? (rawFan.recentReactions as string[]).slice(0, 20) : [],
    mostLovedPlayerIds: Array.isArray(rawFan.mostLovedPlayerIds) ? (rawFan.mostLovedPlayerIds as string[]).slice(0, 5) : [],
    mostCriticizedPlayerIds: Array.isArray(rawFan.mostCriticizedPlayerIds) ? (rawFan.mostCriticizedPlayerIds as string[]).slice(0, 5) : [],
  };

  // Normalize ownership
  const rawOwn = (raw.ownershipState ?? {}) as Record<string, unknown>;
  const ownerType = VALID_OWNERSHIP_TYPES.includes(rawOwn.ownerType as OwnershipType)
    ? rawOwn.ownerType as OwnershipType
    : fallback.ownershipState.ownerType;
  const financialStatus = VALID_FINANCIAL_STATUSES.includes(rawOwn.financialStatus as OwnershipState['financialStatus'])
    ? rawOwn.financialStatus as OwnershipState['financialStatus']
    : fallback.ownershipState.financialStatus;

  const ownershipState: OwnershipState = {
    ownerType,
    ambition: typeof rawOwn.ambition === 'number' ? Math.round(clamp(rawOwn.ambition, 0, 100)) : fallback.ownershipState.ambition,
    patience: typeof rawOwn.patience === 'number' ? Math.round(clamp(rawOwn.patience, 0, 100)) : fallback.ownershipState.patience,
    liquidity: typeof rawOwn.liquidity === 'number' ? Math.round(clamp(rawOwn.liquidity, 0, 100)) : fallback.ownershipState.liquidity,
    prudence: typeof rawOwn.prudence === 'number' ? Math.round(clamp(rawOwn.prudence, 0, 100)) : fallback.ownershipState.prudence,
    boardConfidence: typeof rawOwn.boardConfidence === 'number' ? Math.round(clamp(rawOwn.boardConfidence, 0, 100)) : fallback.ownershipState.boardConfidence,
    financialStatus,
    currentObjectives: Array.isArray(rawOwn.currentObjectives) ? (rawOwn.currentObjectives as string[]) : fallback.ownershipState.currentObjectives,
  };

  return {
    clubId: club.id,
    fanState,
    ownershipState,
    activeEvents: Array.isArray(raw.activeEvents) ? (raw.activeEvents as CareerWorldState['activeEvents']) : [],
    historicalEvents: Array.isArray(raw.historicalEvents) ? (raw.historicalEvents as CareerWorldState['historicalEvents']) : [],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt,
    updatedAt: new Date().toISOString(),
  };
};
