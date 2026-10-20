'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  Minimize2,
  Bot,
  User,
  ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionCard?: any;
  stagedAction?: any;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export function GmdExecutiveAiApp({
  userName,
  businessName,
  onNavigate,
}: {
  userName: string;
  businessName: string;
  onNavigate?: (tab: string) => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    {
      id: 'session-default',
      title: 'Group Financial Briefing',
      updatedAt: 'Just now',
      messages: [
        {
          id: 'welcome-msg',
          sender: 'assistant',
          timestamp: 'Just now',
          content: `Good day, **${userName.split(' ')[0]}**. I am your **BEMS Executive AI Copilot**, grounded directly with live financial telemetry across **${businessName}**.\n\nAsk me about liquid cash reserves across your bank accounts, pending approvals, accountability cases, or request an executive briefing.`,
        },
      ],
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState('session-default');
  const [inputPrompt, setInputPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionResults, setActionResults] = useState<Record<string, { status: 'EXECUTED' | 'CANCELLED' | 'ERROR'; message: string; recordId?: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleConfirmStagedAction = async (action: any) => {
    const actionId = action.id || action.staged_action_id;
    setConfirmingId(actionId);
    try {
      const res = await fetch(`/api/ai/staged-actions/${actionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_hash: action.confirmation_hash }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionResults((prev) => ({
          ...prev,
          [actionId]: {
            status: 'EXECUTED',
            message: `Committed to ledger. Audit ID: ${data.audit_event_id}`,
            recordId: data.record_id,
          },
        }));
      } else {
        setActionResults((prev) => ({
          ...prev,
          [actionId]: {
            status: 'ERROR',
            message: data.message || 'Confirmation failed.',
          },
        }));
      }
    } catch (err: any) {
      setActionResults((prev) => ({
        ...prev,
        [actionId]: {
          status: 'ERROR',
          message: err.message || 'Execution network error.',
        },
      }));
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancelStagedAction = async (action: any) => {
    const actionId = action.id || action.staged_action_id;
    try {
      await fetch(`/api/ai/staged-actions/${actionId}/cancel`, { method: 'POST' });
      setActionResults((prev) => ({
        ...prev,
        [actionId]: {
          status: 'CANCELLED',
          message: 'This staged action was safely discarded.',
        },
      }));
    } catch {
      // continue
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession.messages, isTyping]);

  const createNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Financial Inquiry',
      updatedAt: 'Just now',
      messages: [
        {
          id: `welcome-${Date.now()}`,
          sender: 'assistant',
          timestamp: 'Just now',
          content: `New session started with **BEMS Executive AI**.\n\nHow can I assist your financial decision-making right now?`,
        },
      ],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isTyping) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };

    // Update active session with user message
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const isFirstCustom = s.messages.length <= 1;
          return {
            ...s,
            title: isFirstCustom ? (text.length > 30 ? text.substring(0, 30) + '…' : text) : s.title,
            messages: [...s.messages, userMessage],
            updatedAt: 'Just now',
          };
        }
        return s;
      })
    );

    setInputPrompt('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: activeSession.messages.map((m) => ({ role: m.sender, content: m.content })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch AI reply');

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        content: data.message,
        timestamp: data.timestamp || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        actionCard: data.actionCard,
        stagedAction: data.staged_action || (data.actionCard?.type === 'STAGED_ACTION' ? data.actionCard : undefined),
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: [...s.messages, assistantMessage],
            };
          }
          return s;
        })
      );
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        content: `Apologies, I encountered an issue retrieving real-time ledger records: ${err.message || 'Server error'}. Please try again.`,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s))
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const quickPrompts = [
    'What is our total cash balance across bank accounts?',
    'Give me the morning executive briefing',
    'Are there any fund requests pending my approval?',
    'Who has open accountability advances?',
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: isFullscreen ? '100vh' : 'calc(100vh - 120px)',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        background: '#0b1220',
        borderRadius: isFullscreen ? 0 : '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* 1. LEFT SIDEBAR: CONVERSATION SESSIONS (CLAUDE / CHATGPT STYLE) */}
      <aside
        style={{
          width: '280px',
          background: '#070c17',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ padding: '16px' }}>
          {/* New Chat Button */}
          <button
            onClick={createNewSession}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(234, 88, 12, 0.4)',
              background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, rgba(234, 88, 12, 0.05) 100%)',
              color: '#fed7aa',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: '16px',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} color="#ea580c" /> New Financial Session
            </span>
            <kbd style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px', color: '#94a3b8' }}>⌘K</kbd>
          </button>

          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
            Executive Sessions
          </div>

          {/* Session List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                    {session.title}
                  </span>
                  {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ea580c' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Grounding Badge at bottom of sidebar */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(0, 0, 0, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>Live Ledger Grounded</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Connected to PostgreSQL & Treasury accounts
          </div>
        </div>
      </aside>

      {/* 2. MAIN CHAT AREA (CLAUDE / CHATGPT STYLE) */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0e1726' }}>
        {/* Top Header */}
        <header
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(11, 18, 32, 0.7)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px rgba(234, 88, 12, 0.35)',
              }}
            >
              <Sparkles size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                BEMS Financial Intelligence Engine <span style={{ fontSize: '10px', background: 'rgba(234, 88, 12, 0.2)', color: '#ea580c', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>v2.5</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Group Managing Director & System Admin Executive Copilot
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Focus Mode'}
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#cbd5e1',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? 'Exit' : 'Focus Mode'}</span>
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {activeSession.messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  maxWidth: isUser ? '80%' : '88%',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: isUser ? '#3b82f6' : 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: isUser ? '0 2px 8px rgba(59,130,246,0.3)' : '0 2px 8px rgba(234,88,12,0.3)',
                  }}
                >
                  {isUser ? <User size={18} color="#fff" /> : <Bot size={18} color="#fff" />}
                </div>

                {/* Message Body */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                    {isUser ? userName : 'BEMS Financial Copilot'} · {msg.timestamp}
                  </div>

                  <div
                    style={{
                      background: isUser ? '#1e293b' : 'rgba(255, 255, 255, 0.04)',
                      border: isUser ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Optional Interactive Action Card Render */}
                  {msg.actionCard && (
                    <div style={{ marginTop: '4px' }}>
                      {msg.actionCard.type === 'TREASURY' && (
                        <div
                          style={{
                            background: 'linear-gradient(135deg, #0b1528 0%, #080f1e 100%)',
                            border: '1px solid rgba(234, 88, 12, 0.3)',
                            borderRadius: '12px',
                            padding: '16px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                              <small style={{ color: '#ea580c', fontWeight: 800 }}>LIVE TREASURY AUDIT</small>
                              <h4 style={{ margin: '2px 0 0', color: '#fff', fontSize: '18px' }}>Total: {msg.actionCard.totalCash}</h4>
                            </div>
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate('Treasury accounts')}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#ea580c',
                                  color: '#fff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Manage Bank Accounts ↗
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                            {msg.actionCard.accounts?.map((acc: any, i: number) => (
                              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{acc.name}</div>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>{acc.balance}</div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Acc: {acc.account}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.actionCard.type === 'APPROVALS' && (
                        <div
                          style={{
                            background: 'linear-gradient(135deg, #0b1528 0%, #080f1e 100%)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '12px',
                            padding: '16px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                              <small style={{ color: '#3b82f6', fontWeight: 800 }}>EXECUTIVE REVIEW REQUIRED</small>
                              <h4 style={{ margin: '2px 0 0', color: '#fff', fontSize: '18px' }}>{msg.actionCard.count} Requests ({msg.actionCard.total})</h4>
                            </div>
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate('Approvals & payments')}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#3b82f6',
                                  color: '#fff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Open Approvals Desk ↗
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {msg.actionCard.requests?.map((req: any, i: number) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
                                <div>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>{req.number} · {req.title}</span>
                                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>By {req.by}</span>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#3b82f6' }}>{req.amount}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.actionCard.type === 'BRIEFING' && (
                        <div
                          style={{
                            background: 'linear-gradient(135deg, #0b1528 0%, #080f1e 100%)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            padding: '16px',
                          }}
                        >
                          <small style={{ color: '#10b981', fontWeight: 800 }}>EXECUTIVE SCORECARD</small>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px' }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>LIQUID RESERVES</div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{msg.actionCard.cash}</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px' }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>PENDING REVIEWS</div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>{msg.actionCard.pending}</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px' }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>OPEN ADVANCES</div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>{msg.actionCard.openCases}</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px' }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>GROUP STAFF</div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#e2e8f0', marginTop: '2px' }}>{msg.actionCard.staff}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {(msg.stagedAction || msg.actionCard?.type === 'STAGED_ACTION') && (() => {
                        const staged = msg.stagedAction || msg.actionCard;
                        const actionId = staged.id || staged.staged_action_id;
                        const result = actionResults[actionId];
                        const isExecuting = confirmingId === actionId;

                        return (
                          <div
                            style={{
                              background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
                              border: '1px solid rgba(249, 115, 22, 0.45)',
                              borderRadius: '12px',
                              padding: '16px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldCheck size={16} color="#f97316" />
                                <small style={{ color: '#f97316', fontWeight: 800, letterSpacing: '0.05em' }}>EXECUTIVE STAGED ACTION (UNCOMMITTED)</small>
                              </div>
                              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                                {actionId}
                              </span>
                            </div>

                            <h4 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: '15px', fontWeight: 700 }}>
                              {staged.summary}
                            </h4>

                            {staged.warnings && staged.warnings.length > 0 && (
                              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#f59e0b' }}>
                                ⚠️ {staged.warnings.join(' ')}
                              </div>
                            )}

                            {staged.preview && (
                              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
                                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>BEFORE / AFTER PREVIEW:</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                  {Object.entries(staged.preview).map(([k, v]) => (
                                    typeof v !== 'object' && (
                                      <div key={k}>
                                        <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</span>
                                        <div style={{ color: '#f8fafc', fontWeight: 600 }}>{String(v)}</div>
                                      </div>
                                    )
                                  ))}
                                </div>
                              </div>
                            )}

                            {result?.status === 'EXECUTED' ? (
                              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '13px', fontWeight: 700 }}>
                                <CheckCircle2 size={16} />
                                <span>Action executed & audited successfully ({result.recordId || actionId}).</span>
                              </div>
                            ) : result?.status === 'CANCELLED' ? (
                              <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                                ✕ This staged action was discarded.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleConfirmStagedAction(staged)}
                                  disabled={isExecuting}
                                  style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#ffffff',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    cursor: isExecuting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  <CheckCircle2 size={15} />
                                  <span>{isExecuting ? 'Verifying & Executing...' : 'Authorize & Execute Action'}</span>
                                </button>
                                <button
                                  onClick={() => handleCancelStagedAction(staged)}
                                  disabled={isExecuting}
                                  style={{
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: '#94a3b8',
                                    fontSize: '13px',
                                    cursor: isExecuting ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}

                            {result?.status === 'ERROR' && (
                              <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '12px' }}>
                                ⚠️ {result.message}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} color="#fff" />
              </div>
              <div style={{ padding: '12px 18px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={14} className="animate-spin" /> Grounding query against live PostgreSQL ledger…
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ padding: '0 32px 8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => void handleSend(prompt)}
              disabled={isTyping}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {prompt} →
            </button>
          ))}
        </div>

        {/* Bottom Prompt Composer (Claude / ChatGPT style) */}
        <div style={{ padding: '12px 32px 24px', background: 'rgba(11, 18, 32, 0.5)' }}>
          <div
            style={{
              background: '#152136',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            }}
          >
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask BEMS Executive AI anything (e.g., 'What is our current cash balance across Access and Zenith?')..."
              rows={2}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '14px',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5',
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!inputPrompt.trim() || isTyping}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                border: 'none',
                background: inputPrompt.trim() && !isTyping ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputPrompt.trim() && !isTyping ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
            BEMS Executive AI v2.5 · Real-time financial telemetry strictly grounded with BEMS Group database records.
          </div>
        </div>
      </main>
    </div>
  );
}
