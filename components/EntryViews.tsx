import React, { useState } from 'react';
import { JournalEntry } from '../types';
import { formatAge, formatDate } from '../utils';
import { Badge, Button } from './UI';

// ไอคอน SVG สำหรับ UI
const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

interface EntryViewProps {
  entry: JournalEntry;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
  onView: (entry: JournalEntry) => void;
}

// การ์ดแสดงผล (Grid View)
export const EntryCard: React.FC<EntryViewProps> = ({ entry, onEdit, onDelete, onView }) => {
  const [photoIndex, setPhotoIndex] = useState(0);

  // ฟังก์ชันเปลี่ยนรูปเมื่อคลิกที่รูป
  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.photos.length > 1) {
      setPhotoIndex((prev) => (prev + 1) % entry.photos.length);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full group relative">
      <div 
        className="relative aspect-[4/3] bg-gray-100 cursor-pointer overflow-hidden"
        onClick={handleNextPhoto}
      >
        {entry.photos.length > 0 ? (
          <img 
            src={entry.photos[photoIndex].url} 
            alt="Memory" 
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">ไม่มีรูปภาพ</div>
        )}
        
        {/* ตัวบอกจำนวนรูปภาพ */}
        {entry.photos.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm pointer-events-none">
            {photoIndex + 1} / {entry.photos.length}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 cursor-pointer" onClick={() => onView(entry)}>
        <div className="flex justify-between items-start mb-2">
          <span className="text-sm text-gray-500 font-medium">{formatDate(entry.date)}</span>
          <Badge color="bg-primary-50 text-primary-700 border border-primary-100">{formatAge(entry.ageAtTime)}</Badge>
        </div>
        <p className="text-gray-800 mb-3 line-clamp-3 text-sm flex-1">{entry.notes}</p>
        
        <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-50">
          <div className="flex flex-wrap gap-1">
            {entry.tags.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {t}
              </span>
            ))}
            {entry.tags.length > 3 && <span className="text-[10px] text-gray-400">+{entry.tags.length - 3}</span>}
          </div>
          
          {/* ปุ่มแก้ไข/ลบ บนการ์ด */}
          <div className="flex gap-1 z-10">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-full transition-colors"
              title="แก้ไข"
            >
              <EditIcon />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="ลบ"
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// รายการแสดงผล (List View) - ปรับความสูงให้กะทัดรัด
export const EntryListItem: React.FC<EntryViewProps> = ({ entry, onEdit, onDelete, onView }) => {
  return (
    <div 
      className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group h-24"
      onClick={() => onView(entry)}
    >
      {/* รูปภาพ Thumbnail */}
      <div className="w-20 h-20 shrink-0 bg-gray-100 rounded-md overflow-hidden">
        {entry.photos.length > 0 ? (
          <img src={entry.photos[0].url} alt="Thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">ไม่มีรูป</div>
        )}
      </div>

      {/* ข้อมูล */}
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900">{formatDate(entry.date)}</span>
          <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded-full whitespace-nowrap">
            {formatAge(entry.ageAtTime)}
          </span>
        </div>
        <p className="text-sm text-gray-600 line-clamp-1">{entry.notes}</p>
        <div className="flex items-center gap-2 mt-1 overflow-hidden">
          {entry.tags.map(t => (
            <span key={t} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* ปุ่มจัดการ (แก้ไข/ลบ) */}
      <div className="flex flex-row items-center gap-1 pl-3 border-l border-gray-100 h-full">
        <button 
           onClick={(e) => { e.stopPropagation(); onEdit(entry); }} 
           className="p-2 rounded-full text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
           title="แก้ไข"
        >
           <EditIcon />
        </button>
        <button 
           onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }} 
           className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
           title="ลบ"
        >
           <DeleteIcon />
        </button>
      </div>
    </div>
  );
};

// รายละเอียดแบบเต็ม (Detail Modal View)
export const EntryDetail: React.FC<{ entry: JournalEntry }> = ({ entry }) => {
  return (
    <div className="space-y-6 font-sans">
      {/* Gallery Grid */}
      <div className={`grid gap-4 ${entry.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {entry.photos.map((photo, idx) => (
          <div key={photo.id} className="relative group rounded-lg overflow-hidden shadow-sm border border-gray-200 bg-gray-50">
            <img src={photo.url} alt={`รูปที่ ${idx + 1}`} className="w-full h-auto max-h-96 object-contain mx-auto" />
            
            {/* ปุ่มดาวน์โหลด */}
            <a 
              href={photo.url}
              download={`bpj-photo-${entry.date}-${idx + 1}.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-gray-600 hover:text-primary-500 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 transform hover:scale-110"
              title="ดาวน์โหลดรูปภาพ"
            >
              <DownloadIcon />
            </a>
          </div>
        ))}
      </div>

      {/* Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-2">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{formatDate(entry.date)}</h3>
          <p className="text-primary-600 font-medium text-lg">{formatAge(entry.ageAtTime)}</p>
        </div>
        <div className="flex gap-2">
           {entry.tags.map(t => (
            <span key={t} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base font-normal">{entry.notes}</p>
      </div>
    </div>
  );
};