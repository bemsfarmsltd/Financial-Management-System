'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Maximize2,
  Minimize2,
  Bot,
  Sparkles,
  Zap,
  ShieldCheck,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAiFinancialManager } from './useAiFinancialManager';
import { AiContextBanner } from './AiContextBanner';
import { AiQuickPrompts } from './AiQuickPrompts';
import { BriefingActionCard } from './cards/BriefingActionCard';
import { ApprovalDecisionCard } from './cards/ApprovalDecisionCard';
import { BudgetProposalCard } from './cards/BudgetProposalCard';
import { SalaryAdjustmentCard } from './cards/SalaryAdjustmentCard';
import { DisbursementRecordCard } from './cards/DisbursementRecordCard';
import { ScenarioSimulatorCard } from './cards/ScenarioSimulatorCard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
  userName: string;
  businessName: string;
  businessId: string;
  currentPage: string;
  initialPrompt?: string;
  onNavigate?: (tab: string) => void;
}

export function AiFinancialManagerDrawer({
  isOpen,
  onClose,
  userRole,
  userName,
  businessName,
  businessId,
  currentPage,
  initialPrompt,
  onNavigate,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPromptSentRef = useRef<string | null>(null);

  const { messages, isTyping, sendMessage, handleConfirmAction } = useAiFinancialManager({
    userRole,
    userName,
    businessName,
    businessId,
    currentPage,
  });

  // If launched with an initial prompt from the ambient HUD, send it automatically
  useEffect(() => {
    if (isOpen && initialPrompt && initialPrompt !== lastPromptSentRef.current) {
      lastPromptSentRef.current = initialPrompt;
      sendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt, sendMessage]);

  // Reset sent prompt tracker when closed
  useEffect(() => {
    if (!isOpen) {
      lastPromptSentRef.current = null;
    }
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const drawerWidth = isExpanded ? '920px' : '490px';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(11, 18, 32, 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        transition: 'all 0.25s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: drawerWidth,
          maxWidth: '100vw',
          height: '100vh',
          background: 'linear-gradient(180deg, #090e17 0%, #0f172a 100%)',
          borderLeft: '1px solid rgba(249, 115, 22, 0.25)',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s ease',
          color: '#ffffff',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(15, 23, 42, 0.9)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 0 16px rgba(249, 115, 22, 0.4)',
              }}
            >
              <Bot size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  BEMS AI Financial Manager
                </strong>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    textTransform: 'uppercase',
                  }}
                >
                  Live
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Executive Intelligence & Decision Autopilot
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              title={soundEnabled ? 'Mute AI Audio' : 'Enable AI Audio Feedback'}
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                background: 'none',
                border: 'none',
                color: soundEnabled ? '#f97316' : '#64748b',
                padding: '6px',
                cursor: 'pointer',
                borderRadius: '6px',
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              type="button"
              title={isExpanded ? 'Collapse to Side Drawer' : 'Expand to Cockpit View'}
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                padding: '6px',
                cursor: 'pointer',
                borderRadius: '6px',
              }}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              title="Close (Esc)"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                padding: '6px',
                cursor: 'pointer',
                borderRadius: '6px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Context Banner */}
        <AiContextBanner
          role={userRole}
          userName={userName}
          businessName={businessName}
          currentPage={currentPage}
        />

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
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
                    marginBottom: '4px',
                    fontSize: '10px',
                    color: '#64748b',
                  }}
                >
                  <span style={{ fontWeight: 700, color: isUser ? '#f97316' : '#38bdf8' }}>
                    {isUser ? userName.split(' ')[0] : 'AI Financial Manager'}
                  </span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  style={{
                    background: isUser ? '#ea580c' : 'rgba(30, 41, 59, 0.7)',
                    border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    padding: '12px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    maxWidth: isExpanded ? '85%' : '95%',
                    boxShadow: isUser ? '0 4px 12px rgba(234, 88, 12, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.2)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>

                {/* Render Interactive Action Card if Present */}
                {msg.actionCard && (
                  <div style={{ width: '100%', maxWidth: isExpanded ? '85%' : '95%' }}>
                    {msg.actionCard.type === 'briefing' && (
                      <BriefingActionCard
                        data={msg.actionCard.data}
                        onNavigate={(tab) => {
                          onClose();
                          onNavigate && onNavigate(tab);
                        }}
                        onSelectAction={(prompt) => sendMessage(prompt)}
                      />
                    )}

                    {msg.actionCard.type === 'approval_decision' && (
                      <ApprovalDecisionCard
                        data={msg.actionCard.data}
                        confirmed={msg.actionCard.confirmed}
                        cancelled={msg.actionCard.cancelled}
                        resultMessage={msg.actionCard.resultMessage}
                        onExecuteDecision={(action, reason, recorder) => {
                          handleConfirmAction(msg.id, 'approval_decision', {
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
                          handleConfirmAction(msg.id, 'budget_proposal', bData);
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
                          handleConfirmAction(msg.id, 'salary_adjustment', sData);
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
                          handleConfirmAction(msg.id, 'disbursement_record', dData);
                        }}
                      />
                    )}

                    {msg.actionCard.type === 'scenario_simulator' && (
                      <ScenarioSimulatorCard
                        data={msg.actionCard.data}
                        onApplyRecommendation={(prompt) => sendMessage(prompt)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(249, 115, 22, 0.2)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Bot size={15} color="#f97316" />
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316', animation: 'pulse 1s infinite' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316', animation: 'pulse 1s infinite 0.2s' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316', animation: 'pulse 1s infinite 0.4s' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Analyzing BEMS ledger…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <AiQuickPrompts
          currentPage={currentPage}
          onSelectPrompt={(prompt) => sendMessage(prompt)}
        />

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '12px 16px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            placeholder="Ask anything or instruct: e.g. What needs my attention today?"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            style={{
              background: inputText.trim() && !isTyping ? '#f97316' : 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 14px',
              cursor: inputText.trim() && !isTyping ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '12px',
              transition: 'background 0.15s ease',
            }}
          >
            <span>Send</span>
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}
