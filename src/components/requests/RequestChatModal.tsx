'use client';

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, X, Users, UserRound, LockKeyhole } from 'lucide-react';

export type RequestChatMessage = {
  id: string;
  authorId?: string | null;
  authorName: string;
  authorRole: string;
  body: string;
  visibility?: 'GROUP' | 'PRIVATE';
  recipientId?: string | null;
  createdAt: string;
};

type Participant = { id: string; name: string; role: string };
type CurrentActor = { id: string; name: string; role: string };

export function RequestChatModal({
  requestNumber,
  title,
  initialMessages,
  onClose,
}: {
  requestNumber: string;
  title: string;
  initialMessages: RequestChatMessage[];
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<RequestChatMessage[]>(initialMessages);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [actor, setActor] = useState<CurrentActor | null>(null);
  const [messageText, setMessageText] = useState('');
  const [visibility, setVisibility] = useState<'GROUP' | 'PRIVATE'>('GROUP');
  const [recipientId, setRecipientId] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = async (initial = false) => {
      try {
        const response = await fetch(`/api/requests/${encodeURIComponent(requestNumber)}/action`, { credentials: 'include' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load this request chat.');
        if (!active) return;
        setMessages(result.messages || []);
        setParticipants(result.participants || []);
        setActor(result.actor || null);
        setError('');
      } catch (loadError) {
        if (active && initial) setError(loadError instanceof Error ? loadError.message : 'Could not load this request chat.');
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    void refresh(true);
    // Keep this modal current with messages sent from the request page or the channel inbox.
    const refreshTimer = window.setInterval(() => void refresh(), 4000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [requestNumber]);

  const recipients = useMemo(() => participants.filter((person) => person.id !== actor?.id), [participants, actor?.id]);
  const matchingRecipients = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    return recipients.filter((person) => !query || person.name.toLowerCase().includes(query) || person.role.toLowerCase().replaceAll('_', ' ').includes(query));
  }, [recipients, mentionQuery]);

  const updateMessageText = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    const prefix = value.slice(0, caret);
    const atIndex = prefix.lastIndexOf('@');
    const isMention = atIndex >= 0 && (atIndex === 0 || /\s/.test(prefix[atIndex - 1]));
    const query = isMention ? prefix.slice(atIndex + 1) : '';
    setMessageText(value);
    if (recipientId) {
      const selected = recipients.find((person) => person.id === recipientId);
      if (!selected || !value.includes(`@${selected.name}`)) setRecipientId('');
    }
    if (isMention && !/\s/.test(query)) {
      setMentionStart(atIndex);
      setMentionQuery(query);
    } else {
      setMentionStart(null);
    }
  };

  const chooseMention = (person: Participant) => {
    const input = messageInputRef.current;
    if (mentionStart === null || !input) return;
    const caret = input.selectionStart ?? messageText.length;
    const insertion = `@${person.name} `;
    const next = `${messageText.slice(0, mentionStart)}${insertion}${messageText.slice(caret)}`;
    setMessageText(next);
    if (visibility === 'PRIVATE' && !recipientId) setRecipientId(person.id);
    setMentionStart(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(mentionStart + insertion.length, mentionStart + insertion.length);
    });
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && mentionStart !== null && matchingRecipients.length) {
      event.preventDefault();
      chooseMention(matchingRecipients[0]);
    }
    if (event.key === 'Escape') setMentionStart(null);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || sending || (visibility === 'PRIVATE' && !recipientId)) return;

    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(requestNumber)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'SEND_MESSAGE', text, visibility, recipientId: visibility === 'PRIVATE' ? recipientId : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send message.');
      setMessages((current) => [...current, result.message]);
      setMessageText('');
      setRecipientId('');
      setMentionStart(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const participantName = (id: string | null | undefined) => participants.find((person) => person.id === id)?.name || 'request participant';

  return (
    <div className="request-chat-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="request-chat-modal" role="dialog" aria-modal="true" aria-label={`Chat for ${requestNumber}`}>
        <header className="request-chat-header">
          <span className="request-chat-icon"><MessageSquare size={17} /></span>
          <div><strong>Request chat</strong><small>{requestNumber} · {title}</small></div>
          <button type="button" onClick={onClose} aria-label="Close chat"><X size={17} /></button>
        </header>
        <div className="request-chat-mode" role="group" aria-label="Message audience">
          <button type="button" className={visibility === 'GROUP' ? 'active' : ''} onClick={() => setVisibility('GROUP')}><Users size={14} /> Everyone involved</button>
          <button type="button" className={visibility === 'PRIVATE' ? 'active' : ''} onClick={() => setVisibility('PRIVATE')}><LockKeyhole size={14} /> Private message</button>
        </div>
        <div className="request-chat-messages" aria-live="polite">
          {loading ? <p className="request-chat-empty">Loading conversation…</p> : messages.length ? messages.map((message) => {
            const mine = Boolean(actor && message.authorId === actor.id);
            const privateLabel = message.visibility === 'PRIVATE' ? (mine ? `Private to ${participantName(message.recipientId)}` : `Private from ${message.authorName}`) : '';
            return <article key={message.id} className={mine ? 'request-chat-message mine' : 'request-chat-message'}>
              <div><strong>{message.authorName}</strong><span>{message.authorRole.replaceAll('_', ' ')}{privateLabel && <> · <UserRound size={12} /> {privateLabel}</>}</span><time>{new Date(message.createdAt).toLocaleString('en-GB')}</time></div>
              <p>{message.body}</p>
            </article>;
          }) : <p className="request-chat-empty">No messages yet. Start the conversation about this request.</p>}
        </div>
        <form className="request-chat-compose" onSubmit={sendMessage}>
          {error && <p role="alert">{error}</p>}
          <div className="request-chat-compose-field">
            {mentionStart !== null && <div className="request-chat-mention-list request-chat-compose-mentions" role="listbox" aria-label="Mention a request participant">
              {matchingRecipients.length ? matchingRecipients.map((person) => <button key={person.id} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseMention(person)}>
                <strong>@{person.name}</strong><span>{person.role.replaceAll('_', ' ')}{visibility === 'PRIVATE' && !recipientId && person.id === matchingRecipients[0]?.id ? ' · private recipient' : ''}</span>
              </button>) : <span className="request-chat-mention-empty">No matching request participants</span>}
            </div>}
            <input ref={messageInputRef} role="combobox" aria-autocomplete="list" aria-expanded={mentionStart !== null} aria-label="Write a message" value={messageText} onChange={updateMessageText} onKeyDown={handleMessageKeyDown} placeholder={visibility === 'PRIVATE' ? 'Private message… type @ to choose the recipient' : 'Message everyone… type @ to mention someone'} />
          </div>
          <button type="submit" disabled={loading || sending || !messageText.trim() || (visibility === 'PRIVATE' && !recipientId)} aria-label="Send message"><Send size={15} /> Send</button>
        </form>
      </section>
    </div>
  );
}
