import React, { useState, useRef, useEffect } from 'react';
import { Difficulty, VoiceName, GeneratedResponse, TtsConfig } from './types';
import { generateAnswer, generateSpeech } from './services/gemini';
import { decodeBase64, decodeAudioData } from './utils/audioUtils';
import { Spinner } from './components/Spinner';
import { PracticeModal } from './components/PracticeModal';

function App() {
  const [question, setQuestion] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [result, setResult] = useState<GeneratedResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // TTS State
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>({
    voice: VoiceName.Puck,
    speed: 1.0,
  });
  
  // Track what is playing: 'full' or index of sentence
  const [activeAudioId, setActiveAudioId] = useState<string | number | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | number | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Audio Cache: Key = "VoiceName:Text", Value = AudioBuffer
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  // Pending Requests: Key = "VoiceName:Text", Value = Promise<AudioBuffer>
  // Prevents double-fetching if a request is already in flight
  const pendingRequestsRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());

  // Practice State
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [practiceType, setPracticeType] = useState<'question' | 'answer' | 'sentence'>('question');
  const [practiceText, setPracticeText] = useState('');

  // Initialize AudioContext helper
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  // Optimized Fetcher: Checks Cache -> Checks In-Flight -> Fetches New
  const fetchAudioBuffer = async (text: string, voice: VoiceName): Promise<AudioBuffer> => {
    const cacheKey = `${voice}:${text}`;
    
    // 1. Check Cache (Instant)
    if (audioCacheRef.current.has(cacheKey)) {
      return audioCacheRef.current.get(cacheKey)!;
    }

    // 2. Check Pending Requests (Deduplication)
    if (pendingRequestsRef.current.has(cacheKey)) {
      return pendingRequestsRef.current.get(cacheKey)!;
    }

    // 3. Create new fetch promise
    const fetchPromise = (async () => {
        try {
            const base64Audio = await generateSpeech(text, voice);
            const rawBytes = decodeBase64(base64Audio);
            
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') {
              // We don't await resume here during background preload to avoid errors if user hasn't interacted
              // We just decode. Resume happens on Play.
            }
            const audioBuffer = await decodeAudioData(rawBytes, ctx, 24000);
            
            // Save to Cache
            audioCacheRef.current.set(cacheKey, audioBuffer);
            return audioBuffer;
        } finally {
            // Remove from pending map when done (success or fail)
            pendingRequestsRef.current.delete(cacheKey);
        }
    })();

    // Store the promise so subsequent calls wait for this one
    pendingRequestsRef.current.set(cacheKey, fetchPromise);

    return fetchPromise;
  };

  // AGGRESSIVE PRELOAD: Fetch EVERYTHING immediately
  useEffect(() => {
    if (result?.english) {
      const voice = ttsConfig.voice;
      
      // 1. Preload Full Answer
      fetchAudioBuffer(result.english, voice)
        .catch(err => console.debug('Preload full failed (ignorable)', err));

      // 2. Preload ALL Sentences concurrently
      if (result.sentences) {
        result.sentences.forEach(sentence => {
           fetchAudioBuffer(sentence.english, voice)
             .catch(err => console.debug('Preload sentence failed (ignorable)', err));
        });
      }
    }
  }, [result, ttsConfig.voice]);

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setIsGenerating(true);
    setResult(null);
    stopAudio();
    
    // Clear caches to free memory for new topic
    audioCacheRef.current.clear();
    pendingRequestsRef.current.clear();

    // Warm up AudioContext on click
    getAudioContext();

    try {
      const response = await generateAnswer(question, difficulty);
      setResult(response);
    } catch (error) {
      alert("Đã có lỗi xảy ra khi tạo câu trả lời. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setActiveAudioId(null);
  };

  const playAudio = async (text: string, id: string | number) => {
    // Toggle off if clicking same button
    if (activeAudioId === id) {
      stopAudio();
      return;
    }
    
    stopAudio();
    setLoadingAudioId(id);

    try {
      // This will likely resolve instantly from cache/pending promise
      const audioBuffer = await fetchAudioBuffer(text, ttsConfig.voice);

      const ctx = getAudioContext();
      // Important: Resume context if suspended (browser requirement)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = ttsConfig.speed;
      
      source.connect(ctx.destination);
      
      source.onended = () => {
        setActiveAudioId(null);
      };
      
      sourceNodeRef.current = source;
      source.start();
      setActiveAudioId(id);
    } catch (error) {
      console.error(error);
      alert("Không thể phát âm thanh.");
    } finally {
      setLoadingAudioId(null);
    }
  };

  const openPractice = (type: 'question' | 'answer' | 'sentence', text: string) => {
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
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Giọng đọc:</span>
                <select
                  value={ttsConfig.voice}
                  onChange={(e) => setTtsConfig({...ttsConfig, voice: e.target.value as VoiceName})}
                  className="w-full p-2 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg"
                >
                  {Object.values(VoiceName).map((v) => (
                    <option key={v} value={v}>{v}</option>
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
                  onChange={(e) => {
                    const newSpeed = parseFloat(e.target.value);
                    setTtsConfig({...ttsConfig, speed: newSpeed});
                    if (sourceNodeRef.current) {
                        sourceNodeRef.current.playbackRate.value = newSpeed;
                    }
                  }}
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
                        disabled={loadingAudioId !== null && loadingAudioId !== 'full'}
                        className={`p-3 rounded-full transition-all ${
                          activeAudioId === 'full' 
                          ? 'bg-orange-100 text-orange-600 animate-pulse' 
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                        title="Nghe toàn bộ"
                      >
                         {loadingAudioId === 'full' ? (
                           <div className="h-6 w-6"><Spinner /></div>
                         ) : activeAudioId === 'full' ? (
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
                            disabled={loadingAudioId !== null && loadingAudioId !== idx}
                            className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                              activeAudioId === idx 
                              ? 'bg-orange-100 text-orange-600' 
                              : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                            }`}
                          >
                            {loadingAudioId === idx ? (
                               <div className="h-5 w-5"><Spinner /></div>
                            ) : activeAudioId === idx ? (
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