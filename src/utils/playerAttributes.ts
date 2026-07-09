import { Player, PlayerRole } from '../types';

// ─── Schema canonico degli attributi per famiglia di ruolo ───
// Stessa griglia (numero, ordine, significato) per ogni giocatore della stessa famiglia. Un
// attributo mancante viene derivato in modo deterministico (mai Math.random, mai rigenerato in
// modo diverso a ogni render): stessa fonte -> stesso risultato, sempre.

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000003;
  }
  return hash / 1000003;
};

type AttributeFamily = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'WG' | 'ST';

// Riusa le famiglie di ruolo gia' esistenti nel progetto (PlayerRole): nessun ruolo parallelo.
const FAMILY_BY_ROLE: Record<PlayerRole, AttributeFamily> = {
  GK: 'GK',
  CB: 'CB',
  LB: 'FB',
  RB: 'FB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  LW: 'WG',
  RW: 'WG',
  ST: 'ST'
};

interface AttributeSlot {
  key: string;
  label: string;
  // varianti di etichetta gia' presenti nei dati reali (realClubRosters2025.ts), in ordine di
  // preferenza: la prima trovata su player.attributes viene conservata cosi' com'e'.
  aliases: string[];
  physical?: boolean; // riceve un piccolo aggiustamento in base all'eta' quando derivato
  isOverall?: boolean; // usa sempre e solo player.overall, mai un valore derivato o duplicato
}

const overallSlot: AttributeSlot = { key: 'overall', label: 'Overall', aliases: [], isOverall: true };

const SCHEMAS: Record<AttributeFamily, AttributeSlot[]> = {
  GK: [
    overallSlot,
    { key: 'reflexes', label: 'Riflessi', aliases: ['Riflessi'], physical: true },
    { key: 'handling', label: 'Presa', aliases: ['Presa'] },
    { key: 'kicking', label: 'Rinvio', aliases: ['Rinvio', 'Rinvii'] },
    { key: 'positioning', label: 'Posizionamento', aliases: ['Posizionamento', 'Piazzamento'] },
    { key: 'aerialControl', label: 'Presa alta', aliases: ['Presa alta', 'Gioco aereo', 'Palle alte'] },
    { key: 'commandOfArea', label: 'Comando area', aliases: ['Comando area', 'Comando difesa'] },
    { key: 'sweeperKeeper', label: 'Libero', aliases: ['Libero'] },
    { key: 'oneOnOne', label: 'Uno contro uno', aliases: ['Uno contro uno', '1 contro 1', 'Duello 1v1'] },
    { key: 'penalties', label: 'Rigori', aliases: ['Rigori'] },
    { key: 'throwing', label: 'Rilanci con le mani', aliases: ['Rilanci con le mani'] }
  ],
  CB: [
    overallSlot,
    { key: 'marking', label: 'Marcatura', aliases: ['Marcatura'] },
    { key: 'tackling', label: 'Contrasti', aliases: ['Contrasti'] },
    { key: 'positioning', label: 'Posizionamento difensivo', aliases: ['Posizionamento difensivo', 'Posizionamento dif.', 'Posizionamento'] },
    { key: 'heading', label: 'Colpo di testa', aliases: ['Colpo di testa'], physical: true },
    { key: 'strength', label: 'Forza', aliases: ['Forza'], physical: true },
    { key: 'pace', label: 'Velocità', aliases: ['Velocità', 'Rapidità'], physical: true },
    { key: 'jumping', label: 'Elevazione', aliases: ['Elevazione', 'Salto'], physical: true },
    { key: 'anticipation', label: 'Anticipo', aliases: ['Anticipo', 'Anticipazione'] },
    { key: 'composure', label: 'Calma', aliases: ['Calma', 'Equilibrio'] },
    { key: 'passing', label: 'Passaggio corto', aliases: ['Passaggio corto', 'Gioco con i piedi'] }
  ],
  FB: [
    overallSlot,
    { key: 'pace', label: 'Velocità', aliases: ['Velocità', 'Accelerazione'], physical: true },
    { key: 'stamina', label: 'Resistenza', aliases: ['Resistenza'], physical: true },
    { key: 'tackling', label: 'Contrasti', aliases: ['Contrasti'] },
    { key: 'marking', label: 'Marcatura', aliases: ['Marcatura'] },
    { key: 'crossing', label: 'Cross', aliases: ['Cross'] },
    { key: 'positioning', label: 'Posizionamento difensivo', aliases: ['Posizionamento difensivo', 'Posizionamento dif.', 'Posizionamento'] },
    { key: 'passing', label: 'Passaggio corto', aliases: ['Passaggio corto'] },
    { key: 'dribbling', label: 'Dribbling', aliases: ['Dribbling'] },
    { key: 'workRate', label: 'Lavoro di squadra', aliases: ['Lavoro di squadra', 'Pressing'] }
  ],
  DM: [
    overallSlot,
    { key: 'tackling', label: 'Contrasti', aliases: ['Contrasti'] },
    { key: 'interceptions', label: 'Intercettazioni', aliases: ['Intercettazioni', 'Recupero palla'] },
    { key: 'positioning', label: 'Posizionamento difensivo', aliases: ['Posizionamento difensivo', 'Posizionamento dif.', 'Posizionamento'] },
    { key: 'passing', label: 'Passaggio corto', aliases: ['Passaggio corto'] },
    { key: 'longPassing', label: 'Passaggio lungo', aliases: ['Passaggio lungo', 'Lancio lungo'] },
    { key: 'stamina', label: 'Resistenza', aliases: ['Resistenza'], physical: true },
    { key: 'strength', label: 'Forza', aliases: ['Forza'], physical: true },
    { key: 'composure', label: 'Calma', aliases: ['Calma', 'Equilibrio'] },
    { key: 'vision', label: 'Visione', aliases: ['Visione'] }
  ],
  CM: [
    overallSlot,
    { key: 'passing', label: 'Passaggio corto', aliases: ['Passaggio corto'] },
    { key: 'longPassing', label: 'Passaggio lungo', aliases: ['Passaggio lungo', 'Lancio lungo'] },
    { key: 'vision', label: 'Visione', aliases: ['Visione'] },
    { key: 'stamina', label: 'Resistenza', aliases: ['Resistenza'], physical: true },
    { key: 'dribbling', label: 'Dribbling', aliases: ['Dribbling'] },
    { key: 'workRate', label: 'Lavoro di squadra', aliases: ['Lavoro di squadra', 'Pressing'] },
    { key: 'tackling', label: 'Contrasti', aliases: ['Contrasti'] },
    { key: 'shooting', label: 'Tiro da lontano', aliases: ['Tiro da lontano', 'Potenza tiro'] },
    { key: 'technique', label: 'Tecnica', aliases: ['Tecnica'] }
  ],
  AM: [
    overallSlot,
    { key: 'vision', label: 'Visione', aliases: ['Visione'] },
    { key: 'passing', label: 'Passaggio corto', aliases: ['Passaggio corto'] },
    { key: 'dribbling', label: 'Dribbling', aliases: ['Dribbling'] },
    { key: 'technique', label: 'Tecnica', aliases: ['Tecnica'] },
    { key: 'creativity', label: 'Estro', aliases: ['Estro'] },
    { key: 'finishing', label: 'Finalizzazione', aliases: ['Finalizzazione'] },
    { key: 'shooting', label: 'Tiro da lontano', aliases: ['Tiro da lontano', 'Potenza tiro'] },
    { key: 'firstTouch', label: 'Primo controllo', aliases: ['Primo controllo', 'Controllo palla'] },
    { key: 'decisionMaking', label: 'Decisioni', aliases: ['Decisioni'] }
  ],
  WG: [
    overallSlot,
    { key: 'pace', label: 'Velocità', aliases: ['Velocità', 'Accelerazione'], physical: true },
    { key: 'dribbling', label: 'Dribbling', aliases: ['Dribbling'] },
    { key: 'crossing', label: 'Cross', aliases: ['Cross'] },
    { key: 'finishing', label: 'Finalizzazione', aliases: ['Finalizzazione'] },
    { key: 'technique', label: 'Tecnica', aliases: ['Tecnica'] },
    { key: 'agility', label: 'Agilità', aliases: ['Agilità'], physical: true },
    { key: 'offBallMovement', label: 'Movimento senza palla', aliases: ['Movimento senza palla', 'Movimenti off.'] },
    { key: 'passing', label: 'Passaggio corto', aliases: ['Passaggio corto'] },
    { key: 'composure', label: 'Calma', aliases: ['Calma', 'Equilibrio'] }
  ],
  ST: [
    overallSlot,
    { key: 'finishing', label: 'Finalizzazione', aliases: ['Finalizzazione'] },
    { key: 'heading', label: 'Colpo di testa', aliases: ['Colpo di testa'], physical: true },
    { key: 'pace', label: 'Velocità', aliases: ['Velocità', 'Accelerazione'], physical: true },
    { key: 'strength', label: 'Forza', aliases: ['Forza'], physical: true },
    { key: 'positioning', label: 'Posizionamento offensivo', aliases: ['Pos. offensivo', 'Posizionamento'] },
    { key: 'dribbling', label: 'Dribbling', aliases: ['Dribbling'] },
    { key: 'firstTouch', label: 'Primo controllo', aliases: ['Primo controllo', 'Controllo palla'] },
    { key: 'composure', label: 'Calma', aliases: ['Calma', 'Equilibrio'] },
    { key: 'longShots', label: 'Tiro da lontano', aliases: ['Tiro da lontano', 'Potenza tiro'] }
  ]
};

export const getAttributeSchema = (role: PlayerRole): AttributeSlot[] => SCHEMAS[FAMILY_BY_ROLE[role] ?? 'CM'];

const findExistingValue = (raw: Record<string, unknown> | undefined, slot: AttributeSlot): number | null => {
  if (!raw) return null;
  for (const alias of slot.aliases) {
    const value = raw[alias];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(clamp(value, 0, 100));
  }
  return null;
};

// Piccolo aggiustamento prudente per eta' su attributi fisici, mai un salto arbitrario.
const ageAdjustment = (age: number): number => (
  age <= 23 ? 2 : age <= 29 ? 0 : age <= 32 ? -2 : -5
);

// Deriva un valore mancante da overall/attributi gia' noti/ruolo/eta'/playerId (seed stabile):
// mai piu' alto del prudente, mai casuale (nessun Math.random, nessuna rigenerazione diversa).
const deriveAttributeValue = (player: Player, slot: AttributeSlot, anchor: number): number => {
  const seed = `${player.id}-attr-${slot.key}`;
  const noise = Math.round((hashRatio(seed) - 0.5) * 12); // +-6, prudente
  const physicalAdjustment = slot.physical ? ageAdjustment(player.age) : 0;
  return Math.round(clamp(anchor + noise + physicalAdjustment, 25, 97));
};

export interface DisplayAttribute {
  key: string;
  label: string;
  val: number;
}

// Griglia completa e ordinata per il ruolo del giocatore: stessa struttura per tutti i giocatori
// della stessa famiglia, valori sempre 0-100, nessun duplicato, nessun campo nascosto per undefined.
export const getPlayerRoleAttributes = (player: Player): DisplayAttribute[] => {
  const schema = getAttributeSchema(player.role);
  const raw = player.attributes as Record<string, unknown> | undefined;
  const overall = Math.round(clamp(player.overall, 0, 100));

  const knownValues = schema
    .filter(slot => !slot.isOverall)
    .map(slot => findExistingValue(raw, slot))
    .filter((value): value is number => value !== null);
  const anchor = knownValues.length
    ? Math.round(knownValues.reduce((sum, value) => sum + value, 0) / knownValues.length)
    : overall;

  return schema.map(slot => {
    if (slot.isOverall) return { key: slot.key, label: slot.label, val: overall };
    const existing = findExistingValue(raw, slot);
    const val = existing !== null ? existing : deriveAttributeValue(player, slot, anchor);
    return { key: slot.key, label: slot.label, val };
  });
};
