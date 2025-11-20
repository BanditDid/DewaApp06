
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface BabyProfile {
  name: string;
  birthDate: string; // ISO Date string
}

export interface Photo {
  id: string;
  url: string; // Object URL or Base64 for demo, Drive ID in prod
  mimeType: string;
}

export interface JournalEntry {
  id: string;
  date: string; // ISO Date string (Date taken)
  photos: Photo[];
  notes: string;
  tags: string[];
  ageAtTime: AgeDuration;
}

export interface AgeDuration {
  years: number;
  months: number;
  days: number;
}

export enum ViewMode {
  List = 'LIST',
  Grid = 'GRID',
}

// Interface กลางสำหรับ API Service
export interface IService {
  initClient(): Promise<void>;
  login(): Promise<User>;
  setupStorage(): Promise<{ folderId: string, spreadsheetId: string }>;
  getProfile(): Promise<BabyProfile | null>;
  saveProfile(profile: BabyProfile): Promise<void>;
  getEntries(): Promise<JournalEntry[]>;
  saveEntry(entryData: any, birthDate: string, localPhotoFiles: File[]): Promise<JournalEntry>;
  deleteEntry(id: string): Promise<void>;
  getTags(): Promise<string[]>;
  saveTags(tags: string[]): Promise<void>;
}
