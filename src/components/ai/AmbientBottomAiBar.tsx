'use client';

import React, { useState, useRef, useEffect } from 'react';
import { KineticAiOrb } from './KineticAiOrb';
import { useAmbientTelemetry } from './useAmbientTelemetry';
import { AiMessage } from './types';
import { Send, Maximize2, Minimize2, X, Trash2, Sparkles, ChevronUp, ChevronDown, Target, RotateCcw, History } from 'lucide-react';
import { BriefingActionCard } from './cards/BriefingActionCard';
import { ApprovalDecisionCard } from './cards/ApprovalDecisionCard';
import { BudgetProposalCard } from './cards/BudgetProposalCard';
import { SalaryAdjustmentCard } from './cards/SalaryAdjustmentCard';
import { DisbursementRecordCard } from './cards/DisbursementRecordCard';
import { ScenarioSimulatorCard } from './cards/ScenarioSimulatorCard';
import { UniversalStagedActionCard } from './cards/UniversalStagedActionCard';
import { notifyAiInteraction } from './AiScreenEdgeGlow';
import { FormattedAiMessage } from './FormattedAiMessage';
import { AgentMentionMenu, AgentOption } from './AgentMentionMenu';

interface Props {
  currentPage: string;
  businessName: string;
  userName: string;
  userRole: string;
  messages: AiMessage[];
  isTyping: boolean;
  isInspectMode?: boolean;
  onToggleInspectMode?: () => void;
  onSendMessage: (text: string) => void;
  onConfirmAction: (messageId: string, actionType: string, payload: any) => void;
  onCancelAction?: (messageId: string, stagedActionId: string) => void;
  onNewChat?: () => void;
  onOpenHistory?: () => void;
  onOpenFullCockpit: (initialPrompt?: string) => void;
  onNavigate?: (tab: string) => void;
  agentMode?: 'financial' | 'hr' | 'both' | 'auto';
  onSetAgentMode?: (mode: 'financial' | 'hr' | 'both' | 'auto') => void;
}

export function AmbientBottomAiBar({
  currentPage,
  businessName,
  userName,
  userRole,
  messages,
  isTyping,
  isInspectMode = false,
  onToggleInspectMode,
  onSendMessage,
  onConfirmAction,
  onCancelAction,
  onNewChat,
  onOpenHistory,
  onOpenFullCockpit,
  onNavigate,
  agentMode = 'auto',
  onSetAgentMode,
}: Props) {
  const isGroupScope = !businessName || businessName === 'BEMS Group';
  const [inputText, setInputText] = useState('');
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const [isOrbitActive, setIsOrbitActive] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [isMenuDismissed, setIsMenuDismissed] = useState(false);

  // Auto-stop attention-grabbing orbit 1 minute (60 seconds) after entering the dashboard
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOrbitActive(false);
    }, 60000);
    return () => clearTimeout(timer);
  }, []);

  const { telemetry, displayText, isTyping: isTelemetryTyping } = useAmbientTelemetry({
    currentPage,
    businessName,
  });

  // Only auto-open the floating response deck when the user actively triggers a new query (isTyping becomes true),
  // never when restoring historical messages on page reload.
  useEffect(() => {
    if (isTyping) {
      setIsDeckOpen(true);
    }
  }, [isTyping]);

  // Auto-scroll response stream
  useEffect(() => {
    if (isDeckOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isDeckOpen]);

  // Mention menu detection for @agent or /agent
  const mentionMatch = !isMenuDismissed ? inputText.match(/(?:^|\s)([@/])([a-zA-Z]*)$/) : null;
  const isMentionActive = Boolean(mentionMatch);
  const mentionPrefix = (mentionMatch?.[1] || '@') as '@' | '/';
  const mentionFilter = mentionMatch?.[2] || '';

  const handleSelectAgent = (opt: AgentOption) => {
    if (onSetAgentMode) onSetAgentMode(opt.id);
    const updated = inputText.replace(/(?:^|\s)([@/])([a-zA-Z]*)$/, (match) => {
      const leadingSpace = match.startsWith(' ') ? ' ' : '';
      return `${leadingSpace}${opt.tag} `;
    });
    setInputText(updated);
    setIsMenuDismissed(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isMentionActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuIndex((prev) => prev + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuIndex((prev) => (prev > 0 ? prev - 1 : 2));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const available = [
          { id: 'both', tag: `${mentionPrefix}both`, label: 'Dual-Agent Co-Pilot (Both)', description: '', icon: '✦', color: '#7c3aed', bgLight: '' },
          { id: 'financial', tag: `${mentionPrefix}finance`, label: 'Financial & Treasury Manager', description: '', icon: '⚡', color: '#ea580c', bgLight: '' },
          { id: 'hr', tag: `${mentionPrefix}hr`, label: 'HR & Workforce Operations', description: '', icon: '👥', color: '#059669', bgLight: '' },
          { id: 'auto', tag: `${mentionPrefix}auto`, label: 'Auto-Detect Agent', description: '', icon: '✦', color: '#6366f1', bgLight: '' },
        ].filter(opt => !mentionFilter || opt.tag.includes(mentionFilter.toLowerCase()) || opt.id.includes(mentionFilter.toLowerCase()));
        if (available.length > 0) {
          e.preventDefault();
          const selected = available[menuIndex % available.length];
          handleSelectAgent(selected as any);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuDismissed(true);
        return;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    notifyAiInteraction();

    let textToSend = inputText.trim();
    const tagMatch = textToSend.match(/^[@/](finance|financial|hr|people|both|all|auto)\b\s*/i);
    if (tagMatch) {
      const token = tagMatch[1].toLowerCase();
      textToSend = textToSend.slice(tagMatch[0].length).trim();
      if (onSetAgentMode) {
        if (token === 'finance' || token === 'financial') onSetAgentMode('financial');
        else if (token === 'hr' || token === 'people') onSetAgentMode('hr');
        else if (token === 'both' || token === 'all') onSetAgentMode('both');
        else if (token === 'auto') onSetAgentMode('auto');
      }
    }

    if (textToSend) {
      onSendMessage(textToSend);
      setInputText('');
      setIsDeckOpen(true);
      setIsMenuDismissed(false);
    }
  };

  const getSeverityBadgeColor = () => {
    switch (telemetry.severity) {
      case 'warning':
        return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' };
      case 'highlight':
        return { bg: 'var(--brand-tint, #eff6ff)', text: 'var(--brand-primary, #2563eb)', border: 'var(--brand-primary, #bfdbfe)', dot: 'var(--brand-primary, #3b82f6)' };
      case 'success':
        return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', dot: '#10b981' };
      default:
        return { bg: 'var(--brand-tint, #eff6ff)', text: 'var(--brand-primary, #2563eb)', border: 'var(--brand-primary, #bfdbfe)', dot: 'var(--brand-primary, #3b82f6)' };
    }
  };

  const badgeColors = getSeverityBadgeColor();

  return (
    <div
      className="ambient-bottom-ai-wrapper"
      style={{
        position: 'fixed',
        bottom: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9950,
        width: 'min(1120px, calc(100vw - 32px))',
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
            maxHeight: '620px',
            marginBottom: '10px',
            background: 'rgba(255, 255, 255, 0.58)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.80)',
            borderRadius: '24px',
            boxShadow: '0 25px 70px rgba(15, 23, 42, 0.16), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95), 0 0 40px var(--brand-shadow-color, rgba(37, 99, 235, 0.10))',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Sparkles size={14} color="var(--brand-primary, #ea580c)" />
              <strong style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 800 }}>
                {agentMode === 'both' ? 'BEMS AI Dual-Agent Co-Pilot' : agentMode === 'hr' ? 'BEMS AI HR & Workforce' : agentMode === 'financial' ? 'BEMS AI Financial Assistant' : 'BEMS AI Copilot'}
              </strong>
              {isGroupScope ? (
                <span
                  style={{
                    background: 'rgba(234, 88, 12, 0.12)',
                    color: '#c2410c',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: '1px solid rgba(234, 88, 12, 0.35)',
                    letterSpacing: '0.02em',
                  }}
                >
                  🌐 BEMS Group
                </span>
              ) : (
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#047857',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    letterSpacing: '0.02em',
                  }}
                  title={`Strictly isolated to ${businessName}`}
                >
                  🔒 Scoped to {businessName}
                </span>
              )}

              {onSetAgentMode && (
                <div style={{ display: 'inline-flex', alignItems: 'center', background: '#e2e8f0', borderRadius: '999px', padding: '2px', marginLeft: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onSetAgentMode('auto')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '10px',
                      fontWeight: 750,
                      border: 0,
                      cursor: 'pointer',
                      background: agentMode === 'auto' ? '#ffffff' : 'transparent',
                      color: agentMode === 'auto' ? '#0f172a' : '#64748b',
                      boxShadow: agentMode === 'auto' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                    title="Intelligently route to Financial or HR Agent based on question"
                  >
                    ✦ Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAgentMode('both')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '10px',
                      fontWeight: 750,
                      border: 0,
                      cursor: 'pointer',
                      background: agentMode === 'both' ? '#ffffff' : 'transparent',
                      color: agentMode === 'both' ? '#7c3aed' : '#64748b',
                      boxShadow: agentMode === 'both' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                    title="Parallel Financial & HR Operations synthesis"
                  >
                    ✦ Both
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAgentMode('financial')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '10px',
                      fontWeight: 750,
                      border: 0,
                      cursor: 'pointer',
                      background: agentMode === 'financial' ? '#ffffff' : 'transparent',
                      color: agentMode === 'financial' ? '#ea580c' : '#64748b',
                      boxShadow: agentMode === 'financial' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                    title="Directly talk to Financial Manager"
                  >
                    ⚡ Finance
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAgentMode('hr')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '10px',
                      fontWeight: 750,
                      border: 0,
                      cursor: 'pointer',
                      background: agentMode === 'hr' ? '#ffffff' : 'transparent',
                      color: agentMode === 'hr' ? '#059669' : '#64748b',
                      boxShadow: agentMode === 'hr' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                    title="Directly talk to HR & Workforce Operations"
                  >
                    👥 HR Ops
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  title="View past executive chat sessions"
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
                  <History size={12} color="#ea580c" />
                  <span>History</span>
                </button>
              )}

              {onNewChat && (
                <button
                  type="button"
                  onClick={onNewChat}
                  title="Start a new chat session"
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
                  <RotateCcw size={12} />
                  <span>New Chat</span>
                </button>
              )}

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
              maxHeight: '500px',
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
                    <span style={{ fontWeight: 700, color: isUser ? 'var(--brand-primary, #2563eb)' : '#0284c7' }}>
                      {isUser ? userName.split(' ')[0] : 'BEMS AI Copilot'}
                    </span>
                    <span>·</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    style={{
                      background: isUser
                        ? 'var(--brand-gradient, linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%))'
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
                      boxShadow: isUser ? '0 4px 14px var(--brand-shadow-color, rgba(37, 99, 235, 0.25))' : '0 4px 20px rgba(15, 23, 42, 0.06)',
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
                              requestNumber: msg.actionCard?.data?.requestNumber,
                              staged_action_id: msg.actionCard?.staged_action_id,
                              confirmation_hash: msg.actionCard?.confirmation_hash,
                              action,
                              reason,
                              recorder,
                            });
                          }}
                        />
                      )}

                      {(msg.actionCard.type === 'budget_proposal' || msg.actionCard.type === 'budget') && msg.actionCard.data?.lines && (
                        <BudgetProposalCard
                          data={msg.actionCard.data}
                          confirmed={msg.actionCard.confirmed}
                          cancelled={msg.actionCard.cancelled}
                          resultMessage={msg.actionCard.resultMessage}
                          onConfirmBudget={(bData) => {
                            onConfirmAction(msg.id, 'budget_proposal', {
                              ...bData,
                              staged_action_id: msg.actionCard?.staged_action_id,
                              confirmation_hash: msg.actionCard?.confirmation_hash,
                            });
                          }}
                        />
                      )}

                      {(msg.actionCard.type === 'salary_adjustment' || msg.actionCard.type === 'salary_change') && msg.actionCard.data?.proposedSalary !== undefined && (
                        <SalaryAdjustmentCard
                          data={msg.actionCard.data}
                          confirmed={msg.actionCard.confirmed}
                          cancelled={msg.actionCard.cancelled}
                          resultMessage={msg.actionCard.resultMessage}
                          onAuthorizeAdjustment={(sData) => {
                            onConfirmAction(msg.id, 'salary_adjustment', {
                              ...sData,
                              staged_action_id: msg.actionCard?.staged_action_id,
                              confirmation_hash: msg.actionCard?.confirmation_hash,
                            });
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
                            onConfirmAction(msg.id, 'disbursement_record', {
                              ...dData,
                              staged_action_id: msg.actionCard?.staged_action_id,
                              confirmation_hash: msg.actionCard?.confirmation_hash,
                            });
                          }}
                        />
                      )}

                      {msg.actionCard.type === 'scenario_simulator' && (
                        <ScenarioSimulatorCard
                          data={msg.actionCard.data}
                          onApplyRecommendation={(prompt) => onSendMessage(prompt)}
                        />
                      )}

                      {/* Universal Fallback for any Staged Action or unhandled type */}
                      {(msg.actionCard.staged_action_id ||
                        msg.actionCard.type === 'staged_action' ||
                        msg.actionCard.cardType === 'STAGED_ACTION' ||
                        (!['briefing', 'approval_decision', 'budget_proposal', 'salary_adjustment', 'disbursement_record', 'scenario_simulator'].includes(msg.actionCard.type) &&
                          (!msg.actionCard.data?.lines && msg.actionCard.data?.proposedSalary === undefined))) && (
                        <UniversalStagedActionCard
                          stagedActionId={msg.actionCard.staged_action_id || ''}
                          confirmationHash={msg.actionCard.confirmation_hash || ''}
                          actionType={msg.actionCard.actionType || msg.actionCard.type || 'staged_action'}
                          summary={msg.actionCard.summary || 'Executive Staged Action'}
                          preview={msg.actionCard.preview || msg.actionCard.data || {}}
                          warnings={msg.actionCard.warnings}
                          blockingErrors={msg.actionCard.blocking_errors}
                          expiresAt={msg.actionCard.expires_at}
                          status={msg.actionCard.status}
                          confirmed={msg.actionCard.confirmed}
                          cancelled={msg.actionCard.cancelled}
                          resultMessage={msg.actionCard.resultMessage}
                          errorMessage={msg.actionCard.errorMessage}
                          resultUrl={msg.actionCard.resultUrl}
                          recordId={msg.actionCard.recordId}
                          auditEventId={msg.actionCard.auditEventId}
                          onConfirm={(id, hash) => {
                            onConfirmAction(msg.id, msg.actionCard?.type || 'staged_action', {
                              staged_action_id: id,
                              confirmation_hash: hash,
                            });
                          }}
                          onCancel={(id) => {
                            if (onCancelAction) {
                              onCancelAction(msg.id, id);
                            }
                          }}
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
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--brand-primary, #2563eb)', animation: 'pulse 1s infinite' }} />
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--brand-primary, #2563eb)', animation: 'pulse 1s infinite 0.2s' }} />
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--brand-primary, #2563eb)', animation: 'pulse 1s infinite 0.4s' }} />
                </div>
                <span style={{ fontWeight: 600 }}>Analyzing BEMS ledger...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* 1.5. FLOATING AGENT MENTION / SLASH COMMAND SELECTION MENU (Rendered outside overflow:hidden wrapper) */}
      {isMentionActive && (
        <div
          style={{
            pointerEvents: 'auto',
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-end',
            paddingRight: '36px',
            marginBottom: '8px',
            zIndex: 99999,
            animation: 'deckSlideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <AgentMentionMenu
            prefix={mentionPrefix}
            filterText={mentionFilter}
            selectedIndex={menuIndex}
            onSelect={handleSelectAgent}
            onClose={() => setIsMenuDismissed(true)}
            style={{
              position: 'relative',
              bottom: 'auto',
              left: 'auto',
              minWidth: '340px',
              maxWidth: '420px',
            }}
          />
        </div>
      )}

      {/* 2. THE BOTTOM COMMAND & CHAT BAR WITH HYPER-BRIGHT ORBITING SUBSIDIARY BRAND LIGHT (STOPS AFTER 1 MIN) */}
      <div
        className="bemi-orbit-wrapper"
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: '999px',
          padding: isOrbitActive ? '2.5px' : '1px',
          overflow: 'hidden',
          boxShadow: isOrbitActive
            ? '0 12px 36px rgba(15, 23, 42, 0.14), 0 0 28px var(--brand-shadow-color, rgba(13, 138, 112, 0.38)), 0 0 10px var(--brand-primary, #0d8a70)'
            : '0 8px 24px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
          border: isOrbitActive ? 'none' : '1px solid rgba(226, 232, 240, 0.85)',
          animation: isOrbitActive ? 'bemiAttentionPulse 3.5s ease-in-out infinite' : 'none',
          transition: 'all 0.8s ease',
          pointerEvents: 'auto',
        }}
      >
        {/* Layer 1: Diffused Luminous Outer Halo / Volumetric Bloom Orbit */}
        {isOrbitActive && (
          <div
            aria-hidden="true"
            className="bemi-orbit-bloom"
            style={{
              position: 'absolute',
              inset: '-100%',
              background: 'conic-gradient(from 0deg, transparent 0deg, transparent 180deg, var(--brand-primary, #0d8a70) 250deg, #38bdf8 300deg, #ffffff 345deg, var(--brand-primary, #0d8a70) 360deg)',
              filter: 'blur(8px)',
              opacity: 0.9,
              animation: 'bemiOrbitSpin 3s linear infinite',
              zIndex: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.8s ease',
            }}
          />
        )}

        {/* Layer 2: Core Ultra-Bright Laser Comet (Pure Incandescent White Hot Beam + Vivid Brand Trail) */}
        {isOrbitActive && (
          <div
            aria-hidden="true"
            className="bemi-orbit-comet"
            style={{
              position: 'absolute',
              inset: '-120%',
              background: 'conic-gradient(from 0deg, transparent 0deg, transparent 200deg, var(--brand-primary, #0d8a70) 265deg, #38bdf8 310deg, #ffffff 345deg, #ffffff 355deg, var(--brand-primary, #0d8a70) 360deg)',
              filter: 'drop-shadow(0 0 8px #ffffff) drop-shadow(0 0 16px var(--brand-primary, #0d8a70))',
              animation: 'bemiOrbitSpin 3s linear infinite',
              zIndex: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.8s ease',
            }}
          />
        )}

        {/* The actual Bar Content */}
        <div
          className="ambient-bottom-ai-bar"
          style={{
            position: 'relative',
            zIndex: 1,
            pointerEvents: 'auto',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px 3px 10px',
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(32px) saturate(200%)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
            borderRadius: '999px',
            transition: 'all 0.2s ease',
          }}
        >
        {/* Kinetic Orb + Telemetry Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1.5px 6px',
                borderRadius: '5px',
                fontSize: '8.5px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                background: badgeColors.bg,
                color: badgeColors.text,
                border: `1px solid ${badgeColors.border}`,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: badgeColors.dot,
                  display: 'inline-block',
                }}
              />
              {telemetry.badge}
            </span>
            <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
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
              gap: '4px',
              padding: '2.5px 8px',
              borderRadius: '999px',
              background: 'var(--brand-tint, rgba(37, 99, 235, 0.12))',
              border: '1px solid var(--brand-border, rgba(37, 99, 235, 0.35))',
              color: 'var(--brand-primary, #2563eb)',
              fontSize: '9.5px',
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

        {/* Universal Point & Ask AI Mode Toggle */}
        {onToggleInspectMode && (
          <button
            type="button"
            onClick={onToggleInspectMode}
            title={isInspectMode ? 'Click anywhere on screen to inspect (or press Esc to cancel)' : 'Click to inspect & ask question about anything on screen (Shortcut: Option+Click)'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2.5px 8px',
              borderRadius: '999px',
              background: isInspectMode
                ? 'var(--brand-gradient, linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%))'
                : 'rgba(255, 255, 255, 0.75)',
              border: isInspectMode ? '1px solid var(--brand-primary, #2563eb)' : '1px solid rgba(226, 232, 240, 0.9)',
              color: isInspectMode ? '#ffffff' : '#334155',
              fontSize: '9.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: isInspectMode ? '0 0 10px var(--brand-shadow-color, rgba(37, 99, 235, 0.40))' : '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease',
            }}
          >
            <Target size={11} />
            <span>{isInspectMode ? 'Click Anything to Ask' : 'Point & Ask'}</span>
          </button>
        )}

        {/* Direct Transparent Chat Input Bar */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <form
            onSubmit={handleSubmit}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={isTelemetryTyping ? displayText : `Ask AI or type @ or / to choose agent...`}
              value={inputText}
              onChange={(e) => {
                notifyAiInteraction();
                setInputText(e.target.value);
                setIsMenuDismissed(false);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                notifyAiInteraction();
                if (inputText.includes('@') || inputText.includes('/')) {
                  setIsMenuDismissed(false);
                }
                if (messages.length > 1) setIsDeckOpen(true);
              }}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.75)',
                borderRadius: '999px',
                padding: '3px 12px',
                height: '26px',
                fontSize: '11px',
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
                background: inputText.trim() && !isTyping ? 'var(--brand-gradient, linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%))' : 'rgba(255, 255, 255, 0.45)',
                color: inputText.trim() && !isTyping ? '#ffffff' : '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.60)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'grid',
                placeItems: 'center',
                cursor: inputText.trim() && !isTyping ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={10} />
            </button>
          </form>
        </div>

        {/* Toggle Deck / Expand Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
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
              borderRadius: '7px',
              width: '24px',
              height: '24px',
              padding: 0,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              fontSize: '11px',
            }}
          >
            {isDeckOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          <button
            type="button"
            onClick={() => onOpenFullCockpit()}
            title="Open Full Cockpit (Cmd + J)"
            style={{
              background: 'rgba(255, 255, 255, 0.50)',
              border: '1px solid rgba(255, 255, 255, 0.70)',
              color: '#334155',
              borderRadius: '7px',
              height: '24px',
              padding: '0 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '9.5px',
              fontWeight: 700,
            }}
          >
            <kbd style={{ fontSize: '8.5px', opacity: 0.85 }}>⌘J</kbd>
          </button>
        </div>
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
        @keyframes bemiOrbitSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes bemiAttentionPulse {
          0%, 100% {
            box-shadow: 0 12px 36px rgba(15, 23, 42, 0.14), 0 0 24px var(--brand-shadow-color, rgba(13, 138, 112, 0.35)), 0 0 8px var(--brand-primary, #0d8a70);
          }
          50% {
            box-shadow: 0 16px 42px rgba(15, 23, 42, 0.18), 0 0 42px var(--brand-shadow-color, rgba(13, 138, 112, 0.70)), 0 0 18px var(--brand-primary, #0d8a70), 0 0 24px #ffffff;
          }
        }
      `}</style>
      {/* Global CSS fallback for non-styled-jsx environments */}
      <style>{`
        @keyframes bemiOrbitSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes bemiAttentionPulse {
          0%, 100% {
            box-shadow: 0 12px 36px rgba(15, 23, 42, 0.14), 0 0 24px var(--brand-shadow-color, rgba(13, 138, 112, 0.35)), 0 0 8px var(--brand-primary, #0d8a70);
          }
          50% {
            box-shadow: 0 16px 42px rgba(15, 23, 42, 0.18), 0 0 42px var(--brand-shadow-color, rgba(13, 138, 112, 0.70)), 0 0 18px var(--brand-primary, #0d8a70), 0 0 24px #ffffff;
          }
        }
      `}</style>
    </div>
  );
}
