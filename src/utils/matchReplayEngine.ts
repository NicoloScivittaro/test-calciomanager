import {
  MatchEvent,
  MatchReplay,
  Player,
  PitchPoint,
  PossessionObjective,
  ReplayActionSegment,
  ReplayActionType,
  ReplayFrame,
  ReplayPhase,
  ReplayPlayerState,
  SlotInstruction,
  Tactic
} from '../types';
import { POSITION_PRESETS } from './tacticsEngine';

// ─── Live Tactical Viewer: motore di replay deterministico ───
// Non decide MAI risultati/statistiche: legge solo cio' che il motore di partita reale ha gia' prodotto
// (score, eventi, tattica, formazione) e genera una coreografia visiva coerente (costruzione, avanzamento,
// rifinitura, conclusione) a partire da segmenti d'azione concatenati. Nessun Math.random(): tutto deriva
// da un seed deterministico basato su matchId + minuto + team + tattica.

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50);

const hashString = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
};

// Ratio deterministico 0..1 derivato da un seed testuale (matchId + minuto + team + ...).
const seededRatio = (seed: string): number => (hashString(seed) % 1000003) / 1000003;

// Durata deterministica dentro un range [min,max], derivata dal seed (nessun Math.random()).
const pickDuration = (seed: string, min: number, max: number) => min + seededRatio(seed) * (max - min);

// Numero di maglia stabile: puramente visivo, non e' un dato di gameplay ne' viene persistito.
export const deriveJerseyNumber = (playerId: string): number => (hashString(`shirt-${playerId}`) % 29) + 1;

const shortName = (name: string) => name.split(' ').slice(-1)[0] ?? name;

const otherTeam = (teamId: 'user' | 'opponent'): 'user' | 'opponent' => (teamId === 'user' ? 'opponent' : 'user');

export const getReplayPhaseLabel = (phase: ReplayPhase): string => ({
  build_up: 'Costruzione dal basso',
  progression: 'Avanzamento palla',
  final_third: 'Rifinitura offensiva',
  chance: 'Occasione da gol',
  pressing: 'Pressing alto',
  counter_attack: 'Contropiede',
  defensive_block: 'Blocco difensivo',
  set_piece: 'Palla inattiva',
  transition: 'Transizione'
}[phase]);

interface FormationSlot {
  role: Player['role'];
  position: PitchPoint;
}

// T2: piccolo spostamento visivo (mai un nuovo calcolo di risultato/statistiche) coerente col
// compito/ruolo scelto per lo slot: attacco spinge piu' in alto, difesa resta piu' basso, il terzino
// invertito si accentra, l'ala larga resta larga, il falso nove si abbassa, il target man resta
// centrale. Fallback sicuro: senza istruzione la posizione resta quella statica del preset.
const applyInstructionPositionNudge = (position: PitchPoint, instruction: SlotInstruction | undefined): PitchPoint => {
  if (!instruction) return position;
  let { x, y } = position;

  if (instruction.duty === 'attack') y -= 4;
  else if (instruction.duty === 'defend') y += 4;

  switch (instruction.role) {
    case 'inverted_fullback': x += x < 50 ? 12 : -12; break;
    case 'wingback_attack': x += x < 50 ? -4 : 4; y -= 2; break;
    case 'winger': case 'wide_midfielder': case 'wide_playmaker': x += x < 50 ? -3 : 3; break;
    case 'inside_forward': x += x < 50 ? 10 : -10; break;
    case 'false_nine': y += 8; break;
    case 'target_forward': x += (50 - x) * 0.35; break;
    case 'pressing_forward': y -= 3; break;
    default: break;
  }

  return { x: clamp(x, 4, 96), y: clamp(y, 4, 96) };
};

// Posizioni di base dal modulo realmente schierato. mirror=true orienta la squadra come "in attacco verso il basso"
// (usato per la squadra ospite nel primo tempo), coerente con la convenzione gia' in uso nel resto del match center.
// instructions e' opzionale (solo per il club utente: l'IA avversaria non ha istruzioni per slot modellate):
// senza di esso il comportamento resta identico a prima (fallback sicuro).
export const buildFormationBasePositions = (
  module: Tactic['module'],
  mirror: boolean,
  instructions?: Record<string, SlotInstruction>
): FormationSlot[] =>
  POSITION_PRESETS[module].map((slot, index) => {
    const basePosition = { x: slot.x, y: mirror ? 100 - slot.y : slot.y };
    const instruction = instructions?.[`slot_${index}`];
    const position = instruction ? applyInstructionPositionNudge(basePosition, instruction) : basePosition;
    return { role: slot.role, position };
  });

interface SubstitutionDirective {
  minute: number;
  outPlayerId: string;
  inPlayer: Player;
}

const SUB_PATTERN = /entra\s+([^,]+),\s*esce\s+(.+?)\.?$/i;

// Le sostituzioni reali non hanno playerId strutturati (solo una descrizione testuale): risolviamo per nome
// sulla rosa reale (titolari + panchina). Se il nome non si trova (dato non disponibile), la sostituzione
// viene semplicemente ignorata a livello visivo, senza errori e senza inventare nulla.
const resolveSubstitutionDirectives = (events: MatchEvent[], team: 'user' | 'opponent', squad: Player[]): SubstitutionDirective[] => {
  const byName = new Map(squad.map(player => [player.name, player]));
  const directives: SubstitutionDirective[] = [];
  events
    .filter(event => event.type === 'substitution' && event.team === team)
    .forEach(event => {
      const match = event.description.match(SUB_PATTERN);
      if (!match) return;
      const inPlayer = byName.get(match[1].trim());
      const outPlayer = byName.get(match[2].trim());
      if (inPlayer && outPlayer && inPlayer.id !== outPlayer.id) {
        directives.push({ minute: event.minute, inPlayer, outPlayerId: outPlayer.id });
      }
    });
  return directives.sort((a, b) => a.minute - b.minute);
};

// Applica alla formazione di partenza tutte le sostituzioni avvenute entro il minuto indicato,
// mantenendo lo slot/posizione del giocatore sostituito.
const resolveLineupAtMinute = (lineup: Player[], directives: SubstitutionDirective[], minute: number): Player[] => {
  if (directives.length === 0) return lineup;
  let current = [...lineup];
  directives.forEach(directive => {
    if (directive.minute > minute) return;
    const outIndex = current.findIndex(player => player.id === directive.outPlayerId);
    if (outIndex === -1) return;
    current[outIndex] = directive.inPlayer;
  });
  return current;
};

const findByRole = (lineup: Player[], roles: Player['role'][]): Player | undefined =>
  lineup.find(player => roles.includes(player.role));

interface ReplayBuildContext {
  matchId: string;
  tactic: Tactic;
  opponentModule: Tactic['module'];
  userLineup: Player[];
  opponentLineup: Player[];
  userSquad: Player[];
  opponentSquad: Player[];
  events: MatchEvent[];
  durationSeconds: number;
  userSubs: SubstitutionDirective[];
  opponentSubs: SubstitutionDirective[];
}

const lineupFor = (ctx: ReplayBuildContext, teamId: 'user' | 'opponent', minute: number): Player[] =>
  resolveLineupAtMinute(
    teamId === 'user' ? ctx.userLineup : ctx.opponentLineup,
    teamId === 'user' ? ctx.userSubs : ctx.opponentSubs,
    minute
  );

const squadFor = (ctx: ReplayBuildContext, teamId: 'user' | 'opponent'): Player[] =>
  teamId === 'user' ? ctx.userSquad : ctx.opponentSquad;

// ─── Geometria: zone del campo per la squadra che attacca (orientamento canonico pre-flip: 'user' attacca verso y=0) ───
const ATTACK_ZONE_Y: Record<'user' | 'opponent', { own: number; mid: number; entry: number; box: number; line: number; net: number }> = {
  user: { own: 78, mid: 58, entry: 34, box: 13, line: 3, net: 0.7 },
  opponent: { own: 22, mid: 42, entry: 66, box: 87, line: 97, net: 99.3 }
};

const goalMouthX = (seed: string) => clamp(50 + (seededRatio(seed) - 0.5) * 16, 40, 60);

const quadraticBezierPoint = (p0: PitchPoint, p1: PitchPoint, p2: PitchPoint, t: number): PitchPoint => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
  };
};

const WIDE_ROLES: Player['role'][] = ['LB', 'RB', 'LW', 'RW'];
const ATTACK_ROLES: Player['role'][] = ['ST', 'LW', 'RW', 'AM'];
const CREATIVE_ROLES: Player['role'][] = ['CM', 'AM', 'DM'];
const PASS_LIKE: ReplayActionType[] = ['short_pass', 'progressive_pass', 'through_ball', 'cross', 'free_kick_cross'];

const pickCore = (lineup: Player[]) => ({
  deep: findByRole(lineup, ['CB']) ?? findByRole(lineup, ['DM']) ?? lineup[1] ?? lineup[0],
  mid: findByRole(lineup, ['DM', 'CM']) ?? lineup[5] ?? lineup[0],
  leftWide: findByRole(lineup, ['LB', 'LW']),
  rightWide: findByRole(lineup, ['RB', 'RW']),
  am: findByRole(lineup, ['AM']) ?? findByRole(lineup, ['CM']),
  st: findByRole(lineup, ['ST']) ?? findByRole(lineup, ['AM']) ?? lineup[10] ?? lineup[0]
});

const buildActorTarget = (
  from: PitchPoint,
  to: PitchPoint,
  actor?: Player,
  target?: Player
): { playerId: string; from: PitchPoint; to: PitchPoint }[] => {
  const movements: { playerId: string; from: PitchPoint; to: PitchPoint }[] = [];
  if (actor) movements.push({ playerId: actor.id, from, to: { x: from.x, y: from.y } });
  if (target) movements.push({ playerId: target.id, from: { x: to.x, y: to.y + (to.y > 50 ? 6 : -6) }, to });
  return movements;
};

const distanceBetween = (a: PitchPoint, b: PitchPoint) => Math.hypot(a.x - b.x, a.y - b.y);

// ─── Scelta del ricevente: ogni passaggio deve avere un obiettivo reale (mai un giro a vuoto A-B-A). ───
// Valuta avanzamento verso l'obiettivo di possesso, distanza plausibile del passaggio e un piccolo
// spareggio deterministico (mai Math.random()); esclude candidati vietati dalla regola anti-loop.
interface ReceiverCandidate { player: Player; position: PitchPoint }

const pickNextReceiver = (
  candidates: ReceiverCandidate[],
  carrierPos: PitchPoint,
  progressionTarget: PitchPoint,
  forbiddenIds: Set<string>,
  seed: string,
  preferSafety = false
): ReceiverCandidate | undefined => {
  const currentDistance = distanceBetween(carrierPos, progressionTarget);
  let best: (ReceiverCandidate & { score: number }) | undefined;
  // Sotto pressione (preferSafety) l'avanzamento pesa meno e i passaggi lunghi costano di piu':
  // il portatore preferisce un'opzione vicina e sicura per uscire dalla pressione, non l'ambizione.
  const progressWeight = preferSafety ? 0.6 : 1.3;
  const longBallFactor = preferSafety ? 1 : 0.6;

  candidates.forEach(candidate => {
    if (forbiddenIds.has(candidate.player.id)) return;
    const passDistance = distanceBetween(carrierPos, candidate.position);
    if (passDistance < 6) return; // troppo vicino: non e' un vero passaggio, solo un tocco sul posto
    const progress = currentDistance - distanceBetween(candidate.position, progressionTarget);
    const longBallPenalty = passDistance > 55 ? (passDistance - 55) * longBallFactor : 0;
    const tieBreak = seededRatio(`${seed}-${candidate.player.id}`) * 0.4; // spareggio deterministico, non decide da solo
    const score = progress * progressWeight - longBallPenalty + tieBreak;
    if (!best || score > best.score) best = { ...candidate, score };
  });

  return best;
};

// Posizione ambientale (di formazione) di ogni titolare, usata come proxy di "dove si trova" un
// possibile ricevente quando si valuta un passaggio (stessa convenzione delle posizioni ambientali).
const buildPositionLookup = (ctx: ReplayBuildContext, teamId: 'user' | 'opponent', lineup: Player[]): Map<string, PitchPoint> => {
  const module = teamId === 'user' ? ctx.tactic.module : ctx.opponentModule;
  const slots = buildFormationBasePositions(module, teamId === 'opponent');
  const lookup = new Map<string, PitchPoint>();
  lineup.slice(0, 11).forEach((player, index) => {
    const slot = slots[index] ?? slots[slots.length - 1];
    lookup.set(player.id, slot.position);
  });
  return lookup;
};

// ─── Posizionamento ambientale: giocatori NON direttamente coinvolti nel segmento corrente ───
// Nessuno spostamento e' casuale: il jitter deriva da seedRatio (deterministico). Anche durante le pause
// (fischio, prima di una punizione/rigore) i giocatori continuano piccoli movimenti di posizionamento:
// il jitter e la logica per fase restano attivi, la palla e' l'unica cosa che puo' restare ferma.
const applyPhaseOffset = (
  base: PitchPoint,
  role: Player['role'],
  phase: ReplayPhase,
  hasBall: boolean,
  seedRatio: number
): PitchPoint => {
  let { x, y } = base;
  const jitter = (seedRatio - 0.5) * 3;
  const isBack = role === 'GK' || role === 'CB' || role === 'LB' || role === 'RB';
  const isForward = role === 'ST' || role === 'LW' || role === 'RW';
  const isCreator = role === 'AM' || role === 'CM';

  switch (phase) {
    case 'build_up':
      y += hasBall ? (isBack ? 3 : 6) : -2;
      break;
    case 'progression':
      if (hasBall) {
        y -= 6;
        if (role === 'LB' || role === 'RB') x += role === 'LB' ? -6 : 6;
        if (role === 'LW' || role === 'RW') x += role === 'LW' ? -5 : 5;
      } else {
        y += 3;
      }
      break;
    case 'final_third':
      y += hasBall ? -(isForward ? 14 : isCreator ? 9 : role === 'DM' ? 3 : 6) : 4;
      break;
    case 'chance':
      if (hasBall && (isForward || role === 'AM')) y -= 18;
      else if (hasBall) y -= 6;
      break;
    case 'pressing':
      y += hasBall ? 2 : -5;
      break;
    case 'counter_attack':
      if (hasBall) y -= isForward || role === 'DM' ? 20 : 8;
      else y += isBack ? 8 : 4;
      break;
    case 'defensive_block':
      if (!hasBall) {
        y += 6;
        x = 50 + (x - 50) * 0.82;
      }
      break;
    case 'set_piece':
      if (role === 'CB' || role === 'ST') y -= hasBall ? 10 : 2;
      break;
    case 'transition':
      y += hasBall ? -4 : 4;
      break;
  }

  x += jitter;
  y += jitter * 0.6;
  return { x: clamp(x, 4, 96), y: clamp(y, 4, 96) };
};

const buildAmbientPlayers = (
  ctx: ReplayBuildContext,
  minute: number,
  phase: ReplayPhase,
  possessionTeamId: 'user' | 'opponent',
  seed: string
): ReplayPlayerState[] => {
  const userLineup = lineupFor(ctx, 'user', minute);
  const opponentLineup = lineupFor(ctx, 'opponent', minute);
  const userSlots = buildFormationBasePositions(ctx.tactic.module, false, ctx.tactic.slotInstructions);
  const opponentSlots = buildFormationBasePositions(ctx.opponentModule, true);

  const mapTeam = (lineup: Player[], slots: FormationSlot[], teamId: 'user' | 'opponent'): ReplayPlayerState[] =>
    lineup.slice(0, 11).map((player, index) => {
      const slot = slots[index] ?? slots[slots.length - 1];
      const hasBall = teamId === possessionTeamId;
      const seedRatio = seededRatio(`${seed}-${player.id}`);
      const position = applyPhaseOffset(slot.position, slot.role, phase, hasBall, seedRatio);
      return {
        playerId: player.id,
        teamId,
        position,
        role: slot.role,
        jerseyNumber: deriveJerseyNumber(player.id),
        shortName: shortName(player.name),
        isBallCarrier: false,
        isPressing: false,
        isHighlighted: false
      };
    });

  return [
    ...mapTeam(userLineup, userSlots, 'user'),
    ...mapTeam(opponentLineup, opponentSlots, 'opponent')
  ];
};

const computeDefensiveLine = (ctx: ReplayBuildContext, possessionTeamId: 'user' | 'opponent', phase: ReplayPhase): number => {
  const defendingTeam = otherTeam(possessionTeamId);
  const module = defendingTeam === 'user' ? ctx.tactic.module : ctx.opponentModule;
  const mirror = defendingTeam === 'opponent';
  const slots = buildFormationBasePositions(module, mirror);
  const cbYs = slots.filter(slot => slot.role === 'CB').map(slot => slot.position.y);
  const base = average(cbYs.length ? cbYs : slots.map(slot => slot.position.y));
  const nudge = phase === 'defensive_block' ? 5 : phase === 'pressing' ? -3 : 0;
  return clamp(base + nudge, 10, 90);
};

const matchEventKey = (matchId: string, event: MatchEvent, index: number) => `${matchId}-ev-${index}-${event.minute}-${event.type}`;

// ─── GOAL: sequenza offensiva completa (costruzione lenta, avanzamento, rifinitura, tiro, gol) ───
// Ritmo: costruzione 4-8s, sviluppo 3-6s, rifinitura/cross/dribbling secondo il tipo, tiro 0.6-1.1s,
// gol+breve celebrazione 3-5s totali. Un'azione-gol dura normalmente 15-28 secondi complessivi.
type GoalFinishType = 'cross' | 'through_ball' | 'combination' | 'dribble' | 'long_shot';

const decideFinishType = (scorerRole: Player['role'], assistRole: Player['role'] | undefined, seed: string): GoalFinishType => {
  if (assistRole && WIDE_ROLES.includes(assistRole) && ATTACK_ROLES.includes(scorerRole)) return 'cross';
  if (assistRole && CREATIVE_ROLES.includes(assistRole) && (scorerRole === 'ST' || scorerRole === 'AM' || scorerRole === 'LW' || scorerRole === 'RW')) return 'through_ball';
  if (!assistRole && CREATIVE_ROLES.includes(scorerRole) && seededRatio(`${seed}-long`) > 0.7) return 'long_shot';
  if (!assistRole) return 'dribble';
  return 'combination';
};

// Costruisce una sequenza di 5-7 segmenti che termina esattamente al minuto reale del gol (climaxSecond),
// con la palla che finisce dentro la porta corretta e il marcatore (e l'assistman, se esiste) coinvolti.
const buildGoalSequence = (ctx: ReplayBuildContext, event: MatchEvent, eventId: string, climaxSecond: number): ReplayActionSegment[] => {
  const scoringTeam = event.team;
  const concedingTeam = otherTeam(scoringTeam);
  const minute = event.minute;
  const scoringSquad = squadFor(ctx, scoringTeam);
  const scoringLineup = lineupFor(ctx, scoringTeam, minute);
  const concedingLineup = lineupFor(ctx, concedingTeam, minute);
  const core = pickCore(scoringLineup);
  const scorer = (event.playerId && scoringSquad.find(player => player.id === event.playerId)) || core.st;
  const rawAssist = event.assistPlayerId ? scoringSquad.find(player => player.id === event.assistPlayerId) : undefined;
  const assist = rawAssist && rawAssist.id !== scorer.id ? rawAssist : undefined;
  const seedBase = `${eventId}-goal`;
  const finishType = decideFinishType(scorer.role, assist?.role, seedBase);

  const Z = ATTACK_ZONE_Y[scoringTeam];
  const side: 'left' | 'right' = assist?.role === 'LB' || assist?.role === 'LW'
    ? 'left'
    : assist?.role === 'RB' || assist?.role === 'RW'
      ? 'right'
      : (seededRatio(`${seedBase}-side`) < 0.5 ? 'left' : 'right');
  const flankX = side === 'left' ? clamp(16 + seededRatio(`${seedBase}-fx`) * 8, 12, 26) : clamp(84 - seededRatio(`${seedBase}-fx`) * 8, 74, 88);
  const centerX = clamp(46 + (seededRatio(`${seedBase}-cx`) - 0.5) * 16, 36, 64);
  const targetX = goalMouthX(`${seedBase}-target`);
  const gk = findByRole(concedingLineup, ['GK']) ?? concedingLineup[0];

  const specs: { duration: number; build: (start: number, end: number) => ReplayActionSegment }[] = [];
  const common = { isOfficialMatchEvent: true, isVisualOnly: false, relatedMatchEventId: eventId };

  specs.push({
    duration: pickDuration(`${seedBase}-d0`, 4, 8),
    build: (start, end) => ({
      id: `${eventId}-buildup`, type: 'short_pass', teamId: scoringTeam, startSecond: start, endSecond: end,
      actorId: core.deep.id, targetPlayerId: core.mid.id,
      ballStart: { x: 50, y: Z.own }, ballEnd: { x: centerX, y: Z.mid },
      playerMovements: [
        { playerId: core.deep.id, from: { x: 50, y: Z.own + 4 }, to: { x: 50, y: Z.own } },
        { playerId: core.mid.id, from: { x: centerX, y: Z.mid + 6 }, to: { x: centerX, y: Z.mid } }
      ],
      phase: 'build_up', ...common
    })
  });

  const wideOutlet = (side === 'left' ? core.leftWide : core.rightWide) ?? core.mid;
  // L'assistman reale, se esiste, e' sempre l'attore dell'ultima giocata: mai sostituito da un giocatore generico.
  const entryActor = assist ?? (finishType === 'cross' ? wideOutlet : core.mid);
  const entryX = finishType === 'cross' ? flankX : centerX;
  const entryTargetId = finishType === 'long_shot' ? scorer.id : entryActor.id;
  const entryTargetY = finishType === 'long_shot' ? Z.entry + 6 : Z.entry;

  specs.push({
    duration: pickDuration(`${seedBase}-d1`, 3, 6),
    build: (start, end) => ({
      id: `${eventId}-progression`, type: 'progressive_pass', teamId: scoringTeam, startSecond: start, endSecond: end,
      actorId: core.mid.id, targetPlayerId: entryTargetId,
      ballStart: { x: centerX, y: Z.mid }, ballEnd: { x: entryX, y: entryTargetY },
      playerMovements: [
        { playerId: core.mid.id, from: { x: centerX, y: Z.mid }, to: { x: centerX, y: Z.mid - 4 } },
        { playerId: entryTargetId, from: { x: entryX, y: entryTargetY + 10 }, to: { x: entryX, y: entryTargetY } }
      ],
      phase: 'progression', ...common
    })
  });

  const boxSpot: PitchPoint = { x: targetX, y: Z.box };

  if (finishType === 'cross') {
    specs.push({
      duration: pickDuration(`${seedBase}-d2`, 1.2, 2.0),
      build: (start, end) => ({
        id: `${eventId}-cross`, type: 'cross', teamId: scoringTeam, startSecond: start, endSecond: end,
        actorId: entryActor.id, targetPlayerId: scorer.id,
        ballStart: { x: entryX, y: Z.entry }, ballEnd: boxSpot,
        ballControlPoint: { x: (entryX + targetX) / 2, y: lerp(Z.entry, Z.box, 0.55) },
        playerMovements: [
          { playerId: entryActor.id, from: { x: entryX, y: Z.entry }, to: { x: entryX, y: Z.entry - 3 } },
          { playerId: scorer.id, from: { x: targetX - 6, y: Z.box + 8 }, to: boxSpot }
        ],
        phase: 'final_third', ...common
      })
    });
  } else if (finishType === 'through_ball') {
    specs.push({
      duration: pickDuration(`${seedBase}-d2`, 2, 4),
      build: (start, end) => ({
        id: `${eventId}-through`, type: 'through_ball', teamId: scoringTeam, startSecond: start, endSecond: end,
        actorId: entryActor.id, targetPlayerId: scorer.id,
        ballStart: { x: entryX, y: Z.entry }, ballEnd: boxSpot,
        playerMovements: [
          { playerId: entryActor.id, from: { x: entryX, y: Z.entry }, to: { x: entryX, y: Z.entry - 2 } },
          { playerId: scorer.id, from: { x: targetX, y: Z.box + 10 }, to: boxSpot }
        ],
        phase: 'final_third', ...common
      })
    });
  } else if (finishType === 'combination') {
    specs.push({
      duration: pickDuration(`${seedBase}-d2`, 2, 4),
      build: (start, end) => ({
        id: `${eventId}-combo`, type: 'short_pass', teamId: scoringTeam, startSecond: start, endSecond: end,
        actorId: (assist ?? entryActor).id, targetPlayerId: scorer.id,
        ballStart: { x: entryX, y: Z.entry }, ballEnd: boxSpot,
        playerMovements: [
          { playerId: (assist ?? entryActor).id, from: { x: entryX, y: Z.entry }, to: { x: entryX, y: Z.entry - 2 } },
          { playerId: scorer.id, from: { x: targetX, y: Z.box + 8 }, to: boxSpot }
        ],
        phase: 'final_third', ...common
      })
    });
  } else if (finishType === 'dribble') {
    specs.push({
      duration: pickDuration(`${seedBase}-d2`, 1.4, 3.0),
      build: (start, end) => ({
        id: `${eventId}-dribble`, type: 'dribble', teamId: scoringTeam, startSecond: start, endSecond: end,
        actorId: scorer.id,
        ballStart: { x: entryX, y: Z.entry }, ballEnd: boxSpot,
        playerMovements: [{ playerId: scorer.id, from: { x: entryX, y: Z.entry }, to: boxSpot }],
        phase: 'final_third', ...common
      })
    });
  }
  // long_shot: nessun ingresso in area, si tira direttamente da fuori (gestito sotto).

  const shotFrom = finishType === 'long_shot' ? { x: centerX, y: Z.entry + 6 } : boxSpot;
  specs.push({
    duration: pickDuration(`${seedBase}-d3`, 0.6, 1.1),
    build: (start, end) => ({
      id: `${eventId}-shot`, type: 'shot', teamId: scoringTeam, startSecond: start, endSecond: end,
      actorId: scorer.id,
      ballStart: shotFrom, ballEnd: { x: targetX, y: Z.line },
      playerMovements: [
        { playerId: scorer.id, from: shotFrom, to: { x: targetX, y: Z.line + (Z.line > 50 ? -2 : 2) } },
        ...(gk ? [{ playerId: gk.id, from: { x: 50, y: Z.line }, to: { x: lerp(50, targetX, 0.55), y: Z.line } }] : [])
      ],
      phase: 'chance', ...common
    })
  });

  specs.push({
    duration: pickDuration(`${seedBase}-d4`, 0.5, 0.8),
    build: (start, end) => ({
      id: `${eventId}-goal`, type: 'goal', teamId: scoringTeam, startSecond: start, endSecond: end,
      actorId: scorer.id,
      ballStart: { x: targetX, y: Z.line }, ballEnd: { x: targetX, y: Z.net },
      playerMovements: gk ? [{ playerId: gk.id, from: { x: lerp(50, targetX, 0.55), y: Z.line }, to: { x: lerp(50, targetX, 0.7), y: Z.line } }] : [],
      phase: 'chance',
      eventLabel: `GOOOL! ${scorer.name}`,
      ...common
    })
  });

  specs.push({
    duration: pickDuration(`${seedBase}-d5`, 2.4, 3.8),
    build: (start, end) => ({
      id: `${eventId}-hold`, type: 'goal', teamId: scoringTeam, startSecond: start, endSecond: end,
      actorId: scorer.id,
      ballStart: { x: targetX, y: Z.net }, ballEnd: { x: targetX, y: Z.net },
      playerMovements: [],
      phase: 'chance',
      eventLabel: `GOOOL! ${scorer.name}`,
      ...common
    })
  });

  // Il tiro (fine) coincide esattamente con climaxSecond: e' il momento in cui la palla supera la linea.
  // Tutto cio' che precede viene disposto a ritroso; goal+hold seguono climaxSecond in avanti.
  const after = specs.slice(-2);
  const before = specs.slice(0, -2);

  const afterBuilt: ReplayActionSegment[] = [];
  let afterCursor = climaxSecond;
  after.forEach(spec => {
    const start = afterCursor;
    const end = afterCursor + spec.duration;
    afterBuilt.push(spec.build(start, end));
    afterCursor = end;
  });

  const beforeBuilt: ReplayActionSegment[] = [];
  let beforeCursor = climaxSecond;
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const start = Math.max(0, beforeCursor - before[i].duration);
    beforeBuilt.unshift(before[i].build(start, beforeCursor));
    beforeCursor = start;
  }

  return [...beforeBuilt, ...afterBuilt];
};

// ─── CARTELLINO: un contrasto/pressione plausibile, mai un tiro o un gol ───
const buildCardSequence = (ctx: ReplayBuildContext, event: MatchEvent, eventId: string, climaxSecond: number): ReplayActionSegment[] => {
  const cardedTeam = event.team;
  const attackingTeam = otherTeam(cardedTeam);
  const minute = event.minute;
  const cardedSquad = squadFor(ctx, cardedTeam);
  const cardedLineup = lineupFor(ctx, cardedTeam, minute);
  const carded = (event.playerId && cardedSquad.find(player => player.id === event.playerId)) || findByRole(cardedLineup, ['CB', 'DM']) || cardedLineup[0];
  const attackingLineup = lineupFor(ctx, attackingTeam, minute);
  const attacker = findByRole(attackingLineup, ['ST', 'AM', 'CM']) ?? attackingLineup[0];
  const seedBase = `${eventId}-card`;
  const Z = ATTACK_ZONE_Y[attackingTeam];
  const spotX = clamp(50 + (seededRatio(seedBase) - 0.5) * 40, 18, 82);
  const spotY = (Z.mid + Z.entry) / 2;
  const duration = pickDuration(`${seedBase}-dur`, 3, 5);
  const start = Math.max(0, climaxSecond - duration);

  return [{
    id: `${eventId}-tackle`,
    type: 'tackle',
    startSecond: start,
    endSecond: climaxSecond,
    teamId: attackingTeam,
    actorId: carded?.id,
    targetPlayerId: attacker?.id,
    ballStart: { x: spotX, y: spotY - 4 },
    ballEnd: { x: spotX, y: spotY },
    playerMovements: [
      ...(carded ? [{ playerId: carded.id, from: { x: spotX + 5, y: spotY - 6 }, to: { x: spotX, y: spotY } }] : []),
      ...(attacker ? [{ playerId: attacker.id, from: { x: spotX - 4, y: spotY - 8 }, to: { x: spotX, y: spotY - 2 } }] : [])
    ],
    pressingPlayerIds: carded ? [carded.id] : [],
    phase: 'pressing',
    eventLabel: `${event.type === 'card_red' ? 'Rosso' : 'Giallo'}: ${event.playerName ?? carded?.name ?? ''}`.trim(),
    relatedMatchEventId: eventId,
    isOfficialMatchEvent: true,
    isVisualOnly: false
  }];
};

// ─── Occasione sintetica (nessun evento reale): tiro visibile che termina SEMPRE con parata/respinta/fuori ───
// Ritmo: sviluppo 3-6s + rifinitura 2-4s + tiro 0.6-1.1s + parata/respinta 1.0-1.8s: un'azione senza gol
// dura normalmente 8-18 secondi.
const buildChanceSequence = (
  ctx: ReplayBuildContext,
  seedBase: string,
  possessionTeamId: 'user' | 'opponent',
  entrySpot: PitchPoint,
  startSecond: number
): { segments: ReplayActionSegment[]; endSecond: number; endSpot: PitchPoint } => {
  const Z = ATTACK_ZONE_Y[possessionTeamId];
  const defendingTeam = otherTeam(possessionTeamId);
  const minute = Math.floor(startSecond / 60);
  const core = pickCore(lineupFor(ctx, possessionTeamId, minute));
  const defendingLineup = lineupFor(ctx, defendingTeam, minute);
  const finisher = core.st;
  const creator = core.am ?? core.mid;
  const seed = `${seedBase}-chance`;
  const targetX = goalMouthX(`${seed}-x`);
  const sequenceId = `${seedBase}-chance-seq`;
  const visual = { isOfficialMatchEvent: false, isVisualOnly: true, relatedMatchEventId: sequenceId };

  let cursor = startSecond;
  const segments: ReplayActionSegment[] = [];

  const entryTo: PitchPoint = { x: clamp(46 + (seededRatio(`${seed}-ex`) - 0.5) * 18, 32, 68), y: Z.entry };
  const entryDur = pickDuration(`${seed}-d0`, 3, 6);
  segments.push({
    id: `${seedBase}-entry`, type: 'progressive_pass', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + entryDur,
    actorId: creator?.id, targetPlayerId: finisher?.id,
    ballStart: entrySpot, ballEnd: entryTo,
    playerMovements: buildActorTarget(entrySpot, entryTo, creator, finisher),
    phase: 'final_third', ...visual
  });
  cursor += entryDur;

  const boxSpot: PitchPoint = { x: targetX, y: Z.box };
  const deliveryDur = pickDuration(`${seed}-d1`, 2, 4);
  segments.push({
    id: `${seedBase}-delivery`, type: 'through_ball', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + deliveryDur,
    actorId: creator?.id, targetPlayerId: finisher?.id,
    ballStart: entryTo, ballEnd: boxSpot,
    playerMovements: buildActorTarget(entryTo, boxSpot, creator, finisher),
    phase: 'chance', ...visual
  });
  cursor += deliveryDur;

  const lineSpot: PitchPoint = { x: targetX, y: Z.line };
  const shotDur = pickDuration(`${seed}-d2`, 0.6, 1.1);
  segments.push({
    id: `${seedBase}-shot`, type: 'shot', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + shotDur,
    actorId: finisher?.id,
    ballStart: boxSpot, ballEnd: lineSpot,
    playerMovements: finisher ? [{ playerId: finisher.id, from: boxSpot, to: lineSpot }] : [],
    phase: 'chance', ...visual
  });
  cursor += shotDur;

  const gk = findByRole(defendingLineup, ['GK']) ?? defendingLineup[0];
  const outcomeRoll = seededRatio(`${seed}-outcome`);
  const resolutionDur = pickDuration(`${seed}-d3`, 1.0, 1.8);

  if (outcomeRoll < 0.45) {
    segments.push({
      id: `${seedBase}-save`, type: 'save', teamId: defendingTeam, startSecond: cursor, endSecond: cursor + resolutionDur,
      actorId: gk?.id,
      ballStart: lineSpot, ballEnd: { x: targetX, y: Z.line + (Z.line > 50 ? -3 : 3) },
      playerMovements: gk ? [{ playerId: gk.id, from: { x: 50, y: Z.line }, to: lineSpot }] : [],
      phase: 'defensive_block', eventLabel: 'Parata!', ...visual
    });
  } else if (outcomeRoll < 0.75) {
    const clearSpot: PitchPoint = { x: clamp(targetX + (seededRatio(`${seed}-cl`) - 0.5) * 24, 18, 82), y: Z.mid };
    const defender = findByRole(defendingLineup, ['CB']) ?? defendingLineup[0];
    segments.push({
      id: `${seedBase}-clearance`, type: 'clearance', teamId: defendingTeam, startSecond: cursor, endSecond: cursor + resolutionDur,
      actorId: defender?.id,
      ballStart: lineSpot, ballEnd: clearSpot,
      playerMovements: defender ? [{ playerId: defender.id, from: lineSpot, to: clearSpot }] : [],
      phase: 'defensive_block', eventLabel: 'Respinta!', ...visual
    });
  } else {
    const wideSpot: PitchPoint = { x: targetX < 50 ? clamp(targetX - 16, 2, 30) : clamp(targetX + 16, 70, 98), y: Z.line };
    segments.push({
      id: `${seedBase}-off`, type: 'shot', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + resolutionDur,
      actorId: finisher?.id,
      ballStart: lineSpot, ballEnd: wideSpot,
      playerMovements: [],
      phase: 'chance', eventLabel: 'Fuori!', ...visual
    });
  }
  cursor += resolutionDur;

  return { segments, endSecond: cursor, endSpot: segments[segments.length - 1].ballEnd };
};

// ─── FUORIGIOCO: interrompe l'azione PRIMA della conclusione. Mai durante un cross gia' arrivato,
// mai dietro la linea di porta, mai senza un vero attacco in profondita'. Sempre visual-only. ───
const buildOffsideSequence = (
  ctx: ReplayBuildContext,
  seedBase: string,
  possessionTeamId: 'user' | 'opponent',
  entrySpot: PitchPoint,
  startSecond: number
): { segments: ReplayActionSegment[]; endSecond: number; endSpot: PitchPoint } => {
  const Z = ATTACK_ZONE_Y[possessionTeamId];
  const minute = Math.floor(startSecond / 60);
  const core = pickCore(lineupFor(ctx, possessionTeamId, minute));
  const seed = `${seedBase}-offside`;
  const sequenceId = `${seedBase}-offside-seq`;
  const visual = { isOfficialMatchEvent: false, isVisualOnly: true, relatedMatchEventId: sequenceId };
  const passer = core.mid;
  const runner = core.st;
  let cursor = startSecond;
  const segments: ReplayActionSegment[] = [];

  // Passaggio filtrante in profondita': l'attaccante e' oltre l'ultima linea difensiva.
  const runDur = pickDuration(`${seed}-run`, 1.2, 1.7);
  const runnerTarget: PitchPoint = { x: clamp(46 + (seededRatio(`${seed}-x`) - 0.5) * 20, 30, 70), y: Z.entry - 8 };
  segments.push({
    id: `${seedBase}-through`, type: 'through_ball', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + runDur,
    actorId: passer?.id, targetPlayerId: runner?.id,
    ballStart: entrySpot, ballEnd: runnerTarget,
    playerMovements: buildActorTarget(entrySpot, runnerTarget, passer, runner),
    phase: 'final_third', ...visual
  });
  cursor += runDur;

  // Fischio: l'azione si interrompe subito, la palla passa visivamente alla difesa che si riallinea.
  const whistleDur = pickDuration(`${seed}-whistle`, 0.8, 1.3);
  const restartSpot: PitchPoint = { x: runnerTarget.x, y: runnerTarget.y + (Z.entry > 50 ? 4 : -4) };
  segments.push({
    id: `${seedBase}-flag`, type: 'offside', teamId: otherTeam(possessionTeamId), startSecond: cursor, endSecond: cursor + whistleDur,
    ballStart: runnerTarget, ballEnd: restartSpot,
    playerMovements: [],
    phase: 'transition', eventLabel: 'Fuorigioco!', ...visual
  });
  cursor += whistleDur;

  return { segments, endSecond: cursor, endSpot: restartSpot };
};

// ─── PUNIZIONE: fallo, fischio, posizionamento, barriera (se diretta), battuta, esito. Sempre visual-only:
// se non esiste un evento ufficiale, non puo' MAI trasformarsi in un gol. ───
const buildFreeKickSequence = (
  ctx: ReplayBuildContext,
  seedBase: string,
  possessionTeamId: 'user' | 'opponent',
  entrySpot: PitchPoint,
  startSecond: number
): { segments: ReplayActionSegment[]; endSecond: number; endSpot: PitchPoint } => {
  const Z = ATTACK_ZONE_Y[possessionTeamId];
  const defendingTeam = otherTeam(possessionTeamId);
  const minute = Math.floor(startSecond / 60);
  const lineup = lineupFor(ctx, possessionTeamId, minute);
  const defendingLineup = lineupFor(ctx, defendingTeam, minute);
  const core = pickCore(lineup);
  // Batte un centrocampista tecnico, un esterno o un attaccante: mai il portiere.
  const taker = core.am ?? core.mid;
  const seed = `${seedBase}-fk`;
  const sequenceId = `${seedBase}-fk-seq`;
  const visual = { isOfficialMatchEvent: false, isVisualOnly: true, relatedMatchEventId: sequenceId };
  let cursor = startSecond;
  const segments: ReplayActionSegment[] = [];

  const foulSpot: PitchPoint = { x: clamp(entrySpot.x, 20, 80), y: entrySpot.y };
  const foulDur = pickDuration(`${seed}-foul`, 1.2, 1.8);
  segments.push({
    id: `${seedBase}-foul`, type: 'foul', teamId: defendingTeam, startSecond: cursor, endSecond: cursor + foulDur,
    ballStart: entrySpot, ballEnd: foulSpot, playerMovements: [], phase: 'pressing', ...visual
  });
  cursor += foulDur;

  const whistleDur = pickDuration(`${seed}-whistle`, 0.8, 1.4);
  segments.push({
    id: `${seedBase}-whistle`, type: 'whistle', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + whistleDur,
    ballStart: foulSpot, ballEnd: foulSpot, playerMovements: [], phase: 'set_piece', eventLabel: 'Punizione', ...visual
  });
  cursor += whistleDur;

  const distanceToGoal = Math.abs(foulSpot.y - Z.line);
  const isDirect = distanceToGoal <= 35 && seededRatio(`${seed}-direct`) > 0.4;
  const setupDur = pickDuration(`${seed}-setup`, 1.5, 2.5);
  segments.push({
    id: `${seedBase}-setup`, type: 'restart', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + setupDur,
    actorId: taker?.id,
    ballStart: foulSpot, ballEnd: foulSpot,
    playerMovements: taker ? [{ playerId: taker.id, from: { x: foulSpot.x - 3, y: foulSpot.y + (Z.entry > 50 ? 4 : -4) }, to: foulSpot }] : [],
    phase: 'set_piece', ...visual
  });
  cursor += setupDur;

  if (isDirect) {
    const wallDur = pickDuration(`${seed}-wall`, 1.0, 1.5);
    const wallDefenders = defendingLineup.filter(player => player.role !== 'GK').slice(0, 3).map(player => player.id);
    segments.push({
      id: `${seedBase}-wall`, type: 'restart', teamId: defendingTeam, startSecond: cursor, endSecond: cursor + wallDur,
      ballStart: foulSpot, ballEnd: foulSpot,
      playerMovements: [],
      pressingPlayerIds: wallDefenders,
      phase: 'set_piece', ...visual
    });
    cursor += wallDur;
  }

  const targetX = goalMouthX(`${seed}-target`);
  const boxSpot: PitchPoint = { x: targetX, y: Z.box };
  const strikeDur = pickDuration(`${seed}-strike`, 1.2, 1.8);
  const useCross = !isDirect;

  if (useCross) {
    const finisher = core.st;
    segments.push({
      id: `${seedBase}-cross`, type: 'free_kick_cross', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + strikeDur,
      actorId: taker?.id, targetPlayerId: finisher?.id,
      ballStart: foulSpot, ballEnd: boxSpot,
      ballControlPoint: { x: (foulSpot.x + targetX) / 2, y: lerp(foulSpot.y, Z.box, 0.55) },
      playerMovements: buildActorTarget(foulSpot, boxSpot, taker, finisher),
      phase: 'final_third', ...visual
    });
  } else {
    segments.push({
      id: `${seedBase}-shot`, type: 'free_kick_shot', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + strikeDur,
      actorId: taker?.id,
      ballStart: foulSpot, ballEnd: { x: targetX, y: Z.line },
      playerMovements: taker ? [{ playerId: taker.id, from: foulSpot, to: { x: foulSpot.x, y: foulSpot.y + (Z.entry > 50 ? 2 : -2) } }] : [],
      phase: 'chance', ...visual
    });
  }
  cursor += strikeDur;

  const gk = findByRole(defendingLineup, ['GK']) ?? defendingLineup[0];
  const outcomeRoll = seededRatio(`${seed}-outcome`);
  const resolutionDur = pickDuration(`${seed}-resolution`, 1.0, 1.8);
  const resolvedFrom = useCross ? boxSpot : { x: targetX, y: Z.line };
  let resolutionEnd: PitchPoint;
  let label: string;
  let type: ReplayActionType;

  if (outcomeRoll < 0.4) {
    resolutionEnd = { x: targetX, y: Z.line + (Z.line > 50 ? -3 : 3) };
    label = 'Parata!';
    type = 'save';
  } else if (outcomeRoll < 0.7) {
    resolutionEnd = { x: clamp(targetX + (seededRatio(`${seed}-cl`) - 0.5) * 22, 18, 82), y: Z.mid };
    label = 'Respinta!';
    type = 'clearance';
  } else {
    resolutionEnd = { x: targetX < 50 ? clamp(targetX - 16, 2, 30) : clamp(targetX + 16, 70, 98), y: Z.line };
    label = 'Fuori!';
    type = 'shot';
  }

  segments.push({
    id: `${seedBase}-resolve`, type, teamId: defendingTeam, startSecond: cursor, endSecond: cursor + resolutionDur,
    actorId: type === 'save' ? gk?.id : undefined,
    ballStart: resolvedFrom, ballEnd: resolutionEnd,
    playerMovements: type === 'save' && gk ? [{ playerId: gk.id, from: { x: 50, y: Z.line }, to: resolvedFrom }] : [],
    phase: 'defensive_block', eventLabel: label, ...visual
  });
  cursor += resolutionDur;

  return { segments, endSecond: cursor, endSpot: resolutionEnd };
};

// ─── RIGORE (visual-only): puo' terminare SOLO con parata, palo, fuori o respinto. Un gol reale viene
// etichettato "rigore" unicamente se il motore lo classifica esplicitamente (dato oggi non disponibile:
// vedi buildGoalSequence, che non usa mai questi tipi di segmento per gol reali). ───
const buildPenaltySequence = (
  ctx: ReplayBuildContext,
  seedBase: string,
  possessionTeamId: 'user' | 'opponent',
  startSecond: number
): { segments: ReplayActionSegment[]; endSecond: number; endSpot: PitchPoint } => {
  const Z = ATTACK_ZONE_Y[possessionTeamId];
  const defendingTeam = otherTeam(possessionTeamId);
  const minute = Math.floor(startSecond / 60);
  const lineup = lineupFor(ctx, possessionTeamId, minute);
  const defendingLineup = lineupFor(ctx, defendingTeam, minute);
  const core = pickCore(lineup);
  const taker = core.st ?? core.am;
  const gk = findByRole(defendingLineup, ['GK']) ?? defendingLineup[0];
  const seed = `${seedBase}-pen`;
  const sequenceId = `${seedBase}-pen-seq`;
  const visual = { isOfficialMatchEvent: false, isVisualOnly: true, relatedMatchEventId: sequenceId };
  const spotX = 50;
  const towardOwnGoal = Z.box > 50 ? 6 : -6;
  const spot: PitchPoint = { x: spotX, y: Z.box - towardOwnGoal * 0.4 };
  const penaltySpot: PitchPoint = { x: spotX, y: Z.box + towardOwnGoal * 0.6 };
  let cursor = startSecond;
  const segments: ReplayActionSegment[] = [];

  const signalDur = pickDuration(`${seed}-signal`, 1.0, 1.6);
  segments.push({
    id: `${seedBase}-awarded`, type: 'penalty_awarded', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + signalDur,
    ballStart: spot, ballEnd: penaltySpot, playerMovements: [], phase: 'set_piece', eventLabel: 'Rigore!', ...visual
  });
  cursor += signalDur;

  const walkDur = pickDuration(`${seed}-walk`, 1.6, 2.6);
  segments.push({
    id: `${seedBase}-setup`, type: 'restart', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + walkDur,
    actorId: taker?.id,
    ballStart: penaltySpot, ballEnd: penaltySpot,
    playerMovements: taker ? [{ playerId: taker.id, from: { x: spotX, y: penaltySpot.y + towardOwnGoal }, to: penaltySpot }] : [],
    phase: 'set_piece', ...visual
  });
  cursor += walkDur;

  const keeperDur = pickDuration(`${seed}-keeper`, 0.7, 1.1);
  segments.push({
    id: `${seedBase}-keeper`, type: 'restart', teamId: defendingTeam, startSecond: cursor, endSecond: cursor + keeperDur,
    actorId: gk?.id,
    ballStart: penaltySpot, ballEnd: penaltySpot,
    playerMovements: gk ? [{ playerId: gk.id, from: { x: 50, y: Z.line - towardOwnGoal * 0.4 }, to: { x: 50, y: Z.line } }] : [],
    phase: 'set_piece', ...visual
  });
  cursor += keeperDur;

  const runUpDur = pickDuration(`${seed}-runup`, 0.9, 1.5);
  segments.push({
    id: `${seedBase}-runup`, type: 'restart', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + runUpDur,
    actorId: taker?.id,
    ballStart: penaltySpot, ballEnd: penaltySpot,
    playerMovements: taker ? [{ playerId: taker.id, from: penaltySpot, to: { x: spotX, y: penaltySpot.y - towardOwnGoal * 0.3 } }] : [],
    phase: 'chance', ...visual
  });
  cursor += runUpDur;

  const targetX = goalMouthX(`${seed}-target`);
  const strikeDur = pickDuration(`${seed}-strike`, 0.4, 0.7);
  segments.push({
    id: `${seedBase}-shot`, type: 'penalty_shot', teamId: possessionTeamId, startSecond: cursor, endSecond: cursor + strikeDur,
    actorId: taker?.id,
    ballStart: penaltySpot, ballEnd: { x: targetX, y: Z.line },
    playerMovements: taker ? [{ playerId: taker.id, from: penaltySpot, to: { x: spotX, y: penaltySpot.y - towardOwnGoal * 0.4 } }] : [],
    phase: 'chance', ...visual
  });
  cursor += strikeDur;

  const resolutionDur = pickDuration(`${seed}-resolution`, 1.0, 1.8);
  const outcomeRoll = seededRatio(`${seed}-outcome`);
  let resolutionEnd: PitchPoint;
  let label: string;
  let type: ReplayActionType;

  if (outcomeRoll < 0.5) {
    resolutionEnd = { x: targetX, y: Z.line + (Z.line > 50 ? -3 : 3) };
    label = 'Parata!';
    type = 'penalty_save';
  } else if (outcomeRoll < 0.8) {
    resolutionEnd = { x: targetX < 50 ? clamp(targetX - 14, 2, 30) : clamp(targetX + 14, 70, 98), y: Z.line };
    label = 'Fuori!';
    type = 'penalty_missed';
  } else {
    resolutionEnd = { x: targetX, y: Z.line + (Z.line > 50 ? 2 : -2) };
    label = 'Palo!';
    type = 'penalty_missed';
  }

  segments.push({
    id: `${seedBase}-resolve`, type, teamId: defendingTeam, startSecond: cursor, endSecond: cursor + resolutionDur,
    actorId: type === 'penalty_save' ? gk?.id : undefined,
    ballStart: { x: targetX, y: Z.line }, ballEnd: resolutionEnd,
    playerMovements: type === 'penalty_save' && gk ? [{ playerId: gk.id, from: { x: 50, y: Z.line }, to: { x: targetX, y: Z.line } }] : [],
    phase: 'defensive_block', eventLabel: label, ...visual
  });
  cursor += resolutionDur;

  return { segments, endSecond: cursor, endSpot: resolutionEnd };
};

// Budget deterministico per episodio, per l'intera partita: nessuna seconda simulazione, solo varieta'
// visiva sotto controllo (fuorigioco 0-3, punizioni 1-3, al massimo un rigore visual-only ogni 2-3 partite).
interface EpisodeBudget { offside: number; freeKick: number; penalty: number }

const buildEpisodeBudget = (matchId: string): EpisodeBudget => ({
  offside: Math.floor(seededRatio(`${matchId}-offside-count`) * 4),
  freeKick: 1 + Math.floor(seededRatio(`${matchId}-fk-count`) * 3),
  penalty: seededRatio(`${matchId}-penalty-chance`) > 0.6 ? 1 : 0
});

// ─── Riempimento neutro: costruzione/avanzamento/pressing/blocco difensivo, con episodi occasionali
// (occasioni, punizioni, fuorigioco, raro rigore visual-only). Ritmo piu' lento e leggibile: passaggio
// corto 0.8-1.4s, passaggio progressivo 1.1-1.8s, ripartenza dopo un contrasto 3-6s. ───
const buildNeutralFillerSegments = (
  ctx: ReplayBuildContext,
  fromSecond: number,
  toSecond: number,
  possessionTeamId: 'user' | 'opponent',
  entrySpot: PitchPoint,
  seedBase: string,
  budget: EpisodeBudget
): { segments: ReplayActionSegment[]; endSpot: PitchPoint; endPossession: 'user' | 'opponent' } => {
  const segments: ReplayActionSegment[] = [];
  let cursor = fromSecond;
  let possession = possessionTeamId;
  let spot = entrySpot;
  let spellIndex = 0;
  let guard = 0;

  // Stato del possesso corrente: chi ha palla adesso, chi l'ha avuta prima (regola anti-loop A-B-A-B) e
  // quanti passaggi sono gia' stati giocati nell'ultimo terzo (massimo 2 innocui prima di una giocata decisiva).
  let carrier: Player | undefined;
  let carrierHistory: string[] = [];
  let possessionPlan: { objective: PossessionObjective; direction: 'left' | 'right'; progressionTarget: PitchPoint; maxPasses: number } | null = null;
  let finalThirdPasses = 0;

  const resetSpellState = () => {
    spellIndex = 0;
    carrier = undefined;
    carrierHistory = [];
    possessionPlan = null;
    finalThirdPasses = 0;
  };

  while (cursor < toSecond - 0.05 && guard < 240) {
    guard += 1;
    const remaining = toSecond - cursor;
    const segSeed = `${seedBase}-${Math.round(cursor * 10)}-${possession}-${spellIndex}`;

    // Un possesso normale non deve superare 4-6 passaggi, e non piu' di 2 nell'ultimo terzo, senza una
    // giocata decisiva: oltre questi limiti forziamo un episodio (tiro/cross/perdita), non un altro
    // passaggio innocuo all'infinito.
    const capReached = Boolean(possessionPlan) && (spellIndex >= (possessionPlan?.maxPasses ?? 5) || finalThirdPasses >= 2);
    const episodeGateOpen = capReached || (spellIndex > 0 && spellIndex % 3 === 0 && remaining > 6 && seededRatio(`${segSeed}-episode`) > 0.55);
    if (episodeGateOpen) {
      const kindRoll = seededRatio(`${segSeed}-episode-kind`);
      let outcome: { segments: ReplayActionSegment[]; endSecond: number; endSpot: PitchPoint };

      if (kindRoll < 0.55 || remaining < 9) {
        outcome = buildChanceSequence(ctx, segSeed, possession, spot, cursor);
      } else if (kindRoll < 0.75 && budget.freeKick > 0 && remaining > 6) {
        outcome = buildFreeKickSequence(ctx, segSeed, possession, spot, cursor);
        budget.freeKick -= 1;
      } else if (kindRoll < 0.9 && budget.offside > 0 && remaining > 3) {
        outcome = buildOffsideSequence(ctx, segSeed, possession, spot, cursor);
        budget.offside -= 1;
      } else if (budget.penalty > 0 && remaining > 8) {
        outcome = buildPenaltySequence(ctx, segSeed, possession, cursor);
        budget.penalty -= 1;
      } else {
        outcome = buildChanceSequence(ctx, segSeed, possession, spot, cursor);
      }

      segments.push(...outcome.segments);
      cursor = outcome.endSecond;
      spot = outcome.endSpot;
      possession = otherTeam(possession);
      resetSpellState();
      continue;
    }

    const defendingTeam = otherTeam(possession);
    const minute = Math.floor(cursor / 60);
    const lineup = lineupFor(ctx, possession, minute);
    const defendingLineup = lineupFor(ctx, defendingTeam, minute);
    const core = pickCore(lineup);
    const Z = ATTACK_ZONE_Y[possession];

    const turnover = spellIndex >= 3 && seededRatio(`${segSeed}-turn`) > 0.62;
    if (turnover) {
      const dur = Math.min(pickDuration(`${segSeed}-turndur`, 3, 6), remaining);
      const presser = findByRole(defendingLineup, ['DM', 'CM', 'CB']) ?? defendingLineup[0];
      const turnoverEnd: PitchPoint = {
        x: clamp(spot.x + (seededRatio(`${segSeed}-tx`) - 0.5) * 12, 12, 88),
        y: clamp(spot.y + (seededRatio(`${segSeed}-ty`) - 0.5) * 8, 12, 88)
      };
      segments.push({
        id: `${seedBase}-turn-${Math.round(cursor * 10)}`, type: 'interception', teamId: defendingTeam,
        startSecond: cursor, endSecond: cursor + dur,
        actorId: presser?.id,
        ballStart: spot, ballEnd: turnoverEnd,
        playerMovements: presser ? [{ playerId: presser.id, from: { x: spot.x - 3, y: spot.y - 3 }, to: spot }] : [],
        pressingPlayerIds: presser ? [presser.id] : [],
        phase: 'transition', isOfficialMatchEvent: false, isVisualOnly: true
      });
      cursor += dur;
      spot = turnoverEnd;
      possession = defendingTeam;
      resetSpellState();
      continue;
    }

    // Nuovo possesso: definiamo un intento tattico reale (obiettivo, direzione, bersaglio territoriale,
    // limite di passaggi) invece di generare passaggi a vuoto senza scopo.
    if (!possessionPlan) {
      const direction: 'left' | 'right' = seededRatio(`${segSeed}-dir`) < 0.5 ? 'left' : 'right';
      const objective: PossessionObjective = ctx.tactic.mentality === 'Difensiva' && seededRatio(`${segSeed}-obj`) > 0.72
        ? 'protect_lead'
        : 'build_attack';
      const progressionX = direction === 'left'
        ? clamp(50 - 22 - seededRatio(`${segSeed}-px`) * 10, 10, 40)
        : clamp(50 + 22 + seededRatio(`${segSeed}-px`) * 10, 60, 90);
      possessionPlan = {
        objective,
        direction,
        progressionTarget: { x: progressionX, y: Z.entry },
        maxPasses: 4 + Math.floor(seededRatio(`${segSeed}-mp`) * 3)
      };
      carrier = core.deep;
      carrierHistory = [];
    }

    const activePlan = possessionPlan;
    const activeCarrier = carrier ?? core.deep;
    const underPressure = ctx.tactic.pressing > 60 && spellIndex >= 2 && seededRatio(`${segSeed}-press`) > 0.55;
    const objectiveNow: PossessionObjective = underPressure ? 'escape_press' : activePlan.objective;

    const phase: ReplayPhase = spellIndex === 0
      ? 'build_up'
      : spellIndex === 1
        ? 'progression'
        : (ctx.tactic.pressing > 65 && spellIndex % 2 === 0 ? 'pressing' : 'defensive_block');

    const positionLookup = buildPositionLookup(ctx, possession, lineup);
    const candidates: ReceiverCandidate[] = lineup
      .filter(player => player.role !== 'GK' && player.id !== activeCarrier.id)
      .map(player => ({ player, position: positionLookup.get(player.id) ?? spot }));

    // Regola anti-loop (sempre attiva, nessuna eccezione): vietato ridare subito palla a chi l'ha appena
    // giocata, altrimenti si ricrea un giro a vuoto A-B-A-B. Sotto pressione (escape_press) il portatore
    // puo' comunque scegliere un'opzione piu' arretrata o laterale: e' la valutazione del passaggio (piu'
    // sotto) a tollerare un progresso negativo in quel caso, non l'esclusione anti-loop.
    const forbidden = new Set(carrierHistory.length ? [carrierHistory[carrierHistory.length - 1]] : []);

    const receiver = pickNextReceiver(candidates, spot, activePlan.progressionTarget, forbidden, segSeed, objectiveNow === 'escape_press')
      ?? candidates.find(candidate => !forbidden.has(candidate.player.id))
      ?? candidates[0];

    const progressed = distanceBetween(spot, activePlan.progressionTarget) - distanceBetween(receiver.position, activePlan.progressionTarget);
    const passType: ReplayActionType = progressed > 4 ? 'progressive_pass' : 'short_pass';
    const durRange: [number, number] = passType === 'short_pass' ? [0.8, 1.4] : [1.1, 1.8];
    const dur = clamp(Math.min(pickDuration(`${segSeed}-dur`, durRange[0], durRange[1]), remaining), 0.4, 1.8);
    const pressers = phase === 'pressing'
      ? defendingLineup.filter(player => ['CB', 'DM', 'CM', 'ST', 'LW', 'RW'].includes(player.role)).slice(0, 3).map(player => player.id)
      : [];

    segments.push({
      id: `${seedBase}-flow-${Math.round(cursor * 10)}`,
      type: passType,
      teamId: possession, startSecond: cursor, endSecond: cursor + dur,
      actorId: activeCarrier.id, targetPlayerId: receiver.player.id,
      ballStart: spot, ballEnd: receiver.position,
      playerMovements: buildActorTarget(spot, receiver.position, activeCarrier, receiver.player),
      pressingPlayerIds: pressers,
      phase, isOfficialMatchEvent: false, isVisualOnly: true
    });

    const enteredFinalThird = possession === 'user' ? receiver.position.y < Z.entry : receiver.position.y > Z.entry;
    if (enteredFinalThird) finalThirdPasses += 1;

    cursor += dur;
    spot = receiver.position;
    carrierHistory.push(activeCarrier.id);
    carrier = receiver.player;
    spellIndex += 1;
  }

  if (cursor < toSecond) {
    segments.push({
      id: `${seedBase}-hold`, type: 'interception', teamId: possession,
      startSecond: cursor, endSecond: toSecond,
      ballStart: spot, ballEnd: spot, playerMovements: [], phase: 'defensive_block',
      isOfficialMatchEvent: false, isVisualOnly: true
    });
  }

  return { segments, endSpot: spot, endPossession: possession };
};

// ─── Orchestratore: riserva le finestre per gol/cartellini reali e riempie il resto con sequenze neutre ───
const buildActionSegments = (ctx: ReplayBuildContext): ReplayActionSegment[] => {
  interface ReservedWindow { start: number; end: number; segments: ReplayActionSegment[] }
  const windows: ReservedWindow[] = [];

  ctx.events.forEach((event, index) => {
    if (event.type === 'goal') {
      const eventId = matchEventKey(ctx.matchId, event, index);
      const climax = clamp(event.minute * 60, 0, ctx.durationSeconds);
      const segs = buildGoalSequence(ctx, event, eventId, climax);
      if (segs.length) windows.push({ start: segs[0].startSecond, end: segs[segs.length - 1].endSecond, segments: segs });
    } else if (event.type === 'card_yellow' || event.type === 'card_red') {
      const eventId = matchEventKey(ctx.matchId, event, index);
      const climax = clamp(event.minute * 60, 0, ctx.durationSeconds);
      const segs = buildCardSequence(ctx, event, eventId, climax);
      if (segs.length) windows.push({ start: segs[0].startSecond, end: climax, segments: segs });
    }
  });

  windows.sort((a, b) => a.start - b.start);
  for (let i = 1; i < windows.length; i += 1) {
    if (windows[i].start < windows[i - 1].end) {
      const shift = windows[i - 1].end - windows[i].start;
      windows[i] = {
        start: windows[i].start + shift,
        end: windows[i].end + shift,
        segments: windows[i].segments.map(segment => ({ ...segment, startSecond: segment.startSecond + shift, endSecond: segment.endSecond + shift }))
      };
    }
  }

  const episodeBudget = buildEpisodeBudget(ctx.matchId);
  const allSegments: ReplayActionSegment[] = [];
  let cursor = 0;
  let possessionTeamId: 'user' | 'opponent' = seededRatio(`${ctx.matchId}-start`) >= 0.5 ? 'user' : 'opponent';
  let ballSpot: PitchPoint = { x: 50, y: 50 };

  windows.forEach(window => {
    if (window.start > cursor) {
      const filler = buildNeutralFillerSegments(ctx, cursor, window.start, possessionTeamId, ballSpot, `${ctx.matchId}-fill-${Math.round(cursor)}`, episodeBudget);
      allSegments.push(...filler.segments);
      possessionTeamId = filler.endPossession;
      ballSpot = filler.endSpot;
    }
    allSegments.push(...window.segments);
    const last = window.segments[window.segments.length - 1];
    if (last) {
      ballSpot = last.ballEnd;
      possessionTeamId = last.type === 'goal' ? otherTeam(last.teamId) : last.teamId;
    }
    cursor = Math.max(cursor, window.end);
  });

  if (cursor < ctx.durationSeconds) {
    const filler = buildNeutralFillerSegments(ctx, cursor, ctx.durationSeconds, possessionTeamId, ballSpot, `${ctx.matchId}-fill-tail`, episodeBudget);
    allSegments.push(...filler.segments);
  }

  return allSegments.length
    ? allSegments
    : buildNeutralFillerSegments(ctx, 0, ctx.durationSeconds, possessionTeamId, ballSpot, `${ctx.matchId}-fill-only`, episodeBudget).segments;
};

// Wrapper "di comodo" che espongono le due categorie di sorgente dati separatamente (utili anche in isolamento):
// segmenti derivati da eventi reali del motore, oppure sequenze visive sintetiche per l'intera durata.
export const createReplaySequencesFromMatchEvents = (ctx: ReplayBuildContext): ReplayActionSegment[] => {
  const segments: ReplayActionSegment[] = [];
  ctx.events.forEach((event, index) => {
    const eventId = matchEventKey(ctx.matchId, event, index);
    const climax = clamp(event.minute * 60, 0, ctx.durationSeconds);
    if (event.type === 'goal') segments.push(...buildGoalSequence(ctx, event, eventId, climax));
    else if (event.type === 'card_yellow' || event.type === 'card_red') segments.push(...buildCardSequence(ctx, event, eventId, climax));
  });
  return segments;
};

export const createSyntheticVisualSequences = (ctx: ReplayBuildContext): ReplayActionSegment[] => {
  const startPossession: 'user' | 'opponent' = seededRatio(`${ctx.matchId}-syn-start`) >= 0.5 ? 'user' : 'opponent';
  const budget = buildEpisodeBudget(`${ctx.matchId}-syn`);
  return buildNeutralFillerSegments(ctx, 0, ctx.durationSeconds, startPossession, { x: 50, y: 50 }, `${ctx.matchId}-synthetic`, budget).segments;
};

// ─── Materializzazione: converte i segmenti concatenati in keyframe (ReplayFrame) per il renderer ───
const keyframeFromSegment = (
  ctx: ReplayBuildContext,
  segment: ReplayActionSegment,
  endpoint: 'from' | 'to' | number,
  atSecond: number
): ReplayFrame => {
  const isMid = typeof endpoint === 'number';
  const minute = Math.floor(atSecond / 60);
  const ambient = buildAmbientPlayers(ctx, minute, segment.phase, segment.teamId, `${segment.id}-${isMid ? 'mid' : endpoint}`);

  const overrides = new Map<string, PitchPoint>();
  segment.playerMovements.forEach(movement => {
    if (endpoint === 'from') overrides.set(movement.playerId, movement.from);
    else if (endpoint === 'to') overrides.set(movement.playerId, movement.to);
    else overrides.set(movement.playerId, { x: lerp(movement.from.x, movement.to.x, endpoint), y: lerp(movement.from.y, movement.to.y, endpoint) });
  });

  let ballPos: PitchPoint;
  if (endpoint === 'from') ballPos = segment.ballStart;
  else if (endpoint === 'to') ballPos = segment.ballEnd;
  else {
    ballPos = segment.ballControlPoint
      ? quadraticBezierPoint(segment.ballStart, segment.ballControlPoint, segment.ballEnd, endpoint)
      : { x: lerp(segment.ballStart.x, segment.ballEnd.x, endpoint), y: lerp(segment.ballStart.y, segment.ballEnd.y, endpoint) };
  }

  const ballCarrierId = endpoint === 'from' ? segment.actorId : (segment.targetPlayerId ?? segment.actorId);
  const highlightIds = segment.type === 'goal' && endpoint !== 'from' && segment.actorId ? [segment.actorId] : [];

  const players: ReplayPlayerState[] = ambient.map(player => ({
    ...player,
    position: overrides.get(player.playerId) ?? player.position,
    isBallCarrier: player.playerId === ballCarrierId,
    isPressing: (segment.pressingPlayerIds ?? []).includes(player.playerId),
    isHighlighted: highlightIds.includes(player.playerId)
  }));

  return {
    id: `${segment.id}-${isMid ? 'mid' : endpoint}`,
    startSecond: atSecond,
    endSecond: atSecond, // corretto subito dopo in materializeSegments (tiling continuo)
    minute,
    phase: segment.phase,
    possessionTeamId: segment.teamId,
    ball: ballPos,
    ballCarrierId,
    players,
    passFromPlayerId: PASS_LIKE.includes(segment.type) ? segment.actorId : undefined,
    passToPlayerId: PASS_LIKE.includes(segment.type) ? segment.targetPlayerId : undefined,
    defensiveLine: computeDefensiveLine(ctx, segment.teamId, segment.phase),
    eventLabel: endpoint === 'to' ? segment.eventLabel : undefined,
    relatedMatchEventId: segment.relatedMatchEventId,
    actionType: segment.type,
    isOfficialMatchEvent: segment.isOfficialMatchEvent
  };
};

const materializeSegments = (ctx: ReplayBuildContext, segments: ReplayActionSegment[]): ReplayFrame[] => {
  if (segments.length === 0) return [];
  const frames: ReplayFrame[] = [keyframeFromSegment(ctx, segments[0], 'from', segments[0].startSecond)];
  let previousRelatedId = segments[0].relatedMatchEventId;

  segments.forEach((segment, index) => {
    // Un nuovo episodio (gol/cartellino/occasione/punizione/rigore/fuorigioco) inizia qui: serve un frame
    // esplicito al suo vero startSecond, altrimenti il "vero inizio" resterebbe visibile solo a partire
    // dalla fine del primo segmento (il click sulla timeline atterrerebbe a meta' azione, non all'inizio).
    if (index > 0 && segment.relatedMatchEventId !== previousRelatedId) {
      frames.push(keyframeFromSegment(ctx, segment, 'from', segment.startSecond));
    }
    if ((segment.type === 'cross' || segment.type === 'free_kick_cross') && segment.ballControlPoint) {
      const mid = segment.startSecond + (segment.endSecond - segment.startSecond) * 0.5;
      frames.push(keyframeFromSegment(ctx, segment, 0.5, mid));
    }
    frames.push(keyframeFromSegment(ctx, segment, 'to', segment.endSecond));
    previousRelatedId = segment.relatedMatchEventId;
  });

  // endSecond di ogni frame = startSecond del successivo: tiling continuo richiesto da interpolateReplayFrame,
  // senza il quale un frame "istantaneo" veniva saltato dalla ricerca del bracket (bug del gol a centrocampo).
  for (let i = 0; i < frames.length - 1; i += 1) {
    frames[i].endSecond = frames[i + 1].startSecond;
  }
  return frames;
};

const applySecondHalfFlip = (frame: ReplayFrame, durationSeconds: number): ReplayFrame => {
  if (frame.startSecond < durationSeconds / 2) return frame;
  const flipPoint = (point: PitchPoint): PitchPoint => ({ x: point.x, y: 100 - point.y });
  return {
    ...frame,
    ball: flipPoint(frame.ball),
    defensiveLine: frame.defensiveLine !== undefined ? 100 - frame.defensiveLine : undefined,
    players: frame.players.map(player => ({ ...player, position: flipPoint(player.position) }))
  };
};

export interface MatchReplayInput {
  matchId: string;
  tactic: Tactic;
  opponentModule: Tactic['module'];
  userLineup: Player[];
  opponentLineup: Player[];
  userSquad: Player[];
  opponentSquad: Player[];
  events: MatchEvent[];
  durationMinutes: number;
}

export const buildMatchReplay = (input: MatchReplayInput): MatchReplay => {
  const durationSeconds = Math.max(1, Math.round(input.durationMinutes)) * 60;
  const userSubs = resolveSubstitutionDirectives(input.events, 'user', input.userSquad);
  const opponentSubs = resolveSubstitutionDirectives(input.events, 'opponent', input.opponentSquad);

  const ctx: ReplayBuildContext = {
    matchId: input.matchId,
    tactic: input.tactic,
    opponentModule: input.opponentModule,
    userLineup: input.userLineup,
    opponentLineup: input.opponentLineup,
    userSquad: input.userSquad,
    opponentSquad: input.opponentSquad,
    events: input.events,
    durationSeconds,
    userSubs,
    opponentSubs
  };

  const segments = buildActionSegments(ctx);
  const frames = materializeSegments(ctx, segments).map(frame => applySecondHalfFlip(frame, durationSeconds));

  return { matchId: input.matchId, durationSeconds, frames };
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

// Restituisce un frame "vivo" interpolato al secondo richiesto: usato dal renderer ad ogni tick di animazione.
// Funzione pura: chiamarla piu' volte con lo stesso secondo (restart, click timeline) da' sempre lo stesso
// risultato, senza duplicare o alterare alcun evento.
export const interpolateReplayFrame = (frames: ReplayFrame[], currentSecond: number): ReplayFrame | null => {
  if (frames.length === 0) return null;
  const clamped = clamp(currentSecond, frames[0].startSecond, frames[frames.length - 1].endSecond);

  let index = frames.findIndex(frame => clamped < frame.endSecond);
  if (index === -1) index = frames.length - 1;
  const frameA = frames[index];
  const frameB = frames[Math.min(index + 1, frames.length - 1)];

  if (frameA === frameB || frameB.startSecond <= frameA.startSecond) return frameA;

  const span = frameB.startSecond - frameA.startSecond;
  const rawT = span > 0 ? clamp((clamped - frameA.startSecond) / span, 0, 1) : 1;
  const t = smoothstep(rawT);
  const ballT = clamp(rawT * 1.15, 0, 1); // la palla e' leggermente piu' "veloce" dei giocatori

  const idsA = new Set(frameA.players.map(p => p.playerId));
  const idsB = new Set(frameB.players.map(p => p.playerId));
  const sameRoster = idsA.size === idsB.size && [...idsA].every(id => idsB.has(id));

  if (!sameRoster) {
    // Una sostituzione e' un cambio discreto: niente cross-fade tra rose diverse, solo un taglio netto a meta' strada.
    return rawT < 0.5 ? frameA : { ...frameB, startSecond: clamped, endSecond: clamped };
  }

  const byIdB = new Map(frameB.players.map(p => [p.playerId, p]));
  const players: ReplayPlayerState[] = frameA.players.map(playerA => {
    const playerB = byIdB.get(playerA.playerId) ?? playerA;
    return {
      ...(t < 0.5 ? playerA : playerB),
      position: {
        x: lerp(playerA.position.x, playerB.position.x, t),
        y: lerp(playerA.position.y, playerB.position.y, t)
      }
    };
  });

  return {
    ...(rawT < 0.5 ? frameA : frameB),
    id: `${frameA.id}-interp`,
    startSecond: clamped,
    endSecond: clamped,
    ball: {
      x: lerp(frameA.ball.x, frameB.ball.x, ballT),
      y: lerp(frameA.ball.y, frameB.ball.y, ballT)
    },
    players
  };
};

export interface ReplayTimelineMarker {
  id: string;
  minute: number;
  actionStartSecond: number;
  team: 'user' | 'opponent';
  kind: 'goal' | 'card' | 'substitution' | 'shot' | 'cross' | 'save' | 'offside' | 'free_kick' | 'penalty';
  label: string;
  isVisualOnly: boolean;
}

const classifyMarkerKind = (actionType?: ReplayActionType): ReplayTimelineMarker['kind'] => {
  switch (actionType) {
    case 'goal': return 'goal';
    case 'tackle': return 'card';
    case 'cross': case 'free_kick_cross': return 'cross';
    case 'save': case 'clearance': case 'penalty_save': return 'save';
    case 'offside': return 'offside';
    case 'foul': case 'free_kick': case 'free_kick_shot': return 'free_kick';
    case 'penalty_awarded': case 'penalty_shot': case 'penalty_missed': return 'penalty';
    default: return 'shot';
  }
};

// Timeline compatta: gli eventi ufficiali (gol, cartellini, cambi) sono sempre inclusi; gli episodi
// visivi (tiri, cross, parate, fuorigioco, punizioni, rigori sintetici) riempiono gli spazi restanti,
// mai un evento reale ufficiale ne resta escluso per fare posto a un episodio di solo colore.
export const buildTimelineMarkers = (matchId: string, events: MatchEvent[], replay: MatchReplay, maxCount = 16): ReplayTimelineMarker[] => {
  const groups = new Map<string, { minSecond: number; labelFrame?: ReplayFrame }>();
  replay.frames.forEach(frame => {
    if (!frame.relatedMatchEventId) return;
    const group = groups.get(frame.relatedMatchEventId) ?? { minSecond: frame.startSecond };
    group.minSecond = Math.min(group.minSecond, frame.startSecond);
    if (frame.eventLabel && (!group.labelFrame || frame.startSecond < group.labelFrame.startSecond)) group.labelFrame = frame;
    groups.set(frame.relatedMatchEventId, group);
  });

  const official: ReplayTimelineMarker[] = [];
  const visual: ReplayTimelineMarker[] = [];
  groups.forEach((group, id) => {
    if (!group.labelFrame) return;
    const marker: ReplayTimelineMarker = {
      id,
      minute: group.labelFrame.minute,
      actionStartSecond: group.minSecond,
      team: group.labelFrame.possessionTeamId ?? 'user',
      kind: classifyMarkerKind(group.labelFrame.actionType),
      label: group.labelFrame.eventLabel!,
      isVisualOnly: !group.labelFrame.isOfficialMatchEvent
    };
    (marker.isVisualOnly ? visual : official).push(marker);
  });

  events.forEach((event, index) => {
    if (event.type !== 'substitution') return;
    official.push({
      id: matchEventKey(matchId, event, index),
      minute: event.minute,
      actionStartSecond: clamp(event.minute * 60, 0, replay.durationSeconds),
      team: event.team,
      kind: 'substitution',
      label: event.description,
      isVisualOnly: false
    });
  });

  const visualBudget = Math.max(0, maxCount - official.length);
  const cappedVisual = visual.sort((a, b) => a.actionStartSecond - b.actionStartSecond).slice(0, visualBudget);

  return [...official, ...cappedVisual].sort((a, b) => a.actionStartSecond - b.actionStartSecond);
};
