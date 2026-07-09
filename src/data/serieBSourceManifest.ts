// ─── Manifest di completezza dati Serie B 2025/26 ───
//
// Stato reale, aggiornato manualmente ogni volta che una rosa viene sostituita con dati
// verificati. Oggi TUTTI i 20 club sono "missing": nessuna rosa reale verificata è
// disponibile in questo ambiente (vedi realSerieBRosters2025.ts per i placeholder usati
// al suo posto). Non dichiarare mai un club "complete" senza aver prima aggiornato
// verifiedPlayerCount/sourceType con dati reali controllati.

import { RosterSourceStatus } from '../types';
import { SERIE_B_CLUBS } from './serieBData2025';

const MINIMUM_REQUIRED_PLAYERS = 18;

export const SERIE_B_ROSTER_MANIFEST: RosterSourceStatus[] = SERIE_B_CLUBS.map(club => ({
  clubId: club.id,
  season: '2025/26',
  verifiedPlayerCount: 0,
  minimumRequired: MINIMUM_REQUIRED_PLAYERS,
  status: 'missing',
  sourceType: 'missing',
}));

export interface SerieBCompletenessReport {
  totalClubs: number;
  completeClubs: number;
  partialClubs: number;
  missingClubs: string[]; // nomi club
  isFullyComplete: boolean; // true solo con 20/20 "complete"
}

export const getSerieBCompletenessReport = (): SerieBCompletenessReport => {
  const completeClubs = SERIE_B_ROSTER_MANIFEST.filter(entry => entry.status === 'complete').length;
  const partialClubs = SERIE_B_ROSTER_MANIFEST.filter(entry => entry.status === 'partial').length;
  const missingClubs = SERIE_B_ROSTER_MANIFEST
    .filter(entry => entry.status === 'missing')
    .map(entry => SERIE_B_CLUBS.find(club => club.id === entry.clubId)?.name ?? entry.clubId);

  return {
    totalClubs: SERIE_B_ROSTER_MANIFEST.length,
    completeClubs,
    partialClubs,
    missingClubs,
    isFullyComplete: completeClubs === SERIE_B_ROSTER_MANIFEST.length,
  };
};
