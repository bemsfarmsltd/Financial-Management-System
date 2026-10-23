'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Headphones, Send, X, ShieldCheck } from 'lucide-react';

export type StaffAdminMsg = {
  id: string;
  employeeId: string;
  senderRole: string;
  senderId: string;
  senderName: string;
  message: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isReadByStaff: boolean;
  isReadByAdmin: boolean;
  createdAt: string;
};

export function StaffAdminChatModal({
  employeeId,
  employeeName,
  employeeNumber,
  subsidiary,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  employeeNumber?: string;
  subsidiary?: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<StaffAdminMsg[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async (silent = false) => {
    try {
      const res = await fetch(`/api/staff/chat/admin?employeeId=${encodeURIComponent(employeeId)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load conversation.');
      setMessages(data.messages || []);
      setError('');
      if (!silent) scrollToBottom();
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Could not load messages.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void loadConversation();
    const interval = window.setInterval(() => {
      if (active) void loadConversation(true);
    }, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [employeeId]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || sending) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/staff/chat/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId,
          message: text,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');

      setMessageText('');
      setMessages((prev) => [...prev, data.message]);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="request-chat-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="request-chat-modal" role="dialog" aria-modal="true" aria-label={`Helpdesk chat with ${employeeName}`}>
        <header className="request-chat-header" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="request-chat-icon" style={{ background: '#ECFDF5', color: '#047857' }}>
            <Headphones size={17} />
          </span>
          <div>
            <strong>Staff Helpdesk & Direct Inquiry</strong>
            <small>
              {employeeName} {employeeNumber ? `(${employeeNumber})` : ''} {subsidiary ? `· ${subsidiary}` : ''}
            </small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chat">
            <X size={17} />
          </button>
        </header>

        <div style={{ padding: '8px 16px', background: '#F8FAFC', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748B' }}>
          <ShieldCheck size={13} color="#047857" />
          <span>Direct conversation between Employee and Executive Finance/Admin. Messages are recorded for audit compliance.</span>
        </div>

        <div className="request-chat-messages" style={{ minHeight: '340px', maxHeight: '450px', overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <p className="request-chat-empty">Loading helpdesk conversation…</p>
          ) : messages.length ? (
            messages.map((msg) => {
              const isAdmin = msg.senderRole !== 'STAFF';
              return (
                <article
                  key={msg.id}
                  className={isAdmin ? 'request-chat-message mine' : 'request-chat-message'}
                  style={{ marginBottom: '12px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <div>
                      <strong style={{ fontSize: '12px' }}>{isAdmin ? `${msg.senderName} (Admin)` : msg.senderName}</strong>
                      <span style={{ fontSize: '10px', marginLeft: '6px', color: isAdmin ? '#EA580C' : '#047857', fontWeight: 600 }}>
                        {isAdmin ? 'ADMINISTRATOR' : 'STAFF'}
                      </span>
                    </div>
                    <time style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>{msg.message}</p>
                </article>
              );
            })
          ) : (
            <p className="request-chat-empty">No messages in this helpdesk thread yet. You can send a direct notice or reply to the employee.</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="request-chat-compose" onSubmit={sendMessage} style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          {error && <p role="alert" style={{ color: '#DC2626', fontSize: '11.5px', margin: '0 0 8px' }}>{error}</p>}
          <div className="request-chat-compose-field" style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px' }}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Reply to ${employeeName}…`}
            />
            <button
              type="submit"
              className="primary-button"
              disabled={loading || sending || !messageText.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px' }}
            >
              <Send size={14} /> Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
