import React, { useState, useRef, useEffect } from 'react';
import { Difficulty, GeneratedResponse, TtsConfig } from './types';
import { generateAnswer } from './services/gemini';
import { Spinner } from './components/Spinner';
import { PracticeModal } from './components/PracticeModal';

function App() {
  const [question, setQuestion] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [result, setResult] = useState<GeneratedResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // System TTS State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>({
    voiceURI: '',
    speed: 1.0,
  });
  
  // Track what is playing: 'full' or index of sentence
  const [activeAudioId, setActiveAudioId] = useState<string | number | null>(null);

  // Practice State
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [practiceType, setPracticeType] = useState<'question' | 'answer' | 'sentence'>('question');
  const [practiceText, setPracticeText] = useState('');

  // Load System Voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter for English voices (or all if none found)
      const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));
      const availableVoices = englishVoices.length > 0 ? englishVoices : allVoices;
      
      setVoices(availableVoices);

      // Set default voice if not set
      if (availableVoices.length > 0 && !ttsConfig.voiceURI) {
        // Prefer "Google US English" or similar standard voices if available, otherwise first one
        const preferred = availableVoices.find(v => v.name.includes('Google US English')) || availableVoices[0];
        setTtsConfig(prev => ({ ...prev, voiceURI: preferred.voiceURI }));
      }
    };

    loadVoices();
    
    // Chrome requires this event to load voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [ttsConfig.voiceURI]);

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setIsGenerating(true);
    setResult(null);
    stopAudio();
    
    try {
      const response = await generateAnswer(question, difficulty);
      setResult(response);
    } catch (error) {
      alert("Đã có lỗi xảy ra. Hãy kiểm tra xem bạn đã cấu hình API Key chưa.");
    } finally {
      setIsGenerating(false);
    }
  };

  const stopAudio = () => {
    window.speechSynthesis.cancel();
    setActiveAudioId(null);
  };

  const playAudio = (text: string, id: string | number) => {
    // Stop any current speech
    window.speechSynthesis.cancel();

    // Toggle off if clicking the same button that is currently playing
    if (activeAudioId === id) {
      setActiveAudioId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find the selected voice object
    const selectedVoice = voices.find(v => v.voiceURI === ttsConfig.voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = ttsConfig.speed;
    
    utterance.onend = () => {
      setActiveAudioId(null);
    };
    
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      setActiveAudioId(null);
    };

    setActiveAudioId(id);
    window.speechSynthesis.speak(utterance);
  };

  const openPractice = (type: 'question' | 'answer' | 'sentence', text: string) => {
    // Stop audio when opening practice to avoid interference
    stopAudio();
    setPracticeType(type);
    setPracticeText(text);
    setPracticeModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="text-center pt-4 pb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-indigo-900 tracking-tight">
            Eng<span className="text-indigo-600">Genius</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm md:text-base">Trợ lý luyện nói tiếng Anh thông minh</p>
        </header>

        {/* Input Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 md:p-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="question" className="block text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wide">
                Câu hỏi của bạn
              </label>
              <div className="relative">
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi tiếng Anh (ví dụ: Describe your daily routine)..."
                  className="w-full p-4 pr-12 text-gray-800 border border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all min-h-[100px] resize-y text-base"
                />
                {question && (
                  <button 
                    onClick={() => openPractice('question', question)}
                    className="absolute bottom-3 right-3 p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-indigo-600 border border-gray-100 transition-colors"
                    title="Luyện đọc câu hỏi này"
                  >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2">
              <div className="w-full sm:w-auto">
                 <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full sm:w-48 p-2.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Object.values(Difficulty).map((diff) => (
                    <option key={diff} value={diff}>{diff}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !question.trim()}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? <Spinner /> : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
                <span>{isGenerating ? 'Đang tạo...' : 'Tạo câu trả lời'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Settings (Only show if result exists) */}
        {result && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center gap-4 justify-between">
             <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Giọng đọc ({voices.length}):</span>
                <select
                  value={ttsConfig.voiceURI}
                  onChange={(e) => setTtsConfig({...ttsConfig, voiceURI: e.target.value})}
                  className="w-full p-2 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg"
                >
                  {voices.length === 0 && <option>Đang tải giọng đọc...</option>}
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
             </div>
             <div className="flex items-center gap-4 w-full sm:w-auto">
                <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Tốc độ: {ttsConfig.speed}x</span>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={ttsConfig.speed}
                  onChange={(e) => setTtsConfig({...ttsConfig, speed: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
             </div>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div className="space-y-6 animate-fade-in-up">
            
            {/* 1. Full Answer Card */}
            <div className="bg-white rounded-2xl shadow-lg border-l-4 border-indigo-500 overflow-hidden">
              <div className="p-5 md:p-8">
                <div className="flex justify-between items-start mb-4">
                   <h2 className="text-xl font-bold text-gray-800">Toàn bộ câu trả lời</h2>
                   <div className="flex gap-2">
                      {/* Play Full Button */}
                      <button
                        onClick={() => playAudio(result.english, 'full')}
                        className={`p-3 rounded-full transition-all ${
                          activeAudioId === 'full' 
                          ? 'bg-orange-100 text-orange-600 animate-pulse' 
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                        title="Nghe toàn bộ"
                      >
                         {activeAudioId === 'full' ? (
                           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                         ) : (
                           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                         )}
                      </button>
                      
                      {/* Practice Full Button */}
                      <button
                        onClick={() => openPractice('answer', result.english)}
                        className="p-3 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-all"
                        title="Luyện nói toàn bài"
                      >
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      </button>
                   </div>
                </div>

                <div className="prose prose-indigo max-w-none">
                  <p className="text-lg md:text-xl text-gray-800 leading-relaxed font-medium">
                    {result.english}
                  </p>
                  <p className="text-base text-gray-500 italic mt-4 border-t pt-4">
                    {result.vietnamese}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Breakdown Section */}
            <div className="space-y-4">
               <h3 className="text-lg font-bold text-gray-700 ml-2">Chi tiết từng câu</h3>
               <div className="grid gap-4">
                  {result.sentences.map((sentence, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center">
                       
                       {/* Controls */}
                       <div className="flex flex-row md:flex-col gap-2 shrink-0">
                          <button
                            onClick={() => playAudio(sentence.english, idx)}
                            className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                              activeAudioId === idx 
                              ? 'bg-orange-100 text-orange-600' 
                              : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                            }`}
                          >
                            {activeAudioId === idx ? (
                               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            ) : (
                               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                          </button>
                          
                          <button
                            onClick={() => openPractice('sentence', sentence.english)}
                            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600 transition-colors"
                          >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                          </button>
                       </div>

                       {/* Content */}
                       <div className="flex-1 space-y-1">
                          <p className="text-gray-900 font-medium text-lg leading-snug">{sentence.english}</p>
                          <p className="text-gray-500 text-sm italic">{sentence.vietnamese}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

          </div>
        )}
      </div>

      <PracticeModal
        isOpen={practiceModalOpen}
        onClose={() => setPracticeModalOpen(false)}
        targetText={practiceText}
        type={practiceType}
      />
    </div>
  );
}

export default App;
