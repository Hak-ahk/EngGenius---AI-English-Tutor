import React, { useState, useEffect } from 'react';
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
  
  // Track what is playing
  const [activeAudioId, setActiveAudioId] = useState<string | number | null>(null);

  // Practice State
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [practiceType, setPracticeType] = useState<'question' | 'answer' | 'sentence'>('question');
  const [practiceText, setPracticeText] = useState('');

  // Load System Voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));
      const availableVoices = englishVoices.length > 0 ? englishVoices : allVoices;
      setVoices(availableVoices);

      if (availableVoices.length > 0 && !ttsConfig.voiceURI) {
        const preferred = availableVoices.find(v => v.name.includes('Google US English')) || availableVoices[0];
        setTtsConfig(prev => ({ ...prev, voiceURI: preferred.voiceURI }));
      }
    };

    loadVoices();
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
      alert("Hệ thống chưa nhận diện được mã phiên. Vui lòng kiểm tra lại cấu hình (AuthToken).");
    } finally {
      setIsGenerating(false);
    }
  };

  const stopAudio = () => {
    window.speechSynthesis.cancel();
    setActiveAudioId(null);
  };

  const playAudio = (text: string, id: string | number) => {
    window.speechSynthesis.cancel();
    if (activeAudioId === id) {
      setActiveAudioId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find(v => v.voiceURI === ttsConfig.voiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = ttsConfig.speed;
    
    utterance.onend = () => setActiveAudioId(null);
    utterance.onerror = () => setActiveAudioId(null);

    setActiveAudioId(id);
    window.speechSynthesis.speak(utterance);
  };

  const openPractice = (type: 'question' | 'answer' | 'sentence', text: string) => {
    stopAudio();
    setPracticeType(type);
    setPracticeText(text);
    setPracticeModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header - Playful Style */}
        <header className="text-center pt-6 pb-2">
          <div className="inline-block bg-white px-6 py-2 rounded-full shadow-md mb-4 border-2 border-blue-100">
            <span className="text-sm font-bold text-blue-500 tracking-wider uppercase">✨ Học Tiếng Anh Cực Vui ✨</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight mb-2 drop-shadow-sm">
            English<span className="text-blue-600">Buddy</span> 🚀
          </h1>
          <p className="text-slate-500 font-medium">Bạn hỏi, AI trả lời siêu tốc!</p>
        </header>

        {/* Input Area - Notebook Style */}
        <div className="bg-white rounded-[2rem] shadow-xl border-4 border-white ring-4 ring-blue-50 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400"></div>
          
          <div className="p-6 md:p-8 space-y-6">
            <div className="space-y-3">
              <label htmlFor="question" className="flex items-center gap-2 text-lg font-bold text-slate-700">
                <span>✏️</span> Câu hỏi của em là gì?
              </label>
              <div className="relative group">
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ví dụ: Giới thiệu về bản thân, sở thích của em..."
                  className="w-full p-5 text-slate-700 bg-slate-50 rounded-2xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all min-h-[140px] resize-y text-lg shadow-inner placeholder:text-slate-400"
                />
                {question && (
                  <button 
                    onClick={() => openPractice('question', question)}
                    className="absolute bottom-4 right-4 p-2 bg-white rounded-xl shadow-md text-slate-400 hover:text-blue-600 hover:scale-110 border border-slate-200 transition-all"
                    title="Thử đọc câu hỏi này"
                  >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-auto flex flex-col gap-1">
                 <label className="text-xs font-bold text-slate-400 uppercase ml-1">Độ khó</label>
                 <div className="relative">
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                      className="w-full md:w-56 p-3 pl-4 bg-blue-50 border-2 border-blue-100 text-blue-800 font-bold rounded-xl focus:ring-blue-200 focus:border-blue-400 appearance-none cursor-pointer"
                    >
                      {Object.values(Difficulty).map((diff) => (
                        <option key={diff} value={diff}>{diff}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-blue-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                 </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !question.trim()}
                className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg hover:shadow-orange-200 transform hover:-translate-y-1 transition-all flex items-center justify-center gap-2 text-lg"
              >
                {isGenerating ? <Spinner /> : <span>✨</span>}
                <span>{isGenerating ? 'Đang suy nghĩ...' : 'Tạo câu trả lời'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Settings (Only show if result exists) - Cleaner Look */}
        {result && (
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center gap-4 justify-between">
             <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
                <select
                  value={ttsConfig.voiceURI}
                  onChange={(e) => setTtsConfig({...ttsConfig, voiceURI: e.target.value})}
                  className="w-full p-2 bg-transparent border-b-2 border-slate-200 font-medium text-slate-700 focus:border-blue-500 outline-none transition-colors"
                >
                  {voices.length === 0 && <option>Đang tìm giọng đọc...</option>}
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                  ))}
                </select>
             </div>
             <div className="flex items-center gap-3 w-full sm:w-auto bg-blue-50 px-4 py-2 rounded-xl">
                <span className="text-sm font-bold text-blue-400 whitespace-nowrap">Tốc độ</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={ttsConfig.speed}
                  onChange={(e) => setTtsConfig({...ttsConfig, speed: parseFloat(e.target.value)})}
                  className="w-24 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
             </div>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div className="space-y-8 animate-fade-in-up pb-10">
            
            {/* 1. Full Answer Card */}
            <div className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 overflow-hidden">
              <div className="bg-indigo-50 p-5 border-b border-indigo-100 flex justify-between items-center">
                 <h2 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2">
                   <span>📜</span> Câu trả lời mẫu
                 </h2>
                 <div className="flex gap-2">
                    <button
                      onClick={() => playAudio(result.english, 'full')}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                        activeAudioId === 'full' 
                        ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-200' 
                        : 'bg-white text-indigo-600 hover:bg-indigo-100 shadow-sm'
                      }`}
                    >
                       {activeAudioId === 'full' ? 'Đang đọc...' : 'Nghe hết'}
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    
                    <button
                      onClick={() => openPractice('answer', result.english)}
                      className="p-2 rounded-xl bg-white text-green-600 hover:bg-green-50 shadow-sm transition-all border border-green-100"
                      title="Luyện nói"
                    >
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                 </div>
              </div>

              <div className="p-6 md:p-8">
                <p className="text-xl text-slate-800 leading-relaxed font-medium font-serif">
                  {result.english}
                </p>
                <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-200">
                  <p className="text-lg text-slate-500 italic flex gap-2">
                    <span className="not-italic">🇻🇳</span> {result.vietnamese}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Breakdown Section */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 ml-2">
                 <span className="text-2xl">🧩</span>
                 <h3 className="text-xl font-bold text-slate-700">Học từng câu một</h3>
               </div>
               
               <div className="grid gap-4">
                  {result.sentences.map((sentence, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-transparent hover:border-blue-200 transition-all flex flex-col md:flex-row gap-5 items-start">
                       
                       {/* Controls */}
                       <div className="flex flex-row md:flex-col gap-2 shrink-0">
                          <button
                            onClick={() => playAudio(sentence.english, idx)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                              activeAudioId === idx 
                              ? 'bg-orange-400 text-white scale-110 shadow-orange-200' 
                              : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600'
                            }`}
                          >
                            {activeAudioId === idx ? (
                               <div className="w-3 h-3 bg-white rounded-sm animate-pulse" />
                            ) : (
                               <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                          </button>
                          
                          <button
                            onClick={() => openPractice('sentence', sentence.english)}
                            className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:bg-green-100 hover:text-green-600 border border-slate-100 transition-all flex items-center justify-center"
                          >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                          </button>
                       </div>

                       {/* Content */}
                       <div className="flex-1 pt-1">
                          <p className="text-slate-800 font-bold text-lg mb-2">{sentence.english}</p>
                          <p className="text-slate-500 italic bg-slate-50 p-2 rounded-lg inline-block border border-slate-100">
                            {sentence.vietnamese}
                          </p>
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