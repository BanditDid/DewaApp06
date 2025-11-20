
import { JournalEntry, User, BabyProfile, IService, Photo } from '../types';
import { generateId, calculateAge } from '../utils';

// Keys for LocalStorage
const STORAGE_KEY_ENTRIES = 'bpj_entries';
const STORAGE_KEY_PROFILE = 'bpj_profile';
const STORAGE_KEY_TAGS = 'bpj_tags';

// จำลองความล่าช้า (Simulated latency)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock Data Service
export const MockService: IService = {
  // 1. จำลองการ Init (ไม่ต้องทำอะไร แต่ต้องมี method)
  initClient: async (): Promise<void> => {
    console.log("[Mock Mode] Initializing...");
    await delay(500);
  },

  // 2. จำลองการ Login
  login: async (): Promise<User> => {
    await delay(800);
    return {
      id: 'mock_user_123',
      name: 'ผู้ใช้งานทดสอบ (Mock)',
      email: 'test@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
    };
  },

  // 3. จำลองการ Setup
  setupStorage: async (): Promise<{ folderId: string, spreadsheetId: string }> => {
    await delay(300);
    return { folderId: 'mock_folder', spreadsheetId: 'mock_sheet' };
  },

  getProfile: async (): Promise<BabyProfile | null> => {
    const data = localStorage.getItem(STORAGE_KEY_PROFILE);
    return data ? JSON.parse(data) : null;
  },

  saveProfile: async (profile: BabyProfile): Promise<void> => {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  },

  getTags: async (): Promise<string[]> => {
    const data = localStorage.getItem(STORAGE_KEY_TAGS);
    return data ? JSON.parse(data) : ['มีความสุข', 'เหตุการณ์สำคัญ', 'ตลก', 'นอนหลับ', 'ครอบครัว'];
  },

  saveTags: async (tags: string[]): Promise<void> => {
    localStorage.setItem(STORAGE_KEY_TAGS, JSON.stringify(tags));
  },

  getEntries: async (): Promise<JournalEntry[]> => {
    await delay(500);
    const data = localStorage.getItem(STORAGE_KEY_ENTRIES);
    return data ? JSON.parse(data) : [];
  },

  // ฟังก์ชันจำลองการอัปโหลดและบันทึก
  saveEntry: async (entryData: any, birthDate: string, localPhotoFiles: File[]): Promise<JournalEntry> => {
    await delay(1000);
    const entries = await MockService.getEntries();
    
    // จำลองการอัปโหลดรูป (แปลง File เป็น Object URL)
    const newPhotos: Photo[] = localPhotoFiles.map(file => ({
      id: 'mock_img_' + generateId(),
      url: URL.createObjectURL(file), // ใช้ Local URL แทน Drive URL
      mimeType: file.type
    }));

    const finalPhotos = [...(entryData.photos || []), ...newPhotos];
    const ageAtTime = calculateAge(birthDate, entryData.date);
    
    let newEntry: JournalEntry;

    if (entryData.id) {
      // แก้ไขข้อมูลเดิม
      const index = entries.findIndex(e => e.id === entryData.id);
      if (index === -1) throw new Error("Entry not found");
      
      newEntry = {
        ...entries[index],
        date: entryData.date,
        notes: entryData.notes,
        tags: entryData.tags,
        photos: finalPhotos,
        ageAtTime,
        id: entryData.id
      };
      entries[index] = newEntry;
    } else {
      // สร้างใหม่
      newEntry = {
        id: generateId(),
        date: entryData.date,
        notes: entryData.notes,
        tags: entryData.tags,
        photos: finalPhotos,
        ageAtTime
      };
      entries.unshift(newEntry); // เพิ่มไว้บนสุด
    }

    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
    return newEntry;
  },

  deleteEntry: async (id: string): Promise<void> => {
    await delay(300);
    const entries = await MockService.getEntries();
    const filtered = entries.filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(filtered));
  }
};
