import {
  PlayerConversationIntent,
  PlayerConversationTone,
  PlayerConversationTopic,
  PlayerDialoguePersona,
  PlayerDialogueQuickReply,
  PlayerDialogueResponse
} from '../types';

// ─── Remote AI activation (server side, not included in this repo) ───
//
// This client never holds a provider API key. To enable "IA remota":
// 1. Deploy any small server/serverless function reachable at a same-origin
//    or CORS-enabled URL (e.g. POST /api/player-chat).
// 2. Set VITE_PLAYER_CHAT_ENDPOINT to that URL (public env var: it only
//    contains a routing URL, never a secret).
// 3. On the server, read the real provider key from a server-only env var
//    (e.g. ANTHROPIC_API_KEY) and never send it to the browser.
// 4. The server must accept the JSON body built by buildMinimalRequestPayload()
//    below and respond with JSON matching PlayerDialogueResponse (see the
//    "language: 'it', responseLength: 'short'" hint in the payload).
// Without step 1-2, the app silently keeps using the local deterministic
// provider — nothing breaks.

// ─── Deterministic helpers (no Math.random: same inputs must always produce the same line) ───

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const pick = <T,>(seed: number, options: T[]): T => options[seed % options.length];

export interface PlayerDialogueRequestContext {
  persona: PlayerDialoguePersona;
  playerName: string;
  playerRole: string;
  age: number;
  overall: number;
  form: number;
  morale: number;
  minutesPlayed: number;
  projectRoleLabel: string;
  projectRoleTrust: number;
  projectRoleTension: number;
  topic: PlayerConversationTopic;
  problemSummary: string;
  conversationSummary: string;
  recentMemory: string[];
  recentMessages: { sender: string; text: string }[];
  managerMessage?: string;
  quickReplyLabel?: string;
  conversationId: string;
  messageSeedIndex: number;
}

export interface PlayerDialogueProviderResult {
  response: PlayerDialogueResponse;
  usedFallback: boolean;
}

export type PlayerDialogueProviderMode = 'local' | 'remote';

// ─── Local deterministic phrase banks ───

const OPENERS: Record<string, string[]> = {
  veteran_professional: ['Mister, ', 'Con rispetto, ', 'Sono qui perché ', ''],
  ambitious_talent: ['Mister, devo essere sincero: ', 'Ci penso spesso: ', ''],
  selfish_star: ['Diciamocelo chiaramente: ', 'Non giro intorno alla cosa: ', ''],
  shy_youngster: ['Mister, scusi se la disturbo, ma ', 'Non vorrei sembrare presuntuoso, ma ', 'Mi chiedevo... '],
  club_flag: ['Per il bene della squadra, ', 'Da chi vive questa maglia ogni giorno: ', ''],
  frustrated_reserve: ['Mister, ', 'Devo dirglielo: ', ''],
  balanced: ['Mister, ', '']
};

const TOPIC_CORE: Record<PlayerConversationTopic, Record<string, (ctx: PlayerDialogueRequestContext) => string>> = {
  playing_time: {
    veteran_professional: ctx => `capisco la scelta sul minutaggio, ma preferisco sapere con chiarezza cosa si aspetta da me da qui in avanti.`,
    ambitious_talent: ctx => `sto giocando poco (${ctx.minutesPlayed}' finora) e alla mia età ho bisogno di continuità per crescere davvero.`,
    selfish_star: ctx => `non sono qui per guardare gli altri giocare. Voglio capire se questo è ancora il progetto che mi è stato presentato.`,
    shy_youngster: ctx => `so che devo crescere, però vorrei capire se sono ancora nei suoi piani.`,
    club_flag: ctx => `non è per me, è che la squadra ha bisogno di me in campo per tenere insieme il gruppo.`,
    frustrated_reserve: ctx => `sono ${ctx.minutesPlayed}' in stagione e comincio a chiedermi che spazio ci sia davvero per me.`,
    balanced: ctx => `vorrei un po' più di chiarezza sul mio minutaggio.`
  },
  promise: {
    veteran_professional: ctx => `mi era stato promesso un certo minutaggio: se la situazione è cambiata, ditemelo apertamente.`,
    ambitious_talent: ctx => `mi era stato detto che avrei avuto un piano concreto sui minuti. Vorrei sapere se è ancora valido.`,
    selfish_star: ctx => `gli accordi si rispettano. Se le cose stanno diversamente, voglio saperlo subito.`,
    shy_youngster: ctx => `mi era stato detto che avrei avuto qualche occasione in più. Va ancora bene così?`,
    club_flag: ctx => `una parola data allo spogliatoio conta, mister. Serve chiarezza per tutti, non solo per me.`,
    frustrated_reserve: ctx => `la promessa sui minuti non si sta rispettando e la cosa inizia a pesare.`,
    balanced: ctx => `volevo un chiarimento sulla promessa che mi era stata fatta.`
  },
  project_role: {
    veteran_professional: ctx => `il mio ruolo nel progetto è cambiato: ditemi con chiarezza cosa aspettarsi.`,
    ambitious_talent: ctx => `sento che il mio ruolo si è ridotto e vorrei un piano concreto per il mio futuro qui.`,
    selfish_star: ctx => `il ruolo che mi ritrovo non è quello di uno come me. Va chiarito.`,
    shy_youngster: ctx => `non capisco bene che ruolo ho in questo momento nel gruppo.`,
    club_flag: ctx => `il mio ruolo conta meno di quanto conti la squadra, ma mi piacerebbe capire come vede il mio futuro qui.`,
    frustrated_reserve: ctx => `il mio ruolo nella rosa si è complicato e non mi piace come sta andando.`,
    balanced: ctx => `vorrei capire meglio il mio ruolo attuale nel progetto.`
  },
  match_reaction: {
    veteran_professional: ctx => `dopo l'ultima partita volevo solo confrontarmi con lei con calma.`,
    ambitious_talent: ctx => `dopo la partita sento che potevo dare di più se avessi avuto più spazio.`,
    selfish_star: ctx => `ho fatto la differenza e mi aspetto che venga riconosciuto, non solo notato.`,
    shy_youngster: ctx => `dopo la partita volevo solo sapere se ho fatto la cosa giusta.`,
    club_flag: ctx => `quella partita pesa per tutta la piazza, non solo per il risultato.`,
    frustrated_reserve: ctx => `anche quando entro provo a dare qualcosa, vorrei solo che si notasse.`,
    balanced: ctx => `volevo dirle due parole sull'ultima partita.`
  },
  morale: {
    veteran_professional: ctx => `non sono nel mio momento migliore, ma continuerò a lavorare come sempre.`,
    ambitious_talent: ctx => `non è un bel periodo per me e mi chiedo se c'entra qualcosa il mio ruolo qui.`,
    selfish_star: ctx => `non sono abituato a sentirmi così ai margini, e non mi piace.`,
    shy_youngster: ctx => `non mi sento benissimo ultimamente, mister, forse ho solo bisogno di un segnale.`,
    club_flag: ctx => `non è un momento facile, ma resto qui per la squadra, sempre.`,
    frustrated_reserve: ctx => `il morale non è alto in questo periodo, faccio fatica a nasconderlo.`,
    balanced: ctx => `non mi sento al meglio in questo periodo.`
  },
  training: {
    veteran_professional: ctx => `sugli allenamenti va tutto bene, volevo solo confrontarmi con lei.`,
    ambitious_talent: ctx => `mi alleno al massimo per farmi trovare pronto quando arriverà la mia occasione.`,
    selfish_star: ctx => `in allenamento do sempre il massimo, il campo poi dovrebbe rispecchiarlo.`,
    shy_youngster: ctx => `provo a impegnarmi al massimo in allenamento, spero si veda.`,
    club_flag: ctx => `in settimana provo a trascinare il gruppo, è quello che mi viene naturale.`,
    frustrated_reserve: ctx => `mi alleno sempre al massimo, anche se in campo non si vede spesso.`,
    balanced: ctx => `volevo solo un confronto sul lavoro settimanale.`
  },
  injury_return: {
    veteran_professional: ctx => `sto bene fisicamente, decida lei i tempi con calma.`,
    ambitious_talent: ctx => `sono tornato disponibile e non vedo l'ora di riprendermi il mio spazio.`,
    selfish_star: ctx => `sono pronto, non serve gestirmi come un principiante.`,
    shy_youngster: ctx => `mi sento pronto per tornare, ma capirò se serve ancora un po' di prudenza.`,
    club_flag: ctx => `sono tornato e voglio subito dare una mano al gruppo.`,
    frustrated_reserve: ctx => `sono di nuovo disponibile, spero che questa volta lo spazio arrivi davvero.`,
    balanced: ctx => `volevo confermarle che sono di nuovo disponibile.`
  },
  transfer_interest: {
    veteran_professional: ctx => `so che si parla di mercato, ma preferisco affrontarlo con chiarezza reciproca.`,
    ambitious_talent: ctx => `si parla di un certo interesse su di me: mi piacerebbe capire come lo vede il club.`,
    selfish_star: ctx => `se c'è chi mi vuole altrove, meglio saperlo prima possibile.`,
    shy_youngster: ctx => `ho sentito delle voci di mercato e non so bene cosa pensare.`,
    club_flag: ctx => `anche se si parla di mercato, il mio legame con questa maglia resta lo stesso.`,
    frustrated_reserve: ctx => `con lo spazio che ho qui, capisco perché si parli di me altrove.`,
    balanced: ctx => `volevo un chiarimento sulle voci di mercato che mi riguardano.`
  },
  contract_expectation: {
    veteran_professional: ctx => `sul contratto preferisco parlarne con calma, senza fretta da nessuna delle due parti.`,
    ambitious_talent: ctx => `prima di parlare di rinnovo, vorrei capire che ruolo avrò davvero qui.`,
    selfish_star: ctx => `se si vuole rinnovare, le condizioni devono rispecchiare il mio valore.`,
    shy_youngster: ctx => `non so bene cosa aspettarmi sul contratto, mi fido di quello che deciderete voi.`,
    club_flag: ctx => `per me restare qui conta più di ogni clausola.`,
    frustrated_reserve: ctx => `prima di parlare di contratto, vorrei capire se avrò più spazio.`,
    balanced: ctx => `volevo solo un'idea di massima sul mio futuro contrattuale.`
  },
  team_conflict: {
    veteran_professional: ctx => `c'è un po' di tensione nel gruppo: meglio affrontarla subito e con chiarezza.`,
    ambitious_talent: ctx => `sento un po' di tensione con qualche compagno, preferisco che lei lo sappia.`,
    selfish_star: ctx => `se qualcuno ha un problema con me, che venga a dirmelo in faccia.`,
    shy_youngster: ctx => `non mi piace la tensione che c'è nello spogliatoio in questo periodo.`,
    club_flag: ctx => `il gruppo viene prima di tutto, per questo voglio segnalarle questa tensione.`,
    frustrated_reserve: ctx => `si respira un po' di tensione nello spogliatoio ultimamente.`,
    balanced: ctx => `volevo solo segnalarle un po' di tensione nel gruppo.`
  }
};

const CLOSERS: Record<string, string[]> = {
  calm: [' Mi fido del suo giudizio.', ' Aspetto un suo parere con calma.', ''],
  frustrated: [' Non può durare così ancora a lungo.', ' Non è più solo una sensazione, mister.', ''],
  hopeful: [' Spero solo in un segnale.', ' Anche poche parole mi basterebbero.', '']
};

const toneForStyleAndSeverity = (style: string, severity: number): PlayerConversationTone => {
  if (style === 'selfish_star') return severity >= 55 ? 'frustrated' : 'confident';
  if (style === 'shy_youngster') return 'reserved';
  if (style === 'veteran_professional') return severity >= 70 ? 'direct' : 'calm';
  if (style === 'frustrated_reserve') return severity >= 45 ? 'frustrated' : 'direct';
  if (style === 'club_flag') return severity >= 60 ? 'direct' : 'calm';
  if (style === 'ambitious_talent') return severity >= 55 ? 'frustrated' : 'direct';
  return severity >= 60 ? 'frustrated' : 'calm';
};

const intentForTopicAndSeverity = (topic: PlayerConversationTopic, severity: number): PlayerConversationIntent => {
  if (topic === 'match_reaction' && severity < 30) return 'gratitude';
  if (severity >= 55) return 'complaint';
  if (topic === 'training' || topic === 'injury_return') return 'clarification';
  return 'request';
};

const QUICK_REPLY_POOL: PlayerDialogueQuickReply[] = [
  { label: 'Hai ragione, avrai più spazio.', tone: 'supportive', action: 'reassure_playing_time' },
  { label: 'Devi continuare a lavorare.', tone: 'firm', action: 'ask_patience' },
  { label: 'La decisione dipende dalle prossime partite.', tone: 'cautious', action: 'defer_decision' },
  { label: 'Il gruppo viene prima di tutto.', tone: 'firm', action: 'invoke_team_first' },
  { label: 'Parliamone a fine stagione.', tone: 'cautious', action: 'defer_end_season' },
  { label: 'Non posso prometterti questo.', tone: 'firm', action: 'refuse' }
];

const QUICK_REPLIES_BY_TOPIC: Partial<Record<PlayerConversationTopic, string[]>> = {
  playing_time: ['reassure_playing_time', 'ask_patience', 'defer_decision', 'refuse'],
  promise: ['reassure_playing_time', 'defer_end_season', 'refuse'],
  project_role: ['reassure_playing_time', 'invoke_team_first', 'defer_decision'],
  match_reaction: ['invoke_team_first', 'ask_patience'],
  morale: ['ask_patience', 'defer_decision', 'invoke_team_first'],
  team_conflict: ['invoke_team_first', 'ask_patience'],
  transfer_interest: ['reassure_playing_time', 'defer_end_season', 'refuse'],
  contract_expectation: ['defer_end_season', 'refuse'],
  training: ['ask_patience', 'invoke_team_first'],
  injury_return: ['ask_patience', 'defer_decision']
};

const buildSuggestedReplies = (topic: PlayerConversationTopic, seed: number): PlayerDialogueQuickReply[] => {
  const actions = QUICK_REPLIES_BY_TOPIC[topic] ?? ['ask_patience', 'defer_decision'];
  const ordered = actions.map(action => QUICK_REPLY_POOL.find(reply => reply.action === action)).filter((r): r is PlayerDialogueQuickReply => Boolean(r));
  // Rotate deterministically per player/conversation so it doesn't always show the same order.
  const rotation = seed % ordered.length;
  return [...ordered.slice(rotation), ...ordered.slice(0, rotation)].slice(0, 4);
};

const severityFromContext = (ctx: PlayerDialogueRequestContext): number => {
  const base = Math.max(0, 60 - ctx.morale * 0.4) + Math.max(0, ctx.projectRoleTension - 40) * 0.6;
  return Math.max(0, Math.min(100, base));
};

export const generateLocalPlayerDialogue = (ctx: PlayerDialogueRequestContext): PlayerDialogueResponse => {
  const seed = hashString(`${ctx.persona.speechSeed}_${ctx.conversationId}_${ctx.messageSeedIndex}`);
  const style = ctx.persona.communicationStyle;
  const severity = severityFromContext(ctx);

  const opener = pick(seed, OPENERS[style] ?? OPENERS.balanced);
  const coreBuilder = (TOPIC_CORE[ctx.topic]?.[style]) ?? TOPIC_CORE[ctx.topic]?.balanced ?? (() => 'volevo solo scambiare due parole con lei.');
  const core = coreBuilder(ctx);
  const closerBank = severity >= 55 ? CLOSERS.frustrated : ctx.persona.patience >= 60 ? CLOSERS.calm : CLOSERS.hopeful;
  const closer = pick(seed >> 3, closerBank);

  const sentence = `${opener}${core}${closer}`;
  const trimmed = sentence.length > 260 ? `${sentence.slice(0, 257)}...` : sentence;

  const tone = toneForStyleAndSeverity(style, severity);
  const intent = intentForTopicAndSeverity(ctx.topic, severity);

  return {
    playerMessage: trimmed,
    tone,
    intent,
    memoryCandidate: `${ctx.playerName}: ${core}`.slice(0, 120),
    suggestedReplies: buildSuggestedReplies(ctx.topic, seed)
  };
};

// ─── Remote adapter: calls a configurable, key-less proxy endpoint only ───

const REMOTE_ENDPOINT = import.meta.env.VITE_PLAYER_CHAT_ENDPOINT as string | undefined;

export const isRemoteDialogueConfigured = (): boolean => Boolean(REMOTE_ENDPOINT);

const buildMinimalRequestPayload = (ctx: PlayerDialogueRequestContext) => ({
  persona: ctx.persona,
  player: {
    name: ctx.playerName,
    role: ctx.playerRole,
    age: ctx.age,
    overall: ctx.overall,
    form: ctx.form,
    morale: ctx.morale,
    minutesPlayed: ctx.minutesPlayed,
    projectRoleLabel: ctx.projectRoleLabel,
    projectRoleTrust: ctx.projectRoleTrust,
    projectRoleTension: ctx.projectRoleTension
  },
  topic: ctx.topic,
  problemSummary: ctx.problemSummary,
  conversationSummary: ctx.conversationSummary,
  recentMemory: ctx.recentMemory,
  recentMessages: ctx.recentMessages.slice(-6),
  managerMessage: ctx.managerMessage,
  quickReplyLabel: ctx.quickReplyLabel,
  language: 'it',
  responseLength: 'short'
});

const VALID_TONES: PlayerConversationTone[] = ['calm', 'direct', 'frustrated', 'grateful', 'confident', 'reserved'];
const VALID_INTENTS: PlayerConversationIntent[] = ['request', 'complaint', 'gratitude', 'clarification', 'response'];

const parseRemoteResponse = (data: unknown): PlayerDialogueResponse => {
  if (!data || typeof data !== 'object') throw new Error('Risposta IA non valida.');
  const raw = data as Record<string, unknown>;
  if (typeof raw.playerMessage !== 'string' || !raw.playerMessage.trim()) throw new Error('Risposta IA priva di testo.');
  const tone = VALID_TONES.includes(raw.tone as PlayerConversationTone) ? raw.tone as PlayerConversationTone : 'calm';
  const intent = VALID_INTENTS.includes(raw.intent as PlayerConversationIntent) ? raw.intent as PlayerConversationIntent : 'response';
  const suggestedRepliesRaw = Array.isArray(raw.suggestedReplies) ? raw.suggestedReplies as unknown[] : [];
  const suggestedReplies: PlayerDialogueQuickReply[] = suggestedRepliesRaw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(item => ({
      label: typeof item.label === 'string' ? item.label.slice(0, 60) : 'Va bene.',
      tone: (['supportive', 'firm', 'cautious', 'ambitious'] as const).includes(item.tone as never) ? item.tone as PlayerDialogueQuickReply['tone'] : 'cautious',
      action: 'nessuna azione automatica'
    }))
    .slice(0, 4);

  return {
    playerMessage: raw.playerMessage.slice(0, 320),
    tone,
    intent,
    memoryCandidate: typeof raw.memoryCandidate === 'string' ? raw.memoryCandidate.slice(0, 120) : undefined,
    suggestedReplies: suggestedReplies.length > 0 ? suggestedReplies : generateLocalPlayerDialogue(ctxFallbackStub()).suggestedReplies
  };
};

// Used only if a remote response arrives with zero usable quick replies, to avoid a dead-end UI.
const ctxFallbackStub = (): PlayerDialogueRequestContext => ({
  persona: {
    playerId: 'fallback', communicationStyle: 'balanced', formality: 50, directness: 50, emotionality: 50,
    confidence: 50, patience: 50, loyalty: 50, ambition: 50, ego: 50, leadership: 50, humor: 50,
    conflictTendency: 50, messageLength: 50, speechSeed: 0, preferredTopics: [], dislikedTopics: []
  },
  playerName: '', playerRole: '', age: 25, overall: 70, form: 6, morale: 60, minutesPlayed: 0,
  projectRoleLabel: '', projectRoleTrust: 50, projectRoleTension: 50, topic: 'training',
  problemSummary: '', conversationSummary: '', recentMemory: [], recentMessages: [],
  conversationId: 'fallback', messageSeedIndex: 0
});

export const requestPlayerDialogue = async (
  mode: PlayerDialogueProviderMode,
  context: PlayerDialogueRequestContext
): Promise<PlayerDialogueProviderResult> => {
  if (mode === 'remote' && REMOTE_ENDPOINT) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(REMOTE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildMinimalRequestPayload(context)),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Endpoint IA non disponibile (${res.status}).`);
      const data: unknown = await res.json();
      return { response: parseRemoteResponse(data), usedFallback: false };
    } catch {
      return { response: generateLocalPlayerDialogue(context), usedFallback: true };
    }
  }
  return { response: generateLocalPlayerDialogue(context), usedFallback: false };
};
