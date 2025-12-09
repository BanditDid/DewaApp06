
import { IService } from '../types';
import { GoogleService } from './googleService';
import { MockService } from './mockService';

// อ่านค่า Config จาก Environment Variable
// ถ้าตั้งค่า NEXT_PUBLIC_USE_MOCK=true จะใช้ MockService
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK ;
//const USE_MOCK ='false';

console.log(`[System] Running in ${USE_MOCK ? 'MOCK' : 'PRODUCTION (Google)'} mode`);

// Export Service ที่ถูกเลือก
export const ApiService: IService = USE_MOCK ? MockService : GoogleService;

// Export ตัวแปรเช็คสถานะเพื่อใช้แสดงผลใน UI
export const isMockMode = USE_MOCK;
