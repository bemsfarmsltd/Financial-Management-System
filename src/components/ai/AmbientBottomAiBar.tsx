'use client';

import React, { useState, useRef, useEffect } from 'react';
import { KineticAiOrb } from './KineticAiOrb';
import { useAmbientTelemetry } from './useAmbientTelemetry';
import { AiMessage } from './types';
import { Send, Maximize2, Minimize2, X, Trash2, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { BriefingActionCard } from './cards/BriefingActionCard';
import { ApprovalDecisionCard } from './cards/ApprovalDecisionCard';
import { BudgetProposalCard } from './cards/BudgetProposalCard';
import { SalaryAdjustmentCard } from './cards/SalaryAdjustmentCard';
import { DisbursementRecordCard } from './cards/DisbursementRecordCard';
import { ScenarioSimulatorCard } from './cards/ScenarioSimulatorCard';
import { notifyAiInteraction } from './AiScreenEdgeGlow';
import { FormattedAiMessage } from './FormattedAiMessage';

interface Props {
  currentPage: string;
  businessName: string;
  userName: string;
  userRole: string;
  messages: AiMessage[];
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onConfirmAction: (messageId: string, actionType: string, payload: any) => void;
  onOpenFullCockpit: (initialPrompt?: string) => void;
  onNavigate?: (tab: string) => void;
}

export function AmbientBottomAiBar({
  currentPage,
  businessName,
  userName,
  userRole,
  messages,
  isTyping,
  onSendMessage,
  onConfirmAction,
  onOpenFullCockpit,
  onNavigate,
}: Props) {
  const [inputText, setInputText] = useState('');
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { telemetry, displayText, isTyping: isTelemetryTyping } = useAmbientTelemetry({
    currentPage,
    businessName,
  });

  // When user sends a message or when typing starts, automatically open the floating transparent response deck
  useEffect(() => {
    if (messages.length > 1 || isTyping) {
      setIsDeckOpen(true);
    }
  }, [messages.length, isTyping]);

  // Auto-scroll response stream
  useEffect(() => {
    if (isDeckOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isDeckOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    notifyAiInteraction();
    onSendMessage(inputText.trim());
    setInputText('');
    setIsDeckOpen(true);
  };

  const getSeverityBadgeColor = () => {
    switch (telemetry.severity) {
      case 'warning':
        return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' };
      case 'highlight':
        return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' };
      case 'success':
        return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', dot: '#10b981' };
      default:
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' };
    }
  };

  const badgeColors = getSeverityBadgeColor();

  return (
    <div
      className="ambient-bottom-ai-wrapper"
      style={{
        position: 'fixed',
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9950,
        width: 'min(940px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* 1. FLOATING TRANSPARENT RESPONSE DECK (Pops up directly above the bar) */}
      {isDeckOpen && (
        <div
          className="floating-ai-response-deck"
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxHeight: '480px',
            marginBottom: '10px',
            background: 'rgba(255, 255, 255, 0.58)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.80)',
            borderRadius: '24px',
            boxShadow: '0 25px 70px rgba(15, 23, 42, 0.16), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95), 0 0 40px rgba(249, 115, 22, 0.10)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'deckSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Deck Header */}
          <div
            style={{
              padding: '10px 18px',
              background: 'rgba(255, 255, 255, 0.35)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.50)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} color="#ea580c" />
              <strong style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 800 }}>
                BEMS AI Financial Assistant · Live Stream
              </strong>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#047857',
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  textTransform: 'uppercase',
                }}
              >
                Active
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => onOpenFullCockpit()}
                title="Expand to Full Cockpit Modal (Cmd + J)"
                style={{
                  background: 'rgba(255, 255, 255, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.70)',
                  color: '#334155',
                  padding: '5px 9px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Maximize2 size={12} />
                <span>Full Cockpit</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDeckOpen(false)}
                title="Minimize Deck"
                style={{
                  background: 'rgba(255, 255, 255, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.70)',
                  color: '#334155',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Deck Body: Transparent Message Stream */}
          <div
            style={{
              padding: '16px',
              overflowY: 'auto',
              maxHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '3px',
                      fontSize: '10px',
                      color: '#64748b',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: isUser ? '#ea580c' : '#0284c7' }}>
                      {isUser ? userName.split(' ')[0] : 'BEMS AI Copilot'}
                    </span>
                    <span>·</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    style={{
                      background: isUser
                        ? 'linear-gradient(135deg, rgba(234, 88, 12, 0.95) 0%, rgba(249, 115, 22, 0.95) 100%)'
                        : 'rgba(255, 255, 255, 0.88)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: isUser ? 'none' : '1px solid rgba(226, 232, 240, 0.85)',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      padding: isUser ? '10px 14px' : '14px 16px',
                      color: isUser ? '#ffffff' : '#0f172a',
                      fontSize: '12.5px',
                      lineHeight: 1.5,
                      maxWidth: isUser ? '85%' : '98%',
                      width: isUser ? 'auto' : '100%',
                      boxShadow: isUser ? '0 4px 14px rgba(234, 88, 12, 0.25)' : '0 4px 20px rgba(15, 23, 42, 0.06)',
                    }}
                  >
                    <FormattedAiMessage
                      content={msg.content}
                      isUser={isUser}
                      quickReplies={msg.quickReplies}
                      onSelectQuickReply={(prompt) => onSendMessage(prompt)}
                      onNavigateToRequest={(reqNum) => {
                        setIsDeckOpen(false);
                        onNavigate && onNavigate('Fund requests');
                      }}
                    />
                  </div>

                  {/* Render Action Cards */}
                  {msg.actionCard && (
                    <div style={{ width: '100%', maxWidth: '96%' }}>
                      {msg.actionCard.type === 'briefing' && (
                        <BriefingActionCard
                          data={msg.actionCard.data}
                          onNavigate={(tab) => {
                            setIsDeckOpen(false);
                            onNavigate && onNavigate(tab);
                          }}
                          onSelectAction={(prompt) => onSendMessage(prompt)}
                        />
                      )}

                      {msg.actionCard.type === 'approval_decision' && (
                        <ApprovalDecisionCard
                          data={msg.actionCard.data}
                          confirmed={msg.actionCard.confirmed}
                          cancelled={msg.actionCard.cancelled}
                          resultMessage={msg.actionCard.resultMessage}
                          onExecuteDecision={(action, reason, recorder) => {
                            onConfirmAction(msg.id, 'approval_decision', {
                              requestNumber: msg.actionCard?.data.requestNumber,
                              action,
                              reason,
                              recorder,
                            });
                          }}
                        />
                      )}

                      {msg.actionCard.type === 'budget_proposal' && (
                        <BudgetProposalCard
                          data={msg.actionCard.data}
                          confirmed={msg.actionCard.confirmed}
                          cancelled={msg.actionCard.cancelled}
                          resultMessage={msg.actionCard.resultMessage}
                          onConfirmBudget={(bData) => {
                            onConfirmAction(msg.id, 'budget_proposal', bData);
                          }}
                        />
                      )}

                      {msg.actionCard.type === 'salary_adjustment' && (
                        <SalaryAdjustmentCard
                          data={msg.actionCard.data}
                          confirmed={msg.actionCard.confirmed}
                          cancelled={msg.actionCard.cancelled}
                          resultMessage={msg.actionCard.resultMessage}
                          onAuthorizeAdjustment={(sData) => {
                            onConfirmAction(msg.id, 'salary_adjustment', sData);
                          }}
                        />
                      )}

                      {msg.actionCard.type === 'disbursement_record' && (
                        <DisbursementRecordCard
                          data={msg.actionCard.data}
                          confirmed={msg.actionCard.confirmed}
                          cancelled={msg.actionCard.cancelled}
                          resultMessage={msg.actionCard.resultMessage}
                          onRecordDisbursement={(dData) => {
                            onConfirmAction(msg.id, 'disbursement_record', dData);
                          }}
                        />
                      )}

                      {msg.actionCard.type === 'scenario_simulator' && (
                        <ScenarioSimulatorCard
                          data={msg.actionCard.data}
                          onApplyRecommendation={(prompt) => onSendMessage(prompt)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Typing indicator */}
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '11px' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ea580c', animation: 'pulse 1s infinite' }} />
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ea580c', animation: 'pulse 1s infinite 0.2s' }} />
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ea580c', animation: 'pulse 1s infinite 0.4s' }} />
                </div>
                <span style={{ fontWeight: 600 }}>Analyzing BEMS ledger...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* 2. THE BOTTOM COMMAND & CHAT BAR */}
      <div
        className="ambient-bottom-ai-bar"
        style={{
          pointerEvents: 'auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '7px 10px 7px 12px',
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.80)',
          borderRadius: '999px',
          boxShadow: '0 16px 45px rgba(15, 23, 42, 0.14), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95), 0 0 32px rgba(249, 115, 22, 0.10)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Kinetic Orb + Telemetry Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={() => {
            notifyAiInteraction();
            if (telemetry.actionPrompt) {
              onSendMessage(telemetry.actionPrompt);
              setIsDeckOpen(true);
            } else {
              setIsDeckOpen(!isDeckOpen);
            }
          }}
          title="Toggle AI Response Stream"
        >
          <KineticAiOrb size="compact" isTyping={isTyping || isTelemetryTyping} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: '6px',
                fontSize: '9.5px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                background: badgeColors.bg,
                color: badgeColors.text,
                border: `1px solid ${badgeColors.border}`,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: badgeColors.dot,
                  display: 'inline-block',
                }}
              />
              {telemetry.badge}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
              · {currentPage}
            </span>
          </div>
        </div>

        {/* Quick Context Action Chip (if available and not typing) */}
        {telemetry.actionLabel && !inputText && (
          <button
            type="button"
            onClick={() => {
              if (telemetry.actionPrompt) {
                notifyAiInteraction();
                onSendMessage(telemetry.actionPrompt);
                setIsDeckOpen(true);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              border: '1px solid #fed7aa',
              color: '#c2410c',
              fontSize: '10.5px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <span>⚡</span>
            <span>{telemetry.actionLabel}</span>
          </button>
        )}

        {/* Direct Transparent Chat Input Bar */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
          }}
        >
          <input
            type="text"
            placeholder={isTelemetryTyping ? displayText : `Ask AI or instruct: e.g. What needs my attention?`}
            value={inputText}
            onChange={(e) => {
              notifyAiInteraction();
              setInputText(e.target.value);
            }}
            onFocus={() => {
              notifyAiInteraction();
              if (messages.length > 1) setIsDeckOpen(true);
            }}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.75)',
              borderRadius: '999px',
              padding: '7px 14px',
              fontSize: '12px',
              color: '#0f172a',
              outline: 'none',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)',
            }}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            style={{
              background: inputText.trim() && !isTyping ? 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' : 'rgba(255, 255, 255, 0.45)',
              color: inputText.trim() && !isTyping ? '#ffffff' : '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.60)',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'grid',
              placeItems: 'center',
              cursor: inputText.trim() && !isTyping ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <Send size={12} />
          </button>
        </form>

        {/* Toggle Deck / Expand Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              notifyAiInteraction();
              setIsDeckOpen(!isDeckOpen);
            }}
            title={isDeckOpen ? 'Collapse Deck' : 'Expand AI Stream'}
            style={{
              background: 'rgba(255, 255, 255, 0.50)',
              border: '1px solid rgba(255, 255, 255, 0.70)',
              color: '#334155',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              fontSize: '11px',
            }}
          >
            {isDeckOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          <button
            type="button"
            onClick={() => onOpenFullCockpit()}
            title="Open Full Cockpit (Cmd + J)"
            style={{
              background: 'rgba(255, 255, 255, 0.50)',
              border: '1px solid rgba(255, 255, 255, 0.70)',
              color: '#334155',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10.5px',
              fontWeight: 700,
            }}
          >
            <kbd style={{ fontSize: '9px', opacity: 0.8 }}>⌘J</kbd>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes deckSlideUp {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
