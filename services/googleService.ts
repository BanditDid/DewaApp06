
import { JournalEntry, User, BabyProfile, Photo } from '../types';
import { generateId, calculateAge } from '../utils';

// --- การตั้งค่า (CONFIGURATION) ---
// ใช้ Environment Variables จาก Vercel
// สำคัญ: หากเพิ่มตัวแปรใน Vercel แล้ว ต้องทำการ REDEPLOY (Build ใหม่) 1 ครั้งเพื่อให้ค่าถูกอ่านเข้ามา
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''; 
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

// Scopes ที่ต้องขออนุญาต: Drive (จัดการไฟล์), Sheets (จัดการข้อมูล)
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest'
];

// ชื่อไฟล์และโฟลเดอร์ที่จะสร้างใน Drive ของผู้ใช้
const APP_FOLDER_NAME = 'BabyPhotoJournal_Data';
const SPREADSHEET_NAME = 'BabyJournal_Database';

// Helper สำหรับรอ gapi โหลดเสร็จ
let gapiInited = false;
let gisInited = false;

export const GoogleService = {
  tokenClient: null as any,

  // 1. เริ่มต้นระบบ (Initialize)
  initClient: async (): Promise<void> => {
    console.log("Initializing Google Client...");
    
    // ตรวจสอบว่ามีการตั้งค่า Key หรือยัง
    if (!CLIENT_ID || !API_KEY) {
      console.error("Missing Env Vars - ClientID:", !!CLIENT_ID, "APIKey:", !!API_KEY);
      throw new Error('ไม่พบการตั้งค่า Environment Variables (NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_API_KEY) \n\nหากคุณเพิ่งเพิ่มค่าใน Vercel กรุณากด "Redeploy" เพื่อให้ระบบอัปเดตค่าใหม่');
    }

    // รอให้ Script ของ Google โหลดเข้ามาใน window
    const waitForScripts = () => new Promise<void>((resolve, reject) => {
      const maxAttempts = 50; // รอประมาณ 5 วินาที
      let attempts = 0;
      
      const interval = setInterval(() => {
        attempts++;
        if ((window as any).gapi && (window as any).google) {
          clearInterval(interval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error("ไม่สามารถโหลด Google Scripts ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือ Adblock"));
        }
      }, 100);
    });

    await waitForScripts();

    return new Promise((resolve, reject) => {
      try {
        // โหลด GAPI Client
        (window as any).gapi.load('client', async () => {
          try {
            await (window as any).gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;
            if (gisInited) resolve();
          } catch (err: any) {
            reject(new Error(`GAPI Init Error: ${err.result?.error?.message || JSON.stringify(err)}`));
          }
        });

        // โหลด GIS Client (Google Identity Services)
        GoogleService.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: '', // จะกำหนดตอนเรียก requestAccessToken
        });
        gisInited = true;
        if (gapiInited) resolve();
      } catch (err) {
        reject(err);
      }
    });
  },

  // 2. ล็อกอิน (Login)
  login: async (): Promise<User> => {
    return new Promise((resolve, reject) => {
      try {
        GoogleService.tokenClient.callback = async (resp: any) => {
          if (resp.error) {
            reject(resp);
          }
          // ดึงข้อมูลผู้ใช้จาก Drive API (เพื่อเอาชื่อ/รูป)
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
        
        // ขอ Token หรือขออนุญาต
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

  // 3. ตรวจสอบและสร้างโครงสร้างไฟล์ (Setup Folder & Sheet)
  // ฟังก์ชันนี้จะหาว่ามีโฟลเดอร์และไฟล์ Sheet ของแอพหรือยัง ถ้าไม่มีจะสร้างใหม่
  setupStorage: async (): Promise<{ folderId: string, spreadsheetId: string }> => {
    try {
      // A. หาโฟลเดอร์
      let folderId = '';
      const folderRes = await (window as any).gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
        fields: 'files(id, name)',
      });

      if (folderRes.result.files.length > 0) {
        folderId = folderRes.result.files[0].id;
      } else {
        // สร้างโฟลเดอร์ใหม่
        const createRes = await (window as any).gapi.client.drive.files.create({
          resource: {
            name: APP_FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        folderId = createRes.result.id;
      }

      // B. หา Spreadsheet ในโฟลเดอร์นั้น
      let spreadsheetId = '';
      const sheetRes = await (window as any).gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${SPREADSHEET_NAME}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
      });

      if (sheetRes.result.files.length > 0) {
        spreadsheetId = sheetRes.result.files[0].id;
      } else {
        // สร้าง Spreadsheet ใหม่ โดยใช้ Sheets API
        const createSheetRes = await (window as any).gapi.client.sheets.spreadsheets.create({
          resource: {
            properties: { title: SPREADSHEET_NAME },
            sheets: [
              { properties: { title: 'Entries' } }, // แผ่นงานเก็บข้อมูลบันทึก
              { properties: { title: 'Profile' } }, // แผ่นงานเก็บข้อมูลโปรไฟล์เด็ก
              { properties: { title: 'Tags' } }     // แผ่นงานเก็บ Tag
            ]
          },
        });
        spreadsheetId = createSheetRes.result.spreadsheetId;
        
        // ย้ายไฟล์ Sheet เข้าไปใน Folder (Drive API v3 ใช้ addParents)
        await (window as any).gapi.client.drive.files.update({
          fileId: spreadsheetId,
          addParents: folderId,
          fields: 'id, parents',
        });

        // สร้าง Header ให้ Sheet
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

      // เก็บ ID ไว้ใน localStorage เพื่อลดการ request รอบหน้า
      localStorage.setItem('bpj_folder_id', folderId);
      localStorage.setItem('bpj_sheet_id', spreadsheetId);

      return { folderId, spreadsheetId };
    } catch (error) {
      console.error("Error setting up storage:", error);
      throw error;
    }
  },

  // 4. ดึงข้อมูล Entries (Get Entries)
  getEntries: async (): Promise<JournalEntry[]> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    if (!spreadsheetId) return [];

    const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Entries!A2:E', // อ่านตั้งแต่แถว 2 (ข้าม Header)
    });

    const rows = response.result.values || [];
    const birthDate = await GoogleService.getBirthDateOnly(); // ต้องการวันเกิดเพื่อคำนวณอายุ

    return rows.map((row: any[]) => {
      // row[0]=ID, row[1]=Date, row[2]=Notes, row[3]=Tags(JSON), row[4]=Photos(JSON)
      const date = row[1];
      const ageAtTime = birthDate ? calculateAge(birthDate, date) : { years: 0, months: 0, days: 0 };
      
      return {
        id: row[0],
        date: date,
        notes: row[2] || '',
        tags: row[3] ? JSON.parse(row[3]) : [],
        photos: row[4] ? JSON.parse(row[4]) : [],
        ageAtTime
      };
    }).reverse(); // เอาอันใหม่สุดขึ้นบน
  },

  // Helper เฉพาะสำหรับดึงวันเกิด (เพื่อลด loop)
  getBirthDateOnly: async (): Promise<string | null> => {
    const profile = await GoogleService.getProfile();
    return profile ? profile.birthDate : null;
  },

  // 5. ดึงข้อมูล Profile (Get Profile)
  getProfile: async (): Promise<BabyProfile | null> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    if (!spreadsheetId) return null;

    const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Profile!A2:B2',
    });

    const rows = response.result.values;
    if (rows && rows.length > 0) {
      return { name: rows[0][0], birthDate: rows[0][1] };
    }
    return null;
  },

  // 6. บันทึก Profile (Save Profile)
  saveProfile: async (profile: BabyProfile): Promise<void> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    // เขียนทับที่แถว 2 เสมอ
    await (window as any).gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Profile!A2:B2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[profile.name, profile.birthDate]] }
    });
  },

  // 7. ดึง Tags
  getTags: async (): Promise<string[]> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    if (!spreadsheetId) return [];

    const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Tags!A2:A',
    });
    
    // แปลง Array of Arrays เป็น Flat Array
    const defaultTags = ['มีความสุข', 'เหตุการณ์สำคัญ', 'ตลก', 'นอนหลับ', 'ครอบครัว'];
    if (!response.result.values) return defaultTags;
    
    return [...new Set([...defaultTags, ...response.result.values.flat()])];
  },

  saveTags: async (tags: string[]): Promise<void> => {
     // ในเวอร์ชันจริง อาจจะแค่ append tag ใหม่ แต่เพื่อความง่ายจะเขียนทับคอลัมน์ A
     const spreadsheetId = localStorage.getItem('bpj_sheet_id');
     const values = tags.map(t => [t]);
     
     await (window as any).gapi.client.sheets.spreadsheets.values.update({
       spreadsheetId,
       range: 'Tags!A2:A',
       valueInputOption: 'USER_ENTERED',
       resource: { values }
     });
  },

  // 8. อัปโหลดไฟล์ไป Google Drive
  uploadFile: async (file: File): Promise<Photo> => {
    const folderId = localStorage.getItem('bpj_folder_id');
    
    // Metadata ของไฟล์
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [folderId]
    };

    // สร้าง Multipart Request Body
    const accessToken = (window as any).gapi.auth.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    // ยิง Request ไปที่ Drive API Upload Endpoint
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink,webViewLink,thumbnailLink', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form,
    });
    
    const data = await res.json();
    
    // สร้าง URL ที่ใช้แสดงผล (thumbnailLink มักจะเร็วสุดสำหรับการแสดงผล)
    // หมายเหตุ: webContentLink เป็น Original Quality
    return {
      id: data.id,
      url: `https://lh3.googleusercontent.com/d/${data.id}`, // Trick URL สำหรับแสดงภาพตรงๆ
      mimeType: file.type
    };
  },

  // 9. บันทึก Entry (Save Entry) - ทั้งสร้างใหม่และแก้ไข
  saveEntry: async (entryData: any, birthDate: string, localPhotoFiles: File[]): Promise<JournalEntry> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    
    // 1. อัปโหลดรูปภาพใหม่ (ถ้ามี)
    const newPhotos: Photo[] = [];
    for (const file of localPhotoFiles) {
       const photo = await GoogleService.uploadFile(file);
       newPhotos.push(photo);
    }

    // รวมรูปเก่าและรูปใหม่
    const finalPhotos = [...(entryData.photos || []), ...newPhotos];
    const ageAtTime = calculateAge(birthDate, entryData.date);
    
    // เตรียมข้อมูลสำหรับบันทึก
    const newEntry: JournalEntry = {
       id: entryData.id || generateId(),
       date: entryData.date,
       notes: entryData.notes,
       tags: entryData.tags,
       photos: finalPhotos,
       ageAtTime
    };

    // แปลงเป็น Row Array
    const rowValues = [
      newEntry.id,
      newEntry.date,
      newEntry.notes,
      JSON.stringify(newEntry.tags),
      JSON.stringify(newEntry.photos)
    ];

    if (entryData.id) {
      // --- กรณีแก้ไข (UPDATE) ---
      // ต้องหา Row Index ก่อน (วิธีง่ายสุดคืออ่านมาทั้งหมดแล้วหา Index - ไม่ Efficient มากแต่ใช้ได้สำหรับข้อมูลน้อย)
      const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Entries!A2:A', // อ่านเฉพาะ ID
      });
      const ids = response.result.values ? response.result.values.flat() : [];
      const rowIndex = ids.findIndex((id: string) => id === entryData.id);
      
      if (rowIndex !== -1) {
        const sheetRow = rowIndex + 2; // +2 เพราะ Array เริ่ม 0 และ Header แถว 1
        await (window as any).gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Entries!A${sheetRow}:E${sheetRow}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowValues] }
        });
      }
    } else {
      // --- กรณีสร้างใหม่ (CREATE) ---
      await (window as any).gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Entries!A:E',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [rowValues] }
      });
    }

    return newEntry;
  },

  // 10. ลบ Entry (Delete)
  deleteEntry: async (id: string): Promise<void> => {
    const spreadsheetId = localStorage.getItem('bpj_sheet_id');
    
    // หา Row Index
    const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Entries!A2:A', 
    });
    const ids = response.result.values ? response.result.values.flat() : [];
    const rowIndex = ids.findIndex((rowId: string) => rowId === id);
    
    if (rowIndex !== -1) {
        // ใช้ batchUpdate เพื่อลบ Row (Sheet API deleteDimension)
        // rowIndex + 1 เพราะใน request นี้ 0-based index แต่ต้องนับ Header เป็น index 0
        const gridRowIndex = rowIndex + 1; 
        
        await (window as any).gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: 0, // สมมติว่าเป็น sheet แรกเสมอ (Entries)
                            dimension: 'ROWS',
                            startIndex: gridRowIndex,
                            endIndex: gridRowIndex + 1
                        }
                    }
                }]
            }
        });
    }
  }
};
