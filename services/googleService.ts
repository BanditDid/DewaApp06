
import { JournalEntry, User, BabyProfile, Photo } from '../types';
import { generateId, calculateAge } from '../utils';

// --- 1. ส่วนจัดการ Environment Variables (แบบใหม่) ---

// Config Interface
export interface GoogleConfig {
    clientId: string;
    apiKey: string;
}

// Helper: ดึงค่า Env อย่างปลอดภัย
const getEnv = (key: string): string => {
    try {
        // @ts-ignore
        return (import.meta.env && import.meta.env[key]) || '';
    } catch (e) {
        return '';
    }
};

// State: เก็บค่า Config
let currentConfig: GoogleConfig = {
    clientId: getEnv('VITE_GOOGLE_CLIENT_ID'),
    apiKey: getEnv('VITE_GOOGLE_API_KEY')
};

// Export ฟังก์ชันสำหรับ Inject Config จากภายนอก
export const setGoogleConfig = (config: GoogleConfig) => {
    currentConfig = config;
};

// ตรวจสอบว่ามีค่า Config หรือไม่
export const isGoogleConfigured = () => {
    return currentConfig.clientId && currentConfig.apiKey;
};


// --- 2. ค่าคงที่อื่นๆ (Constants) ---
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest'
];

const APP_FOLDER_NAME = 'BabyPhotoJournal_Data';
const SPREADSHEET_NAME = 'BabyJournal_Database';

let gapiInited = false;
let gisInited = false;


// --- 3. GoogleService ---

export const GoogleService = {
  tokenClient: null as any,

  // 1. Init
  initClient: async (): Promise<void> => {
    console.log("Initializing Google Client...");
    
    if (!isGoogleConfigured()) {
      console.error("Missing Config:", currentConfig);
      throw new Error('ไม่พบการตั้งค่า Environment Variables (VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY)');
    }

    const waitForScripts = () => new Promise<void>((resolve, reject) => {
      const maxAttempts = 50; 
      let attempts = 0;
      
      const interval = setInterval(() => {
        attempts++;
        if ((window as any).gapi && (window as any).google) {
          clearInterval(interval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error("ไม่สามารถโหลด Google Scripts ได้"));
        }
      }, 100);
    });

    await waitForScripts();

    return new Promise((resolve, reject) => {
      try {
        (window as any).gapi.load('client', async () => {
          try {
            await (window as any).gapi.client.init({
              apiKey: currentConfig.apiKey,
              discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;
            if (gisInited) resolve();
          } catch (err: any) {
            reject(new Error(`GAPI Init Error: ${JSON.stringify(err)}`));
          }
        });

        GoogleService.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: currentConfig.clientId,
          scope: SCOPES,
          callback: '', 
        });
        gisInited = true;
        if (gapiInited) resolve();
      } catch (err) {
        reject(err);
      }
    });
  },

  // 2. Login
  login: async (): Promise<User> => {
    return new Promise((resolve, reject) => {
      try {
        GoogleService.tokenClient.callback = async (resp: any) => {
          if (resp.error) {
            reject(resp);
          }
          try {
            const response = await (window as any).gapi.client.drive.about.get({
              fields: "user"
            });
            const userData = response.result.user;
            resolve({
              id: userData.permissionId,
              name: userData.displayName,
              email: userData.emailAddress,
              avatarUrl: userData.photoLink
            });
          } catch (err) {
            reject(err);
          }
        };
        
        if ((window as any).gapi.client.getToken() === null) {
          GoogleService.tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
          GoogleService.tokenClient.requestAccessToken({prompt: ''});
        }
      } catch (e) {
        reject(e);
      }
    });
  },

  // 3. Setup Storage
  setupStorage: async (): Promise<{ folderId: string, spreadsheetId: string }> => {
    try {
      let folderId = localStorage.getItem('bpj_folder_id') || '';
      
      if(!folderId) {
          const folderRes = await (window as any).gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)',
          });
          if (folderRes.result.files.length > 0) {
            folderId = folderRes.result.files[0].id;
          } else {
            const createRes = await (window as any).gapi.client.drive.files.create({
              resource: { name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
              fields: 'id',
            });
            folderId = createRes.result.id;
          }
          localStorage.setItem('bpj_folder_id', folderId);
      }

      let spreadsheetId = localStorage.getItem('bpj_sheet_id') || '';
      if(!spreadsheetId) {
          const sheetRes = await (window as any).gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${SPREADSHEET_NAME}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
          });
          if (sheetRes.result.files.length > 0) {
            spreadsheetId = sheetRes.result.files[0].id;
          } else {
            const createSheetRes = await (window as any).gapi.client.sheets.spreadsheets.create({
              resource: {
                properties: { title: SPREADSHEET_NAME },
                sheets: [
                  { properties: { title: 'Entries' } },
                  { properties: { title: 'Profile' } },
                  { properties: { title: 'Tags' } }
                ]
              },
            });
            spreadsheetId = createSheetRes.result.spreadsheetId;
            await (window as any).gapi.client.drive.files.update({
              fileId: spreadsheetId,
              addParents: folderId,
              fields: 'id, parents',
            });
            await (window as any).gapi.client.sheets.spreadsheets.values.batchUpdate({
              spreadsheetId,
              resource: {
                valueInputOption: 'USER_ENTERED',
                data: [
                  { range: 'Entries!A1:E1', values: [['ID', 'Date', 'Notes', 'Tags (JSON)', 'Photos (JSON)']] },
                  { range: 'Profile!A1:B1', values: [['Name', 'BirthDate']] },
                  { range: 'Tags!A1:A1', values: [['TagName']] }
                ]
              }
            });
          }
          localStorage.setItem('bpj_sheet_id', spreadsheetId);
      }

      return { folderId, spreadsheetId };
    } catch (error) {
      console.error("Error setting up storage:", error);
      throw error;
    }
  },

  // Helper: แก้ไข URL รูปภาพให้แสดงผลได้
  fixPhotoUrl: (photo: Photo): Photo => {
    // ถ้าเป็น URL แบบเก่า (lh3) หรือไม่มี sz ให้เปลี่ยนเป็น thumbnail link ที่ถูกต้อง
    if (photo.url.includes('lh3.googleusercontent.com/d/') || !photo.url.includes('sz=')) {
        // ดึง ID ออกมา
        let id = photo.id;
        // กรณีที่ ID ใน Photo object ไม่ตรง (เผื่อไว้) แต่ปกติเราเก็บ ID แยกอยู่แล้ว
        return {
            ...photo,
            // ใช้ URL ที่บังคับขนาดภาพ 1024px (sz=w1024) ซึ่งเข้าถึงได้ง่ายกว่าสำหรับเจ้าของไฟล์
            url: `https://drive.google.com/thumbnail?id=${id}&sz=w1024`
        };
    }
    return photo;
  },

  // 4. Get Entries
  getEntries: async (): Promise<JournalEntry[]> => {
     const spreadsheetId = localStorage.getItem('bpj_sheet_id');
     if (!spreadsheetId) return [];
     const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
       spreadsheetId, range: 'Entries!A2:E',
     });
     const rows = response.result.values || [];
     const birthDate = await GoogleService.getBirthDateOnly();
     
     return rows.map((row: any[]) => {
       const date = row[1];
       const ageAtTime = birthDate ? calculateAge(birthDate, date) : { years: 0, months: 0, days: 0 };
       
       let photos: Photo[] = row[4] ? JSON.parse(row[4]) : [];
       // Fix URLs on load
       photos = photos.map(GoogleService.fixPhotoUrl);

       return {
         id: row[0], date: date, notes: row[2] || '',
         tags: row[3] ? JSON.parse(row[3]) : [],
         photos: photos,
         ageAtTime
       };
     }).reverse();
  },

  getBirthDateOnly: async (): Promise<string | null> => {
    const profile = await GoogleService.getProfile();
    return profile ? profile.birthDate : null;
  },

  // 5. Get Profile
  getProfile: async (): Promise<BabyProfile | null> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    if (!spreadsheetId) return null;
    const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId, range: 'Profile!A2:B2',
    });
    const rows = response.result.values;
    if (rows && rows.length > 0) return { name: rows[0][0], birthDate: rows[0][1] };
    return null;
  },

  // 6. Save Profile
  saveProfile: async (profile: BabyProfile): Promise<void> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    await (window as any).gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId, range: 'Profile!A2:B2',
      valueInputOption: 'USER_ENTERED', resource: { values: [[profile.name, profile.birthDate]] }
    });
  },

  // 7. Get Tags
  getTags: async (): Promise<string[]> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    if (!spreadsheetId) return [];
    const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId, range: 'Tags!A2:A',
    });
    const defaultTags = ['มีความสุข', 'เหตุการณ์สำคัญ', 'ตลก', 'นอนหลับ', 'ครอบครัว'];
    if (!response.result.values) return defaultTags;
    return [...new Set([...defaultTags, ...response.result.values.flat()])];
  },

  saveTags: async (tags: string[]): Promise<void> => {
     const spreadsheetId = localStorage.getItem('bpj_sheet_id');
     await (window as any).gapi.client.sheets.spreadsheets.values.update({
       spreadsheetId, range: 'Tags!A2:A', valueInputOption: 'USER_ENTERED', resource: { values: tags.map(t => [t]) }
     });
  },

  // 8. Upload File (แก้ไข URL)
  uploadFile: async (file: File): Promise<Photo> => {
    const folderId = localStorage.getItem('bpj_folder_id');
    const metadata = { name: file.name, mimeType: file.type, parents: [folderId] };
    const accessToken = (window as any).gapi.auth.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,thumbnailLink', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form,
    });
    
    const data = await res.json();
    
    // ใช้ URL แบบ Thumbnail Link ขนาดใหญ่ (sz=w1024) แทน lh3.../d/
    // วิธีนี้ช่วยให้แสดงรูปภาพได้แม้ไฟล์จะเป็น Private (ตราบใดที่ User Login Browser อยู่)
    const robustUrl = `https://drive.google.com/thumbnail?id=${data.id}&sz=w1024`;

    return {
      id: data.id,
      url: robustUrl, 
      mimeType: file.type
    };
  },

  // 9. Save Entry
  saveEntry: async (entryData: any, birthDate: string, localPhotoFiles: File[]): Promise<JournalEntry> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    const newPhotos: Photo[] = [];
    for (const file of localPhotoFiles) {
       const photo = await GoogleService.uploadFile(file);
       newPhotos.push(photo);
    }
    // รวมรูปเก่า (ที่ไม่ใช่ temp) กับรูปใหม่
    const oldPhotos = (entryData.photos || []).filter((p: Photo) => !p.id.startsWith('temp-'));
    const finalPhotos = [...oldPhotos, ...newPhotos];
    
    const ageAtTime = calculateAge(birthDate, entryData.date);
    
    const newEntry: JournalEntry = {
       id: entryData.id || generateId(),
       date: entryData.date, notes: entryData.notes, tags: entryData.tags, photos: finalPhotos, ageAtTime
    };

    const rowValues = [
      newEntry.id, newEntry.date, newEntry.notes,
      JSON.stringify(newEntry.tags), JSON.stringify(newEntry.photos)
    ];

    if (entryData.id) {
      const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId, range: 'Entries!A2:A',
      });
      const ids = response.result.values ? response.result.values.flat() : [];
      const rowIndex = ids.findIndex((id: string) => id === entryData.id);
      
      if (rowIndex !== -1) {
        const sheetRow = rowIndex + 2;
        await (window as any).gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId, range: `Entries!A${sheetRow}:E${sheetRow}`,
            valueInputOption: 'USER_ENTERED', resource: { values: [rowValues] }
        });
      }
    } else {
      await (window as any).gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId, range: 'Entries!A:E',
        valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', resource: { values: [rowValues] }
      });
    }
    return newEntry;
  },

  // 10. Delete Entry
  deleteEntry: async (id: string): Promise<void> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId, range: 'Entries!A2:A', 
    });
    const ids = response.result.values ? response.result.values.flat() : [];
    const rowIndex = ids.findIndex((rowId: string) => rowId === id);
    
    if (rowIndex !== -1) {
        const gridRowIndex = rowIndex + 1; 
        await (window as any).gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ deleteDimension: { range: { sheetId: 0, dimension: 'ROWS', startIndex: gridRowIndex, endIndex: gridRowIndex + 1 } } }] }
        });
    }
  }
};
