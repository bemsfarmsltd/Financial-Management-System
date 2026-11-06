'use client';

import React, { useState } from 'react';
import { History, Plus, X, MessageSquare, Trash2, Clock, ChevronRight, Search } from 'lucide-react';
import { AiMessage } from './useAiFinancialManager';

export interface ChatHistorySessionItem {
  id: string;
  title: string;
  updatedAt: string | Date;
  turnsCount?: number;
  messages?: AiMessage[];
}

interface AiChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatHistorySessionItem[];
  activeSessionId?: string;
  onSelectSession: (session: ChatHistorySessionItem) => void;
  onNewChat: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

export function AiChatHistoryDrawer({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: AiChatHistoryDrawerProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) =>
    (s.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          height: '100%',
          background: '#ffffff',
          boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(234, 88, 12, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <History size={17} color="#ea580c" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Executive Chat History
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Past financial manager sessions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar: New Chat & Search */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#ea580c',
              color: '#ffffff',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
            }}
          >
            <Plus size={16} />
            <span>New Executive Chat</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px 10px',
            }}
          >
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search past conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '12px',
                color: '#0f172a',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Sessions List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredSessions.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <MessageSquare size={32} strokeWidth={1.5} color="#cbd5e1" />
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No conversations found</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                Your financial inquiries and staged decisions will appear here.
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const dateStr = session.updatedAt
                ? new Date(session.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent';

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session);
                    onClose();
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: isActive ? '1px solid rgba(234, 88, 12, 0.4)' : '1px solid #f1f5f9',
                    background: isActive ? 'rgba(234, 88, 12, 0.05)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={13} color={isActive ? '#ea580c' : '#64748b'} />
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: isActive ? 700 : 600,
                          color: isActive ? '#ea580c' : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {session.title || 'Executive Session'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} />
                        <span>{dateStr}</span>
                      </div>
                      {session.turnsCount && (
                        <span>• {session.turnsCount} turns</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {onDeleteSession && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          borderRadius: '4px',
                        }}
                        title="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ChevronRight size={14} color="#cbd5e1" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

