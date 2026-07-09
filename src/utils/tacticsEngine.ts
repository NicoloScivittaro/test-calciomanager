import { Player, PlayerInstructionRole, SlotInstruction, TacticalDuty, Tactic, TacticalPrinciple } from '../types';
import { evaluateLineupPersonalities } from './playerPersonality';
import { getPlayerRoleAttributes } from './playerAttributes';

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

// Riga di slot: ripartisce N ruoli su X coordinate equidistanti (o esplicite) alla stessa profondita' y.
// Solo un helper di autoring per evitare 26 moduli x 11 coordinate scritte a mano: l'output resta
// puro/statico (nessun calcolo a runtime dipendente da stato di gioco).
const line = (y: number, roles: Player['role'][], xs?: number[]): TacticalSlot[] => {
  const positions = xs ?? (roles.length === 1
    ? [50]
    : Array.from({ length: roles.length }, (_, i) => Math.round(15 + (70 / (roles.length - 1)) * i)));
  return roles.map((role, i) => ({ x: positions[i], y, role }));
};

export const POSITION_PRESETS: Record<Tactic['module'], TacticalSlot[]> = {
  // ─── Difesa a 4 ───
  '4-3-3': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(55, ['DM']),
    ...line(44, ['CM', 'CM'], [32, 68]),
    ...line(22, ['LW', 'RW'], [20, 80]),
    ...line(14, ['ST'])
  ],
  '4-2-3-1': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(56, ['DM', 'DM'], [38, 62]),
    ...line(38, ['AM']),
    ...line(22, ['LW', 'RW'], [20, 80]),
    ...line(14, ['ST'])
  ],
  '4-4-2': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(46, ['LW', 'CM', 'CM', 'RW'], [18, 38, 62, 82]),
    ...line(15, ['ST', 'ST'], [38, 62])
  ],
  '4-4-1-1': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(46, ['LW', 'CM', 'CM', 'RW'], [18, 38, 62, 82]),
    ...line(26, ['AM']),
    ...line(14, ['ST'])
  ],
  '4-1-4-1': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(58, ['DM']),
    ...line(42, ['LW', 'CM', 'CM', 'RW'], [18, 38, 62, 82]),
    ...line(14, ['ST'])
  ],
  '4-5-1': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(52, ['DM']),
    ...line(45, ['LW', 'CM', 'CM', 'RW'], [16, 37, 63, 84]),
    ...line(15, ['ST'])
  ],
  '4-3-1-2': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(58, ['DM']),
    ...line(46, ['CM', 'CM'], [32, 68]),
    ...line(34, ['AM']),
    ...line(15, ['ST', 'ST'], [38, 62])
  ],
  '4-3-2-1': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(56, ['DM']),
    ...line(46, ['CM', 'CM'], [32, 68]),
    ...line(30, ['AM', 'AM'], [35, 65]),
    ...line(14, ['ST'])
  ],
  '4-1-2-1-2': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(58, ['DM']),
    ...line(46, ['CM', 'CM'], [42, 58]),
    ...line(34, ['AM']),
    ...line(15, ['ST', 'ST'], [38, 62])
  ],
  '4-2-2-2': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(56, ['DM', 'DM'], [38, 62]),
    ...line(36, ['LW', 'RW'], [25, 75]),
    ...line(15, ['ST', 'ST'], [38, 62])
  ],
  '4-2-4': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(50, ['DM', 'DM'], [38, 62]),
    ...line(16, ['LW', 'ST', 'ST', 'RW'], [15, 38, 62, 85])
  ],
  '4-1-3-2': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(58, ['DM']),
    ...line(38, ['LW', 'AM', 'RW'], [22, 50, 78]),
    ...line(15, ['ST', 'ST'], [38, 62])
  ],
  // ─── Difesa a 3 ───
  '3-5-2': [
    ...line(88, ['GK']),
    ...line(74, ['CB'], [50]),
    ...line(72, ['CB', 'CB'], [28, 72]),
    ...line(54, ['DM']),
    ...line(44, ['CM', 'CM'], [32, 68]),
    ...line(36, ['LB', 'RB'], [15, 85]),
    ...line(16, ['ST', 'ST'], [38, 62])
  ],
  '3-4-3': [
    ...line(88, ['GK']),
    ...line(74, ['CB'], [50]),
    ...line(72, ['CB', 'CB'], [28, 72]),
    ...line(46, ['LB', 'CM', 'CM', 'RB'], [15, 38, 62, 85]),
    ...line(22, ['LW', 'RW'], [20, 80]),
    ...line(14, ['ST'])
  ],
  '3-4-2-1': [
    ...line(88, ['GK']),
    ...line(74, ['CB'], [50]),
    ...line(72, ['CB', 'CB'], [28, 72]),
    ...line(46, ['LB', 'CM', 'CM', 'RB'], [15, 38, 62, 85]),
    ...line(30, ['AM', 'AM'], [35, 65]),
    ...line(14, ['ST'])
  ],
  '3-4-1-2': [
    ...line(88, ['GK']),
    ...line(74, ['CB'], [50]),
    ...line(72, ['CB', 'CB'], [28, 72]),
    ...line(46, ['LB', 'CM', 'CM', 'RB'], [15, 38, 62, 85]),
    ...line(32, ['AM']),
    ...line(15, ['ST', 'ST'], [38, 62])
  ],
  '3-5-1-1': [
    ...line(88, ['GK']),
    ...line(74, ['CB'], [50]),
    ...line(72, ['CB', 'CB'], [28, 72]),
    ...line(54, ['DM']),
    ...line(44, ['LB', 'CM', 'CM', 'RB'], [15, 38, 62, 85]),
    ...line(28, ['AM']),
    ...line(14, ['ST'])
  ],
  '3-3-1-3': [
    ...line(88, ['GK']),
    ...line(74, ['CB'], [50]),
    ...line(72, ['CB', 'CB'], [28, 72]),
    ...line(52, ['DM', 'CM', 'CM'], [50, 32, 68]),
    ...line(34, ['AM']),
    ...line(20, ['LW', 'RW'], [18, 82]),
    ...line(14, ['ST'])
  ],
  // ─── Difesa a 5 ───
  '5-3-2': [
    ...line(88, ['GK']),
    ...line(76, ['CB'], [50]),
    ...line(73, ['CB', 'CB'], [30, 70]),
    ...line(65, ['LB', 'RB'], [12, 88]),
    ...line(46, ['DM', 'CM', 'CM'], [50, 32, 68]),
    ...line(16, ['ST', 'ST'], [38, 62])
  ],
  '5-4-1': [
    ...line(88, ['GK']),
    ...line(76, ['CB'], [50]),
    ...line(73, ['CB', 'CB'], [30, 70]),
    ...line(65, ['LB', 'RB'], [12, 88]),
    ...line(44, ['LW', 'CM', 'CM', 'RW'], [20, 38, 62, 80]),
    ...line(14, ['ST'])
  ],
  '5-2-3': [
    ...line(88, ['GK']),
    ...line(76, ['CB'], [50]),
    ...line(73, ['CB', 'CB'], [30, 70]),
    ...line(65, ['LB', 'RB'], [12, 88]),
    ...line(46, ['DM', 'CM'], [40, 60]),
    ...line(18, ['LW', 'ST', 'RW'], [20, 50, 80])
  ],
  '5-3-1-1': [
    ...line(88, ['GK']),
    ...line(76, ['CB'], [50]),
    ...line(73, ['CB', 'CB'], [30, 70]),
    ...line(65, ['LB', 'RB'], [12, 88]),
    ...line(46, ['DM', 'CM', 'CM'], [50, 32, 68]),
    ...line(28, ['AM']),
    ...line(14, ['ST'])
  ],
  '5-2-1-2': [
    ...line(88, ['GK']),
    ...line(76, ['CB'], [50]),
    ...line(73, ['CB', 'CB'], [30, 70]),
    ...line(65, ['LB', 'RB'], [12, 88]),
    ...line(48, ['DM', 'CM'], [40, 60]),
    ...line(32, ['AM']),
    ...line(15, ['ST', 'ST'], [38, 62])
  ],
  // ─── Moduli speciali / situazionali ───
  '4-6-0': [
    ...line(88, ['GK']),
    ...line(72, ['CB', 'CB'], [35, 65]),
    ...line(66, ['LB', 'RB'], [15, 85]),
    ...line(54, ['DM', 'CM', 'CM'], [50, 32, 68]),
    ...line(32, ['LW', 'AM', 'RW'], [22, 50, 78])
  ],
  '3-6-1': [
    ...line(88, ['GK']),
    ...line(74, ['CB'], [50]),
    ...line(72, ['CB', 'CB'], [28, 72]),
    ...line(54, ['DM', 'CM', 'CM'], [50, 32, 68]),
    ...line(34, ['LW', 'AM', 'RW'], [22, 50, 78]),
    ...line(14, ['ST'])
  ],
  '2-3-5': [
    ...line(88, ['GK']),
    ...line(70, ['CB', 'CB'], [35, 65]),
    ...line(48, ['DM', 'CM', 'CM'], [50, 32, 68]),
    ...line(18, ['LW', 'AM', 'ST', 'AM', 'RW'], [10, 32, 50, 68, 90])
  ]
};

export type FormationShapeType = 'wide' | 'narrow' | 'diamond' | 'wingbacks' | 'low_block' | 'possession' | 'direct' | 'pressing';
export type FormationMentalityFit = 'defensive' | 'balanced' | 'offensive' | 'flexible';

export interface FormationTacticalModifiers {
  defensiveSolidity: number;
  centralControl: number;
  wingThreat: number;
  pressingPotential: number;
  counterAttack: number;
  possessionControl: number;
  chanceCreation: number;
  defensiveTransitionRisk: number;
  fatigueLoad: number;
}

export interface FormationDefinition {
  id: Tactic['module'];
  label: string;
  description: string;
  tags: string[];
  defensiveLine: 3 | 4 | 5;
  shapeType: FormationShapeType;
  mentalityFit: FormationMentalityFit;
  tacticalModifiers: FormationTacticalModifiers;
  strengths: string[];
  weaknesses: string[];
  recommendedPlayerTypes?: string[];
}

const mods = (m: Partial<FormationTacticalModifiers>): FormationTacticalModifiers => ({
  defensiveSolidity: 0, centralControl: 0, wingThreat: 0, pressingPotential: 0, counterAttack: 0,
  possessionControl: 0, chanceCreation: 0, defensiveTransitionRisk: 0, fatigueLoad: 0, ...m
});

// Libreria formazioni (T1): descrizione, tag, forma e modificatori tattici usati sia dalla UI
// ("Analisi modulo") sia da evaluateTactic per far pesare davvero il modulo scelto sul match.
export const FORMATION_LIBRARY: Record<Tactic['module'], FormationDefinition> = {
  '4-3-3': {
    id: '4-3-3', label: '4-3-3', description: 'Ampiezza, pressing e ali', tags: ['Bilanciato', 'Fasce', 'Pressing'],
    defensiveLine: 4, shapeType: 'wide', mentalityFit: 'balanced',
    tacticalModifiers: mods({ wingThreat: 6, pressingPotential: 5, chanceCreation: 3, defensiveTransitionRisk: 3, fatigueLoad: 3 }),
    strengths: ['Ampiezza reale con ali e terzini', 'Buon pressing alto', 'Equilibrio tra reparti'],
    weaknesses: ['Rischio in transizione se i terzini spingono troppo', 'Il mediano unico puo restare scoperto'],
    recommendedPlayerTypes: ['Ali veloci', 'Terzini offensivi', 'Un mediano di equilibrio']
  },
  '4-2-3-1': {
    id: '4-2-3-1', label: '4-2-3-1', description: 'Equilibrio moderno e trequartista', tags: ['Bilanciato', 'Centrale'],
    defensiveLine: 4, shapeType: 'possession', mentalityFit: 'balanced',
    tacticalModifiers: mods({ centralControl: 6, defensiveSolidity: 3, chanceCreation: 3, fatigueLoad: 1 }),
    strengths: ['Doppio mediano: solidita centrale', 'Trequartista come rifinitore', 'Modulo leggibile e stabile'],
    weaknesses: ['Meno presenza in area rispetto a moduli a due punte', 'Dipende dalla qualita del trequartista'],
    recommendedPlayerTypes: ['Trequartista tecnico', 'Due mediani complementari', 'Prima punta che tiene palla']
  },
  '4-4-2': {
    id: '4-4-2', label: '4-4-2', description: 'Classico, cross e doppia punta', tags: ['Bilanciato', 'Fasce'],
    defensiveLine: 4, shapeType: 'wide', mentalityFit: 'balanced',
    tacticalModifiers: mods({ wingThreat: 5, defensiveSolidity: 3, chanceCreation: 2, centralControl: -3 }),
    strengths: ['Due punte sempre presenti in area', 'Compattezza semplice da allenare', 'Buon volume di cross'],
    weaknesses: ['Meno controllo centrale contro moduli a tre centrocampisti', 'Numeri inferiori a centrocampo'],
    recommendedPlayerTypes: ['Due punte complementari', 'Esterni che crossano', 'Centrocampisti box-to-box']
  },
  '4-4-1-1': {
    id: '4-4-1-1', label: '4-4-1-1', description: 'Seconda punta dietro il centravanti', tags: ['Bilanciato', 'Centrale'],
    defensiveLine: 4, shapeType: 'possession', mentalityFit: 'balanced',
    tacticalModifiers: mods({ centralControl: 3, chanceCreation: 3, wingThreat: 2, defensiveSolidity: 2 }),
    strengths: ['Collegamento in piu tra centrocampo e punta', 'Solidita del 4-4-2 con piu qualita offensiva'],
    weaknesses: ['La seconda punta puo isolarsi se non supportata', 'Meno presenza fissa in area'],
    recommendedPlayerTypes: ['Seconda punta/trequartista mobile', 'Centravanti da riferimento']
  },
  '4-1-4-1': {
    id: '4-1-4-1', label: '4-1-4-1', description: 'Mediano unico e blocco compatto', tags: ['Bilanciato', 'Pressing', 'Centrale'],
    defensiveLine: 4, shapeType: 'pressing', mentalityFit: 'balanced',
    tacticalModifiers: mods({ defensiveSolidity: 5, pressingPotential: 4, centralControl: 3, chanceCreation: -2 }),
    strengths: ['Schermo davanti alla difesa solido', 'Ottimo per riaggressione e pressing coordinato'],
    weaknesses: ['Punta spesso isolata', 'Poca imprevedibilita offensiva senza esterni forti'],
    recommendedPlayerTypes: ['Mediano di rottura affidabile', 'Esterni che rientrano per pressare']
  },
  '4-5-1': {
    id: '4-5-1', label: '4-5-1', description: 'Blocco medio-basso e densita centrale', tags: ['Difensivo', 'Blocco basso'],
    defensiveLine: 4, shapeType: 'low_block', mentalityFit: 'defensive',
    tacticalModifiers: mods({ defensiveSolidity: 6, counterAttack: 3, chanceCreation: -4, wingThreat: -1 }),
    strengths: ['Centrocampo folto, difficile da bucare in mezzo', 'Buona base per il contropiede'],
    weaknesses: ['Punta isolata', 'Poche occasioni create con manovra propria'],
    recommendedPlayerTypes: ['Centrocampisti di sacrificio', 'Attaccante che lavora anche da solo']
  },
  '4-3-1-2': {
    id: '4-3-1-2', label: '4-3-1-2', description: 'Rombo centrale e trequartista', tags: ['Centrale', 'Possesso'],
    defensiveLine: 4, shapeType: 'diamond', mentalityFit: 'offensive',
    tacticalModifiers: mods({ centralControl: 7, wingThreat: -6, chanceCreation: 4, defensiveTransitionRisk: 3 }),
    strengths: ['Controllo centrale molto alto', 'Trequartista come uomo decisivo', 'Superiorita numerica in mezzo'],
    weaknesses: ['Pochissima ampiezza naturale', 'Dipende molto dalla spinta dei terzini'],
    recommendedPlayerTypes: ['Trequartista decisivo', 'Terzini che danno ampiezza', 'Due punte complementari']
  },
  '4-3-2-1': {
    id: '4-3-2-1', label: '4-3-2-1', description: 'Albero di Natale, due mezze punte', tags: ['Offensivo', 'Centrale'],
    defensiveLine: 4, shapeType: 'narrow', mentalityFit: 'offensive',
    tacticalModifiers: mods({ centralControl: 5, chanceCreation: 5, wingThreat: -3, defensiveTransitionRisk: 4 }),
    strengths: ['Due mezze punte creano superiorita sulla trequarti', 'Tanta qualita offensiva concentrata al centro'],
    weaknesses: ['Fasce scoperte', 'Fragile in fase di transizione difensiva'],
    recommendedPlayerTypes: ['Mezze punte tecniche', 'Centrocampisti che coprono ampio campo']
  },
  '4-1-2-1-2': {
    id: '4-1-2-1-2', label: '4-1-2-1-2', description: 'Rombo stretto e doppia punta', tags: ['Centrale', 'Possesso'],
    defensiveLine: 4, shapeType: 'diamond', mentalityFit: 'offensive',
    tacticalModifiers: mods({ centralControl: 6, possessionControl: 4, wingThreat: -7, chanceCreation: 3 }),
    strengths: ['Densita centrale altissima', 'Buona costruzione dal basso'],
    weaknesses: ['Ampiezza quasi nulla senza terzini propositivi', 'Vulnerabile sugli esterni avversari'],
    recommendedPlayerTypes: ['Regista basso', 'Terzini che danno tutta l ampiezza']
  },
  '4-2-2-2': {
    id: '4-2-2-2', label: '4-2-2-2', description: 'Due mediani e trequartisti larghi', tags: ['Bilanciato', 'Offensivo'],
    defensiveLine: 4, shapeType: 'possession', mentalityFit: 'offensive',
    tacticalModifiers: mods({ chanceCreation: 5, centralControl: 2, defensiveSolidity: 2, wingThreat: 2 }),
    strengths: ['Doppio mediano da equilibrio', 'Trequartisti larghi imprevedibili', 'Due punte sempre servite'],
    weaknesses: ['Corsie laterali scoperte in fase difensiva', 'Richiede trequartisti box-to-box']
  },
  '4-2-4': {
    id: '4-2-4', label: '4-2-4', description: 'Assalto offensivo', tags: ['Offensivo', 'Fasce'],
    defensiveLine: 4, shapeType: 'direct', mentalityFit: 'offensive',
    tacticalModifiers: mods({ chanceCreation: 8, wingThreat: 6, defensiveTransitionRisk: 8, defensiveSolidity: -6, fatigueLoad: 6 }),
    strengths: ['Moltissime occasioni create', 'Pressione enorme sulla difesa avversaria'],
    weaknesses: ['Grande rischio in transizione', 'Fatica alta', 'Adatto solo a squadre forti o finali di partita'],
    recommendedPlayerTypes: ['Rosa con qualita superiore all avversario', 'Centrocampo capace di reggere da solo']
  },
  '4-1-3-2': {
    id: '4-1-3-2', label: '4-1-3-2', description: 'Mediano unico, trequarti larga, doppia punta', tags: ['Bilanciato', 'Centrale'],
    defensiveLine: 4, shapeType: 'possession', mentalityFit: 'balanced',
    tacticalModifiers: mods({ centralControl: 4, chanceCreation: 4, defensiveSolidity: 1, defensiveTransitionRisk: 2 }),
    strengths: ['Tre uomini tra le linee per creare superiorita', 'Doppia punta sempre rifornita'],
    weaknesses: ['Mediano unico sovraccaricato', 'Vulnerabile se il mediano perde il duello centrale']
  },
  '3-5-2': {
    id: '3-5-2', label: '3-5-2', description: 'Quinti, doppia punta e densita centrale', tags: ['Bilanciato', 'Centrale'],
    defensiveLine: 3, shapeType: 'wingbacks', mentalityFit: 'balanced',
    tacticalModifiers: mods({ centralControl: 5, defensiveSolidity: 2, wingThreat: 3, fatigueLoad: 3 }),
    strengths: ['Centrocampo forte a livello numerico', 'Due punte sempre in coppia', 'Quinti che danno ampiezza'],
    weaknesses: ['Soffre l ampiezza se i quinti calano fisicamente', 'Difesa a tre esposta 1-contro-1 in ampiezza']
  },
  '3-4-3': {
    id: '3-4-3', label: '3-4-3', description: 'Aggressivo, ampiezza e pressing alto', tags: ['Offensivo', 'Pressing', 'Fasce'],
    defensiveLine: 3, shapeType: 'wingbacks', mentalityFit: 'offensive',
    tacticalModifiers: mods({ pressingPotential: 6, wingThreat: 5, chanceCreation: 4, defensiveTransitionRisk: 6 }),
    strengths: ['Pressing alto molto efficace', 'Tridente offensivo con ampiezza reale'],
    weaknesses: ['Rischio dietro gli esterni se il pressing salta', 'Difesa a tre isolata in campo aperto']
  },
  '3-4-2-1': {
    id: '3-4-2-1', label: '3-4-2-1', description: 'Due trequartisti dietro la punta', tags: ['Offensivo', 'Centrale'],
    defensiveLine: 3, shapeType: 'wingbacks', mentalityFit: 'offensive',
    tacticalModifiers: mods({ chanceCreation: 6, centralControl: 3, wingThreat: 2, defensiveTransitionRisk: 4 }),
    strengths: ['Due trequartisti creano superiorita alle spalle della punta', 'Quinti danno ampiezza in appoggio'],
    weaknesses: ['Punta unica isolata se i trequartisti non si inseriscono', 'Fase difensiva delicata']
  },
  '3-4-1-2': {
    id: '3-4-1-2', label: '3-4-1-2', description: 'Trequartista dietro due punte', tags: ['Offensivo', 'Centrale'],
    defensiveLine: 3, shapeType: 'wingbacks', mentalityFit: 'offensive',
    tacticalModifiers: mods({ chanceCreation: 5, centralControl: 3, wingThreat: 1, defensiveTransitionRisk: 3 }),
    strengths: ['Trequartista decisivo tra le linee', 'Doppia punta sempre presente in area'],
    weaknesses: ['Poca ampiezza senza quinti in forma', 'Dipende molto dal trequartista']
  },
  '3-5-1-1': {
    id: '3-5-1-1', label: '3-5-1-1', description: 'Centrocampo folto e seconda punta', tags: ['Bilanciato', 'Centrale'],
    defensiveLine: 3, shapeType: 'wingbacks', mentalityFit: 'balanced',
    tacticalModifiers: mods({ centralControl: 5, defensiveSolidity: 3, chanceCreation: 1, fatigueLoad: 2 }),
    strengths: ['Grande densita a centrocampo', 'Seconda punta come collegamento con l attacco'],
    weaknesses: ['Punta centrale spesso poco supportata in area', 'Richiede quinti molto resistenti']
  },
  '3-3-1-3': {
    id: '3-3-1-3', label: '3-4-3 diamond (3-3-1-3)', description: 'Tridente offensivo e trequartista', tags: ['Offensivo', 'Possesso'],
    defensiveLine: 3, shapeType: 'diamond', mentalityFit: 'offensive',
    tacticalModifiers: mods({ chanceCreation: 7, centralControl: 4, defensiveTransitionRisk: 7, defensiveSolidity: -4 }),
    strengths: ['Massima proiezione offensiva', 'Trequartista e tridente sempre collegati'],
    weaknesses: ['Copertura difensiva molto ridotta', 'Rischio enorme in caso di palla persa']
  },
  '5-3-2': {
    id: '5-3-2', label: '5-3-2', description: 'Difensivo, doppia punta di ripartenza', tags: ['Difensivo', 'Contropiede'],
    defensiveLine: 5, shapeType: 'low_block', mentalityFit: 'defensive',
    tacticalModifiers: mods({ defensiveSolidity: 7, counterAttack: 5, chanceCreation: -3, wingThreat: -2 }),
    strengths: ['Fase difensiva molto solida', 'Doppia punta pronta a ripartire'],
    weaknesses: ['Poca costruzione dal basso', 'Ampiezza offensiva limitata']
  },
  '5-4-1': {
    id: '5-4-1', label: '5-4-1', description: 'Blocco basso e ripartenze', tags: ['Difensivo', 'Blocco basso'],
    defensiveLine: 5, shapeType: 'low_block', mentalityFit: 'defensive',
    tacticalModifiers: mods({ defensiveSolidity: 8, counterAttack: 4, chanceCreation: -6, fatigueLoad: -3 }),
    strengths: ['Ottima copertura per squadre in difficolta', 'Blocco molto compatto e difficile da superare'],
    weaknesses: ['Pochissime occasioni create', 'Punta isolata davanti'],
    recommendedPlayerTypes: ['Difesa numerosa e disciplinata', 'Attaccante fisico che tiene palla da solo']
  },
  '5-2-3': {
    id: '5-2-3', label: '5-2-3', description: 'Difesa a cinque con tridente alto', tags: ['Contropiede', 'Fasce'],
    defensiveLine: 5, shapeType: 'wingbacks', mentalityFit: 'flexible',
    tacticalModifiers: mods({ defensiveSolidity: 4, wingThreat: 4, counterAttack: 4, centralControl: -3 }),
    strengths: ['Copertura difensiva con tridente pronto a ripartire', 'Buon equilibrio tra sicurezza e imprevedibilita'],
    weaknesses: ['Poco controllo del centrocampo con solo due mediani', 'Dipende dai quinti su entrambe le fasi']
  },
  '5-3-1-1': {
    id: '5-3-1-1', label: '5-3-1-1', description: 'Centrocampo folto, seconda punta di appoggio', tags: ['Difensivo', 'Centrale'],
    defensiveLine: 5, shapeType: 'low_block', mentalityFit: 'defensive',
    tacticalModifiers: mods({ defensiveSolidity: 6, centralControl: 3, chanceCreation: -3, counterAttack: 3 }),
    strengths: ['Molto equilibrato tra copertura e collegamento offensivo', 'Seconda punta aiuta la costruzione'],
    weaknesses: ['Presenza offensiva ridotta', 'Poca ampiezza in fase di possesso']
  },
  '5-2-1-2': {
    id: '5-2-1-2', label: '5-2-1-2', description: 'Doppia punta con trequartista di raccordo', tags: ['Contropiede', 'Centrale'],
    defensiveLine: 5, shapeType: 'wingbacks', mentalityFit: 'flexible',
    tacticalModifiers: mods({ defensiveSolidity: 4, counterAttack: 5, chanceCreation: 1, centralControl: -2 }),
    strengths: ['Buona base difensiva con doppia punta pronta a ripartire', 'Trequartista come raccordo centrale'],
    weaknesses: ['Solo due mediani per coprire ampio campo', 'Fasce dipendono interamente dai quinti']
  },
  '4-6-0': {
    id: '4-6-0', label: '4-6-0', description: 'Falso nove e possesso totale', tags: ['Possesso', 'Centrale'],
    defensiveLine: 4, shapeType: 'possession', mentalityFit: 'flexible',
    tacticalModifiers: mods({ possessionControl: 8, centralControl: 5, chanceCreation: -4, defensiveSolidity: 2 }),
    strengths: ['Tantissimo possesso palla', 'Difficile da marcare per assenza di un riferimento fisso'],
    weaknesses: ['Pochi riferimenti veri in area', 'Efficace solo con tecnica individuale molto alta'],
    recommendedPlayerTypes: ['Centrocampisti di grande qualita tecnica', 'Falso nove intelligente nei movimenti']
  },
  '3-6-1': {
    id: '3-6-1', label: '3-6-1', description: 'Controllo totale del centrocampo', tags: ['Possesso', 'Centrale'],
    defensiveLine: 3, shapeType: 'possession', mentalityFit: 'flexible',
    tacticalModifiers: mods({ possessionControl: 7, centralControl: 6, chanceCreation: -3, wingThreat: -2 }),
    strengths: ['Superiorita numerica quasi ovunque a centrocampo', 'Ottimo per gestire il ritmo della partita'],
    weaknesses: ['Punta unica molto isolata', 'Poca profondita offensiva se manca velocita sugli esterni']
  },
  '2-3-5': {
    id: '2-3-5', label: '2-3-5', description: 'Assetto storico ultra-offensivo', tags: ['Offensivo', 'Fasce'],
    defensiveLine: 4, shapeType: 'direct', mentalityFit: 'offensive',
    tacticalModifiers: mods({ chanceCreation: 9, wingThreat: 7, defensiveSolidity: -9, defensiveTransitionRisk: 9, fatigueLoad: 5 }),
    strengths: ['Presenza offensiva massima', 'Cinque uomini sempre pronti in area'],
    weaknesses: ['Difesa numericamente inferiore quasi sempre', 'Rischio altissimo su ogni palla persa'],
    recommendedPlayerTypes: ['Solo per superiorita tecnica netta o momenti disperati di partita']
  }
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
  // Familiarita' di ruolo (allenamento lento nel tempo): riusa il dato reale se presente, altrimenti
  // il fit resta quello legacy sopra (vecchi salvataggi non ancora migrati).
  const familiarityEntry = player.roleFamiliarity?.find(entry => entry.roleId === slotRole);
  const familiarityFit = familiarityEntry ? (familiarityEntry.familiarity / 100) * 0.9 : 0;
  return clamp(Math.max(naturalFit, trainedFit, progressFit, familiarityFit), 0.08, 1);
};

// ─── T2: ruoli/compiti individuali per slot ───
// Estende (non sostituisce) il fit posizionale di base sopra: ogni PlayerInstructionRole aggiunge
// solo un piccolo bonus/malus tattico deterministico (stesso schema a 9 assi di FORMATION_LIBRARY)
// e richiede 1-2 attributi chiave (schema gia' esistente in playerAttributes.ts) per la compatibilita'.

export interface PlayerInstructionRoleMeta {
  label: string;
  baseRoles: Player['role'][];
  defaultDuty: TacticalDuty;
  keyAttributes: string[];
  modifiers: FormationTacticalModifiers;
}

export const PLAYER_INSTRUCTION_ROLE_META: Record<PlayerInstructionRole, PlayerInstructionRoleMeta> = {
  gk_defend: { label: 'Portiere puro', baseRoles: ['GK'], defaultDuty: 'defend', keyAttributes: ['handling', 'positioning'], modifiers: mods({ defensiveSolidity: 2 }) },
  sweeper_keeper: { label: 'Portiere libero', baseRoles: ['GK'], defaultDuty: 'support', keyAttributes: ['sweeperKeeper', 'passing'], modifiers: mods({ possessionControl: 2, defensiveTransitionRisk: 1 }) },
  centre_back: { label: 'Difensore centrale', baseRoles: ['CB'], defaultDuty: 'defend', keyAttributes: ['marking', 'tackling'], modifiers: mods({ defensiveSolidity: 2 }) },
  ball_playing_defender: { label: 'Centrale impostatore', baseRoles: ['CB'], defaultDuty: 'defend', keyAttributes: ['passing', 'composure'], modifiers: mods({ possessionControl: 3, centralControl: 2, defensiveTransitionRisk: 1 }) },
  aggressive_centre_back: { label: 'Centrale aggressivo', baseRoles: ['CB'], defaultDuty: 'defend', keyAttributes: ['tackling', 'anticipation'], modifiers: mods({ pressingPotential: 3, defensiveTransitionRisk: 2, defensiveSolidity: 1 }) },
  wide_centre_back: { label: 'Braccetto', baseRoles: ['CB'], defaultDuty: 'defend', keyAttributes: ['pace', 'positioning'], modifiers: mods({ wingThreat: 1, defensiveSolidity: 2 }) },
  fullback_defend: { label: 'Terzino bloccato', baseRoles: ['LB', 'RB'], defaultDuty: 'defend', keyAttributes: ['marking', 'tackling'], modifiers: mods({ defensiveSolidity: 3, wingThreat: -2, defensiveTransitionRisk: -2 }) },
  fullback_support: { label: 'Terzino di supporto', baseRoles: ['LB', 'RB'], defaultDuty: 'support', keyAttributes: ['stamina', 'crossing'], modifiers: mods({ wingThreat: 2, fatigueLoad: 1 }) },
  wingback_support: { label: 'Quinto di supporto', baseRoles: ['LB', 'RB'], defaultDuty: 'support', keyAttributes: ['stamina', 'crossing'], modifiers: mods({ wingThreat: 3, fatigueLoad: 2, defensiveTransitionRisk: 1 }) },
  wingback_attack: { label: 'Quinto a tutta fascia', baseRoles: ['LB', 'RB'], defaultDuty: 'attack', keyAttributes: ['pace', 'crossing'], modifiers: mods({ wingThreat: 5, chanceCreation: 2, fatigueLoad: 3, defensiveTransitionRisk: 3 }) },
  inverted_fullback: { label: 'Terzino invertito', baseRoles: ['LB', 'RB'], defaultDuty: 'support', keyAttributes: ['passing', 'positioning'], modifiers: mods({ centralControl: 3, wingThreat: -4, possessionControl: 2 }) },
  defensive_midfielder: { label: 'Mediano', baseRoles: ['DM'], defaultDuty: 'defend', keyAttributes: ['tackling', 'positioning'], modifiers: mods({ defensiveSolidity: 3, defensiveTransitionRisk: -2, chanceCreation: -1 }) },
  deep_lying_playmaker: { label: 'Regista basso', baseRoles: ['DM', 'CM'], defaultDuty: 'support', keyAttributes: ['passing', 'vision'], modifiers: mods({ possessionControl: 4, chanceCreation: 2, defensiveSolidity: -1 }) },
  anchor_man: { label: 'Mediano davanti alla difesa', baseRoles: ['DM'], defaultDuty: 'defend', keyAttributes: ['tackling', 'positioning'], modifiers: mods({ defensiveSolidity: 4, defensiveTransitionRisk: -3, chanceCreation: -2 }) },
  ball_winning_midfielder: { label: 'Mediano di rottura', baseRoles: ['DM', 'CM'], defaultDuty: 'defend', keyAttributes: ['tackling', 'stamina'], modifiers: mods({ pressingPotential: 4, defensiveSolidity: 2, fatigueLoad: 2 }) },
  central_midfielder: { label: 'Centrocampista centrale', baseRoles: ['CM'], defaultDuty: 'support', keyAttributes: ['passing', 'stamina'], modifiers: mods({ centralControl: 2 }) },
  box_to_box: { label: 'Box-to-box', baseRoles: ['CM'], defaultDuty: 'support', keyAttributes: ['stamina', 'workRate'], modifiers: mods({ pressingPotential: 2, counterAttack: 2, fatigueLoad: 3 }) },
  mezzala: { label: 'Mezzala', baseRoles: ['CM'], defaultDuty: 'attack', keyAttributes: ['dribbling', 'passing'], modifiers: mods({ chanceCreation: 3, wingThreat: 1, fatigueLoad: 2 }) },
  advanced_playmaker: { label: 'Regista avanzato', baseRoles: ['CM', 'AM'], defaultDuty: 'support', keyAttributes: ['vision', 'technique'], modifiers: mods({ chanceCreation: 4, centralControl: 2 }) },
  wide_midfielder: { label: 'Centrocampista esterno', baseRoles: ['LW', 'RW'], defaultDuty: 'support', keyAttributes: ['crossing', 'stamina'], modifiers: mods({ wingThreat: 3, fatigueLoad: 1 }) },
  winger: { label: 'Ala larga', baseRoles: ['LW', 'RW'], defaultDuty: 'attack', keyAttributes: ['pace', 'dribbling'], modifiers: mods({ wingThreat: 4, chanceCreation: 2 }) },
  inside_forward: { label: 'Ala inversa', baseRoles: ['LW', 'RW'], defaultDuty: 'attack', keyAttributes: ['technique', 'shooting'], modifiers: mods({ chanceCreation: 4, wingThreat: -2, centralControl: 1 }) },
  wide_playmaker: { label: 'Trequartista largo', baseRoles: ['LW', 'RW'], defaultDuty: 'support', keyAttributes: ['vision', 'passing'], modifiers: mods({ possessionControl: 2, chanceCreation: 2 }) },
  attacking_midfielder: { label: 'Mezzapunta', baseRoles: ['AM'], defaultDuty: 'attack', keyAttributes: ['vision', 'technique'], modifiers: mods({ chanceCreation: 3, centralControl: 1 }) },
  shadow_striker: { label: 'Seconda punta d\'inserimento', baseRoles: ['AM'], defaultDuty: 'attack', keyAttributes: ['finishing', 'offBallMovement'], modifiers: mods({ chanceCreation: 4, counterAttack: 2, defensiveSolidity: -1 }) },
  trequartista: { label: 'Trequartista', baseRoles: ['AM'], defaultDuty: 'attack', keyAttributes: ['vision', 'creativity'], modifiers: mods({ chanceCreation: 4, possessionControl: 1 }) },
  advanced_forward: { label: 'Punta boa avanzata', baseRoles: ['ST'], defaultDuty: 'attack', keyAttributes: ['finishing', 'pace'], modifiers: mods({ chanceCreation: 2, counterAttack: 2 }) },
  pressing_forward: { label: 'Punta pressing', baseRoles: ['ST'], defaultDuty: 'attack', keyAttributes: ['workRate', 'stamina'], modifiers: mods({ pressingPotential: 4, fatigueLoad: 3 }) },
  target_forward: { label: 'Target man', baseRoles: ['ST'], defaultDuty: 'attack', keyAttributes: ['strength', 'heading'], modifiers: mods({ chanceCreation: 1, defensiveSolidity: 1, counterAttack: 1 }) },
  false_nine: { label: 'Falso nove', baseRoles: ['ST', 'AM'], defaultDuty: 'support', keyAttributes: ['technique', 'vision'], modifiers: mods({ possessionControl: 4, centralControl: 2, chanceCreation: -1 }) },
  second_striker: { label: 'Seconda punta', baseRoles: ['ST', 'AM'], defaultDuty: 'support', keyAttributes: ['finishing', 'dribbling'], modifiers: mods({ chanceCreation: 3, counterAttack: 1 }) }
};

// Moltiplicatori per compito (duty): stesso set di assi tattici, mai un nuovo output. "attack" enfatizza
// gli assi offensivi e alza il rischio in transizione; "defend" fa l'opposto; "support" e' neutro.
const DUTY_AXIS_MULTIPLIERS: Record<TacticalDuty, { offense: number; defense: number; risk: number; fatigue: number }> = {
  defend: { offense: 0.55, defense: 1.3, risk: 0.6, fatigue: 0.9 },
  support: { offense: 1, defense: 1, risk: 1, fatigue: 1 },
  attack: { offense: 1.3, defense: 0.65, risk: 1.35, fatigue: 1.15 }
};

// Sceglie un ruolo/compito di default sensato per uno slot, in base al ruolo base, alla posizione nel
// modulo e al carattere del modulo stesso (FORMATION_LIBRARY). Deterministico: stesso modulo = stessi
// default sempre, cosi' un vecchio salvataggio senza istruzioni si comporta in modo prevedibile.
const pickDefaultInstruction = (
  module: Tactic['module'],
  slot: TacticalSlot,
  allSlots: TacticalSlot[]
): { role: PlayerInstructionRole; duty: TacticalDuty } => {
  const meta = FORMATION_LIBRARY[module];
  const isDefensiveShape = meta.mentalityFit === 'defensive' || meta.shapeType === 'low_block';
  const isOffensiveShape = meta.mentalityFit === 'offensive' || meta.shapeType === 'direct';
  const highTransitionRisk = meta.tacticalModifiers.defensiveTransitionRisk >= 6;
  const sameRoleSlots = allSlots.filter(s => s.role === slot.role);
  const orderInBand = sameRoleSlots.indexOf(slot);

  switch (slot.role) {
    case 'GK':
      return { role: 'gk_defend', duty: 'defend' };
    case 'CB': {
      const isWideCB = meta.defensiveLine === 3 && sameRoleSlots.length >= 3 && slot.x !== 50;
      if (isWideCB) return { role: 'wide_centre_back', duty: 'defend' };
      if (meta.shapeType === 'possession' || meta.mentalityFit === 'offensive') return { role: 'ball_playing_defender', duty: 'defend' };
      return { role: 'centre_back', duty: 'defend' };
    }
    case 'LB':
    case 'RB': {
      if (slot.y < 40) return { role: 'wingback_attack', duty: 'attack' };
      if (isDefensiveShape || highTransitionRisk) return { role: 'fullback_defend', duty: 'defend' };
      return { role: 'fullback_support', duty: 'support' };
    }
    case 'DM': {
      if (sameRoleSlots.length === 2) return orderInBand === 0 ? { role: 'anchor_man', duty: 'defend' } : { role: 'deep_lying_playmaker', duty: 'support' };
      if (meta.shapeType === 'possession' || meta.shapeType === 'diamond') return { role: 'deep_lying_playmaker', duty: 'support' };
      if (isDefensiveShape) return { role: 'anchor_man', duty: 'defend' };
      return { role: 'defensive_midfielder', duty: 'defend' };
    }
    case 'CM':
      // Moduli a blocco basso/difensivi: coppia piu' sobria (centrale + di rottura), non due mezzali
      // d'inserimento — coerente con "5-4-1: centrocampisti central/ball_winning" della richiesta.
      if (isDefensiveShape) return orderInBand % 2 === 0 ? { role: 'central_midfielder', duty: 'support' } : { role: 'ball_winning_midfielder', duty: 'defend' };
      return orderInBand % 2 === 0 ? { role: 'box_to_box', duty: 'support' } : { role: 'mezzala', duty: 'attack' };
    case 'AM': {
      if (module === '4-6-0' && slot.y === Math.min(...allSlots.map(s => s.y))) return { role: 'false_nine', duty: 'support' };
      if (sameRoleSlots.length === 2) return orderInBand === 0 ? { role: 'trequartista', duty: 'attack' } : { role: 'shadow_striker', duty: 'attack' };
      return { role: 'trequartista', duty: 'attack' };
    }
    case 'LW':
    case 'RW': {
      if (meta.shapeType === 'wide') return { role: 'winger', duty: isOffensiveShape ? 'attack' : isDefensiveShape ? 'defend' : 'support' };
      if (meta.shapeType === 'narrow' || meta.shapeType === 'diamond' || meta.shapeType === 'possession') return { role: 'inside_forward', duty: 'attack' };
      return { role: 'winger', duty: isDefensiveShape ? 'defend' : 'support' };
    }
    case 'ST': {
      if (sameRoleSlots.length === 2) return orderInBand === 0 ? { role: 'advanced_forward', duty: 'attack' } : { role: 'second_striker', duty: 'support' };
      if (meta.shapeType === 'low_block') return { role: 'target_forward', duty: 'attack' };
      if (meta.shapeType === 'pressing') return { role: 'pressing_forward', duty: 'attack' };
      return { role: 'advanced_forward', duty: 'attack' };
    }
    default:
      return { role: 'central_midfielder', duty: 'support' };
  }
};

// Istruzioni di default per un intero modulo: sempre 11, sempre le stesse per lo stesso modulo.
export const getDefaultSlotInstructions = (module: Tactic['module']): Record<string, SlotInstruction> => {
  const slots = POSITION_PRESETS[module];
  const result: Record<string, SlotInstruction> = {};
  slots.forEach((slot, index) => {
    const slotId = `slot_${index}`;
    const { role, duty } = pickDefaultInstruction(module, slot, slots);
    result[slotId] = { slotId, role, duty };
  });
  return result;
};

// Cambio modulo: mantiene le istruzioni gia' impostate dove il ruolo scelto e' ancora compatibile con
// il ruolo base del nuovo slot nella stessa posizione (slot_0..slot_10); rigenera solo dove non lo e'
// piu' (es. un 'wingback_attack' non ha senso su uno slot che nel nuovo modulo e' un CM).
export const mergeSlotInstructionsForModule = (
  previous: Record<string, SlotInstruction> | undefined,
  module: Tactic['module']
): Record<string, SlotInstruction> => {
  const defaults = getDefaultSlotInstructions(module);
  if (!previous) return defaults;
  const slots = POSITION_PRESETS[module];
  const merged: Record<string, SlotInstruction> = {};
  slots.forEach((slot, index) => {
    const slotId = `slot_${index}`;
    const existing = previous[slotId];
    const existingMeta = existing ? PLAYER_INSTRUCTION_ROLE_META[existing.role] : undefined;
    merged[slotId] = existingMeta && existingMeta.baseRoles.includes(slot.role) ? existing : defaults[slotId];
  });
  return merged;
};

// ─── T2: compatibilita' giocatore/ruolo-istruzione (5 livelli) ───

export type InstructionCompatibilityLabel = 'Ottimo' | 'Buono' | 'Adattato' | 'Rischioso' | 'Fuori ruolo';

export interface InstructionCompatibility {
  score: number; // 0-1
  label: InstructionCompatibilityLabel;
}

export const getInstructionCompatibility = (player: Player, instructionRole: PlayerInstructionRole): InstructionCompatibility => {
  const meta = PLAYER_INSTRUCTION_ROLE_META[instructionRole];
  const baseFit = Math.max(...meta.baseRoles.map(role => getPlayerSlotFitScore(player, role)));
  const attrs = getPlayerRoleAttributes(player);
  const attrValue = (key: string) => attrs.find(entry => entry.key === key)?.val ?? player.overall;
  const attrFit = meta.keyAttributes.length ? clamp(average(meta.keyAttributes.map(attrValue)) / 100, 0, 1) : 0.7;
  const score = clamp(baseFit * 0.65 + attrFit * 0.35, 0.05, 1);
  const label: InstructionCompatibilityLabel =
    score >= 0.88 ? 'Ottimo' :
    score >= 0.74 ? 'Buono' :
    score >= 0.58 ? 'Adattato' :
    score >= 0.4 ? 'Rischioso' : 'Fuori ruolo';
  return { score, label };
};

export interface PlayerInstructionFitResult {
  score: number; // 0-100
  label: InstructionCompatibilityLabel;
  reasons: string[];
}

// Versione estesa per la UI: stessa base di getInstructionCompatibility (mai due formule diverse
// per lo stesso concetto) ma con motivi leggibili, e un piccolo aggiustamento aggiuntivo solo dove
// esistono davvero i dati (stamina per compiti ad alta intensita, altezza per il target man) — mai
// un requisito bloccante se il dato manca.
export const evaluatePlayerInstructionFit = (
  player: Player,
  slotRole: Player['role'],
  instruction: SlotInstruction,
  tactic: Tactic
): PlayerInstructionFitResult => {
  const meta = PLAYER_INSTRUCTION_ROLE_META[instruction.role];
  const reasons: string[] = [];

  const baseFit = Math.max(...meta.baseRoles.map(role => getPlayerSlotFitScore(player, role)));
  if (!meta.baseRoles.includes(slotRole)) {
    reasons.push(`${meta.label} non e' pensato per uno slot ${slotRole}.`);
  } else if (baseFit >= 0.85) {
    reasons.push(`Ruolo naturale (${player.role}) compatibile con lo slot.`);
  }

  const familiarityEntry = player.roleFamiliarity?.find(entry => entry.roleId === slotRole);
  if (familiarityEntry && familiarityEntry.familiarity >= 70) reasons.push('Familiarità di ruolo già alta su questa posizione.');

  const attrs = getPlayerRoleAttributes(player);
  const attrValue = (key: string) => attrs.find(entry => entry.key === key)?.val ?? player.overall;
  const attrFit = meta.keyAttributes.length ? clamp(average(meta.keyAttributes.map(attrValue)) / 100, 0, 1) : 0.7;
  if (meta.keyAttributes.length) {
    const weakestKey = [...meta.keyAttributes].sort((a, b) => attrValue(a) - attrValue(b))[0];
    if (attrValue(weakestKey) < 62) reasons.push(`Attributo chiave sotto la media per questo compito: ${weakestKey}.`);
    else if (attrFit >= 0.82) reasons.push('Attributi chiave del ruolo sopra la media.');
  }

  // Stamina/workload: solo per compiti ad alta intensita, solo se il dato (stamina base) esiste.
  const highIntensityRoles: PlayerInstructionRole[] = ['box_to_box', 'pressing_forward', 'ball_winning_midfielder', 'wingback_attack'];
  let staminaAdj = 0;
  if (highIntensityRoles.includes(instruction.role) || instruction.duty === 'attack') {
    if (player.stamina < 58) { staminaAdj = -0.06; reasons.push('Resistenza limitata per un compito così dispendioso.'); }
    else if (player.stamina >= 82) { staminaAdj = 0.03; reasons.push('Ottima resistenza per sostenere il compito nei 90 minuti.'); }
  }

  // Fisico: solo per il target man, solo se l'altezza e' un dato leggibile (mai un requisito rigido).
  let physicalAdj = 0;
  if (instruction.role === 'target_forward' && player.height) {
    const heightCm = Number.parseInt(player.height, 10);
    if (Number.isFinite(heightCm) && heightCm >= 186) { physicalAdj = 0.05; reasons.push('Fisico adatto a fare da riferimento offensivo.'); }
    else if (Number.isFinite(heightCm) && heightCm < 176) { physicalAdj = -0.05; reasons.push('Statura ridotta per un ruolo da riferimento fisico.'); }
  }

  const score01 = clamp(
    baseFit * 0.58 + attrFit * 0.3 + staminaAdj + physicalAdj + (familiarityEntry ? (familiarityEntry.familiarity / 100) * 0.08 : 0),
    0.05,
    1
  );
  const label: InstructionCompatibilityLabel =
    score01 >= 0.88 ? 'Ottimo' :
    score01 >= 0.74 ? 'Buono' :
    score01 >= 0.58 ? 'Adattato' :
    score01 >= 0.4 ? 'Rischioso' : 'Fuori ruolo';

  if (reasons.length === 0) reasons.push('Nessuna indicazione particolare: fit nella media per questo compito.');
  void tactic; // riservato per letture future (es. mentalita/pressing) senza rompere la firma della funzione

  return { score: Math.round(score01 * 100), label, reasons: reasons.slice(0, 4) };
};

// ─── T2: preset rapidi (cambiano solo il compito/duty, mai il modulo o il ruolo assegnato) ───

export type InstructionPresetId = 'prudente' | 'equilibrato' | 'aggressivo' | 'possesso' | 'contropiede' | 'pressing_alto';

export const INSTRUCTION_PRESET_LABELS: Record<InstructionPresetId, string> = {
  prudente: 'Prudente',
  equilibrato: 'Equilibrato',
  aggressivo: 'Aggressivo',
  possesso: 'Possesso',
  contropiede: 'Contropiede',
  pressing_alto: 'Pressing alto'
};

const DUTY_PRESETS: Record<Exclude<InstructionPresetId, 'equilibrato'>, Partial<Record<Player['role'], TacticalDuty>>> = {
  prudente: { CB: 'defend', LB: 'defend', RB: 'defend', DM: 'defend', CM: 'support', AM: 'support', LW: 'support', RW: 'support', ST: 'support' },
  aggressivo: { CB: 'defend', LB: 'attack', RB: 'attack', DM: 'support', CM: 'attack', AM: 'attack', LW: 'attack', RW: 'attack', ST: 'attack' },
  possesso: { CB: 'defend', LB: 'support', RB: 'support', DM: 'support', CM: 'support', AM: 'attack', LW: 'support', RW: 'support', ST: 'support' },
  contropiede: { CB: 'defend', LB: 'defend', RB: 'defend', DM: 'defend', CM: 'support', AM: 'attack', LW: 'attack', RW: 'attack', ST: 'attack' },
  pressing_alto: { CB: 'defend', LB: 'support', RB: 'support', DM: 'support', CM: 'attack', AM: 'attack', LW: 'attack', RW: 'attack', ST: 'attack' }
};

export const applyInstructionPreset = (
  instructions: Record<string, SlotInstruction>,
  module: Tactic['module'],
  preset: InstructionPresetId
): Record<string, SlotInstruction> => {
  const slots = POSITION_PRESETS[module];
  const defaults = preset === 'equilibrato' ? getDefaultSlotInstructions(module) : null;
  const dutyMap = preset === 'equilibrato' ? null : DUTY_PRESETS[preset];
  const result: Record<string, SlotInstruction> = {};
  slots.forEach((slot, index) => {
    const slotId = `slot_${index}`;
    const existing = instructions[slotId];
    if (!existing) return;
    const duty = defaults ? defaults[slotId].duty : (dutyMap?.[slot.role] ?? existing.duty);
    result[slotId] = { ...existing, duty };
  });
  return result;
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

  // T1: effetto reale del modulo scelto (mai solo estetico). I modificatori del modulo (statici,
  // in FORMATION_LIBRARY) pesano in modo piccolo ma deterministico su attacco/centrocampo/difesa/
  // fatica/rischio, esattamente come gia' fanno mentalita, pressing, ecc. Nessun Math.random qui.
  const formationMeta = FORMATION_LIBRARY[tactic.module];
  const fm = formationMeta.tacticalModifiers;
  const wideCreation = tactic.chanceCreation === 'Cross';
  const narrowCreation = tactic.chanceCreation === 'Tagli Interni' || tactic.chanceCreation === 'Passaggi Filtranti';
  const shapeChanceSynergy =
    (formationMeta.shapeType === 'wide' && wideCreation) ||
    ((formationMeta.shapeType === 'diamond' || formationMeta.shapeType === 'narrow' || formationMeta.shapeType === 'possession') && narrowCreation)
      ? 3
      : (formationMeta.shapeType === 'wide' && narrowCreation) ||
        ((formationMeta.shapeType === 'diamond' || formationMeta.shapeType === 'narrow') && wideCreation)
        ? -3
        : 0;

  // T2: ruoli/compiti individuali per slot. Ogni titolare porta il piccolo modificatore del proprio
  // PlayerInstructionRole, scalato dal compito (duty: attack amplifica gli assi offensivi e il rischio,
  // defend li smorza), poi mediato sugli 11 in campo cosi' l'effetto resta percepibile ma mai enorme.
  const slotInstructions = tactic.slotInstructions ?? getDefaultSlotInstructions(tactic.module);
  const instructionMismatchWarnings: string[] = [];
  const instructionAccum = { attack: 0, midfield: 0, defense: 0, chance: 0, risk: 0, fatigue: 0 };
  lineup.forEach((player, index) => {
    const instruction = slotInstructions[`slot_${index}`];
    if (!instruction) return;
    const roleMeta = PLAYER_INSTRUCTION_ROLE_META[instruction.role];
    const dutyAxis = DUTY_AXIS_MULTIPLIERS[instruction.duty];
    const m = roleMeta.modifiers;
    instructionAccum.attack += (m.chanceCreation * 0.3 + m.wingThreat * 0.25 + m.counterAttack * 0.2) * dutyAxis.offense;
    instructionAccum.midfield += (m.centralControl * 0.3 + m.possessionControl * 0.2) * dutyAxis.offense;
    instructionAccum.defense += (m.defensiveSolidity * 0.3 - m.defensiveTransitionRisk * 0.1) * dutyAxis.defense;
    instructionAccum.chance += (m.chanceCreation * 0.25) * dutyAxis.offense;
    instructionAccum.risk += (m.defensiveTransitionRisk * 0.3 - m.defensiveSolidity * 0.15) * dutyAxis.risk;
    instructionAccum.fatigue += m.fatigueLoad * dutyAxis.fatigue;

    const compat = getInstructionCompatibility(player, instruction.role);
    if (compat.label === 'Rischioso' || compat.label === 'Fuori ruolo') {
      instructionMismatchWarnings.push(`${player.name}: ${compat.label.toLowerCase()} come ${roleMeta.label}.`);
    }
  });
  // Normalizza su un "reparto tipo" (5), non sull'intera rosa: cosi' cambiare anche un solo slot
  // produce un effetto reale e verificabile, mentre allineare piu' ruoli coerenti (es. tutti i
  // reparti offensivi) puo' sommarsi fino a un impatto piu marcato, senza mai esplodere.
  const instructionNormalizer = 5;
  const instructionImpact = {
    attack: instructionAccum.attack / instructionNormalizer,
    midfield: instructionAccum.midfield / instructionNormalizer,
    defense: instructionAccum.defense / instructionNormalizer,
    chance: instructionAccum.chance / instructionNormalizer,
    risk: instructionAccum.risk / instructionNormalizer,
    fatigue: instructionAccum.fatigue / instructionNormalizer
  };

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
    principleImpact.attack + automatismMatchBonus * 0.45 + personalityReport.chanceSwing * 0.4 +
    fm.chanceCreation * 0.35 + fm.wingThreat * 0.25 + fm.counterAttack * 0.2 + shapeChanceSynergy +
    instructionImpact.attack,
    45,
    95
  );
  const midfield = clamp(
    midfieldBase + buildUpBonus * 0.6 + markingBonus * 0.4 + (tactic.tempo - 50) * 0.03 +
    principleImpact.midfield + automatismMatchBonus * 0.5 +
    fm.centralControl * 0.35 + fm.possessionControl * 0.2 +
    instructionImpact.midfield,
    45,
    95
  );
  const defense = clamp(
    defenseBase + markingBonus + lowBlockBonus + mentalityDefense + pressingReward - highLineRisk - riskDefensePenalty +
    principleImpact.defense + automatismMatchBonus * 0.35 +
    fm.defensiveSolidity * 0.35 - fm.defensiveTransitionRisk * 0.15 +
    instructionImpact.defense,
    45,
    95
  );
  const cohesion = clamp(avgMorale * 0.28 + avgForm * 0.18 + avgCondition * 0.16 + compatibility * 0.38 + automatismCohesionBonus + personalityReport.cohesionSwing, 35, 100);

  const fatigueLoad = clamp(
    8 + tactic.pressing * 0.09 + tactic.tempo * 0.05 + tactic.defensiveLine * 0.03 + tactic.riskLevel * 0.04 +
    (100 - compatibility) * 0.11 + principleImpact.fatigue - Math.max(0, automatisms - 65) * 0.035 -
    personalityReport.performanceSwing * 0.12 + fm.fatigueLoad * 0.5 + instructionImpact.fatigue,
    8,
    36
  );
  const chanceQuality = clamp(attack * 0.72 + midfield * 0.18 + compatibility * 0.1 + principleImpact.chanceQuality + automatismMatchBonus * 0.5 + personalityReport.chanceSwing + fm.chanceCreation * 0.3 + shapeChanceSynergy * 0.6 + instructionImpact.chance, 35, 96);
  const foulRisk = clamp(5 + tactic.pressing * 0.08 + (tactic.marking === 'Uomo' ? 4 : 0) + (100 - compatibility) * 0.04 + principleImpact.foulRisk + personalityReport.foulSwing + fm.pressingPotential * 0.15, 3, 28);
  const opponentRisk = clamp(48 + tactic.riskLevel * 0.12 + tactic.defensiveLine * 0.09 - defense * 0.18 - compatibility * 0.08 + principleImpact.opponentRisk - automatismRiskRelief + fm.defensiveTransitionRisk * 0.6 - fm.defensiveSolidity * 0.3 + instructionImpact.risk, 22, 84);
  const matchScore = clamp(avgOverall * 0.32 + attack * 0.24 + midfield * 0.2 + defense * 0.18 + cohesion * 0.06 + automatismMatchBonus + personalityReport.performanceSwing * 0.55, 45, 94);

  const warnings = slotFits
    .filter(fit => fit.score < 0.65)
    .slice(0, 4)
    .map(fit => `${fit.playerName}: ${fit.playerRole} schierato da ${fit.slotRole}`);

  if (tactic.pressing > 78 && avgCondition < 75) warnings.push('Pressing alto con condizione bassa: calo fisico probabile nel finale.');
  if (tactic.defensiveLine > 76 && defense < 76) warnings.push('Linea alta senza copertura solida: gli avversari troveranno spazio alle spalle.');
  if (tactic.chanceCreation === 'Cross' && roleScore(lineup, ['ST']) < 76) warnings.push('Tanti cross senza una punta dominante: qualita occasioni ridotta.');
  if (tactic.attackingFocus === 'Fasce' && roleScore(lineup, ['LW', 'RW', 'LB', 'RB']) < 75) warnings.push('Focus sulle fasce con pochi specialisti: manovra prevedibile.');
  if (shapeChanceSynergy < 0) warnings.push(`${formationMeta.label} si abbina meglio a un altro tipo di occasione: la scelta attuale (${tactic.chanceCreation}) non sfrutta appieno la forma del modulo.`);
  if (formationMeta.weaknesses[0]) warnings.push(`${formationMeta.label}: ${formationMeta.weaknesses[0]}`);
  instructionMismatchWarnings.slice(0, 3).forEach(warning => warnings.push(warning));
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

// ─── T1: compatibilita rosa per modulo (indipendente dagli 11 titolari attuali) ───
// Per ogni slot del modulo trova il miglior giocatore disponibile in rosa (assegnazione greedy per
// ruolo, deterministica), per capire se il modulo e sostenibile con la rosa reale, non solo con
// l'undici sceso in campo oggi.

export interface FormationCompatibilityReport {
  compatibilityScore: number; // 0-100
  missingRoles: Player['role'][]; // slot senza un giocatore adatto in rosa (miglior fit < 0.55)
  keyPlayers: string[]; // giocatori che si adattano molto bene al modulo (fit >= 0.85), max 4
  adaptationRisk: 'low' | 'medium' | 'high';
}

export const getFormationCompatibilityReport = (players: Player[], module: Tactic['module']): FormationCompatibilityReport => {
  const slots = POSITION_PRESETS[module];
  const used = new Set<string>();

  const slotAssignments = slots.map(slot => {
    const ranked = players
      .filter(player => !used.has(player.id))
      .map(player => ({ player, score: getPlayerSlotFitScore(player, slot.role) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (best) used.add(best.player.id);
    return { slotRole: slot.role, bestPlayerName: best?.player.name ?? null, score: best?.score ?? 0 };
  });

  const compatibilityScore = Math.round(average(slotAssignments.map(entry => entry.score)) * 100);
  const missingRoles = Array.from(new Set(
    slotAssignments.filter(entry => entry.score < 0.55).map(entry => entry.slotRole)
  ));
  const keyPlayers = slotAssignments
    .filter(entry => entry.score >= 0.85 && entry.bestPlayerName)
    .slice(0, 4)
    .map(entry => entry.bestPlayerName as string);
  const adaptationRisk: FormationCompatibilityReport['adaptationRisk'] =
    compatibilityScore >= 78 ? 'low' : compatibilityScore >= 60 ? 'medium' : 'high';

  return { compatibilityScore, missingRoles, keyPlayers, adaptationRisk };
};
