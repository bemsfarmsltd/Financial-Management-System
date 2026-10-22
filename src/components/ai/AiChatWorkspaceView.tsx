'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  RotateCcw,
  Bot,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAiFinancialManager } from './useAiFinancialManager';
import { FormattedAiMessage } from './FormattedAiMessage';
import { KineticAiOrb } from './KineticAiOrb';
import { BriefingActionCard } from './cards/BriefingActionCard';
import { ApprovalDecisionCard } from './cards/ApprovalDecisionCard';
import { BudgetProposalCard } from './cards/BudgetProposalCard';
import { SalaryAdjustmentCard } from './cards/SalaryAdjustmentCard';
import { DisbursementRecordCard } from './cards/DisbursementRecordCard';
import { ScenarioSimulatorCard } from './cards/ScenarioSimulatorCard';

interface AiChatWorkspaceViewProps {
  businessName: string;
  businessId: string;
  userName: string;
  userRole: string;
  isChatEnabled?: boolean;
  onNavigate?: (tab: string) => void;
}

const SUGGESTED_PROMPTS = [
  { icon: '💰', text: 'What is our current liquid cash and treasury reserve balance?' },
  { icon: '📊', text: 'Summarize all pending requisitions and urgent approvals' },
  { icon: '⚖️', text: 'Show open accountability cases and overdue evidence' },
  { icon: '📈', text: 'Analyze our top spend categories and recent trends' },
  { icon: '🔮', text: 'Forecast cash runway and obligations due in 30 days' },
];

export function AiChatWorkspaceView({
  businessName,
  businessId,
  userName,
  userRole,
  isChatEnabled = true,
  onNavigate,
}: AiChatWorkspaceViewProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const aiManager = useAiFinancialManager({
    userRole,
    userName,
    businessName,
    businessId,
    currentPage: 'AI Copilot & Chat',
  });

  const { messages, isTyping, sendMessage, handleConfirmAction } = aiManager;

  // Auto-scroll when messages update or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping || !isChatEnabled) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handlePromptClick = (promptText: string) => {
    if (!isChatEnabled || isTyping) return;
    sendMessage(promptText);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', minHeight: 650 }}>
      {/* Workspace Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#8b5cf6',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            ✦ EXECUTIVE AI INTELLIGENCE & COPILOT
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 850, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            AI Copilot & Conversational Workspace
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px', maxWidth: 780 }}>
            Converse directly with the BEMS Autonomous AI Financial Copilot. Query live ledger balances, audit pending requests, inspect vendor records, and run simulations for {businessName}.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isChatEnabled ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#047857',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
              Live Copilot Active
            </div>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#b91c1c',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <Lock size={13} />
              Access Paused by Admin
            </div>
          )}
        </div>
      </div>

      {/* Access Paused Notice Banner */}
      {!isChatEnabled && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '24px 28px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: 10,
                padding: 10,
                color: '#b91c1c',
              }}
            >
              <Lock size={24} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: '#991b1b' }}>
                AI Chat Access Paused by Administrator
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#7f1d1d', lineHeight: 1.5, maxWidth: 700 }}>
                The Group Managing Director or System Administrator has temporarily toggled off interactive AI chat for the AI Analyst role in <strong>Settings → AI & Copilot Access</strong>. While chat is paused, you can still view Executive Briefings and Request Channels.
              </p>
            </div>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('Executive briefing')}
              style={{
                background: '#ffffff',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              View Executive Briefing <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* Main Chat Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Suggested Quick Prompts Bar */}
        {isChatEnabled && (
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              alignItems: 'center',
              scrollbarWidth: 'thin',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
              Suggested queries:
            </span>
            {SUGGESTED_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePromptClick(p.text)}
                disabled={isTyping}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '999px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: isTyping ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                  opacity: isTyping ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isTyping) {
                    e.currentTarget.style.borderColor = '#8b5cf6';
                    e.currentTarget.style.color = '#6d28d9';
                    e.currentTarget.style.background = '#f5f3ff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#334155';
                  e.currentTarget.style.background = '#ffffff';
                }}
              >
                <span>{p.icon}</span>
                <span>{p.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Chat History */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
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
                {/* Message Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 5,
                    fontSize: '11px',
                    color: '#64748b',
                  }}
                >
                  <span style={{ fontWeight: 800, color: isUser ? '#ea580c' : '#7c3aed' }}>
                    {isUser ? userName : 'BEMS AI Financial Copilot'}
                  </span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Bubble */}
                <div
                  style={{
                    background: isUser
                      ? 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)'
                      : '#ffffff',
                    border: isUser ? 'none' : '1px solid #e2e8f0',
                    borderRadius: isUser ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                    padding: isUser ? '12px 18px' : '16px 20px',
                    color: isUser ? '#ffffff' : '#0f172a',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    maxWidth: isUser ? '75%' : '88%',
                    boxShadow: isUser
                      ? '0 4px 14px rgba(234, 88, 12, 0.2)'
                      : '0 4px 18px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  <FormattedAiMessage
                    content={msg.content}
                    isUser={isUser}
                    quickReplies={msg.quickReplies}
                    onSelectQuickReply={(prompt) => sendMessage(prompt)}
                    onNavigateToRequest={() => {
                      onNavigate && onNavigate('Fund requests');
                    }}
                  />
                </div>

                {/* Render Interactive Action Card if Present */}
                {msg.actionCard && (
                  <div style={{ width: '100%', maxWidth: '88%', marginTop: 8 }}>
                    {msg.actionCard.type === 'briefing' && (
                      <BriefingActionCard
                        data={msg.actionCard.data}
                        onNavigate={(tab) => onNavigate && onNavigate(tab)}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '88%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: '11px', color: '#64748b' }}>
                <span style={{ fontWeight: 800, color: '#7c3aed' }}>BEMS AI Financial Copilot</span>
                <span>·</span>
                <span>Analyzing live ledger…</span>
              </div>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px 16px 16px 3px',
                  padding: '14px 20px',
                  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', animation: 'bounce 1.4s infinite ease-in-out' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', animation: 'bounce 1.4s infinite ease-in-out 0.2s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', animation: 'bounce 1.4s infinite ease-in-out 0.4s' }} />
                </div>
                <span style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                  Processing financial intelligence…
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          <form
            onSubmit={handleSend}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ position: 'absolute', left: 14, color: '#8b5cf6', pointerEvents: 'none' }}>
                <Sparkles size={17} />
              </div>
              <input
                ref={inputRef}
                type="text"
                disabled={!isChatEnabled || isTyping}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  !isChatEnabled
                    ? 'AI chat is currently paused by the administrator in Settings.'
                    : 'Ask anything about requisitions, treasury reserves, budget variances, or financial health…'
                }
                style={{
                  width: '100%',
                  padding: '13px 16px 13px 44px',
                  borderRadius: 12,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#0f172a',
                  background: !isChatEnabled ? '#f8fafc' : '#ffffff',
                  cursor: !isChatEnabled ? 'not-allowed' : 'text',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  if (isChatEnabled) e.currentTarget.style.borderColor = '#8b5cf6';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!isChatEnabled || !inputText.trim() || isTyping}
              style={{
                background: !isChatEnabled || !inputText.trim() || isTyping
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '13px 22px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: !isChatEnabled || !inputText.trim() || isTyping ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: !isChatEnabled || !inputText.trim() || isTyping ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Send</span>
              <Send size={15} />
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              fontSize: '11px',
              color: '#94a3b8',
            }}
          >
            <span>Autonomous AI Copilot powered by BEMS live ledger & database intelligence</span>
            <span>Tip: Press <strong>Enter</strong> to send · <strong>⌘+J</strong> opens quick drawer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
