import { AgeDuration } from './types';

// คำนวณอายุจากวันเกิดและวันที่เป้าหมาย
export const calculateAge = (birthDateStr: string, targetDateStr: string): AgeDuration => {
  const birthDate = new Date(birthDateStr);
  const targetDate = new Date(targetDateStr);

  let years = targetDate.getFullYear() - birthDate.getFullYear();
  let months = targetDate.getMonth() - birthDate.getMonth();
  let days = targetDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    // หาวันที่สุดท้ายของเดือนก่อนหน้า
    const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, days };
};

// แปลงอายุเป็นข้อความภาษาไทย
export const formatAge = (age: AgeDuration): string => {
  const parts = [];
  if (age.years > 0) parts.push(`${age.years} ปี`);
  if (age.months > 0) parts.push(`${age.months} เดือน`);
  if (age.days > 0 || parts.length === 0) parts.push(`${age.days} วัน`);
  return parts.join(' ');
};

// แปลงวันที่เป็นรูปแบบภาษาไทย (เช่น จันทร์, 1 ม.ค. 2024)
export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// สร้าง ID สุ่ม
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};