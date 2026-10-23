'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, Mic, MicOff, Sparkles, X } from 'lucide-react';

interface GmdMobileInputBarProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

const QUICK_PROMPTS = [
  '⚡ Liquid cash balance across bank accounts',
  '✓ Fund requests pending my approval',
  '📊 30-day runway and cash obligations in a graph',
  '◌ Explain recurring commitments in detailed paragraph',
  '🏢 Spend distribution across primary vendors',
  '📜 Executive morning briefing',
];

export function GmdMobileInputBar({ onSendMessage, disabled = false }: GmdMobileInputBarProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Speech Recognition on mount if supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = 'en-US';

        recog.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInput(transcript);
          }
        };

        recog.onerror = (e: any) => {
          console.warn('Speech recognition error:', e);
          setIsListening(false);
        };

        recog.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recog;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  };

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 40,
        background: 'linear-gradient(180deg, rgba(9, 13, 22, 0) 0%, rgba(9, 13, 22, 0.92) 20%, rgba(9, 13, 22, 0.98) 100%)',
        padding: '8px 12px calc(env(safe-area-inset-bottom, 8px) + 6px) 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Quick Prompts Carousel */}
      <div
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(prompt.replace(/^[⚡✓📊◌🏢📜]\s*/, ''))}
            style={{
              flexShrink: 0,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              borderRadius: '999px',
              padding: '5px 11px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#94a3b8',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Main Floating Input Capsule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(30, 41, 59, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: isListening ? '1.5px solid #ea580c' : '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '26px',
          padding: '6px 8px 6px 14px',
          boxShadow: isListening
            ? '0 0 20px rgba(234, 88, 12, 0.35)'
            : '0 8px 30px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Voice Dictation Button */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'Stop listening' : 'Speak to GMD Copilot'}
            style={{
              background: isListening ? '#ea580c' : 'transparent',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '999px',
              display: 'grid',
              placeItems: 'center',
              color: isListening ? '#ffffff' : '#94a3b8',
              cursor: 'pointer',
              animation: isListening ? 'pulse 1.2s infinite' : 'none',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening to voice...' : 'Ask GMD Copilot or instruct...'}
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f8fafc',
            fontSize: '13.5px',
            lineHeight: 1.4,
            resize: 'none',
            maxHeight: '80px',
            fontFamily: 'inherit',
          }}
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          aria-label="Send query"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '999px',
            background: input.trim() && !disabled ? '#ea580c' : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            color: input.trim() && !disabled ? '#ffffff' : '#64748b',
            cursor: input.trim() && !disabled ? 'pointer' : 'default',
            transition: 'all 0.18s ease',
            flexShrink: 0,
          }}
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
