'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GmdMobileHeader } from '@/components/mobile/GmdMobileHeader';
import { GmdMobileInputBar } from '@/components/mobile/GmdMobileInputBar';
import { GmdMobileDrawer } from '@/components/mobile/GmdMobileDrawer';
import { FormattedAiMessage } from '@/components/ai/FormattedAiMessage';
import { Sparkles, ShieldCheck, CheckCircle, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionCard?: any;
}

interface Organization {
  id: string;
  legalName: string;
  code?: string;
}

export default function GmdMobilePage() {
  const [user, setUser] = useState<{ id: string; legalName: string; role: string } | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize GMD Session and Subsidiary List
  useEffect(() => {
    // 1. Fetch Session
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setUser(data.user);
        } else {
          // Dev bypass for GMD role on mobile
          fetch('/api/auth/dev-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role: 'GMD' }),
          })
            .then((r) => r.json())
            .then((devData) => {
              if (devData?.user) setUser(devData.user);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    // 2. Fetch Organizations
    fetch('/api/organizations', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const orgList = data?.organizations || [];
        setOrganizations(orgList);
        if (orgList.length > 0 && !currentOrgId) {
          const storedOrg = typeof window !== 'undefined' ? localStorage.getItem('bems_active_org') : null;
          const matched = orgList.find((o: Organization) => o.id === storedOrg);
          setCurrentOrgId(matched ? matched.id : orgList[0].id);
        }
      })
      .catch(() => {});

    // 3. Initial welcome greeting
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        content: `Good day, **GMD**. I am your **BEMS Mobile Executive Copilot**.\n\nYou have direct mobile authority over group treasury, multi-subsidiary ledgers, and payment approvals. You can speak to me with voice dictation or ask:\n\n• *"What is our total cash balance across bank accounts?"*\n• *"Show fund requests pending my approval."*\n• *"Show 30-day runway and obligations in a graph."*\n• *"Explain recurring commitments in a detailed paragraph."*`,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  // Auto-scroll chat stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const activeOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0];
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bems-mobile-role': 'GMD',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          context: {
            active_business_id: currentOrgId,
            target_element: {
              page: 'GMD Mobile Cockpit',
              subsidiary: activeOrg?.legalName || 'BEMS Group Holdings Ltd (HQ)',
              section: 'Executive AI Mobile Stream',
              label: 'Direct Mobile Inquiry',
            },
          },
        }),
      });

      const data = await res.json();
      const replyText = data.message || data.reply || 'I processed your command.';

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        content: replyText,
        timestamp: data.timestamp || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        actionCard: data.actionCard || data.staged_action || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          content: `⚠️ Could not reach AI Copilot server. Please check network connectivity or refresh.`,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // 1-Tap Staged Action Confirmation from Mobile
  const handleConfirmAction = async (actionId: string, actionType: string, payload: any) => {
    try {
      const res = await fetch(`/api/ai/staged-actions/${encodeURIComponent(actionId)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bems-mobile-role': 'GMD' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `action_done_${Date.now()}`,
            sender: 'assistant',
            content: `✅ **Action Confirmed & Executed!** The decision has been cryptographically signed and committed to the BEMS Group immutable ledger.`,
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error('Action confirmation failed');
      }
    } catch (e: any) {
      alert('Could not commit action: ' + e.message);
    }
  };

  const currentOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0] || {
    id: 'hq',
    legalName: 'BEMS Group Holdings Ltd (HQ)',
  };

  return (
    <div
      className="gmd-mobile-app-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: '#090d16',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top Header */}
      <GmdMobileHeader
        organizations={organizations}
        currentOrgId={currentOrgId}
        onSelectOrg={(id) => {
          setCurrentOrgId(id);
          if (typeof window !== 'undefined') localStorage.setItem('bems_active_org', id);
        }}
        onOpenDrawer={() => setDrawerOpen(true)}
        onNewChat={() => {
          setMessages([
            {
              id: `welcome_${Date.now()}`,
              sender: 'assistant',
              content: `Conversation reset. How can I assist you with **${currentOrg.legalName}**?`,
              timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }}
        isStreaming={isTyping}
      />

      {/* Main Conversation Stream */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '680px',
          width: '100%',
          margin: '0 auto',
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
                width: '100%',
              }}
            >
              {/* Sender label & time */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '10px',
                  color: '#64748b',
                  marginBottom: '4px',
                  padding: '0 4px',
                }}
              >
                <span style={{ fontWeight: 700, color: isUser ? '#f97316' : '#38bdf8' }}>
                  {isUser ? (user ? user.legalName.split(' ')[0] : 'GMD') : 'BEMS Copilot'}
                </span>
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                style={{
                  background: isUser
                    ? 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)'
                    : '#151d2f',
                  border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: isUser ? '10px 14px' : '14px 16px',
                  color: isUser ? '#ffffff' : '#f8fafc',
                  fontSize: '13.5px',
                  lineHeight: 1.55,
                  maxWidth: isUser ? '86%' : '100%',
                  width: isUser ? 'auto' : '100%',
                  boxShadow: isUser
                    ? '0 4px 16px rgba(234, 88, 12, 0.3)'
                    : '0 4px 20px rgba(0, 0, 0, 0.25)',
                }}
              >
                <FormattedAiMessage
                  content={msg.content}
                  isUser={isUser}
                  onSelectQuickReply={(prompt) => handleSendMessage(prompt)}
                />
              </div>

              {/* Staged Action 1-Tap Trigger (if present) */}
              {msg.actionCard && msg.actionCard.id && (
                <div
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    background: 'rgba(234, 88, 12, 0.08)',
                    border: '1px solid rgba(234, 88, 12, 0.3)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#f97316' }}>
                    <ShieldCheck size={14} />
                    <span>STAGED EXECUTIVE ACTION READY</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    {msg.actionCard.summary || 'Authorize pending requisition'}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleConfirmAction(msg.actionCard.id, msg.actionCard.actionType, msg.actionCard.materialPayload)}
                    style={{
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(234, 88, 12, 0.4)',
                    }}
                  >
                    <CheckCircle size={14} />
                    <span>Authorize & Commit to Ledger</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', padding: '4px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                background: '#ea580c',
                animation: 'pulse 1s infinite',
              }}
            />
            <span>GMD Copilot is analyzing live ledgers...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Floating Bottom Input Bar */}
      <GmdMobileInputBar onSendMessage={handleSendMessage} disabled={isTyping} />

      {/* Slide-over Cockpit Drawer */}
      <GmdMobileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        gmdName={user ? user.legalName : 'Group Managing Director'}
        activeEntityName={currentOrg.legalName}
        onSelectAction={(prompt) => handleSendMessage(prompt)}
        onOpenDesktopView={() => {
          if (typeof window !== 'undefined') window.location.href = '/';
        }}
        onSignOut={() => {
          fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => {
            if (typeof window !== 'undefined') window.location.href = '/';
          });
        }}
      />
    </div>
  );
}
