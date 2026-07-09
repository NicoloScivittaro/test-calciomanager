// ─── Manual career backup: export/import the full career as a JSON file ───

export interface CareerBackupFile {
  format: 'calciomanager-career-backup';
  schemaVersion: 1;
  exportedAt: string;
  appDataVersion: string;
  selectedClubName?: string;
  storage: Record<string, string | null>;
}

export interface CareerBackupValidation {
  ok: boolean;
  reason?: string;
}

export const createCareerBackup = (
  careerStorageKeys: string[],
  appDataVersion: string,
  selectedClubName?: string
): CareerBackupFile => {
  const storage: Record<string, string | null> = {};
  careerStorageKeys.forEach(key => {
    storage[key] = localStorage.getItem(key);
  });

  return {
    format: 'calciomanager-career-backup',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appDataVersion,
    selectedClubName,
    storage
  };
};

const sanitizeForFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Carriera';

const formatBackupTimestamp = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
};

export const buildCareerBackupFileName = (selectedClubName?: string, date: Date = new Date()): string => {
  const clubPart = sanitizeForFileName(selectedClubName ?? 'Carriera');
  return `CalcioManager_${clubPart}_${formatBackupTimestamp(date)}.json`;
};

export const downloadCareerBackup = (backup: CareerBackupFile): void => {
  const fileName = buildCareerBackupFileName(backup.selectedClubName);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const parseCareerBackupFile = async (file: File): Promise<CareerBackupFile> => {
  let raw: unknown;
  try {
    const text = await file.text();
    raw = JSON.parse(text);
  } catch {
    throw new Error('Il file selezionato non è un JSON valido.');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Il file selezionato non ha un formato di backup valido.');
  }

  const candidate = raw as Record<string, unknown>;

  if (candidate.format !== 'calciomanager-career-backup') {
    throw new Error('Questo file non è un salvataggio di CalcioManager.');
  }
  if (candidate.schemaVersion !== 1) {
    throw new Error('Formato di backup non supportato da questa versione del gioco.');
  }
  if (!candidate.storage || typeof candidate.storage !== 'object' || Array.isArray(candidate.storage)) {
    throw new Error('Il file di backup non contiene dati di carriera validi.');
  }

  return candidate as unknown as CareerBackupFile;
};

export const validateCareerBackup = (backup: CareerBackupFile, appDataVersion: string): CareerBackupValidation => {
  if (backup.format !== 'calciomanager-career-backup') {
    return { ok: false, reason: 'Il file non è un salvataggio di CalcioManager.' };
  }
  if (backup.schemaVersion !== 1) {
    return { ok: false, reason: 'Formato di backup non supportato da questa versione del gioco.' };
  }
  if (!backup.storage || typeof backup.storage !== 'object') {
    return { ok: false, reason: 'Il file di backup non contiene dati di carriera validi.' };
  }
  if (backup.appDataVersion !== appDataVersion) {
    return {
      ok: false,
      reason: 'Questo salvataggio è stato creato con una versione dei dati diversa da quella attuale e non può essere importato in sicurezza.'
    };
  }
  return { ok: true };
};

// Restores localStorage from the backup. Atomic from the user's perspective:
// any failure mid-write rolls back every key to its pre-restore value.
export const restoreCareerBackup = (backup: CareerBackupFile, careerStorageKeys: string[]): void => {
  const snapshot = new Map<string, string | null>();
  careerStorageKeys.forEach(key => snapshot.set(key, localStorage.getItem(key)));

  try {
    careerStorageKeys.forEach(key => {
      const value = backup.storage[key];
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    snapshot.forEach((value, key) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
    throw error instanceof Error ? error : new Error('Ripristino del salvataggio non riuscito.');
  }
};
