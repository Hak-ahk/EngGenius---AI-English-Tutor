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
      case 'question': return 'Luyện tập Câu hỏi';
      case 'answer': return 'Luyện tập Toàn bộ câu trả lời';
      case 'sentence': return 'Luyện tập Câu (Từng câu)';
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
      setFeedback("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-fade-in flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">
            {getTitle()}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="overflow-y-auto mb-6 flex-1">
             <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <p className="text-lg text-indigo-900 font-medium italic">{targetText}</p>
            </div>
        
            <div className="flex flex-col items-center justify-center space-y-4 mt-6">
            {!isAnalyzing && (
                <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording 
                    ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-110' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg'
                }`}
                >
                {isRecording ? (
                    <div className="h-8 w-8 bg-white rounded-sm" />
                ) : (
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                )}
                </button>
            )}

            {isAnalyzing && (
                <div className="flex flex-col items-center text-indigo-600">
                <Spinner />
                <span className="mt-2 text-sm font-medium">Đang phân tích phát âm...</span>
                </div>
            )}

            <p className="text-gray-500 text-sm">
                {isRecording ? "Đang ghi âm... Nhấn để dừng." : isAnalyzing ? "" : "Nhấn vào micro để bắt đầu đọc"}
            </p>
            </div>

            {feedback && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">Đánh giá từ AI:</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{feedback}</p>
            </div>
            )}
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
