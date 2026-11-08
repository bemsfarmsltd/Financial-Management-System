'use client';

import { useState, useCallback, useEffect } from 'react';
import { AiMessage, AiRole, BriefingCardData, ApprovalDecisionCardData, BudgetProposalCardData, SalaryAdjustmentCardData, DisbursementRecordCardData, ScenarioSimulatorCardData } from './types';
import { ElementContextPayload } from './useUniversalContextHarvester';

interface UseAiOptions {
  userRole: string;
  userName: string;
  businessName: string;
  businessId: string;
  currentPage: string;
}

export function useAiFinancialManager({ userRole, userName, businessName, businessId, currentPage }: UseAiOptions) {
  const isGroupScope = !businessId || businessId === 'bems-group-hq' || businessId === 'ALL';
  const scopeKey = isGroupScope ? 'group_hq' : (businessId || 'group_hq');

  // Scoped executive keys ensure each workspace has clean, isolated conversation memory
  const [accountId, setAccountId] = useState<string>('');
  useEffect(() => { if(userRole!=='GMD'){setAccountId('');return;} fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.json()).then(data => { if (data.user?.id) setAccountId(data.user.id); }).catch(() => {}); }, [userRole]);
  const storageKey = `bems_executive_chat_history_v4_${accountId}_${scopeKey}`;
  const sessionsKey = `bems_executive_chat_sessions_v4_${accountId}_${scopeKey}`;

  const defaultWelcomeText = isGroupScope
    ? `Good afternoon, ${userName ? userName.split(' ')[0] : 'Executive'}. I am your BEMS AI Group Financial Manager. I monitor real-time expenditure, approvals, cash runway, and compliance across BEMS Group Conglomerate HQ.\n\nHow can I assist your financial oversight today?`
    : `Good afternoon, ${userName ? userName.split(' ')[0] : 'Executive'}. I am your dedicated AI Financial Manager for ${businessName}. I am strictly scoped to ${businessName}'s budgets, bank accounts, staff, and requisitions.\n\nHow can I assist your financial oversight for ${businessName} today?`;

  const [messages, setMessages] = useState<AiMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'assistant',
      timestamp: 'Just now',
      content: defaultWelcomeText,
    },
  ]);

  const [isTyping, setIsTyping] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('active');
  const [hydratedStorageKey, setHydratedStorageKey] = useState('');

  // Load archived sessions
  const refreshSessions = useCallback(() => {
    if (typeof window === 'undefined' || !accountId) return;
    try {
      const local = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
      fetch(`/api/ai/memory?mode=sessions&scope=${encodeURIComponent(scopeKey)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.sessions)) {
            const merged = [...local];
            data.sessions.forEach((s: any) => {
              if (!merged.some((m) => m.id === s.id)) {
                merged.push(s);
              }
            });
            setSessions(merged);
          } else {
            setSessions(local);
          }
        })
        .catch(() => setSessions(local));
    } catch {
      setSessions([]);
    }
  }, [sessionsKey, accountId, scopeKey]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Account and workspace changes hydrate atomically before persistence resumes.
  useEffect(() => {
    if (typeof window === 'undefined' || !accountId) return;
    let cancelled = false;
    const id = localStorage.getItem(storageKey + '_active') || `conv_${accountId}_${crypto.randomUUID()}`;
    setActiveSessionId(id);
    const welcome: AiMessage[] = [{ id: 'msg-welcome', sender: 'assistant', timestamp: 'Just now', content: defaultWelcomeText }];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      setMessages(Array.isArray(saved) && saved.length ? saved : welcome);
      setHydratedStorageKey(storageKey);
      if (!saved) {
        fetch(`/api/ai/memory?limit=40&session_id=${encodeURIComponent(id)}&scope=${encodeURIComponent(scopeKey)}`)
          .then(r => r.ok ? r.json() : null).then(data => {
            if (cancelled || !Array.isArray(data?.messages) || !data.messages.length) return;
            setMessages(data.messages.map((m: any) => ({ id: `restored-${m.id}`, sender: m.role === 'assistant' ? 'assistant' : 'user', timestamp: 'Earlier', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })));
          }).catch(() => {});
      }
    } catch { setMessages(welcome); setHydratedStorageKey(storageKey); }
    return () => { cancelled = true; };
  }, [storageKey, accountId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !accountId || hydratedStorageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
      if (activeSessionId !== 'active') localStorage.setItem(storageKey + '_active', activeSessionId);
    } catch {}
  }, [messages, storageKey, accountId, hydratedStorageKey, activeSessionId]);

  // Start fresh chat session
  const startNewChat = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        if (messages.length > 1) {
          const existingSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
          const archiveTitle = messages.find((m) => m.sender === 'user')?.content?.slice(0, 45) || 'Executive Financial Oversight';
          existingSessions.unshift({
            id: activeSessionId,
            title: archiveTitle,
            updatedAt: new Date().toISOString(),
            turnsCount: messages.length,
            messages,
          });
          localStorage.setItem(sessionsKey, JSON.stringify(existingSessions.slice(0, 25)));
          setSessions(existingSessions.slice(0, 25));
        }
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.warn('Error archiving session:', e);
    }

    setActiveSessionId(`conv_${accountId}_${crypto.randomUUID()}`);
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'assistant',
        timestamp: 'Just now',
        content: `Good afternoon, ${userName ? userName.split(' ')[0] : 'Executive'}. I am your BEMS AI Group Financial Manager. I monitor real-time expenditure, approvals, cash runway, and compliance across ${businessName}.\n\nHow can I assist your financial oversight today?`,
      },
    ]);
  }, [messages, sessionsKey, storageKey, userName, businessName, accountId, activeSessionId]);

  // Load a past session from history
  const loadSession = useCallback(
    (session: any) => {
      if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
        setMessages(session.messages);
        setActiveSessionId(session.id);
        try {
          localStorage.setItem(storageKey, JSON.stringify(session.messages));
        } catch {}
        return;
      }

      // Fetch from backend memory if not cached locally
      fetch(`/api/ai/memory?session_id=${encodeURIComponent(session.id)}&limit=50`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.messages) && data.messages.length > 0) {
            const restored: AiMessage[] = data.messages.map((m: any, idx: number) => ({
              id: `restored-${m.id || idx}`,
              sender: m.role === 'assistant' ? 'assistant' : 'user',
              timestamp: m.created_at
                ? new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : 'Earlier',
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            }));
            setMessages(restored);
            setActiveSessionId(session.id);
            try {
              localStorage.setItem(storageKey, JSON.stringify(restored));
            } catch {}
          }
        })
        .catch(() => {});
    },
    [storageKey]
  );

  // Delete an archived session
  const deleteSession = useCallback(
    (sessionId: string) => {
      try {
        if (typeof window !== 'undefined') {
          const existingSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
          const filtered = existingSessions.filter((s: any) => s.id !== sessionId);
          localStorage.setItem(sessionsKey, JSON.stringify(filtered));
          setSessions(filtered);
        }
      } catch (e) {
        console.warn('Error deleting session:', e);
      }
    },
    [sessionsKey]
  );

  // Send a user prompt and generate an intelligent response with interactive action cards
  const sendMessage = useCallback(
    async (text: string, elementContext?: ElementContextPayload) => {
      if(userRole!=='GMD')return;
      const displayContent = elementContext
        ? `[Re: ${elementContext.label}${elementContext.value ? ` · ${elementContext.value}` : ''}] ${text}`
        : text;

      const userMsg: AiMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        content: displayContent,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            conversation_id: activeSessionId.startsWith(`conv_${accountId}_`) ? activeSessionId : `conv_${accountId}_${crypto.randomUUID()}`,
            context: {
              active_business_id: businessId,
              business_name: businessName,
              is_group_scope: isGroupScope,
              target_element: elementContext,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.conversation_id) setActiveSessionId(data.conversation_id);
          const rawAction = data.actionCard || data.staged_action;
          let actionCard: any = undefined;

          if (rawAction) {
            const rawType = (rawAction.actionType || rawAction.type || rawAction.cardType || '').toLowerCase();
            const stagedId = rawAction.staged_action_id || rawAction.id;
            const confHash = rawAction.confirmation_hash || rawAction.confirmationHash;
            const preview = rawAction.preview || rawAction.data || rawAction;
            const summary = rawAction.summary || (typeof preview === 'object' ? preview.summary || preview.title : '') || 'Executive Action Required';

            if (rawType === 'wallet_release') {
              actionCard = {type:'wallet_release',data:{id:stagedId},summary:'GMD wallet release'};
            } else if (rawType === 'budget' || rawType === 'budget_proposal') {
              const totalAmountNum = typeof preview.total_amount === 'string'
                ? Number(preview.total_amount.replace(/[^0-9.]/g, ''))
                : Number(preview.total_amount || preview.amount || 0);

              const rawAlloc = preview.allocations || [];
              const lines = Array.isArray(rawAlloc) && rawAlloc.length > 0
                ? rawAlloc.map((a: any) => ({
                    departmentName: a.department || a.line_name || 'General Operations',
                    category: a.category || a.line_name || 'Operating Expenditure',
                    allocatedAmount: typeof a.amount === 'string' ? Number(a.amount.replace(/[^0-9.]/g, '')) : Number(a.amount || 0),
                  }))
                : [{ departmentName: 'General Operations', category: 'Allocation', allocatedAmount: totalAmountNum }];

              actionCard = {
                type: 'budget_proposal',
                data: {
                  organizationId: preview.organization_id || businessId,
                  organizationName: preview.organization || businessName,
                  periodName: preview.period || '',
                  fiscalYear: new Date().getFullYear(),
                  fiscalPeriod: preview.period || '',
                  totalAmount: totalAmountNum,
                  currency: preview.currency || 'NGN',
                  lines,
                },
                staged_action_id: stagedId,
                confirmation_hash: confHash,
                summary,
                preview,
                warnings: rawAction.warnings,
                blocking_errors: rawAction.blocking_errors || rawAction.blockingErrors,
                expires_at: rawAction.expires_at || rawAction.expiresAt,
              };
            } else if (rawType === 'salary_change' || rawType === 'salary_adjustment') {
              const propSalary = typeof preview.new_base_gross === 'string'
                ? Number(preview.new_base_gross.replace(/[^0-9.]/g, ''))
                : Number(preview.new_base_salary || preview.amount || 0);
              const currSalary = typeof preview.prior_base_gross === 'string'
                ? Number(preview.prior_base_gross.replace(/[^0-9.]/g, ''))
                : Number(preview.current_salary || 0);

              actionCard = {
                type: 'salary_adjustment',
                data: {
                  employeeId: preview.employee_id || '',
                  employeeName: preview.employee_name || 'Staff Member',
                  employeeNumber: preview.employee_number || '',
                  subsidiaryName: preview.subsidiary || businessName,
                  departmentName: preview.department || 'Operations',
                  currentSalary: currSalary,
                  proposedSalary: propSalary,
                  changeType: propSalary >= currSalary ? 'ADDITION' : 'DEDUCTION',
                  effectiveDate: preview.effective_date || new Date().toISOString().split('T')[0],
                  reason: preview.reason || 'Salary review approved by management',
                  willNotifyEmployee: true,
                },
                staged_action_id: stagedId,
                confirmation_hash: confHash,
                summary,
                preview,
                warnings: rawAction.warnings,
                blocking_errors: rawAction.blocking_errors || rawAction.blockingErrors,
                expires_at: rawAction.expires_at || rawAction.expiresAt,
              };
            } else if (rawType === 'briefing' || rawType === 'approval_decision' || rawType === 'disbursement_record' || rawType === 'scenario_simulator') {
              actionCard = {
                type: rawType,
                data: rawAction.data || preview,
                staged_action_id: stagedId,
                confirmation_hash: confHash,
                summary,
                preview,
              };
            } else {
              // Universal Staged Action Card fallback
              actionCard = {
                type: 'staged_action',
                cardType: 'STAGED_ACTION',
                actionType: rawType || 'staged_action',
                staged_action_id: stagedId,
                confirmation_hash: confHash,
                summary,
                preview,
                data: preview,
                warnings: rawAction.warnings,
                blocking_errors: rawAction.blocking_errors || rawAction.blockingErrors,
                expires_at: rawAction.expires_at || rawAction.expiresAt,
              };
            }
          }

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: data.timestamp || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: data.message || 'I have analyzed your query against the live ledger.',
            actionCard,
            references: Array.isArray(data.citations)
              ? data.citations.map((c: any) => ({
                  type: c.record_type === 'vendor' ? 'budget' : 'request',
                  id: c.record_id,
                  label: c.label || c.record_id,
                }))
              : undefined,
            quickReplies: Array.isArray(data.quick_replies) ? data.quick_replies : Array.isArray(data.quickReplies) ? data.quickReplies : undefined,
          };
          setMessages((prev) => [...prev, aiReply]);
          setIsTyping(false);
          return;
        }
      } catch (err) {
        console.warn('Live AI chat request failed:', err);
      }

      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`, sender: 'assistant',
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        content: 'The assistant could not reach the server. Please retry. Live records and pending actions have not been verified.',
      }]);
      setIsTyping(false);
    },
    [businessName, businessId, isGroupScope, activeSessionId, accountId, userRole]
  );

  // Execute confirmation for an action card (strictly bound to backend confirmation endpoint)
  const handleConfirmAction = useCallback(
    async (messageId: string, _actionType: string, payload: any) => {
      try {
        const targetMsg = messages.find((m) => m.id === messageId);
        const stagedId = payload?.staged_action_id || targetMsg?.actionCard?.staged_action_id;
        const confHash = payload?.confirmation_hash || targetMsg?.actionCard?.confirmation_hash;

        if (!stagedId || !confHash) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId && m.actionCard
                ? {
                    ...m,
                    actionCard: {
                      ...m.actionCard,
                      status: 'EXPIRED',
                      errorMessage: 'Unverified proposal (missing staged_action_id or confirmation_hash). Request a fresh preview.',
                    },
                  }
                : m
            )
          );
          return;
        }

        const res = await fetch(`/api/ai/staged-actions/${stagedId}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `idemp_${stagedId}_${confHash.slice(-10)}`,
          },
          body: JSON.stringify({
            confirmed_by: userName || 'GMD Executive',
            confirmation_hash: confHash,
          }),
        });
        const result = await res.json().catch(() => ({}));

        if (res.ok && result.ok) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === messageId && m.actionCard) {
                return {
                  ...m,
                  actionCard: {
                    ...m.actionCard,
                    status: 'EXECUTED',
                    confirmed: true,
                    cancelled: false,
                    errorMessage: undefined,
                    auditEventId: result.audit_event_id,
                    recordId: result.record_id,
                    resultUrl: result.url,
                    executionResult: result,
                    resultMessage: `Operation committed to ledger. Audit ID: #${result.audit_event_id || 'VERIFIED'}.`,
                  },
                };
              }
              return m;
            })
          );
        } else {
          const derivedStatus: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED' =
            result.status === 'EXECUTED' || result.error_code === 'ALREADY_EXECUTED'
              ? 'EXECUTED'
              : result.status === 'CANCELLED' || result.error_code === 'CANCELLED'
              ? 'CANCELLED'
              : result.status === 'EXPIRED' ||
                result.error_code === 'STAGED_ACTION_EXPIRED' ||
                result.error_code === 'TARGET_CHANGED'
              ? 'EXPIRED'
              : 'PENDING';

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === messageId && m.actionCard) {
                return {
                  ...m,
                  actionCard: {
                    ...m.actionCard,
                    status: derivedStatus,
                    confirmed: derivedStatus === 'EXECUTED',
                    cancelled: derivedStatus === 'CANCELLED',
                    errorMessage: result.message || 'Staged action confirmation failed.',
                  },
                };
              }
              return m;
            })
          );
        }
      } catch (err: any) {
        console.error('Failed to commit action:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.actionCard
              ? {
                  ...m,
                  actionCard: {
                    ...m.actionCard,
                    errorMessage: err?.message || 'Network error while confirming staged action.',
                  },
                }
              : m
          )
        );
      }
    },
    [userName, messages]
  );

  const handleCancelAction = useCallback(
    async (messageId: string, stagedActionId?: string) => {
      try {
        const targetMsg = messages.find((m) => m.id === messageId);
        const resolvedId = stagedActionId || targetMsg?.actionCard?.staged_action_id;

        if (!resolvedId) {
          return;
        }

        const res = await fetch(`/api/ai/staged-actions/${resolvedId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await res.json().catch(() => ({}));

        if (res.ok && result.ok) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === messageId && m.actionCard) {
                return {
                  ...m,
                  actionCard: {
                    ...m.actionCard,
                    status: 'CANCELLED',
                    cancelled: true,
                    confirmed: false,
                    errorMessage: undefined,
                    resultMessage: 'Staged action discarded by executive.',
                  },
                };
              }
              return m;
            })
          );
        } else if (result.error_code === 'ALREADY_EXECUTED' || result.status === 'EXECUTED') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId && m.actionCard
                ? {
                    ...m,
                    actionCard: {
                      ...m.actionCard,
                      status: 'EXECUTED',
                      confirmed: true,
                      cancelled: false,
                      errorMessage: result.message || 'Action was already executed and cannot be cancelled.',
                    },
                  }
                : m
            )
          );
        } else if (result.error_code === 'STAGED_ACTION_EXPIRED' || result.status === 'EXPIRED') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId && m.actionCard
                ? {
                    ...m,
                    actionCard: {
                      ...m.actionCard,
                      status: 'EXPIRED',
                      errorMessage: result.message || 'Staged action has expired.',
                    },
                  }
                : m
            )
          );
        }
      } catch (err) {
        console.error('Failed to cancel action:', err);
      }
    },
    [messages]
  );

  // Hydrate staged action card states from backend on mount / session change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stagedIds = Array.from(
      new Set(
        messages
          .map((m) => m.actionCard?.staged_action_id)
          .filter((id): id is string => Boolean(id && id.startsWith('sa_')))
      )
    );
    if (stagedIds.length === 0) return;

    fetch(`/api/ai/staged-actions/status?ids=${encodeURIComponent(stagedIds.join(','))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok || !data.actions) return;
        const serverMap = data.actions as Record<string, any>;
        setMessages((prev) => {
          let changed = false;
          const next = prev.map((m) => {
            const sid = m.actionCard?.staged_action_id;
            if (!sid || !serverMap[sid] || !m.actionCard) return m;
            const srv = serverMap[sid];
            const srvStatus = srv.status as 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
            const execRes = srv.execution_result || null;
            const nextConfirmed = srvStatus === 'EXECUTED';
            const nextCancelled = srvStatus === 'CANCELLED';
            if (
              m.actionCard.status === srvStatus &&
              m.actionCard.confirmed === nextConfirmed &&
              m.actionCard.cancelled === nextCancelled &&
              m.actionCard.auditEventId === (srv.audit_event_id || undefined)
            ) {
              return m;
            }
            changed = true;
            return {
              ...m,
              actionCard: {
                ...m.actionCard,
                status: srvStatus,
                confirmed: nextConfirmed,
                cancelled: nextCancelled,
                expires_at: srv.expires_at || m.actionCard.expires_at,
                auditEventId: srv.audit_event_id || execRes?.audit_event_id || m.actionCard.auditEventId,
                recordId: execRes?.record_id || m.actionCard.recordId,
                resultUrl: execRes?.url || m.actionCard.resultUrl,
                executionResult: execRes || m.actionCard.executionResult,
                resultMessage:
                  srvStatus === 'EXECUTED'
                    ? m.actionCard.resultMessage ||
                      `Operation committed to ledger. Audit ID: #${srv.audit_event_id || execRes?.audit_event_id || 'VERIFIED'}.`
                    : srvStatus === 'CANCELLED'
                    ? 'Staged action discarded by executive.'
                    : m.actionCard.resultMessage,
              },
            };
          });
          return changed ? next : prev;
        });
      })
      .catch(() => {});
  }, [messages.length, activeSessionId]);

  return {
    messages,
    isTyping,
    sendMessage,
    handleConfirmAction,
    handleCancelAction,
    startNewChat,
    isHistoryOpen,
    setIsHistoryOpen,
    sessions,
    loadSession,
    deleteSession,
    refreshSessions,
    activeSessionId,
  };
}
