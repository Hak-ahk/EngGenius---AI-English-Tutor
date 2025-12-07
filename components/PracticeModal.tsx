import React, { useState, useRef } from 'react';
import { checkPronunciation } from '../services/gemini';
import { blobToBase64 } from '../utils/audioUtils';
import { Spinner } from './Spinner';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetText: string;
  type: 'question' | 'answer' | 'sentence';
}

export const PracticeModal: React.FC<PracticeModalProps> = ({ isOpen, onClose, targetText, type }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (type) {
      case 'question': return '🎙️ Luyện đọc Câu hỏi';
      case 'answer': return '🎙️ Thử thách: Đọc cả bài';
      case 'sentence': return '🎙️ Luyện đọc câu này';
      default: return 'Luyện tập';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' }); // or audio/webm
        setIsAnalyzing(true);
        try {
          const base64 = await blobToBase64(audioBlob);
          const result = await checkPronunciation(base64, targetText);
          setFeedback(result);
        } catch (err) {
          setFeedback("Lỗi khi phân tích âm thanh.");
        } finally {
          setIsAnalyzing(false);
        }
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setFeedback(null);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setFeedback("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập trên trình duyệt nhé.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-6 md:p-8 animate-fade-in flex flex-col max-h-[90vh] border-4 border-blue-50">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-extrabold text-slate-800">
            {getTitle()}
            </h3>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="overflow-y-auto mb-4 flex-1 custom-scrollbar">
             <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 text-center">
                <p className="text-xl text-blue-900 font-medium leading-relaxed font-serif">"{targetText}"</p>
            </div>
        
            <div className="flex flex-col items-center justify-center space-y-6 mt-8">
            {!isAnalyzing && (
                <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording 
                    ? 'bg-red-500 hover:bg-red-600 shadow-xl shadow-red-200 scale-110 animate-pulse' 
                    : 'bg-gradient-to-tr from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-xl shadow-blue-200 hover:scale-105'
                }`}
                >
                {isRecording ? (
                    <div className="h-8 w-8 bg-white rounded-md" />
                ) : (
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                )}
                </button>
            )}

            {isAnalyzing && (
                <div className="flex flex-col items-center text-indigo-600 bg-indigo-50 px-8 py-6 rounded-2xl">
                <Spinner />
                <span className="mt-3 text-sm font-bold animate-pulse">AI đang nghe em đọc...</span>
                </div>
            )}

            <p className="text-slate-400 font-medium text-sm">
                {isRecording ? "Đang ghi âm... Nhấn để dừng lại nhé." : isAnalyzing ? "" : "Nhấn vào micro màu xanh để bắt đầu"}
            </p>
            </div>

            {feedback && (
            <div className="mt-8 p-5 bg-green-50 rounded-2xl border-2 border-green-100 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🤖</span>
                    <h4 className="font-bold text-green-800 text-lg">AI nhận xét:</h4>
                </div>
                <p className="text-slate-700 text-base leading-relaxed pl-1">{feedback}</p>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};