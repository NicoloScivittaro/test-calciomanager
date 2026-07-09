// ─── Serie B 2025/26 — dati di club ───
//
// Identità dei club (nome, città, stadio, colori storici) basata su conoscenza generale
// pubblica e ampiamente documentata dei club reali di Serie B — NON è un fetch da fonte
// ufficiale live e va considerata "local_verified" (vedi serieBSourceManifest.ts).
//
// Il set di 20 club è stato scelto dall'utente per evitare doppioni con i club di Serie A
// già presenti nel progetto (Frosinone, Monza e Venezia sono Serie A in questo universo di
// gioco, quindi non possono comparire anche in Serie B).
//
// Budget, valore, reputazione, obiettivo, pressione e "difficulty" sono ESPLICITAMENTE dati
// di gioco CalcioManager (bilanciati per tier di forza), non dati ufficiali o economici reali.

import { ClubProfile } from '../types';

export type SerieBStrengthTier = 'ex_serie_a' | 'strong' | 'mid' | 'promoted';

type SerieBClubSeed = {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  city: string;
  stadium: string;
  stadiumCapacity: number;
  primaryColor: string;
  secondaryColor: string;
  highlight: string;
  tier: SerieBStrengthTier;
  note: string; // motivo di ingresso in Serie B (retrocessione, permanenza, promozione dalla C)
};

const TIER_ECONOMY: Record<SerieBStrengthTier, { budget: number; clubValue: number; pressure: number; objective: string; boardPromise: string; difficulty: ClubProfile['difficulty'] }> = {
  ex_serie_a: {
    budget: 9000000,
    clubValue: 42000000,
    pressure: 68,
    objective: 'Tornare subito in Serie A',
    boardPromise: 'La proprietà chiede una promozione immediata dopo la retrocessione.',
    difficulty: 'Media',
  },
  strong: {
    budget: 6000000,
    clubValue: 28000000,
    pressure: 60,
    objective: 'Lottare per i playoff promozione',
    boardPromise: 'La proprietà vuole un campionato da protagonista.',
    difficulty: 'Media',
  },
  mid: {
    budget: 3800000,
    clubValue: 16000000,
    pressure: 48,
    objective: 'Salvezza tranquilla, playoff come bonus',
    boardPromise: 'La proprietà chiede stabilità e un progetto sostenibile.',
    difficulty: 'Difficile',
  },
  promoted: {
    budget: 2400000,
    clubValue: 9000000,
    pressure: 42,
    objective: 'Salvezza',
    boardPromise: 'La proprietà considera già un successo la permanenza in categoria.',
    difficulty: 'Difficile',
  },
};

const SERIE_B_CLUB_SEEDS: SerieBClubSeed[] = [
  { id: 'sb_cremonese', name: 'Cremonese', shortName: 'Cremonese', initials: 'CRE', city: 'Cremona', stadium: 'Stadio Giovanni Zini', stadiumCapacity: 15500, primaryColor: '#7A1F2B', secondaryColor: '#B0B7BC', highlight: '#7A1F2B', tier: 'ex_serie_a', note: 'Retrocessa dalla Serie A' },
  { id: 'sb_verona', name: 'Hellas Verona', shortName: 'Verona', initials: 'VER', city: 'Verona', stadium: 'Stadio Marcantonio Bentegodi', stadiumCapacity: 31000, primaryColor: '#F2D027', secondaryColor: '#1C4E9C', highlight: '#F2D027', tier: 'ex_serie_a', note: 'Retrocessa dalla Serie A' },
  { id: 'sb_pisa', name: 'Pisa', shortName: 'Pisa', initials: 'PIS', city: 'Pisa', stadium: 'Arena Garibaldi - Stadio Romeo Anconetani', stadiumCapacity: 8800, primaryColor: '#0B2C4A', secondaryColor: '#FFFFFF', highlight: '#0B2C4A', tier: 'ex_serie_a', note: 'Retrocessa dalla Serie A' },
  { id: 'sb_avellino', name: 'Avellino', shortName: 'Avellino', initials: 'AVE', city: 'Avellino', stadium: 'Stadio Partenio-Lombardi', stadiumCapacity: 25000, primaryColor: '#00843D', secondaryColor: '#FFFFFF', highlight: '#00843D', tier: 'mid', note: 'Confermata in Serie B' },
  { id: 'sb_carrarese', name: 'Carrarese', shortName: 'Carrarese', initials: 'CAR', city: 'Carrara', stadium: 'Stadio dei Marmi', stadiumCapacity: 4000, primaryColor: '#1C4E9C', secondaryColor: '#87CEEB', highlight: '#1C4E9C', tier: 'mid', note: 'Confermata in Serie B' },
  { id: 'sb_catanzaro', name: 'Catanzaro', shortName: 'Catanzaro', initials: 'CAT', city: 'Catanzaro', stadium: 'Stadio Nicola Ceravolo', stadiumCapacity: 14000, primaryColor: '#F2C51D', secondaryColor: '#B5121B', highlight: '#F2C51D', tier: 'strong', note: 'Perdente finale playoff' },
  { id: 'sb_cesena', name: 'Cesena', shortName: 'Cesena', initials: 'CES', city: 'Cesena', stadium: 'Stadio Dino Manuzzi', stadiumCapacity: 23000, primaryColor: '#FFFFFF', secondaryColor: '#000000', highlight: '#000000', tier: 'strong', note: 'Confermata in Serie B' },
  { id: 'sb_empoli', name: 'Empoli', shortName: 'Empoli', initials: 'EMP', city: 'Empoli', stadium: 'Stadio Carlo Castellani', stadiumCapacity: 16000, primaryColor: '#1C4E9C', secondaryColor: '#FFFFFF', highlight: '#1C4E9C', tier: 'strong', note: 'Confermata in Serie B' },
  { id: 'sb_entella', name: 'Virtus Entella', shortName: 'Entella', initials: 'ENT', city: 'Chiavari', stadium: 'Stadio Comunale di Chiavari', stadiumCapacity: 4000, primaryColor: '#1C4E9C', secondaryColor: '#FFFFFF', highlight: '#1C4E9C', tier: 'mid', note: 'Confermata in Serie B' },
  { id: 'sb_juvestabia', name: 'Juve Stabia', shortName: 'Juve Stabia', initials: 'JUV', city: 'Castellammare di Stabia', stadium: 'Stadio Romeo Menti', stadiumCapacity: 7500, primaryColor: '#F2C51D', secondaryColor: '#1C4E9C', highlight: '#F2C51D', tier: 'mid', note: 'Confermata in Serie B' },
  { id: 'sb_mantova', name: 'Mantova', shortName: 'Mantova', initials: 'MAN', city: 'Mantova', stadium: 'Stadio Danilo Martelli', stadiumCapacity: 7000, primaryColor: '#B5121B', secondaryColor: '#FFFFFF', highlight: '#B5121B', tier: 'mid', note: 'Confermata in Serie B' },
  { id: 'sb_modena', name: 'Modena', shortName: 'Modena', initials: 'MOD', city: 'Modena', stadium: 'Stadio Alberto Braglia', stadiumCapacity: 20000, primaryColor: '#F2C51D', secondaryColor: '#1C4E9C', highlight: '#F2C51D', tier: 'strong', note: 'Confermata in Serie B' },
  { id: 'sb_padova', name: 'Padova', shortName: 'Padova', initials: 'PAD', city: 'Padova', stadium: 'Stadio Euganeo', stadiumCapacity: 32000, primaryColor: '#FFFFFF', secondaryColor: '#000000', highlight: '#000000', tier: 'mid', note: 'Confermata in Serie B' },
  { id: 'sb_palermo', name: 'Palermo', shortName: 'Palermo', initials: 'PAL', city: 'Palermo', stadium: 'Stadio Renzo Barbera', stadiumCapacity: 36000, primaryColor: '#F286A1', secondaryColor: '#000000', highlight: '#F286A1', tier: 'strong', note: 'Confermata in Serie B' },
  { id: 'sb_sampdoria', name: 'Sampdoria', shortName: 'Sampdoria', initials: 'SAM', city: 'Genova', stadium: 'Stadio Luigi Ferraris', stadiumCapacity: 36600, primaryColor: '#1C4E9C', secondaryColor: '#B5121B', highlight: '#1C4E9C', tier: 'strong', note: 'Confermata in Serie B' },
  { id: 'sb_sudtirol', name: 'Südtirol', shortName: 'Südtirol', initials: 'SUD', city: 'Bolzano', stadium: 'Stadio Druso', stadiumCapacity: 4850, primaryColor: '#B5121B', secondaryColor: '#1C4E9C', highlight: '#B5121B', tier: 'mid', note: 'Salva ai playout' },
  { id: 'sb_vicenza', name: 'Vicenza', shortName: 'Vicenza', initials: 'VIC', city: 'Vicenza', stadium: 'Stadio Romeo Menti', stadiumCapacity: 11000, primaryColor: '#B5121B', secondaryColor: '#FFFFFF', highlight: '#B5121B', tier: 'promoted', note: 'Promossa dalla Serie C' },
  { id: 'sb_arezzo', name: 'Arezzo', shortName: 'Arezzo', initials: 'ARE', city: 'Arezzo', stadium: 'Stadio Città di Arezzo', stadiumCapacity: 11700, primaryColor: '#7A1F2B', secondaryColor: '#F2C51D', highlight: '#7A1F2B', tier: 'promoted', note: 'Promossa dalla Serie C' },
  { id: 'sb_benevento', name: 'Benevento', shortName: 'Benevento', initials: 'BEN', city: 'Benevento', stadium: 'Stadio Ciro Vigorito', stadiumCapacity: 15000, primaryColor: '#F2C51D', secondaryColor: '#B5121B', highlight: '#F2C51D', tier: 'promoted', note: 'Promossa dalla Serie C' },
  { id: 'sb_ascoli', name: 'Ascoli', shortName: 'Ascoli', initials: 'ASC', city: 'Ascoli Piceno', stadium: 'Stadio Cino e Lillo Del Duca', stadiumCapacity: 13000, primaryColor: '#FFFFFF', secondaryColor: '#000000', highlight: '#000000', tier: 'promoted', note: 'Promossa dalla Serie C' },
];

export const SERIE_B_SEASON = '2025/26';

export const SERIE_B_CLUBS: ClubProfile[] = SERIE_B_CLUB_SEEDS.map(seed => {
  const economy = TIER_ECONOMY[seed.tier];
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    initials: seed.initials,
    city: seed.city,
    stadium: seed.stadium,
    stadiumCapacity: seed.stadiumCapacity,
    ownership: 'Proprietà locale',
    transferBudget: economy.budget,
    clubValue: economy.clubValue,
    objective: economy.objective,
    boardPromise: economy.boardPromise,
    playStyle: 'Assetto equilibrato da Serie B',
    academy: 'Settore giovanile in sviluppo',
    fanbase: seed.note,
    pressure: economy.pressure,
    difficulty: economy.difficulty,
    primaryColor: seed.primaryColor,
    secondaryColor: seed.secondaryColor,
    highlight: seed.highlight,
    division: 'serie_b',
  };
});

export const SERIE_B_STRENGTH_TIER: Record<string, SerieBStrengthTier> = Object.fromEntries(
  SERIE_B_CLUB_SEEDS.map(seed => [seed.id, seed.tier])
);

export const getSerieBClubById = (id: string): ClubProfile | undefined => SERIE_B_CLUBS.find(club => club.id === id);
export const getSerieBClubByName = (name: string): ClubProfile | undefined => SERIE_B_CLUBS.find(club => club.name === name);

// ─── Serie C astratta (non giocabile): pool feeder persistente ───
//
// Usato solo per generare deterministicamente le 4 squadre che salgono in Serie B a fine
// stagione (Fase 4/6). Nomi di club reali di Serie C, usati come identità stabili del pool;
// le rose assegnate a queste squadre quando entrano in Serie B sono sempre generate (vedi
// realSerieBRosters2025.ts), mai spacciate per ufficiali.
export const SERIE_C_FEEDER_POOL: { id: string; name: string; city: string }[] = [
  { id: 'sc_triestina', name: 'Triestina', city: 'Trieste' },
  { id: 'sc_perugia', name: 'Perugia', city: 'Perugia' },
  { id: 'sc_novara', name: 'Novara', city: 'Novara' },
  { id: 'sc_pescara', name: 'Pescara', city: 'Pescara' },
  { id: 'sc_giugliano', name: 'Giugliano', city: 'Giugliano in Campania' },
  { id: 'sc_pontedera', name: 'Pontedera', city: 'Pontedera' },
  { id: 'sc_atalantau23', name: 'Atalanta U23', city: 'Bergamo' },
  { id: 'sc_arzignano', name: 'Arzignano Valchiampo', city: 'Arzignano' },
];
