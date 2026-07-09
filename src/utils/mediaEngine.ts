import {
  CareerWorldState,
  Journalist,
  JournalistArchetype,
  MarketRumor,
  MarketRumorStatus,
  MarketRumorType,
  MediaArticle,
  MediaArticleCategory,
  MediaState,
  PressConference,
  PressConferenceOption,
  PressConferenceTone,
  PressConferenceTrigger,
} from '../types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// ─── Journalists (5 fixed, fictional personas) ───

const JOURNALIST_ARCHETYPES: JournalistArchetype[] = ['tactical', 'polemical', 'transfer_expert', 'romantic', 'local_reporter'];

const JOURNALIST_DEFS: Record<JournalistArchetype, { name: string; outlet: string; toneNote: string }> = {
  tactical: { name: 'Marco Ferretti', outlet: 'Tuttosport Analisi', toneNote: 'Guarda solo moduli, dati e scelte tattiche.' },
  polemical: { name: 'Sandra Colombo', outlet: 'Radio Polemica', toneNote: 'Cerca sempre lo scontro e la frase ad effetto.' },
  transfer_expert: { name: 'Davide Conti', outlet: 'Mercato 24', toneNote: 'Vive di mercato, cifre e indiscrezioni.' },
  romantic: { name: 'Elena Bruni', outlet: 'Il Romantico del Calcio', toneNote: 'Racconta emozioni, storie e legami con la maglia.' },
  local_reporter: { name: 'Giulio Santoro', outlet: 'Gazzetta Locale', toneNote: 'Parla per la gente della citta e per il vivaio.' },
};

const createJournalist = (archetype: JournalistArchetype): Journalist => ({
  id: `journalist_${archetype}`,
  archetype,
  name: JOURNALIST_DEFS[archetype].name,
  outlet: JOURNALIST_DEFS[archetype].outlet,
  toneNote: JOURNALIST_DEFS[archetype].toneNote,
  respect: 55,
});

export const createInitialMediaState = (): MediaState => ({
  journalists: JOURNALIST_ARCHETYPES.map(createJournalist),
  articles: [],
  pendingConference: null,
  lastConferenceRound: null,
  lastProcessedMatchIds: [],
  lastProcessedTransferIds: [],
  marketRumors: [],
  lastRumorRound: null,
  lastProcessedRumorSourceIds: [],
});

// ─── Normalize (migration-safe loader) ───

const normalizeJournalist = (raw: unknown, archetype: JournalistArchetype): Journalist => {
  const base = createJournalist(archetype);
  if (!raw || typeof raw !== 'object') return base;
  const item = raw as Record<string, unknown>;
  return {
    ...base,
    respect: typeof item.respect === 'number' ? Math.round(clamp(item.respect, 0, 100)) : base.respect,
  };
};

const VALID_TONES: PressConferenceTone[] = ['diplomatico', 'aggressivo', 'difensivo', 'onesto'];

const normalizeOption = (raw: unknown): PressConferenceOption | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.label !== 'string') return null;
  return {
    id: item.id,
    label: item.label,
    tone: VALID_TONES.includes(item.tone as PressConferenceTone) ? (item.tone as PressConferenceTone) : 'diplomatico',
    fanMoodEffect: typeof item.fanMoodEffect === 'number' ? item.fanMoodEffect : 0,
    boardConfidenceEffect: typeof item.boardConfidenceEffect === 'number' ? item.boardConfidenceEffect : 0,
    journalistRespectEffect: typeof item.journalistRespectEffect === 'number' ? item.journalistRespectEffect : 0,
    previewNote: typeof item.previewNote === 'string' ? item.previewNote : '',
  };
};

const VALID_TRIGGERS: PressConferenceTrigger[] = [
  'derby', 'strong_rivalry', 'painful_sale', 'broken_promise',
  'criticized_player', 'low_board_confidence', 'objective_at_risk', 'emotional_narrative', 'market_rumor',
];

const normalizePressConference = (raw: unknown): PressConference | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.question !== 'string') return null;
  const options = Array.isArray(item.options)
    ? item.options.map(normalizeOption).filter((o): o is PressConferenceOption => o !== null)
    : [];
  if (options.length === 0) return null;

  return {
    id: item.id,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    season: typeof item.season === 'string' ? item.season : '',
    round: typeof item.round === 'number' ? item.round : 0,
    journalistId: typeof item.journalistId === 'string' ? item.journalistId : '',
    trigger: VALID_TRIGGERS.includes(item.trigger as PressConferenceTrigger) ? (item.trigger as PressConferenceTrigger) : 'derby',
    question: item.question,
    context: typeof item.context === 'string' ? item.context : '',
    options,
    status: item.status === 'resolved' ? 'resolved' : 'pending',
    chosenOptionId: typeof item.chosenOptionId === 'string' ? item.chosenOptionId : undefined,
    resolvedAt: typeof item.resolvedAt === 'string' ? item.resolvedAt : undefined,
    relatedMatchId: typeof item.relatedMatchId === 'string' ? item.relatedMatchId : undefined,
    relatedTransferId: typeof item.relatedTransferId === 'string' ? item.relatedTransferId : undefined,
  };
};

const VALID_ARTICLE_CATEGORIES: MediaArticleCategory[] = [
  'derby', 'big_match', 'emotional_story', 'young_hero', 'heavy_defeat',
  'surprise_result', 'transfer_rival', 'transfer_idol_sale', 'transfer_big_buy', 'ownership_objective', 'rumor_update',
];

const normalizeArticle = (raw: unknown): MediaArticle | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.body !== 'string') return null;
  return {
    id: item.id,
    date: typeof item.date === 'string' ? item.date : new Date().toISOString(),
    season: typeof item.season === 'string' ? item.season : '',
    journalistId: typeof item.journalistId === 'string' ? item.journalistId : '',
    category: VALID_ARTICLE_CATEGORIES.includes(item.category as MediaArticleCategory) ? (item.category as MediaArticleCategory) : 'big_match',
    title: item.title,
    body: item.body,
    importance: Math.round(clamp(typeof item.importance === 'number' ? item.importance : 50, 0, 100)),
    relatedMatchId: typeof item.relatedMatchId === 'string' ? item.relatedMatchId : undefined,
    relatedTransferId: typeof item.relatedTransferId === 'string' ? item.relatedTransferId : undefined,
    relatedPlayerIds: Array.isArray(item.relatedPlayerIds)
      ? (item.relatedPlayerIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : undefined,
  };
};

const VALID_RUMOR_TYPES: MarketRumorType[] = [
  'player_unhappy', 'playing_time_doubt', 'promise_pressure', 'club_interest',
  'possible_sale', 'possible_purchase', 'rival_interest', 'fan_fear',
];

const VALID_RUMOR_STATUSES: MarketRumorStatus[] = ['active', 'confirmed', 'denied', 'expired'];

const normalizeMarketRumor = (raw: unknown): MarketRumor | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.summary !== 'string') return null;
  const type = VALID_RUMOR_TYPES.includes(item.type as MarketRumorType) ? (item.type as MarketRumorType) : 'player_unhappy';

  return {
    id: item.id,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    journalistId: typeof item.journalistId === 'string' ? item.journalistId : '',
    type,
    status: VALID_RUMOR_STATUSES.includes(item.status as MarketRumorStatus) ? (item.status as MarketRumorStatus) : 'active',
    confidence: Math.round(clamp(typeof item.confidence === 'number' ? item.confidence : 50, 0, 100)),
    importance: Math.round(clamp(typeof item.importance === 'number' ? item.importance : 50, 0, 100)),
    title: item.title,
    summary: item.summary,
    playerId: typeof item.playerId === 'string' ? item.playerId : undefined,
    playerName: typeof item.playerName === 'string' ? item.playerName : undefined,
    relatedClubId: typeof item.relatedClubId === 'string' ? item.relatedClubId : undefined,
    relatedClubName: typeof item.relatedClubName === 'string' ? item.relatedClubName : undefined,
    relatedPromiseId: typeof item.relatedPromiseId === 'string' ? item.relatedPromiseId : undefined,
    relatedTransferId: typeof item.relatedTransferId === 'string' ? item.relatedTransferId : undefined,
    sourceId: typeof item.sourceId === 'string' ? item.sourceId : `${typeof item.playerId === 'string' ? item.playerId : 'general'}_${type}_legacy`,
    reasons: Array.isArray(item.reasons) ? (item.reasons as unknown[]).filter((r): r is string => typeof r === 'string').slice(0, 4) : [],
    round: typeof item.round === 'number' ? item.round : 0,
    season: typeof item.season === 'string' ? item.season : '',
    expiresAfterRound: typeof item.expiresAfterRound === 'number' ? item.expiresAfterRound : undefined,
  };
};

// Old saves (or a corrupted list) could in theory carry more than 10 "active" rumors;
// force-expire anything beyond the cap instead of silently ignoring the limit.
const capActiveRumors = (rumors: MarketRumor[], maxActive: number): MarketRumor[] => {
  let activeSeen = 0;
  return rumors.map(rumor => {
    if (rumor.status !== 'active') return rumor;
    activeSeen += 1;
    return activeSeen > maxActive ? { ...rumor, status: 'expired' as const } : rumor;
  });
};

export const normalizeMediaState = (raw: unknown): MediaState => {
  const fallback = createInitialMediaState();
  if (!raw || typeof raw !== 'object') return fallback;
  const item = raw as Record<string, unknown>;

  const byArchetype = new Map<string, unknown>();
  if (Array.isArray(item.journalists)) {
    item.journalists.forEach(entry => {
      if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).archetype === 'string') {
        byArchetype.set((entry as Record<string, unknown>).archetype as string, entry);
      }
    });
  }
  const journalists = JOURNALIST_ARCHETYPES.map(archetype => normalizeJournalist(byArchetype.get(archetype), archetype));

  const articles = Array.isArray(item.articles)
    ? item.articles.map(normalizeArticle).filter((a): a is MediaArticle => a !== null).slice(0, 20)
    : [];

  const pendingConference = normalizePressConference(item.pendingConference);

  const rawRumors = Array.isArray(item.marketRumors)
    ? item.marketRumors.map(normalizeMarketRumor).filter((r): r is MarketRumor => r !== null).slice(0, 30)
    : [];
  const marketRumors = capActiveRumors(rawRumors, 10);

  return {
    journalists,
    articles,
    pendingConference: pendingConference && pendingConference.status === 'pending' ? pendingConference : null,
    lastConferenceRound: typeof item.lastConferenceRound === 'number' ? item.lastConferenceRound : null,
    lastProcessedMatchIds: Array.isArray(item.lastProcessedMatchIds)
      ? (item.lastProcessedMatchIds as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [],
    lastProcessedTransferIds: Array.isArray(item.lastProcessedTransferIds)
      ? (item.lastProcessedTransferIds as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [],
    marketRumors,
    lastRumorRound: typeof item.lastRumorRound === 'number' ? item.lastRumorRound : null,
    lastProcessedRumorSourceIds: Array.isArray(item.lastProcessedRumorSourceIds)
      ? (item.lastProcessedRumorSourceIds as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 60)
      : [],
  };
};

// ─── Press conference option templates (fixed, deterministic, small effects) ───

const opt = (
  id: string,
  label: string,
  tone: PressConferenceTone,
  fanMoodEffect: number,
  boardConfidenceEffect: number,
  journalistRespectEffect: number,
  previewNote: string
): PressConferenceOption => ({ id, label, tone, fanMoodEffect, boardConfidenceEffect, journalistRespectEffect, previewNote });

const buildOptionsForTrigger = (trigger: PressConferenceTrigger): PressConferenceOption[] => {
  switch (trigger) {
    case 'derby':
    case 'strong_rivalry':
      return [
        opt('diplomatico', 'Rispetto il derby ma pensiamo solo a noi stessi', 'diplomatico', 1, 1, 1, 'Tifosi tranquilli, nessun rischio.'),
        opt('aggressivo', 'Vogliamo vincerlo per la nostra gente', 'aggressivo', 4, -1, -1, 'Curva entusiasta, ma piu pressione se il risultato non arriva.'),
        opt('difensivo', 'Non aggiungo altra pressione alla squadra', 'difensivo', -1, 2, 0, 'La societa apprezza la prudenza, i tifosi restano piu freddi.'),
        opt('onesto', 'Ammetto che sara una gara speciale e delicata', 'onesto', 2, 0, 2, 'Il giornalista apprezza la sincerita.'),
      ];
    case 'painful_sale':
      return [
        opt('diplomatico', 'E stata una scelta di mercato ponderata', 'diplomatico', 0, 2, 1, 'Nessuno scossone, la societa e coperta.'),
        opt('aggressivo', 'Chi non condivide il progetto puo anche partire', 'aggressivo', -3, 1, -2, 'Curva scontenta, il giornalista non apprezza la durezza.'),
        opt('difensivo', 'Non commento le singole trattative', 'difensivo', -1, 1, 0, 'Risposta neutra, poco materiale per tutti.'),
        opt('onesto', 'E stata una cessione dolorosa ma necessaria', 'onesto', 1, -1, 2, 'I tifosi apprezzano la sincerita, la proprieta un po meno.'),
      ];
    case 'broken_promise':
      return [
        opt('diplomatico', 'Le scelte di formazione restano tecniche', 'diplomatico', -1, 1, 0, 'Risposta prudente, nessuno resta soddisfatto del tutto.'),
        opt('aggressivo', 'Le promesse si adattano a ció che serve alla squadra', 'aggressivo', -2, 0, -2, 'Il giornalista la legge come una scusa.'),
        opt('difensivo', 'Parlero col giocatore in privato', 'difensivo', 0, 1, 1, 'Risposta misurata, chiude l\'argomento.'),
        opt('onesto', 'Ammetto di non aver mantenuto quanto detto', 'onesto', 1, -2, 3, 'Grande rispetto dal giornalista, la proprieta storce il naso.'),
      ];
    case 'criticized_player':
      return [
        opt('diplomatico', 'Ha tutta la mia fiducia', 'diplomatico', 1, 0, 0, 'Squadra compatta, i tifosi restano scettici.'),
        opt('aggressivo', 'Chi critica non vede gli allenamenti', 'aggressivo', -2, -1, -2, 'Il giornalista si sente attaccato.'),
        opt('difensivo', 'Valuto tutti allo stesso modo', 'difensivo', 0, 1, 0, 'Risposta piatta, nessun rischio.'),
        opt('onesto', 'Deve migliorare, lo sa anche lui', 'onesto', 2, 0, 2, 'Tifosi e stampa apprezzano la chiarezza.'),
      ];
    case 'low_board_confidence':
      return [
        opt('diplomatico', 'Il rapporto con la proprieta e sereno', 'diplomatico', 0, 2, 0, 'Risposta di facciata, la societa e sollevata.'),
        opt('aggressivo', 'Chiedo piu fiducia, i risultati arriveranno', 'aggressivo', 2, -2, -1, 'Il giornalista fiuta tensione interna.'),
        opt('difensivo', 'Lavoro e non guardo le voci', 'difensivo', 0, 1, 0, 'Nessuna scintilla, tutto passa in secondo piano.'),
        opt('onesto', 'So che il momento e delicato per tutti', 'onesto', 1, -1, 2, 'Sincerita apprezzata, ma la proprieta nota la pressione ammessa.'),
      ];
    case 'objective_at_risk':
      return [
        opt('diplomatico', 'L\'obiettivo resta alla nostra portata', 'diplomatico', 1, 1, 0, 'Messaggio rassicurante per tutti.'),
        opt('aggressivo', 'Se serve, cambieremo approccio subito', 'aggressivo', 1, -1, -1, 'Il giornalista la vede come pressione autoimposta.'),
        opt('difensivo', 'Pensiamo una partita alla volta', 'difensivo', -1, 1, 0, 'Risposta di routine, poco materiale.'),
        opt('onesto', 'Sara dura, non lo nascondo', 'onesto', 0, -1, 2, 'Sincerita che paga in rispetto ma non in fiducia societaria.'),
      ];
    case 'emotional_narrative':
      return [
        opt('diplomatico', 'E una bella storia, ma pensiamo al campionato', 'diplomatico', 1, 1, 0, 'Risposta equilibrata.'),
        opt('aggressivo', 'Vogliamo che diventi una favola vera', 'aggressivo', 3, 0, -1, 'Entusiasmo alto, il giornalista percepisce enfasi eccessiva.'),
        opt('difensivo', 'Non voglio caricare troppo la squadra', 'difensivo', 0, 1, 1, 'Prudenza premiata dal giornalista.'),
        opt('onesto', 'E una storia che ci ha sorpreso quanto voi', 'onesto', 2, 0, 2, 'Sincerita che convince tifosi e stampa.'),
      ];
    case 'market_rumor':
    default:
      return [
        opt('diplomatico', 'Sono solo voci, non commento il mercato', 'diplomatico', 0, 1, 1, 'Risposta prudente, nessun rischio.'),
        opt('aggressivo', 'Chi mette in giro certe voci non conosce lo spogliatoio', 'aggressivo', -1, 0, -2, 'Il giornalista si sente sfidato.'),
        opt('difensivo', 'Non alimento le voci di mercato', 'difensivo', 0, 1, 0, 'Risposta neutra, poco materiale per tutti.'),
        opt('onesto', 'Capisco la curiosita, ma ora pensiamo al campo', 'onesto', 1, 0, 2, 'Sincerita apprezzata dal giornalista.'),
      ];
  }
};

// ─── Press conference gating (shared by match and transfer flows) ───

interface PressConferenceCandidate {
  trigger: PressConferenceTrigger;
  journalistArchetype: JournalistArchetype;
  journalistId?: string; // optional override, e.g. keep the same journalist who raised a rumor
  question: string;
  context: string;
}

interface PressConferenceGate {
  round: number;
  season: string;
  candidates: PressConferenceCandidate[]; // priority order, first wins
  relatedMatchId?: string;
  relatedTransferId?: string;
}

export const createPressConferenceIfNeeded = (state: CareerWorldState, gate: PressConferenceGate): CareerWorldState => {
  if (state.mediaState.pendingConference) return state; // max una conferenza pending
  if (gate.candidates.length === 0) return state; // mai dopo un evento normale
  const lastRound = state.mediaState.lastConferenceRound;
  if (lastRound !== null && gate.round - lastRound < 2) return state; // max una ogni 2 giornate

  const candidate = gate.candidates[0];
  const journalist = (candidate.journalistId ? state.mediaState.journalists.find(j => j.id === candidate.journalistId) : undefined)
    ?? state.mediaState.journalists.find(j => j.archetype === candidate.journalistArchetype)
    ?? state.mediaState.journalists[0];

  const conference: PressConference = {
    id: `presser_${gate.round}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    season: gate.season,
    round: gate.round,
    journalistId: journalist.id,
    trigger: candidate.trigger,
    question: candidate.question,
    context: candidate.context,
    options: buildOptionsForTrigger(candidate.trigger),
    status: 'pending',
    relatedMatchId: gate.relatedMatchId,
    relatedTransferId: gate.relatedTransferId,
  };

  return {
    ...state,
    mediaState: {
      ...state.mediaState,
      pendingConference: conference,
      lastConferenceRound: gate.round,
    },
  };
};

export const resolvePressConference = (state: CareerWorldState, optionId: string): CareerWorldState => {
  const conference = state.mediaState.pendingConference;
  if (!conference || conference.status !== 'pending') return state;
  const option = conference.options.find(o => o.id === optionId);
  if (!option) return state;

  const journalists = state.mediaState.journalists.map(journalist => (
    journalist.id === conference.journalistId
      ? { ...journalist, respect: Math.round(clamp(journalist.respect + option.journalistRespectEffect, 0, 100)) }
      : journalist
  ));

  return {
    ...state,
    fanState: {
      ...state.fanState,
      overallMood: Math.round(clamp(state.fanState.overallMood + option.fanMoodEffect, 0, 100)),
    },
    ownershipState: {
      ...state.ownershipState,
      boardConfidence: Math.round(clamp(state.ownershipState.boardConfidence + option.boardConfidenceEffect, 0, 100)),
    },
    mediaState: {
      ...state.mediaState,
      journalists,
      pendingConference: null,
    },
  };
};

// ─── Post-match media processing ───

export interface MediaMatchContext {
  matchId: string;
  season: string;
  round: number;
  teamName: string;
  opponentName: string;
  scoreUser: number;
  scoreOpponent: number;
  isDerby: boolean;
  isStrongRivalry: boolean; // rivalry status forte/nemico storico
  matchImportance: number; // 0-100
  hasMajorEmotionalStory: boolean;
  decisiveYoungsterName?: string;
  isHeavyDefeat: boolean;
  isSurpriseResult: boolean;
  criticizedPlayerName?: string;
  brokenPromisePlayerName?: string;
  boardConfidence: number;
  objectiveAtRiskTitle?: string; // only set the round an objective's status just turned "a_rischio"
  objectiveCompletedTitle?: string; // only set the round an objective's status just turned "completato"
}

export interface MediaNewsDraft {
  title: string;
  content: string;
  category: 'board' | 'training' | 'market' | 'league';
}

export interface MediaProcessResult {
  state: CareerWorldState;
  news: MediaNewsDraft[];
}

interface ArticleDraft {
  category: MediaArticleCategory;
  journalistArchetype: JournalistArchetype;
  title: string;
  body: string;
  importance: number;
}

const buildMatchArticle = (context: MediaMatchContext): ArticleDraft | null => {
  const scoreLabel = `${context.teamName} ${context.scoreUser}-${context.scoreOpponent} ${context.opponentName}`;

  if (context.isHeavyDefeat) {
    return {
      category: 'heavy_defeat',
      journalistArchetype: 'polemical',
      title: `Notte fonda per il ${context.teamName}`,
      body: `${scoreLabel}: una sconfitta pesante che riapre discussioni tattiche e di spogliatoio.`,
      importance: 78,
    };
  }
  if (context.isDerby || context.isStrongRivalry) {
    return {
      category: 'derby',
      journalistArchetype: 'tactical',
      title: `${context.isDerby ? 'Derby' : 'Big match di rivalita'}: ${scoreLabel}`,
      body: `Una sfida sentita dalla piazza: la rivalita con il ${context.opponentName} resta accesa anche dopo il fischio finale.`,
      importance: 80,
    };
  }
  if (context.objectiveCompletedTitle) {
    return {
      category: 'ownership_objective',
      journalistArchetype: 'polemical',
      title: `Obiettivo raggiunto: ${context.objectiveCompletedTitle}`,
      body: `La proprieta vede completato l'obiettivo "${context.objectiveCompletedTitle}": la stagione cambia volto.`,
      importance: 80,
    };
  }
  if (context.objectiveAtRiskTitle) {
    return {
      category: 'ownership_objective',
      journalistArchetype: 'polemical',
      title: `Obiettivo a rischio: ${context.objectiveAtRiskTitle}`,
      body: `Dopo ${scoreLabel}, l'obiettivo "${context.objectiveAtRiskTitle}" della proprieta comincia a vacillare.`,
      importance: 76,
    };
  }
  if (context.hasMajorEmotionalStory) {
    return {
      category: 'emotional_story',
      journalistArchetype: 'romantic',
      title: 'Una storia che scalda lo spogliatoio',
      body: `${scoreLabel}: al di la del risultato, la gara lascia una narrazione che i tifosi non dimenticheranno presto.`,
      importance: 72,
    };
  }
  if (context.decisiveYoungsterName) {
    return {
      category: 'young_hero',
      journalistArchetype: 'local_reporter',
      title: `Il futuro si chiama ${context.decisiveYoungsterName}`,
      body: `${context.decisiveYoungsterName} decide ${scoreLabel}: il vivaio sorride e la citta se ne accorge.`,
      importance: 70,
    };
  }
  if (context.isSurpriseResult) {
    return {
      category: 'surprise_result',
      journalistArchetype: 'romantic',
      title: 'Sorpresa a sorpresa',
      body: `${scoreLabel}: un risultato che in pochi si aspettavano prima del fischio d'inizio.`,
      importance: 74,
    };
  }
  if (context.matchImportance >= 70) {
    return {
      category: 'big_match',
      journalistArchetype: 'tactical',
      title: `Big match, il ${context.teamName} regge il confronto`,
      body: `${scoreLabel}: una gara di alta classifica letta con attenzione dagli addetti ai lavori.`,
      importance: 66,
    };
  }
  return null;
};

const pushArticle = (mediaState: MediaState, draft: ArticleDraft, meta: { id: string; season: string; relatedMatchId?: string; relatedTransferId?: string }): { mediaState: MediaState; news: MediaNewsDraft[] } => {
  const journalist = mediaState.journalists.find(j => j.archetype === draft.journalistArchetype) ?? mediaState.journalists[0];
  const article: MediaArticle = {
    id: meta.id,
    date: new Date().toISOString(),
    season: meta.season,
    journalistId: journalist.id,
    category: draft.category,
    title: draft.title,
    body: draft.body,
    importance: draft.importance,
    relatedMatchId: meta.relatedMatchId,
    relatedTransferId: meta.relatedTransferId,
  };

  const news: MediaNewsDraft[] = article.importance >= 75
    ? [{ title: article.title, content: article.body, category: meta.relatedTransferId ? 'market' : 'league' }]
    : [];

  return {
    mediaState: { ...mediaState, articles: [article, ...mediaState.articles].slice(0, 20) },
    news,
  };
};

export const processMediaAfterMatch = (state: CareerWorldState, context: MediaMatchContext): MediaProcessResult => {
  if (state.mediaState.lastProcessedMatchIds.includes(context.matchId)) {
    return { state, news: [] };
  }

  const draft = buildMatchArticle(context);
  let mediaState = state.mediaState;
  let news: MediaNewsDraft[] = [];

  if (draft) {
    const pushed = pushArticle(mediaState, draft, { id: `article_match_${context.matchId}`, season: context.season, relatedMatchId: context.matchId });
    mediaState = pushed.mediaState;
    news = pushed.news;
  }

  mediaState = { ...mediaState, lastProcessedMatchIds: [context.matchId, ...mediaState.lastProcessedMatchIds].slice(0, 50) };

  let nextState: CareerWorldState = { ...state, mediaState };

  const candidates: PressConferenceCandidate[] = [];
  if (context.isDerby) {
    candidates.push({
      trigger: 'derby',
      journalistArchetype: 'tactical',
      question: `Che partita ti aspetti nel derby con il ${context.opponentName}?`,
      context: 'Derby caldissimo, la citta si ferma per questa sfida.',
    });
  }
  if (!context.isDerby && context.isStrongRivalry) {
    candidates.push({
      trigger: 'strong_rivalry',
      journalistArchetype: 'tactical',
      question: `Quanto pesa emotivamente sfidare ancora il ${context.opponentName}?`,
      context: 'Una rivalita forte che accompagna la squadra da tempo.',
    });
  }
  if (context.criticizedPlayerName) {
    candidates.push({
      trigger: 'criticized_player',
      journalistArchetype: 'polemical',
      question: `Perche continua a schierare ${context.criticizedPlayerName} nonostante le critiche?`,
      context: `${context.criticizedPlayerName} e finito nel mirino della piazza nelle ultime settimane.`,
    });
  }
  if (context.brokenPromisePlayerName) {
    candidates.push({
      trigger: 'broken_promise',
      journalistArchetype: 'polemical',
      question: `${context.brokenPromisePlayerName} si aspettava altro da questo progetto: cosa risponde?`,
      context: 'Una promessa fatta allo spogliatoio non e stata rispettata.',
    });
  }
  if (context.boardConfidence <= 40) {
    candidates.push({
      trigger: 'low_board_confidence',
      journalistArchetype: 'polemical',
      question: 'Sente ancora la fiducia della proprieta?',
      context: 'Voci di corridoio parlano di una proprieta sempre meno convinta.',
    });
  }
  if (context.objectiveAtRiskTitle) {
    candidates.push({
      trigger: 'objective_at_risk',
      journalistArchetype: 'tactical',
      question: `L'obiettivo "${context.objectiveAtRiskTitle}" e ancora alla portata?`,
      context: 'La proprieta aveva fissato un obiettivo chiaro a inizio stagione.',
    });
  }
  if (context.hasMajorEmotionalStory) {
    candidates.push({
      trigger: 'emotional_narrative',
      journalistArchetype: 'romantic',
      question: 'Quanto ha inciso la componente emotiva su questa partita?',
      context: 'Una storia che ha coinvolto spogliatoio e tifosi.',
    });
  }

  nextState = createPressConferenceIfNeeded(nextState, {
    round: context.round,
    season: context.season,
    candidates,
    relatedMatchId: context.matchId,
  });

  return { state: nextState, news };
};

// ─── Post-transfer media processing ───

export interface MediaTransferContext {
  transferId: string;
  season: string;
  round: number;
  playerName: string;
  counterpartClub: string;
  fee: number;
  direction: 'buy' | 'sell';
  isRivalCounterpart: boolean;
  isPainfulSale: boolean; // beloved player or academy/vivaio sale
  isBigSignature: boolean;
  boardConfidence: number;
}

const formatFeeShort = (fee: number) => `${Math.round(fee / 1000000)} milioni`;

const buildTransferArticle = (context: MediaTransferContext): ArticleDraft | null => {
  if (context.direction === 'sell' && context.isRivalCounterpart) {
    return {
      category: 'transfer_rival',
      journalistArchetype: 'transfer_expert',
      title: `Sgarbo di mercato: ${context.playerName} alla rivale ${context.counterpartClub}`,
      body: `${context.playerName} lascia il club per ${formatFeeShort(context.fee)} e va a rinforzare proprio il ${context.counterpartClub}.`,
      importance: 82,
    };
  }
  if (context.direction === 'sell' && context.isPainfulSale) {
    return {
      category: 'transfer_idol_sale',
      journalistArchetype: 'local_reporter',
      title: `Il vivaio piange: ${context.playerName} lascia il club`,
      body: `${context.playerName} parte per ${formatFeeShort(context.fee)}: un addio che la piazza sentira per tutta la stagione.`,
      importance: 80,
    };
  }
  if (context.direction === 'buy' && context.isBigSignature) {
    return {
      category: 'transfer_big_buy',
      journalistArchetype: 'transfer_expert',
      title: `Colpo importante: arriva ${context.playerName}`,
      body: `Operazione da ${formatFeeShort(context.fee)}: il mercato apre una nuova fase del progetto tecnico.`,
      importance: 72,
    };
  }
  return null;
};

export const processMediaAfterTransfer = (state: CareerWorldState, context: MediaTransferContext): MediaProcessResult => {
  if (state.mediaState.lastProcessedTransferIds.includes(context.transferId)) {
    return { state, news: [] };
  }

  const draft = buildTransferArticle(context);
  let mediaState = state.mediaState;
  let news: MediaNewsDraft[] = [];

  if (draft) {
    const pushed = pushArticle(mediaState, draft, { id: `article_transfer_${context.transferId}`, season: context.season, relatedTransferId: context.transferId });
    mediaState = pushed.mediaState;
    news = pushed.news;
  }

  mediaState = { ...mediaState, lastProcessedTransferIds: [context.transferId, ...mediaState.lastProcessedTransferIds].slice(0, 50) };

  let nextState: CareerWorldState = { ...state, mediaState };

  const candidates: PressConferenceCandidate[] = [];
  if (context.direction === 'sell' && context.isPainfulSale) {
    candidates.push({
      trigger: 'painful_sale',
      journalistArchetype: 'transfer_expert',
      question: `Come risponde ai tifosi delusi per la cessione di ${context.playerName}?`,
      context: 'Una cessione dolorosa che ha scosso l\'ambiente.',
    });
  }
  if (context.boardConfidence <= 40) {
    candidates.push({
      trigger: 'low_board_confidence',
      journalistArchetype: 'polemical',
      question: 'Questa operazione di mercato basta a rassicurare la proprieta?',
      context: 'La fiducia della proprieta era gia in bilico prima di questa operazione.',
    });
  }

  nextState = createPressConferenceIfNeeded(nextState, {
    round: context.round,
    season: context.season,
    candidates,
    relatedTransferId: context.transferId,
  });

  return { state: nextState, news };
};

// ─── Market rumors (Fase 6B) ───

export interface MarketRumorPlayerSignal {
  playerId: string;
  playerName: string;
  // promesse (utility esistente playerPromises.ts)
  promiseId?: string;
  promiseJustAtRisk?: boolean;
  promiseJustBroken?: boolean;
  promiseJustCompleted?: boolean;
  // morale / ruolo percepito (playerProjectRole.ts)
  moraleVeryLow?: boolean;
  moraleLow?: boolean;
  isFrustratedTalent?: boolean;
  isOutOfProject?: boolean;
  longMinutesDrought?: boolean;
  coachRelationVeryLow?: boolean;
  // tifosi (Fase 4B)
  isBelovedOrIdol?: boolean;
  isAcademyOrLocal?: boolean;
  // mercato (Market.tsx / marketIntelligence.ts, dati reali)
  isListedForSale?: boolean;
  financialFragile?: boolean;
  hasIncomingOffer?: boolean;
  incomingOfferFromClub?: string;
  incomingOfferFromClubId?: string;
  incomingOfferIsRival?: boolean;
  scoutLevel?: number;
  scoutingJustAdvanced?: boolean;
  tacticalFitHigh?: boolean;
  sourceClubName?: string;
  sourceClubId?: string;
}

interface RumorCandidateDraft {
  type: MarketRumorType;
  confidence: number;
  importance: number;
  title: string;
  summary: string;
  reasons: string[];
  journalistArchetype: JournalistArchetype;
  playerId: string;
  playerName: string;
  relatedClubId?: string;
  relatedClubName?: string;
  relatedPromiseId?: string;
  expiresAfterRound?: number;
}

const buildRumorCandidatesForPlayerSignal = (signal: MarketRumorPlayerSignal): RumorCandidateDraft[] => {
  const drafts: RumorCandidateDraft[] = [];

  // ─ Giocatore scontento ─
  if (signal.promiseJustBroken) {
    drafts.push({
      type: 'promise_pressure',
      confidence: 82,
      importance: 74,
      title: `${signal.playerName} valuta il proprio futuro`,
      summary: `La promessa di minutaggio non rispettata pesa sul rapporto tra ${signal.playerName} e il progetto tecnico.`,
      reasons: ['Promessa di minutaggio non mantenuta'],
      journalistArchetype: 'polemical',
      playerId: signal.playerId,
      playerName: signal.playerName,
      relatedPromiseId: signal.promiseId,
    });
  } else if (signal.promiseJustAtRisk) {
    drafts.push({
      type: 'playing_time_doubt',
      confidence: 62,
      importance: 58,
      title: `${signal.playerName} chiede maggiore chiarezza sul proprio futuro`,
      summary: `Il minutaggio promesso e in ritardo sulla tabella di marcia: cresce l'attenzione attorno a ${signal.playerName}.`,
      reasons: ['Promessa di minutaggio a rischio'],
      journalistArchetype: 'polemical',
      playerId: signal.playerId,
      playerName: signal.playerName,
      relatedPromiseId: signal.promiseId,
    });
  } else if (signal.isFrustratedTalent) {
    drafts.push({
      type: 'player_unhappy',
      confidence: 60,
      importance: 56,
      title: `${signal.playerName}, un talento sempre piu frustrato`,
      summary: `Poco spazio rispetto alle attese: l'ambiente comincia a interrogarsi sul futuro di ${signal.playerName}.`,
      reasons: ['Ruolo percepito come talento frustrato'],
      journalistArchetype: 'polemical',
      playerId: signal.playerId,
      playerName: signal.playerName,
    });
  } else if (signal.longMinutesDrought) {
    drafts.push({
      type: 'playing_time_doubt',
      confidence: 50,
      importance: 50,
      title: `${signal.playerName} in cerca di spazio`,
      summary: `Una lunga assenza dal campo alimenta i dubbi sul futuro di ${signal.playerName}.`,
      reasons: ['Lunga assenza di minuti reali'],
      journalistArchetype: 'polemical',
      playerId: signal.playerId,
      playerName: signal.playerName,
    });
  } else if (signal.isOutOfProject || signal.coachRelationVeryLow || signal.moraleVeryLow) {
    drafts.push({
      type: 'player_unhappy',
      confidence: signal.moraleVeryLow ? 46 : 52,
      importance: 50,
      title: `Aria pesante attorno a ${signal.playerName}`,
      summary: `${signal.playerName} sembra sempre piu ai margini del progetto tecnico.`,
      reasons: [
        signal.isOutOfProject ? 'Percepito fuori dal progetto tecnico' : '',
        signal.coachRelationVeryLow ? 'Rapporto con il mister ai minimi' : '',
        signal.moraleVeryLow ? 'Morale molto basso' : '',
      ].filter((reason): reason is string => Boolean(reason)),
      journalistArchetype: 'polemical',
      playerId: signal.playerId,
      playerName: signal.playerName,
    });
  } else if (signal.moraleLow) {
    drafts.push({
      type: 'player_unhappy',
      confidence: 40,
      importance: 42,
      title: `Qualche imbarazzo attorno a ${signal.playerName}`,
      summary: `Segnali non allarmanti, ma il morale di ${signal.playerName} non e ai livelli abituali.`,
      reasons: ['Morale leggermente sotto la media'],
      journalistArchetype: 'polemical',
      playerId: signal.playerId,
      playerName: signal.playerName,
    });
  }

  // ─ Giocatore amato o giovane a rischio ─
  const idolRisk = (signal.isBelovedOrIdol || signal.isAcademyOrLocal)
    && (signal.isListedForSale || signal.hasIncomingOffer || signal.financialFragile);
  if (idolRisk) {
    drafts.push({
      type: 'fan_fear',
      confidence: 50,
      importance: 68,
      title: `La curva teme per ${signal.playerName}`,
      summary: `Tra i tifosi cresce la preoccupazione per una possibile cessione di ${signal.playerName}.`,
      reasons: [
        signal.isAcademyOrLocal ? 'Giovane del vivaio' : 'Giocatore molto amato dai tifosi',
        signal.isListedForSale ? 'Inserito nella lista cedibili' : '',
        signal.hasIncomingOffer ? 'Un club ha gia mostrato interesse concreto' : '',
        signal.financialFragile ? 'Situazione economica del club fragile' : '',
      ].filter((reason): reason is string => Boolean(reason)),
      journalistArchetype: 'romantic',
      playerId: signal.playerId,
      playerName: signal.playerName,
    });
  }

  // ─ Interesse di altri club / possibile cessione ─
  if (signal.hasIncomingOffer) {
    if (signal.incomingOfferIsRival) {
      drafts.push({
        type: 'rival_interest',
        confidence: 80,
        importance: 70,
        title: `Un rivale osserva ${signal.playerName}`,
        summary: `${signal.incomingOfferFromClub ?? 'Una rivale'} ha messo gli occhi su ${signal.playerName}: la piazza non la prende bene.`,
        reasons: ['Offerta reale ricevuta da un club rivale'],
        journalistArchetype: 'local_reporter',
        playerId: signal.playerId,
        playerName: signal.playerName,
        relatedClubId: signal.incomingOfferFromClubId,
        relatedClubName: signal.incomingOfferFromClub,
      });
    } else {
      drafts.push({
        type: 'club_interest',
        confidence: 74,
        importance: 62,
        title: `${signal.incomingOfferFromClub ?? 'Un club'} su ${signal.playerName}`,
        summary: `Un'offerta concreta accende le voci di mercato attorno a ${signal.playerName}.`,
        reasons: ['Offerta reale ricevuta da un altro club'],
        journalistArchetype: 'transfer_expert',
        playerId: signal.playerId,
        playerName: signal.playerName,
        relatedClubId: signal.incomingOfferFromClubId,
        relatedClubName: signal.incomingOfferFromClub,
      });
    }
    drafts.push({
      type: 'possible_sale',
      confidence: 78,
      importance: (signal.isBelovedOrIdol || signal.isAcademyOrLocal) ? 74 : 60,
      title: `L'esperto di mercato: possibile cessione di ${signal.playerName}`,
      summary: 'Con un\'offerta reale sul tavolo, il mercato inizia a parlare di una possibile cessione per finanziare un acquisto.',
      reasons: ['Offerta reale ricevuta'],
      journalistArchetype: 'transfer_expert',
      playerId: signal.playerId,
      playerName: signal.playerName,
      relatedClubId: signal.incomingOfferFromClubId,
      relatedClubName: signal.incomingOfferFromClub,
    });
  } else if (signal.isListedForSale) {
    drafts.push({
      type: 'possible_sale',
      confidence: 55,
      importance: (signal.isBelovedOrIdol || signal.isAcademyOrLocal) ? 62 : 48,
      title: `${signal.playerName} sulla lista cedibili`,
      summary: `Nessuna offerta ancora concreta, ma ${signal.playerName} resta tra i nomi cedibili.`,
      reasons: ['Giocatore inserito nella lista cedibili'],
      journalistArchetype: 'transfer_expert',
      playerId: signal.playerId,
      playerName: signal.playerName,
    });
  } else if (signal.financialFragile && (signal.isBelovedOrIdol || signal.isAcademyOrLocal)) {
    drafts.push({
      type: 'possible_sale',
      confidence: 45,
      importance: 58,
      title: `Conti in tensione, ${signal.playerName} tra i nomi caldi`,
      summary: 'Le difficolta di bilancio riaprono discorsi su una possibile cessione per finanziare il mercato.',
      reasons: ['Situazione economica del club fragile'],
      journalistArchetype: 'transfer_expert',
      playerId: signal.playerId,
      playerName: signal.playerName,
    });
  }

  // ─ Possibile acquisto (scouting reale su una trattativa) ─
  if (signal.scoutingJustAdvanced && (signal.scoutLevel ?? 0) >= 2) {
    const confidence = (signal.scoutLevel ?? 0) >= 4 ? 85 : (signal.scoutLevel ?? 0) >= 3 ? 72 : 60;
    drafts.push({
      type: 'possible_purchase',
      confidence,
      importance: 58,
      title: `${signal.playerName} accostato al club`,
      summary: `Una trattativa di scouting reale avvicina ${signal.playerName}${signal.sourceClubName ? ` (${signal.sourceClubName})` : ''} al club.`,
      reasons: ['Scouting avanzato su una trattativa reale'],
      journalistArchetype: signal.tacticalFitHigh ? 'tactical' : 'transfer_expert',
      playerId: signal.playerId,
      playerName: signal.playerName,
      relatedClubId: signal.sourceClubId,
      relatedClubName: signal.sourceClubName,
    });
  }

  return drafts;
};

interface RumorApplyContext {
  round: number;
  season: string;
  candidates: RumorCandidateDraft[];
  relatedTransferId?: string;
}

const applyRumorCandidates = (
  state: CareerWorldState,
  ctx: RumorApplyContext
): { state: CareerWorldState; createdRumor: MarketRumor | null } => {
  const media = state.mediaState;
  if (ctx.candidates.length === 0) return { state, createdRumor: null };
  if (media.lastRumorRound === ctx.round) return { state, createdRumor: null }; // massimo un nuovo rumor per giornata
  if (media.marketRumors.filter(r => r.status === 'active').length >= 10) return { state, createdRumor: null }; // massimo 10 rumor attivi

  const sorted = [...ctx.candidates].sort((a, b) => (b.importance + b.confidence) - (a.importance + a.confidence));
  const chosen = sorted.find(candidate => {
    const sourceId = `${candidate.playerId}_${candidate.type}_${ctx.season}`;
    if (media.lastProcessedRumorSourceIds.includes(sourceId)) return false; // nessun rumor duplicato per stessa causa
    if (media.marketRumors.some(r => r.playerId === candidate.playerId && (ctx.round - r.round) < 4)) return false; // massimo uno per giocatore ogni 4 giornate
    return true;
  });
  if (!chosen) return { state, createdRumor: null };

  const sourceId = `${chosen.playerId}_${chosen.type}_${ctx.season}`;
  const journalist = media.journalists.find(j => j.archetype === chosen.journalistArchetype) ?? media.journalists[0];
  const now = new Date().toISOString();

  const rumor: MarketRumor = {
    id: `rumor_${ctx.round}_${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    journalistId: journalist.id,
    type: chosen.type,
    status: 'active',
    confidence: Math.round(clamp(chosen.confidence, 0, 100)),
    importance: Math.round(clamp(chosen.importance, 0, 100)),
    title: chosen.title,
    summary: chosen.summary,
    playerId: chosen.playerId,
    playerName: chosen.playerName,
    relatedClubId: chosen.relatedClubId,
    relatedClubName: chosen.relatedClubName,
    relatedPromiseId: chosen.relatedPromiseId,
    relatedTransferId: ctx.relatedTransferId,
    sourceId,
    reasons: chosen.reasons.slice(0, 4),
    round: ctx.round,
    season: ctx.season,
    expiresAfterRound: chosen.expiresAfterRound ?? ctx.round + 6,
  };

  const nextMedia: MediaState = {
    ...media,
    marketRumors: [rumor, ...media.marketRumors].slice(0, 30),
    lastRumorRound: ctx.round,
    lastProcessedRumorSourceIds: [sourceId, ...media.lastProcessedRumorSourceIds].slice(0, 60),
  };

  return { state: { ...state, mediaState: nextMedia }, createdRumor: rumor };
};

// A promise-related rumor is denied the moment the field settles the question for real
// (the promise it was about gets completed) - a short, low-importance article marks it,
// deliberately below the >=75 news threshold used for regular media articles.
const denyRumorsResolvedByPromises = (
  state: CareerWorldState,
  signals: MarketRumorPlayerSignal[],
  season: string
): CareerWorldState => {
  const completedPlayerIds = new Set(signals.filter(signal => signal.promiseJustCompleted).map(signal => signal.playerId));
  if (completedPlayerIds.size === 0) return state;

  const media = state.mediaState;
  let firstDenied: MarketRumor | null = null;

  const marketRumors = media.marketRumors.map(rumor => {
    if (rumor.status !== 'active' || !rumor.playerId || !completedPlayerIds.has(rumor.playerId)) return rumor;
    if (rumor.type !== 'promise_pressure' && rumor.type !== 'playing_time_doubt' && rumor.type !== 'player_unhappy') return rumor;
    const denied: MarketRumor = { ...rumor, status: 'denied', updatedAt: new Date().toISOString() };
    if (!firstDenied) firstDenied = denied;
    return denied;
  });

  if (!firstDenied) return state;
  const resolvedRumor: MarketRumor = firstDenied;

  const article: MediaArticle = {
    id: `article_rumor_denied_${resolvedRumor.id}`,
    date: new Date().toISOString(),
    season,
    journalistId: resolvedRumor.journalistId,
    category: 'rumor_update',
    title: 'Il campo allontana le voci',
    body: `${resolvedRumor.playerName ?? 'Il giocatore'} risponde con i fatti: le voci delle ultime settimane perdono forza.`,
    importance: 45,
    relatedPlayerIds: resolvedRumor.playerId ? [resolvedRumor.playerId] : undefined,
  };

  return {
    ...state,
    mediaState: {
      ...media,
      marketRumors,
      articles: [article, ...media.articles].slice(0, 20),
    },
  };
};

export const resolveMarketRumorsAfterTransfer = (
  state: CareerWorldState,
  context: { playerId: string; transferId: string }
): CareerWorldState => {
  const media = state.mediaState;
  let changed = false;
  const marketRumors = media.marketRumors.map(rumor => {
    if (rumor.playerId !== context.playerId || rumor.status !== 'active') return rumor;
    changed = true;
    return { ...rumor, status: 'confirmed' as const, relatedTransferId: context.transferId, updatedAt: new Date().toISOString() };
  });
  if (!changed) return state;
  return { ...state, mediaState: { ...media, marketRumors } };
};

export const expireMarketRumors = (state: CareerWorldState, context: { round: number }): CareerWorldState => {
  const media = state.mediaState;
  let changed = false;
  const marketRumors = media.marketRumors.map(rumor => {
    if (rumor.status !== 'active') return rumor;
    if (rumor.expiresAfterRound !== undefined && context.round > rumor.expiresAfterRound) {
      changed = true;
      return { ...rumor, status: 'expired' as const, updatedAt: new Date().toISOString() };
    }
    return rumor;
  });
  if (!changed) return state;
  return { ...state, mediaState: { ...media, marketRumors } };
};

export interface MarketRumorMatchContext {
  round: number;
  season: string;
  playerSignals: MarketRumorPlayerSignal[];
}

export const processMarketRumorsAfterMatch = (state: CareerWorldState, context: MarketRumorMatchContext): CareerWorldState => {
  const expired = expireMarketRumors(state, { round: context.round });
  const denied = denyRumorsResolvedByPromises(expired, context.playerSignals, context.season);

  const candidates = context.playerSignals
    .filter(signal => !signal.promiseJustCompleted)
    .flatMap(buildRumorCandidatesForPlayerSignal);

  const { state: afterRumor, createdRumor } = applyRumorCandidates(denied, {
    round: context.round,
    season: context.season,
    candidates,
  });

  if (!createdRumor || createdRumor.importance < 80) return afterRumor;

  // Rumor rilevante + contesto gia forte: puo aprire una conferenza stampa (stesso gate condiviso, mai forzato).
  return createPressConferenceIfNeeded(afterRumor, {
    round: context.round,
    season: context.season,
    candidates: [{
      trigger: 'market_rumor',
      journalistArchetype: 'polemical',
      journalistId: createdRumor.journalistId,
      question: `Cosa risponde alle voci su ${createdRumor.playerName ?? 'questo giocatore'}?`,
      context: createdRumor.summary,
    }],
  });
};

export const processMarketRumorsAfterPlayerStateChange = (
  state: CareerWorldState,
  context: { round: number; season: string; signal: MarketRumorPlayerSignal }
): CareerWorldState => {
  const candidates = buildRumorCandidatesForPlayerSignal(context.signal);
  const { state: nextState } = applyRumorCandidates(state, { round: context.round, season: context.season, candidates });
  return nextState;
};

export interface MarketRumorTransferContext {
  round: number;
  season: string;
  signal: MarketRumorPlayerSignal;
  relatedTransferId?: string;
}

export const processMarketRumorsAfterTransfer = (state: CareerWorldState, context: MarketRumorTransferContext): CareerWorldState => {
  const candidates = buildRumorCandidatesForPlayerSignal(context.signal);
  const { state: nextState } = applyRumorCandidates(state, {
    round: context.round,
    season: context.season,
    candidates,
    relatedTransferId: context.relatedTransferId,
  });
  return nextState;
};
