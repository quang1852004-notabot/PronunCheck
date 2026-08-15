import sys

file_path = r'D:\DT3_PronunCheck\frontend-pronuncheck\app\components\AudioRecorder.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '''import { Mic, Square, Play, RotateCcw, Send } from 'lucide-react';''',
    '''import { Mic, Square, Play, RotateCcw, Send, Upload } from 'lucide-react';'''
)

content = content.replace(
    '''  const streamRef = useRef<MediaStream | null>(null);''',
    '''  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setRecordedBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };'''
)

content = content.replace(
    '''  const resetRecording = () => {
    setRecordedBlob(null);
    setAudioUrl(null);
  };''',
    '''  const resetRecording = () => {
    setRecordedBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
  };'''
)

old_ui = '''      {!isRecording && !recordedBlob && (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all ${
            disabled
              ? 'bg-gray-600 cursor-not-allowed opacity-50'
              : 'bg-red-500 hover:bg-red-600 hover:scale-105'
          }`}
        >
          <Mic className="w-5 h-5" /> Bắt đầu ghi âm
        </button>
      )}'''

new_ui = '''      {!isRecording && !recordedBlob && (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all ${
              disabled
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-red-500 hover:bg-red-600 hover:scale-105'
            }`}
          >
            <Mic className="w-5 h-5" /> Bắt đầu ghi âm
          </button>

          <span className="text-gray-400 font-medium">hoặc</span>

          <label className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all cursor-pointer ${
            disabled ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
          }`}>
            <Upload className="w-5 h-5" /> Tải file lên
            <input 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={disabled}
              ref={fileInputRef}
            />
          </label>
        </div>
      )}'''

content = content.replace(old_ui, new_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
