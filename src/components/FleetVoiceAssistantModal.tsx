import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, MicOff, Volume2, VolumeX, Send, 
  MessageSquare, User, RotateCcw, Activity
} from 'lucide-react';
import { EngineData, WorkOrder } from '../types/fleet';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  audioBase64?: string;
}

interface FleetVoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  fleet: EngineData[];
  workOrders: WorkOrder[];
}

export const FleetVoiceAssistantModal: React.FC<FleetVoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  fleet,
  workOrders,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "Good day. I am your Fleet Operations Advisor. Ask me anything about machine health, remaining useful life forecasts, sensor readings (vibration, temperature, motor current, pressure, RPM), or pending maintenance work orders.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen && currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsPlayingAudio(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSendMessage(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, [fleet, workOrders, isMuted]);

  const playAudio = (base64Audio: string) => {
    if (isMuted) return;
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      setIsPlayingAudio(true);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play().catch((err) => console.warn('Audio play restricted:', err));
    } catch (e) {
      console.warn('Audio error:', e);
      setIsPlayingAudio(false);
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.warn('Recognition start failed:', e);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `notice-${Date.now()}`,
            sender: 'assistant',
            text: 'Microphone speech recognition is not supported in this browser environment. You can type your question in the text box below.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    }
  };

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build snapshot for server-side Gemini conversation
      const fleetContext = {
        totalMonitored: fleet.length,
        criticalMachines: fleet.filter((f) => f.status === 'Critical').map((m) => ({
          id: m.engineId,
          type: m.fleetType,
          model: m.modelDesignation,
          currentCycle: m.currentCycle,
          predictedRUL: m.predictedRUL,
          healthScore: m.healthScore,
          latestSensors: m.history[m.history.length - 1],
        })),
        maintenanceNeeded: fleet.filter((f) => f.status === 'Maintenance Required').map((m) => ({
          id: m.engineId,
          type: m.fleetType,
          predictedRUL: m.predictedRUL,
        })),
        healthyCount: fleet.filter((f) => f.status === 'Healthy').length,
        pendingExceptions: workOrders.filter((w) => w.isException && w.status === 'PENDING_APPROVAL').map((w) => ({
          id: w.id,
          engineId: w.engineId,
          priority: w.priority,
          reason: w.exceptionReason,
        })),
        activeWorkOrdersCount: workOrders.length,
      };

      const response = await fetch('/api/fleet/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          fleetContext,
          history: messages.slice(-6).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }],
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const assistantText = data.text || 'Unable to retrieve fleet diagnosis at this time.';

      // Request speech audio via Gemini TTS
      let audioBase64: string | undefined;
      if (!isMuted) {
        try {
          const ttsRes = await fetch('/api/fleet/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: assistantText.slice(0, 300) }),
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            audioBase64 = ttsData.audioBase64;
          }
        } catch (ttsErr) {
          console.warn('TTS fetch failed:', ttsErr);
        }
      }

      const newAssistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioBase64,
      };

      setMessages((prev) => [...prev, newAssistantMsg]);

      if (audioBase64) {
        playAudio(audioBase64);
      }
    } catch (err: any) {
      const criticalMachines = fleet.filter((f) => f.status === 'Critical');
      const fallbackText = criticalMachines.length > 0
        ? `Fleet advisory: Machines ${criticalMachines.map((m) => `${m.engineId} (${m.fleetType})`).join(', ')} currently have elevated wear signatures and require prompt inspection.`
        : `All ${fleet.length} units in the fleet are operating within normal baseline telemetry.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-fallback-${Date.now()}`,
          sender: 'assistant',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQuestions = [
    'How is overall fleet health today?',
    'Which units are closest to service intervals?',
    'Summarize TRK-101 vibration levels',
    'Are any work orders awaiting my sign-off?',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl h-[82vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block">Fleet Operations Advisor</span>
              <span className="text-xs text-slate-500 font-normal">Ask in plain language about machine health, RUL, and sensor telemetry</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-lg border text-xs transition-colors ${
                isMuted
                  ? 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
              title={isMuted ? 'Turn on voice playback' : 'Mute voice playback'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Audio Visualizer Status Banner */}
        {(isPlayingAudio || isListening) && (
          <div className="bg-blue-50 px-6 py-2.5 border-b border-blue-100 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-blue-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span>{isListening ? 'Listening to your voice...' : 'Speaking fleet advisory...'}</span>
            </div>
            {isPlayingAudio && (
              <button
                onClick={() => {
                  currentAudioRef.current?.pause();
                  setIsPlayingAudio(false);
                }}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Stop Audio
              </button>
            )}
          </div>
        )}

        {/* Message Log */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <div className="flex items-center justify-between gap-3 mt-2 text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {msg.audioBase64 && !isUser && (
                      <button
                        onClick={() => playAudio(msg.audioBase64!)}
                        className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                        title="Replay Audio"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen Again</span>
                      </button>
                    )}
                  </div>
                </div>
                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-500">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Activity className="w-4 h-4 animate-spin" />
              </div>
              <span>Querying fleet diagnostics...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-6 py-2.5 bg-white border-t border-slate-200 overflow-x-auto scrollbar-none flex gap-2">
          {sampleQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(q)}
              className="text-xs font-medium whitespace-nowrap bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Query Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center space-x-2.5"
          >
            <button
              type="button"
              onClick={handleToggleMic}
              className={`p-2.5 rounded-xl border text-xs transition-colors ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title={isListening ? 'Stop recording voice' : 'Start speaking voice question'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'Listening to voice...' : 'Type or ask a question about fleet conditions...'}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
