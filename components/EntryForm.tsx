
import React, { useState, useEffect } from 'react';
import { Button } from './UI';
import { JournalEntry, Photo } from '../types';
// ใช้ ApiService กลางแทน GoogleService โดยตรง
import { ApiService } from '../services/api';

interface EntryFormProps {
  initialData?: JournalEntry | null;
  birthDate: string;
  onSave: (entry?: JournalEntry) => void;
  onCancel: () => void;
}

export const EntryForm: React.FC<EntryFormProps> = ({ initialData, birthDate, onSave, onCancel }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]); // เก็บไฟล์จริงๆที่จะอัปโหลด
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // โหลด Tags จาก ApiService
    ApiService.getTags().then(setAvailableTags);
    
    if (initialData) {
      setDate(initialData.date.split('T')[0]);
      setNotes(initialData.notes);
      setSelectedTags(initialData.tags);
      setPhotos(initialData.photos);
    }
  }, [initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // 1. เก็บไฟล์จริงไว้รออัปโหลด
      setNewPhotoFiles(prev => [...prev, ...files]);
      
      // 2. สร้าง Preview
      const newPreviews: Photo[] = files.map((file: File) => ({
        id: 'temp-' + Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file), 
        mimeType: file.type
      }));
      setPhotos(prev => [...prev, ...newPreviews]);
    }
  };

  const handleAddTag = () => {
    if (newTagInput.trim() && !availableTags.includes(newTagInput.trim())) {
      const newTag = newTagInput.trim();
      const updatedTags = [...availableTags, newTag];
      setAvailableTags(updatedTags);
      setSelectedTags(prev => [...prev, newTag]);
      // หมายเหตุ: เพื่อความง่ายเราเรียก save ไว้ก่อน
      // ApiService.saveTags(updatedTags); 
      setNewTagInput('');
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const removePhoto = (id: string) => {
    if (id.startsWith('temp-')) {
        // Logic ลบ Preview
    }
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // ส่งข้อมูล + ไฟล์รูปใหม่ไปให้ ApiService จัดการ
      await ApiService.saveEntry({
        id: initialData?.id,
        date,
        notes,
        tags: selectedTags,
        photos: photos.filter(p => !p.id.startsWith('temp-')) // ส่งเฉพาะรูปเก่าที่มี ID จริง
      }, birthDate, newPhotoFiles); // ส่งไฟล์ใหม่ไปด้วย
      
      // บันทึก Tags ล่าสุดด้วย
      await ApiService.saveTags(availableTags);

      onSave();
    } catch (error) {
      console.error("บันทึกไม่สำเร็จ", error);
      alert("เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่: " + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 font-sans">
      {/* เลือกวันที่ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ถ่ายภาพ</label>
        <input 
          type="date" 
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border-gray-300 rounded-lg shadow-sm focus:border-primary-500 focus:ring-primary-500 p-2 border"
        />
      </div>

      {/* อัปโหลดรูปภาพ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพ</label>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {photos.map(photo => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
              <img src={photo.url} alt="Preview" className="w-full h-full object-cover" />
              <button 
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <label className="border-2 border-dashed border-gray-300 rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:text-primary-500 transition-colors text-gray-400 bg-gray-50 hover:bg-white">
            <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs">เพิ่มรูป</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
        <p className="text-xs text-gray-400">*รูปภาพจะถูกอัปโหลดไปยังที่เก็บข้อมูล (Google Drive หรือ Local Storage)</p>
      </div>

      {/* หมวดหมู่ (Tags) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">กลุ่ม / เหตุการณ์</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {availableTags.map(tag => (
            <button
              type="button"
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                selectedTags.includes(tag) 
                  ? 'bg-primary-500 text-white border-primary-500' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="สร้างกลุ่มใหม่..."
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            className="flex-1 border-gray-300 rounded-lg text-sm p-2 border focus:ring-primary-500 focus:border-primary-500"
          />
          <Button type="button" variant="secondary" onClick={handleAddTag} className="text-xs py-1">เพิ่ม</Button>
        </div>
      </div>

      {/* ข้อความบันทึก (Notes) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">บันทึกความทรงจำ</label>
        <textarea 
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="วันนี้เจ้าตัวเล็กทำอะไรน่ารักๆ บ้าง..."
          className="w-full border-gray-300 rounded-lg shadow-sm focus:border-primary-500 focus:ring-primary-500 p-2 border"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>ยกเลิก</Button>
        <Button type="submit" isLoading={isSubmitting}>{isSubmitting ? 'กำลังบันทึก...' : (initialData ? 'บันทึกการแก้ไข' : 'บันทึก')}</Button>
      </div>
    </form>
  );
};
