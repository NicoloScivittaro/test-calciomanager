import {
  ClubHistoryState,
  EmotionalNarrativeState,
  Player,
  PlayerConversation,
  PlayerConversationMemory,
  PlayerConversationMessage,
  PlayerConversationState,
  PlayerConversationTopic,
  PlayerDialogueCommunicationStyle,
  PlayerDialoguePersona,
  PlayerDialogueQuickReply,
  PlayerProjectRole,
  PlayerSeasonStat
} from '../types';
import { getPlayerProjectRole } from './playerProjectRole';
import { generateLocalPlayerDialogue, PlayerDialogueRequestContext } from './playerDialogueProvider';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampPercent = (value: number) => Math.round(clamp(value, 0, 100));

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

// Cooldown expressed in league rounds. A round is roughly one week of career time,
// so "at least 2 rounds" approximates the "14 giorni di carriera" requirement without
// inventing a real-date system the project doesn't otherwise track.
const IMPORTANT_MESSAGE_COOLDOWN_ROUNDS = 2;
const MAX_OPEN_URGENT_CONVERSATIONS = 2;
const URGENT_IMPORTANCE_THRESHOLD = 60;
const MAX_MESSAGES_PER_CONVERSATION = 12;
const MAX_MEMORY_PER_CONVERSATION = 5;
const MAX_STORED_CONVERSATIONS = 60;

// ─── Initial / normalize (migration-safe) ───

export const createInitialPlayerConversationState = (): PlayerConversationState => ({
  personas: [],
  conversations: [],
  lastImportantMessageRoundByPlayer: {},
  updatedAt: new Date().toISOString()
});

const VALID_STYLES: PlayerDialogueCommunicationStyle[] = [
  'veteran_professional', 'ambitious_talent', 'selfish_star', 'shy_youngster', 'club_flag', 'frustrated_reserve', 'balanced'
];
const VALID_TOPICS: PlayerConversationTopic[] = [
  'playing_time', 'project_role', 'promise', 'match_reaction', 'morale', 'training', 'injury_return', 'transfer_interest', 'contract_expectation', 'team_conflict'
];
const VALID_STATUSES = ['open', 'resolved', 'archived'];
const VALID_SENDERS = ['manager', 'player', 'system'];
const VALID_TONES = ['calm', 'direct', 'frustrated', 'grateful', 'confident', 'reserved'];
const VALID_INTENTS = ['request', 'complaint', 'gratitude', 'clarification', 'response'];

const normalizePersona = (raw: unknown): PlayerDialoguePersona | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.playerId !== 'string') return null;
  const num = (value: unknown, fallback: number) => typeof value === 'number' ? clampPercent(value) : fallback;
  return {
    playerId: item.playerId,
    communicationStyle: VALID_STYLES.includes(item.communicationStyle as PlayerDialogueCommunicationStyle) ? item.communicationStyle as PlayerDialogueCommunicationStyle : 'balanced',
    formality: num(item.formality, 50),
    directness: num(item.directness, 50),
    emotionality: num(item.emotionality, 50),
    confidence: num(item.confidence, 50),
    patience: num(item.patience, 50),
    loyalty: num(item.loyalty, 50),
    ambition: num(item.ambition, 50),
    ego: num(item.ego, 50),
    leadership: num(item.leadership, 50),
    humor: num(item.humor, 50),
    conflictTendency: num(item.conflictTendency, 50),
    messageLength: num(item.messageLength, 50),
    speechSeed: typeof item.speechSeed === 'number' ? item.speechSeed : hashString(item.playerId),
    preferredTopics: Array.isArray(item.preferredTopics) ? (item.preferredTopics as string[]).filter(t => VALID_TOPICS.includes(t as PlayerConversationTopic)) as PlayerConversationTopic[] : [],
    dislikedTopics: Array.isArray(item.dislikedTopics) ? (item.dislikedTopics as string[]).filter(t => VALID_TOPICS.includes(t as PlayerConversationTopic)) as PlayerConversationTopic[] : []
  };
};

const normalizeMessage = (raw: unknown): PlayerConversationMessage | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.text !== 'string') return null;
  return {
    id: item.id,
    sender: VALID_SENDERS.includes(item.sender as string) ? item.sender as PlayerConversationMessage['sender'] : 'system',
    text: item.text,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    tone: VALID_TONES.includes(item.tone as string) ? item.tone as PlayerConversationMessage['tone'] : 'calm',
    intent: VALID_INTENTS.includes(item.intent as string) ? item.intent as PlayerConversationMessage['intent'] : 'response',
    isImportant: item.isImportant === true,
    relatedActionId: typeof item.relatedActionId === 'string' ? item.relatedActionId : undefined
  };
};

const normalizeMemory = (raw: unknown): PlayerConversationMemory | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.text !== 'string') return null;
  return { id: item.id, text: item.text, createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString() };
};

const normalizeConversation = (raw: unknown): PlayerConversation | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.playerId !== 'string') return null;

  const messages = Array.isArray(item.messages)
    ? item.messages.map(normalizeMessage).filter((m): m is PlayerConversationMessage => m !== null).slice(-MAX_MESSAGES_PER_CONVERSATION)
    : [];
  const memory = Array.isArray(item.memory)
    ? item.memory.map(normalizeMemory).filter((m): m is PlayerConversationMemory => m !== null).slice(0, MAX_MEMORY_PER_CONVERSATION)
    : [];

  return {
    id: item.id,
    playerId: item.playerId,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    status: VALID_STATUSES.includes(item.status as string) ? item.status as PlayerConversation['status'] : 'open',
    topic: VALID_TOPICS.includes(item.topic as PlayerConversationTopic) ? item.topic as PlayerConversationTopic : 'training',
    messages,
    summary: typeof item.summary === 'string' ? item.summary : '',
    memory,
    unreadForManager: item.unreadForManager === true,
    unreadForPlayer: item.unreadForPlayer === true,
    lastPlayerInitiatedAt: typeof item.lastPlayerInitiatedAt === 'string' ? item.lastPlayerInitiatedAt : undefined,
    lastManagerMessageAt: typeof item.lastManagerMessageAt === 'string' ? item.lastManagerMessageAt : undefined,
    relatedPromiseId: typeof item.relatedPromiseId === 'string' ? item.relatedPromiseId : undefined,
    relatedEventId: typeof item.relatedEventId === 'string' ? item.relatedEventId : undefined,
    relatedMatchId: typeof item.relatedMatchId === 'string' ? item.relatedMatchId : undefined,
    importance: typeof item.importance === 'number' ? clampPercent(item.importance) : 40,
    sentiment: typeof item.sentiment === 'number' ? clampPercent(item.sentiment) : 50
  };
};

export const normalizePlayerConversationState = (value: unknown): PlayerConversationState => {
  if (!value || typeof value !== 'object') return createInitialPlayerConversationState();
  const raw = value as Record<string, unknown>;

  const personas = Array.isArray(raw.personas)
    ? raw.personas.map(normalizePersona).filter((p): p is PlayerDialoguePersona => p !== null)
    : [];
  const conversations = Array.isArray(raw.conversations)
    ? raw.conversations.map(normalizeConversation).filter((c): c is PlayerConversation => c !== null).slice(0, MAX_STORED_CONVERSATIONS)
    : [];
  const lastImportantMessageRoundByPlayer = raw.lastImportantMessageRoundByPlayer && typeof raw.lastImportantMessageRoundByPlayer === 'object'
    ? Object.fromEntries(Object.entries(raw.lastImportantMessageRoundByPlayer as Record<string, unknown>).filter(([, v]) => typeof v === 'number') as [string, number][])
    : {};

  return {
    personas,
    conversations,
    lastImportantMessageRoundByPlayer,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  };
};

// ─── Persona generation (stable, derived from real player data + a per-player seed) ───

export const deriveCommunicationStyle = (player: Player, role: PlayerProjectRole): PlayerDialogueCommunicationStyle => {
  if (player.age >= 32 && player.personality.professionalism >= 62) return 'veteran_professional';
  if (player.personality.clubLove >= 74 && player.personality.oneClubManDesire >= 62) return 'club_flag';
  if (player.age <= 21 && player.personality.shyness >= 52) return 'shy_youngster';
  if ((player.personality.ego >= 74 || role.key === 'untouchableStar') && player.personality.ambition >= 60) return 'selfish_star';
  if (['twelfthMan', 'benchPlayer', 'surplus', 'frustratedTalent'].includes(role.key) && role.trust <= 50) return 'frustrated_reserve';
  if (player.personality.ambition >= 68 && player.age <= 26) return 'ambitious_talent';
  return 'balanced';
};

const PREFERRED_TOPICS_BY_STYLE: Record<PlayerDialogueCommunicationStyle, PlayerConversationTopic[]> = {
  veteran_professional: ['project_role', 'training'],
  ambitious_talent: ['playing_time', 'promise'],
  selfish_star: ['project_role', 'match_reaction'],
  shy_youngster: ['project_role', 'training'],
  club_flag: ['team_conflict', 'match_reaction'],
  frustrated_reserve: ['playing_time', 'promise'],
  balanced: ['training']
};
const DISLIKED_TOPICS_BY_STYLE: Record<PlayerDialogueCommunicationStyle, PlayerConversationTopic[]> = {
  veteran_professional: ['transfer_interest'],
  ambitious_talent: ['training'],
  selfish_star: ['contract_expectation'],
  shy_youngster: ['team_conflict'],
  club_flag: ['transfer_interest'],
  frustrated_reserve: ['team_conflict'],
  balanced: []
};

export const createPlayerDialoguePersona = (player: Player, role: PlayerProjectRole): PlayerDialoguePersona => {
  const seed = hashString(player.id);
  const style = deriveCommunicationStyle(player, role);
  const jitter = (salt: number) => (((seed + salt) % 17) - 8) / 8 * 6;

  return {
    playerId: player.id,
    communicationStyle: style,
    formality: clampPercent(40 + player.personality.professionalism * 0.4 + jitter(1)),
    directness: clampPercent(30 + player.personality.aggression * 0.3 + (100 - player.personality.shyness) * 0.2 + jitter(2)),
    emotionality: clampPercent(100 - player.personality.composure * 0.6 + jitter(3)),
    confidence: clampPercent(player.personality.ego * 0.4 + player.overall * 0.3 + jitter(4)),
    patience: clampPercent(player.personality.benchTolerance * 0.5 + (100 - player.personality.ambition) * 0.2 + jitter(5)),
    loyalty: clampPercent(player.personality.loyalty * 0.6 + player.personality.clubLove * 0.3 + jitter(6)),
    ambition: clampPercent(player.personality.ambition * 0.7 + player.personality.bigClubDesire * 0.2 + jitter(7)),
    ego: clampPercent(player.personality.ego * 0.8 + jitter(8)),
    leadership: clampPercent(player.personality.leadership * 0.8 + jitter(9)),
    humor: clampPercent(30 + (100 - player.personality.shyness) * 0.3 + jitter(10)),
    conflictTendency: clampPercent(player.personality.aggression * 0.4 + player.personality.ego * 0.3 - player.personality.professionalism * 0.15 + jitter(11)),
    messageLength: clampPercent(
      style === 'veteran_professional' || style === 'shy_youngster' ? 28 + jitter(12) :
      style === 'selfish_star' || style === 'club_flag' ? 62 + jitter(12) :
      45 + jitter(12)
    ),
    speechSeed: seed % 9973,
    preferredTopics: PREFERRED_TOPICS_BY_STYLE[style],
    dislikedTopics: DISLIKED_TOPICS_BY_STYLE[style]
  };
};

export const ensurePersonaForPlayer = (
  state: PlayerConversationState,
  player: Player,
  role: PlayerProjectRole
): { state: PlayerConversationState; persona: PlayerDialoguePersona } => {
  const existing = state.personas.find(p => p.playerId === player.id);
  if (existing) return { state, persona: existing };
  const persona = createPlayerDialoguePersona(player, role);
  return { state: { ...state, personas: [...state.personas, persona] }, persona };
};

// ─── Small read helpers ───

export const getOpenConversationForPlayer = (state: PlayerConversationState, playerId: string): PlayerConversation | undefined => (
  state.conversations.find(c => c.playerId === playerId && c.status === 'open')
);

export const getConversationsForPlayer = (state: PlayerConversationState, playerId: string): PlayerConversation[] => (
  state.conversations.filter(c => c.playerId === playerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
);

const replaceConversation = (state: PlayerConversationState, conversation: PlayerConversation): PlayerConversationState => ({
  ...state,
  conversations: state.conversations.map(c => c.id === conversation.id ? conversation : c),
  updatedAt: new Date().toISOString()
});

const statFor = (playerId: string, playerStats: PlayerSeasonStat[]): PlayerSeasonStat | undefined => (
  playerStats.find(s => s.playerId === playerId)
);

const buildRequestContext = (params: {
  persona: PlayerDialoguePersona;
  player: Player;
  role: PlayerProjectRole;
  stat?: PlayerSeasonStat;
  topic: PlayerConversationTopic;
  problemSummary: string;
  conversation?: PlayerConversation;
  managerMessage?: string;
  quickReplyLabel?: string;
}): PlayerDialogueRequestContext => ({
  persona: params.persona,
  playerName: params.player.name,
  playerRole: params.player.role,
  age: params.player.age,
  overall: params.player.overall,
  form: params.player.form,
  morale: params.player.morale,
  minutesPlayed: params.stat?.minutesPlayed ?? 0,
  projectRoleLabel: params.role.label,
  projectRoleTrust: params.role.trust,
  projectRoleTension: params.role.tension,
  topic: params.topic,
  problemSummary: params.problemSummary,
  conversationSummary: params.conversation?.summary ?? '',
  recentMemory: (params.conversation?.memory ?? []).map(m => m.text),
  recentMessages: (params.conversation?.messages ?? []).slice(-6).map(m => ({ sender: m.sender, text: m.text })),
  managerMessage: params.managerMessage,
  quickReplyLabel: params.quickReplyLabel,
  conversationId: params.conversation?.id ?? `draft_${params.player.id}`,
  messageSeedIndex: params.conversation?.messages.length ?? 0
});

const buildSummary = (memory: PlayerConversationMemory[], fallback: string): string => (
  memory.length > 0 ? memory.slice(0, 3).map(m => m.text).join(' · ').slice(0, 220) : fallback
);

const sentimentDeltaForTone = (tone: PlayerConversationMessage['tone']): number => (
  tone === 'grateful' ? 8 : tone === 'calm' ? 3 : tone === 'confident' ? 1 : tone === 'reserved' ? -2 : tone === 'direct' ? -3 : -8
);

// ─── Manual conversation (started from the player profile) ───

const inferCurrentTopic = (player: Player, role: PlayerProjectRole): PlayerConversationTopic => {
  if (player.playingTimePromise?.status === 'at_risk' || player.playingTimePromise?.status === 'broken') return 'promise';
  if (role.key === 'frustratedTalent' || role.tension >= 60) return 'project_role';
  if (player.morale <= 35) return 'morale';
  return 'playing_time';
};

export const openManualConversation = (
  state: PlayerConversationState,
  player: Player,
  playerStats: PlayerSeasonStat[],
  clubHistory: ClubHistoryState | undefined,
  currentRound: number
): { state: PlayerConversationState; conversation: PlayerConversation; suggestedReplies: PlayerDialogueQuickReply[] } => {
  const existing = getOpenConversationForPlayer(state, player.id);
  if (existing) return { state, conversation: existing, suggestedReplies: [] };

  const role = getPlayerProjectRole(player, { seasonStats: playerStats, clubHistory, round: currentRound });
  const { state: stateWithPersona, persona } = ensurePersonaForPlayer(state, player, role);
  const topic = inferCurrentTopic(player, role);
  const stat = statFor(player.id, playerStats);

  const problemSummary = topic === 'promise' && player.playingTimePromise
    ? `Promessa di ${player.playingTimePromise.targetMinutes}' minuti: ${player.playingTimePromise.currentMinutes}' finora.`
    : topic === 'project_role'
    ? `Ruolo percepito attuale: ${role.label.toLowerCase()}.`
    : topic === 'morale'
    ? `Morale del giocatore basso (${player.morale}).`
    : `Minuti stagionali finora: ${stat?.minutesPlayed ?? 0}'.`;

  const conversationId = `conv_${player.id}_${Date.now()}`;
  const requestCtx = buildRequestContext({ persona, player, role, stat, topic, problemSummary });
  const dialogue = generateLocalPlayerDialogue(requestCtx);

  const openingMessage: PlayerConversationMessage = {
    id: `msg_${conversationId}_0`,
    sender: 'player',
    text: dialogue.playerMessage,
    createdAt: new Date().toISOString(),
    tone: dialogue.tone,
    intent: dialogue.intent,
    isImportant: false
  };

  const memory: PlayerConversationMemory[] = dialogue.memoryCandidate
    ? [{ id: `mem_${conversationId}_0`, text: dialogue.memoryCandidate, createdAt: new Date().toISOString() }]
    : [];

  const conversation: PlayerConversation = {
    id: conversationId,
    playerId: player.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'open',
    topic,
    messages: [openingMessage],
    summary: buildSummary(memory, problemSummary),
    memory,
    unreadForManager: false,
    unreadForPlayer: false,
    relatedPromiseId: player.playingTimePromise?.id,
    importance: 30,
    sentiment: 50
  };

  const nextState: PlayerConversationState = {
    ...stateWithPersona,
    conversations: [conversation, ...stateWithPersona.conversations].slice(0, MAX_STORED_CONVERSATIONS),
    updatedAt: new Date().toISOString()
  };

  return { state: nextState, conversation, suggestedReplies: dialogue.suggestedReplies };
};

// ─── Manager free-text message + committing an already-generated player reply ───

export const appendManagerMessage = (state: PlayerConversationState, conversationId: string, text: string): PlayerConversationState => {
  const conversation = state.conversations.find(c => c.id === conversationId);
  if (!conversation) return state;
  const now = new Date().toISOString();
  const message: PlayerConversationMessage = {
    id: `msg_${conversationId}_${conversation.messages.length}`,
    sender: 'manager',
    text,
    createdAt: now,
    tone: 'calm',
    intent: 'response',
    isImportant: false
  };
  return replaceConversation(state, {
    ...conversation,
    messages: [...conversation.messages, message].slice(-MAX_MESSAGES_PER_CONVERSATION),
    lastManagerMessageAt: now,
    unreadForPlayer: false,
    updatedAt: now
  });
};

export const appendPlayerReply = (
  state: PlayerConversationState,
  conversationId: string,
  response: { playerMessage: string; tone: PlayerConversationMessage['tone']; intent: PlayerConversationMessage['intent']; memoryCandidate?: string },
  isImportant = false
): PlayerConversationState => {
  const conversation = state.conversations.find(c => c.id === conversationId);
  if (!conversation) return state;
  const now = new Date().toISOString();
  const message: PlayerConversationMessage = {
    id: `msg_${conversationId}_${conversation.messages.length}`,
    sender: 'player',
    text: response.playerMessage,
    createdAt: now,
    tone: response.tone,
    intent: response.intent,
    isImportant
  };
  const memory = response.memoryCandidate
    ? [{ id: `mem_${conversationId}_${conversation.memory.length}`, text: response.memoryCandidate, createdAt: now }, ...conversation.memory].slice(0, MAX_MEMORY_PER_CONVERSATION)
    : conversation.memory;

  return replaceConversation(state, {
    ...conversation,
    messages: [...conversation.messages, message].slice(-MAX_MESSAGES_PER_CONVERSATION),
    memory,
    summary: buildSummary(memory, conversation.summary),
    unreadForManager: true,
    sentiment: clampPercent(conversation.sentiment + sentimentDeltaForTone(response.tone)),
    updatedAt: now
  });
};

// ─── Quick replies: deterministic, code-applied consequences ───

interface QuickReplyEffect { moraleDelta: number; sentimentDelta: number; }

const QUICK_REPLY_EFFECTS: Record<string, (persona: PlayerDialoguePersona) => QuickReplyEffect> = {
  reassure_playing_time: () => ({ moraleDelta: 4, sentimentDelta: 14 }),
  ask_patience: () => ({ moraleDelta: 1, sentimentDelta: 5 }),
  defer_decision: () => ({ moraleDelta: 2, sentimentDelta: 6 }),
  invoke_team_first: persona => (persona.ego >= 70 ? { moraleDelta: -2, sentimentDelta: -4 } : { moraleDelta: 1, sentimentDelta: 5 }),
  defer_end_season: () => ({ moraleDelta: 1, sentimentDelta: 4 }),
  refuse: persona => (persona.ambition >= 65 || persona.ego >= 65 ? { moraleDelta: -6, sentimentDelta: -12 } : { moraleDelta: -3, sentimentDelta: -8 })
};

const TONE_BY_REPLY_TONE: Record<PlayerDialogueQuickReply['tone'], PlayerConversationMessage['tone']> = {
  supportive: 'calm',
  firm: 'direct',
  cautious: 'reserved',
  ambitious: 'confident'
};

export const applyQuickReply = (
  state: PlayerConversationState,
  conversationId: string,
  reply: PlayerDialogueQuickReply,
  player: Player,
  playerStats: PlayerSeasonStat[],
  clubHistory: ClubHistoryState | undefined,
  currentRound: number
): { state: PlayerConversationState; moraleDelta: number; suggestedReplies: PlayerDialogueQuickReply[] } => {
  const conversation = state.conversations.find(c => c.id === conversationId);
  if (!conversation) return { state, moraleDelta: 0, suggestedReplies: [] };

  const role = getPlayerProjectRole(player, { seasonStats: playerStats, clubHistory, round: currentRound });
  const { state: stateWithPersona, persona } = ensurePersonaForPlayer(state, player, role);
  const effect = (QUICK_REPLY_EFFECTS[reply.action] ?? (() => ({ moraleDelta: 0, sentimentDelta: 0 })))(persona);

  const withManagerMessage = appendManagerMessage(stateWithPersona, conversationId, reply.label);
  const managerToneConversation = withManagerMessage.conversations.find(c => c.id === conversationId)!;

  const stat = statFor(player.id, playerStats);
  const requestCtx = buildRequestContext({
    persona, player, role, stat, topic: conversation.topic, problemSummary: conversation.summary,
    conversation: managerToneConversation, quickReplyLabel: reply.label
  });
  const ack = generateLocalPlayerDialogue({ ...requestCtx, managerMessage: undefined });

  const nextSentiment = clampPercent(conversation.sentiment + effect.sentimentDelta);
  const shouldResolve = nextSentiment >= 75;

  const withPlayerReply = appendPlayerReply(withManagerMessage, conversationId, {
    playerMessage: ack.playerMessage,
    tone: TONE_BY_REPLY_TONE[reply.tone],
    intent: 'response',
    memoryCandidate: `Risposta del mister: "${reply.label}"`
  });

  const finalConversation = withPlayerReply.conversations.find(c => c.id === conversationId)!;
  const resolvedState = replaceConversation(withPlayerReply, {
    ...finalConversation,
    sentiment: nextSentiment,
    status: shouldResolve ? 'resolved' : finalConversation.status,
    importance: shouldResolve ? Math.max(20, finalConversation.importance - 20) : finalConversation.importance
  });

  return { state: resolvedState, moraleDelta: effect.moraleDelta, suggestedReplies: shouldResolve ? [] : ack.suggestedReplies };
};

export const closeConversation = (state: PlayerConversationState, conversationId: string): PlayerConversationState => {
  const conversation = state.conversations.find(c => c.id === conversationId);
  if (!conversation) return state;
  return replaceConversation(state, { ...conversation, status: 'resolved', unreadForManager: false });
};

export const markConversationRead = (state: PlayerConversationState, conversationId: string): PlayerConversationState => {
  const conversation = state.conversations.find(c => c.id === conversationId);
  if (!conversation || !conversation.unreadForManager) return state;
  return replaceConversation(state, { ...conversation, unreadForManager: false });
};

// ─── Post-match automatic triggers ───

export interface PostMatchDialogueTriggerContext {
  round: number;
  matchId: string;
  opponentName: string;
  rivalryHeat: number;
  beforePlayers: Player[];
  afterPlayers: Player[];
  playerStats: PlayerSeasonStat[];
  starters: string[];
  playedPlayerIds: string[];
  justBrokenPromisePlayerIds: string[];
  emotionalNarratives: EmotionalNarrativeState;
  clubHistory: ClubHistoryState;
}

interface TriggerCandidate {
  playerId: string;
  topic: PlayerConversationTopic;
  importance: number;
  problemSummary: string;
  relatedPromiseId?: string;
  relatedEventId?: string;
  relatedMatchId?: string;
}

export const detectPostMatchConversationTriggers = (
  state: PlayerConversationState,
  context: PostMatchDialogueTriggerContext
): { state: PlayerConversationState; created?: PlayerConversation } => {
  const candidates: TriggerCandidate[] = [];

  context.afterPlayers.forEach(player => {
    const lastRound = state.lastImportantMessageRoundByPlayer[player.id];
    if (lastRound !== undefined && context.round - lastRound < IMPORTANT_MESSAGE_COOLDOWN_ROUNDS) return;

    const role = getPlayerProjectRole(player, { starters: context.starters, seasonStats: context.playerStats, clubHistory: context.clubHistory, round: context.round });

    if (context.justBrokenPromisePlayerIds.includes(player.id) && player.playingTimePromise) {
      candidates.push({
        playerId: player.id, topic: 'promise', importance: 78,
        relatedPromiseId: player.playingTimePromise.id,
        problemSummary: `La promessa di ${player.playingTimePromise.targetMinutes}' minuti non e stata rispettata.`
      });
      return;
    }
    if (player.playingTimePromise?.status === 'at_risk') {
      candidates.push({
        playerId: player.id, topic: 'promise', importance: 62,
        relatedPromiseId: player.playingTimePromise.id,
        problemSummary: `La promessa di ${player.playingTimePromise.targetMinutes}' minuti e a rischio (${player.playingTimePromise.currentMinutes}' finora).`
      });
      return;
    }
    if (role.key === 'frustratedTalent' || (role.tension >= 68 && ['surplus', 'contestedStarter', 'brokenPromise'].includes(role.key))) {
      candidates.push({
        playerId: player.id, topic: 'project_role', importance: 60,
        problemSummary: `Il ruolo percepito di ${player.name} e peggiorato: ${role.label.toLowerCase()}.`
      });
      return;
    }

    const heroNarrative = context.emotionalNarratives.narratives.find(n => (
      n.playerId === player.id && n.relatedMatchIds.includes(context.matchId) && (n.type === 'unexpected_hero' || n.type === 'redemption_arc')
    ));
    if (heroNarrative && (player.age <= 23 || role.key === 'twelfthMan' || role.key === 'benchPlayer')) {
      candidates.push({
        playerId: player.id, topic: 'match_reaction', importance: 55,
        relatedEventId: heroNarrative.id, relatedMatchId: context.matchId,
        problemSummary: `${player.name} si e messo in mostra: ${heroNarrative.title}.`
      });
      return;
    }

    const before = context.beforePlayers.find(p => p.id === player.id);
    if (before?.status === 'Infortunato' && player.status !== 'Infortunato' && context.playedPlayerIds.includes(player.id)) {
      candidates.push({
        playerId: player.id, topic: 'injury_return', importance: 40,
        problemSummary: `${player.name} e tornato disponibile dopo l'infortunio.`
      });
      return;
    }

    if (context.rivalryHeat >= 55 && context.playedPlayerIds.includes(player.id)) {
      candidates.push({
        playerId: player.id, topic: 'match_reaction', importance: 50, relatedMatchId: context.matchId,
        problemSummary: `Derby contro ${context.opponentName}.`
      });
      return;
    }

    if (player.morale <= 30) {
      candidates.push({
        playerId: player.id, topic: 'morale', importance: 45,
        problemSummary: `Il morale di ${player.name} e basso (${player.morale}).`
      });
      return;
    }

    if (player.age <= 21 && role.tension >= 40 && role.tension < 68) {
      candidates.push({
        playerId: player.id, topic: 'project_role', importance: 34,
        problemSummary: `${player.name} non ha ancora chiarezza sul proprio ruolo.`
      });
      return;
    }

    if (player.age >= 32 && ['twelfthMan', 'benchPlayer', 'decliningVeteran'].includes(role.key) && role.tension >= 35 && role.tension < 68) {
      candidates.push({
        playerId: player.id, topic: 'project_role', importance: 32,
        problemSummary: `${player.name} valuta il proprio ruolo ridotto in rosa.`
      });
    }
  });

  if (candidates.length === 0) return { state };

  candidates.sort((a, b) => b.importance - a.importance);
  const top = candidates[0];

  const openUrgentCount = state.conversations.filter(c => c.status === 'open' && c.importance >= URGENT_IMPORTANCE_THRESHOLD).length;
  if (top.importance >= URGENT_IMPORTANCE_THRESHOLD && openUrgentCount >= MAX_OPEN_URGENT_CONVERSATIONS) return { state };

  const player = context.afterPlayers.find(p => p.id === top.playerId);
  if (!player) return { state };
  const role = getPlayerProjectRole(player, { starters: context.starters, seasonStats: context.playerStats, clubHistory: context.clubHistory, round: context.round });

  const existingOpen = state.conversations.find(c => c.playerId === top.playerId && c.topic === top.topic && c.status === 'open');
  if (existingOpen) {
    const memoryEntry: PlayerConversationMemory = { id: `mem_${existingOpen.id}_${existingOpen.memory.length}`, text: top.problemSummary, createdAt: new Date().toISOString() };
    const updated: PlayerConversation = {
      ...existingOpen,
      memory: [memoryEntry, ...existingOpen.memory].slice(0, MAX_MEMORY_PER_CONVERSATION),
      importance: Math.max(existingOpen.importance, top.importance),
      updatedAt: new Date().toISOString()
    };
    const nextState = replaceConversation(state, updated);
    return { state: { ...nextState, lastImportantMessageRoundByPlayer: { ...nextState.lastImportantMessageRoundByPlayer, [top.playerId]: context.round } } };
  }

  const { state: stateWithPersona, persona } = ensurePersonaForPlayer(state, player, role);
  const conversationId = `conv_${top.playerId}_${Date.now()}`;
  const stat = statFor(top.playerId, context.playerStats);
  const requestCtx = buildRequestContext({ persona, player, role, stat, topic: top.topic, problemSummary: top.problemSummary });
  const dialogue = generateLocalPlayerDialogue(requestCtx);
  const now = new Date().toISOString();

  const message: PlayerConversationMessage = {
    id: `msg_${conversationId}_0`, sender: 'player', text: dialogue.playerMessage, createdAt: now,
    tone: dialogue.tone, intent: dialogue.intent, isImportant: top.importance >= 55
  };
  const memory: PlayerConversationMemory[] = dialogue.memoryCandidate
    ? [{ id: `mem_${conversationId}_0`, text: dialogue.memoryCandidate, createdAt: now }]
    : [];

  const conversation: PlayerConversation = {
    id: conversationId,
    playerId: top.playerId,
    createdAt: now,
    updatedAt: now,
    status: 'open',
    topic: top.topic,
    messages: [message],
    summary: buildSummary(memory, top.problemSummary),
    memory,
    unreadForManager: true,
    unreadForPlayer: false,
    lastPlayerInitiatedAt: now,
    relatedPromiseId: top.relatedPromiseId,
    relatedEventId: top.relatedEventId,
    relatedMatchId: top.relatedMatchId,
    importance: top.importance,
    sentiment: 50
  };

  const nextState: PlayerConversationState = {
    ...stateWithPersona,
    conversations: [conversation, ...stateWithPersona.conversations].slice(0, MAX_STORED_CONVERSATIONS),
    lastImportantMessageRoundByPlayer: { ...stateWithPersona.lastImportantMessageRoundByPlayer, [top.playerId]: context.round },
    updatedAt: now
  };

  return { state: nextState, created: conversation };
};

export { buildRequestContext };
