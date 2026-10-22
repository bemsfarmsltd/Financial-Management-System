'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, ArrowRight, CornerDownLeft, Target } from 'lucide-react';
import { ElementContextPayload } from './useUniversalContextHarvester';

interface Props {
  context: ElementContextPayload;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onSubmit: (question: string, context: ElementContextPayload) => void;
}

export function ContextualAskPopover({ context, position, onClose, onSubmit }: Props) {
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [context]);

  // Suggested questions based on detected element context
  const getSuggestedPrompts = () => {
    const prompts: string[] = [];
    if (context.value) {
      prompts.push(`Why is this figure currently at ${context.value}?`);
      prompts.push(`Break down the historical records behind this ${context.value}`);
    } else {
      prompts.push(`Explain what this ${context.label} represents for ${context.subsidiary}`);
    }
    if (context.tableRowIdentifier) {
      prompts.push(`Give me the full audit trail and status for ${context.tableRowIdentifier}`);
    } else {
      prompts.push(`What action or approval is expected here?`);
    }
    return prompts.slice(0, 3);
  };

  const suggestions = getSuggestedPrompts();

  const handleSend = (text: string) => {
    const query = text.trim();
    if (!query) return;
    onSubmit(query, context);
    onClose();
  };

  // Compute smart popover position so it stays within viewport
  const getPopoverStyle = (): React.CSSProperties => {
    if (!position) {
      return {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
      };
    }

    const width = 420;
    const padding = 16;
    let left = position.x - width / 2;
    if (left < padding) left = padding;
    if (left + width > window.innerWidth - padding) {
      left = window.innerWidth - width - padding;
    }

    let top = position.y + 24;
    // If clicked near bottom of screen, open upwards
    if (top + 260 > window.innerHeight) {
      top = Math.max(padding, position.y - 280);
    }

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 9999,
      width: `${width}px`,
    };
  };

  return (
    <div
      style={{
        ...getPopoverStyle(),
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(234, 88, 12, 0.35)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(234, 88, 12, 0.15)',
        animation: 'bemsFadeSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header with target context */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Target style={{ width: 13, height: 13, color: '#ea580c' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#ea580c',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'block',
              }}
            >
              Ask AI About Selection
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
              title={context.label}
            >
              {context.label} {context.value ? `(${context.value})` : ''}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(question);
        }}
        style={{ position: 'relative', marginBottom: '10px' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Ask anything about "${context.label.slice(0, 24)}..."`}
          style={{
            width: '100%',
            padding: '10px 42px 10px 12px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            fontSize: '12.5px',
            color: '#0f172a',
            outline: 'none',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#ea580c')}
          onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        <button
          type="submit"
          disabled={!question.trim()}
          style={{
            position: 'absolute',
            right: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: question.trim() ? '#ea580c' : '#f1f5f9',
            color: question.trim() ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '7px',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: question.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          <CornerDownLeft style={{ width: 14, height: 14 }} />
        </button>
      </form>

      {/* Suggested Quick Prompt Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles style={{ width: 11, height: 11, color: '#ea580c' }} />
          Suggested queries:
        </span>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(s)}
            style={{
              textAlign: 'left',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '7px',
              padding: '6px 10px',
              fontSize: '11px',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fff7ed';
              e.currentTarget.style.borderColor = '#fed7aa';
              e.currentTarget.style.color = '#c2410c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#334155';
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
            <ArrowRight style={{ width: 10, height: 10, flexShrink: 0, opacity: 0.6 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
