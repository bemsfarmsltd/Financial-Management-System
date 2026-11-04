'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, X, ArrowRight } from 'lucide-react';
import { StaffAdminChatModal } from './StaffAdminChatModal';

type UnreadPayload = {
  isAdmin: boolean;
  unreadCount: number;
  latestMessage: {
    id: string;
    employeeId: string;
    senderName: string;
    employeeName?: string;
    message: string;
    createdAt: string;
  } | null;
};

export function InAppChatPushToast() {
  const [activeToast, setActiveToast] = useState<{
    id: string;
    employeeId: string;
    senderName: string;
    message: string;
    isAdmin: boolean;
  } | null>(null);

  const [activeChatModal, setActiveChatModal] = useState<{
    employeeId: string;
    employeeName: string;
  } | null>(null);

  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkUnread = async () => {
      try {
        const res = await fetch('/api/staff/chat/unread', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const data: UnreadPayload = await res.json();

        if (data && data.unreadCount > 0 && data.latestMessage) {
          const msg = data.latestMessage;
          if (msg.id !== lastMessageId) {
            setLastMessageId(msg.id);
            setActiveToast({
              id: msg.id,
              employeeId: msg.employeeId,
              senderName: msg.employeeName || msg.senderName,
              message: msg.message,
              isAdmin: data.isAdmin,
            });
          }
        }
      } catch (_) {}
    };

    void checkUnread();
    const interval = window.setInterval(checkUnread, 4500);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [lastMessageId]);

  // Auto-dismiss toast after 8 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => {
      setActiveToast(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [activeToast]);

  return (
    <>
      {activeToast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            width: 'min(380px, 90vw)',
            background: '#0f172a',
            color: '#ffffff',
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: '0 20px 48px rgba(15, 23, 42, 0.4), 0 0 0 1.5px #ea580c',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: '#ea580c',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <MessageSquare size={16} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#fb923c', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {activeToast.isAdmin ? 'STAFF DIRECT MESSAGE' : 'DIRECTIVE FROM GMD'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 750, color: '#f8fafc', marginTop: 1 }}>
                  {activeToast.senderName}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveToast(null)}
              style={{
                background: 'transparent',
                border: 0,
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div
            style={{
              fontSize: 12,
              color: '#cbd5e1',
              lineHeight: 1.4,
              maxHeight: 48,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            “{activeToast.message}”
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 2 }}>
            <button
              type="button"
              onClick={() => {
                setActiveChatModal({
                  employeeId: activeToast.employeeId,
                  employeeName: activeToast.senderName,
                });
                setActiveToast(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 7,
                background: '#ea580c',
                color: '#ffffff',
                border: 0,
                fontSize: 11,
                fontWeight: 750,
                cursor: 'pointer',
              }}
            >
              <span>Reply Direct</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {activeChatModal && (
        <StaffAdminChatModal
          employeeId={activeChatModal.employeeId}
          employeeName={activeChatModal.employeeName}
          onClose={() => setActiveChatModal(null)}
        />
      )}
    </>
  );
}

