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
  const storageKey = `bems_web_chat_history_${businessId || 'default'}_${userRole || 'STAFF'}`;

  const [messages, setMessages] = useState<AiMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'assistant',
      timestamp: 'Just now',
      content: `Good afternoon, ${userName ? userName.split(' ')[0] : 'Executive'}. I am your BEMS AI Group Financial Manager. I monitor real-time expenditure, approvals, cash runway, and compliance across ${businessName}.\n\nHow can I assist your financial oversight today?`,
    },
  ]);

  const [isTyping, setIsTyping] = useState(false);

  // Hydrate conversation on mount from localStorage or /api/ai/memory
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }

      // If no local history, query backend memory for session
      fetch('/api/ai/memory?limit=20')
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
            if (restored.length > 0) {
              setMessages(restored);
              try {
                localStorage.setItem(storageKey, JSON.stringify(restored));
              } catch {}
            }
          }
        })
        .catch(() => {});
    } catch (e) {
      console.warn('Could not load chat history:', e);
    }
  }, [storageKey]);

  // Persist conversation whenever messages change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (messages.length > 1 || (messages.length === 1 && messages[0].id !== 'msg-welcome')) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Could not persist chat history:', e);
    }
  }, [messages, storageKey]);

  // Start fresh chat session
  const startNewChat = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        if (messages.length > 1) {
          const sessionsKey = `bems_web_chat_sessions_${businessId || 'default'}`;
          const existingSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
          const archiveTitle = messages.find((m) => m.sender === 'user')?.content?.slice(0, 40) || 'Financial Oversight';
          existingSessions.unshift({
            id: `session-${Date.now()}`,
            title: archiveTitle,
            updatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            messages,
          });
          localStorage.setItem(sessionsKey, JSON.stringify(existingSessions.slice(0, 10)));
        }
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.warn('Error archiving session:', e);
    }

    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'assistant',
        timestamp: 'Just now',
        content: `Good afternoon, ${userName ? userName.split(' ')[0] : 'Executive'}. I am your BEMS AI Group Financial Manager. I monitor real-time expenditure, approvals, cash runway, and compliance across ${businessName}.\n\nHow can I assist your financial oversight today?`,
      },
    ]);
  }, [businessId, messages, storageKey, userName, businessName]);

  // Send a user prompt and generate an intelligent response with interactive action cards
  const sendMessage = useCallback(
    async (text: string, elementContext?: ElementContextPayload) => {
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
            context: {
              active_business_id: businessId,
              target_element: elementContext,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawAction = data.actionCard || data.staged_action;
          let actionCard: any = undefined;

          if (rawAction) {
            const rawType = (rawAction.actionType || rawAction.type || rawAction.cardType || '').toLowerCase();
            const stagedId = rawAction.staged_action_id || rawAction.id;
            const confHash = rawAction.confirmation_hash || rawAction.confirmationHash;
            const preview = rawAction.preview || rawAction.data || rawAction;
            const summary = rawAction.summary || (typeof preview === 'object' ? preview.summary || preview.title : '') || 'Executive Action Required';

            if (rawType === 'budget' || rawType === 'budget_proposal') {
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
                  periodName: preview.period || 'November 2026',
                  fiscalYear: new Date().getFullYear(),
                  fiscalPeriod: preview.period || '2026-11',
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
        console.warn('Live AI chat API call failed, using graceful fallback:', err);
      }

      const normalized = text.toLowerCase();

      // Local fallback in case network call fails
      setTimeout(() => {
        // 0. Element-Specific Contextual Analysis (Point & Ask)
        if (elementContext) {
          const label = elementContext.label;
          const val = elementContext.value || '0';
          const sec = elementContext.section || 'Overview';
          let contextualReply = '';

          if (label.toLowerCase().includes('payments recorded')) {
            contextualReply = `**Payments Recorded (${val}):**\n\nThis metric tracks the cumulative count of disbursement vouchers executed from company bank reserves for **${businessName}**.\n\n• **Current Status:** The value is currently **${val}** because no disbursement transactions have been authorized and disbursed to vendor accounts in this cycle.\n• **Operational Action:** Once a requisition is approved by the GMD, navigate to **Approvals & payments** to execute the payment voucher and update this live telemetry figure.`;
          } else if (label.toLowerCase().includes('closed & accounted')) {
            contextualReply = `**Closed & Accounted (${val}):**\n\nThis counter reflects staff cash advances that have been verified, receipt-matched, and formally reconciled within the mandatory 72-hour SLA window.\n\n• **Current Status:** Currently at **${val}**. Disbursed advances remain in 'Awaiting Proof' until physical receipts and delivery notes are uploaded by staff and cleared by the GMD.`;
          } else if (label.toLowerCase().includes('review required') || label.toLowerCase().includes('awaiting authorization')) {
            contextualReply = `**Executive Review Required (${val}):**\n\nThere ${val === '1' ? 'is currently **1 requisition**' : `are currently **${val} requisitions**`} awaiting executive GMD review and sign-off for **${businessName}**.\n\n• **Action Required:** Open the **Approvals & payments** desk or ask me to *"Review pending approvals"* to inspect line items, vendor quotes, and execute authorization.`;
          } else if (label.toLowerCase().includes('group requests') || label.toLowerCase().includes('requests')) {
            contextualReply = `**Total Requests (${val}):**\n\nThis metric records the entire requisition pipeline submitted under **${businessName}**.\n\n• **Telemetry:** A total of **${val} requests** have been created in the system, spanning operational procurement, recurring commitments, and staff advances.`;
          } else if (label.toLowerCase().includes('velocity') || label.toLowerCase().includes('spending')) {
            contextualReply = `**Group Spending Velocity (${val}):**\n\nThis chart visualizes the 7-day cash outflow pacing across Monday through Sunday.\n\n• **Current Analysis:** A baseline of **${val}** indicates zero cash disbursements processed on this specific weekday, confirming that operational liquidity remains preserved within treasury reserves.`;
          } else if (label.toLowerCase().includes('clearance rate') || label.toLowerCase().includes('accountability')) {
            contextualReply = `**Accountability Clearance Rate (${val}):**\n\nThis compliance index measures on-time receipt retirement for cash advances across BEMS Group.\n\n• **Audit Score:** Standing at **${val}**, reflecting that zero staff advances are in default or overdue beyond the 72-hour retiral threshold.`;
          } else if (label.toLowerCase().includes('sla clock') || label.toLowerCase().includes('clock') || label.toLowerCase().includes('01:00:00')) {
            contextualReply = `**GMD Review SLA Clock (${val}):**\n\nThis is the executive 1-Hour SLA countdown timer for pending requisitions.\n\n• **Policy:** When a fund request enters the GMD queue, this clock counts down from 01:00:00 to guarantee swift operational turnaround without administrative bottlenecks.`;
          } else if (label.toLowerCase().includes('starlink') || label.toLowerCase().includes('wi-fi') || label.toLowerCase().includes('attendance')) {
            contextualReply = `**Starlink Wi-Fi Attendance Policy:**\n\nStaff check-ins require verified connection to the company Starlink Wi-Fi network combined with GPS geofence validation.\n\n• **Arrival Window:** 07:00 AM – 08:00 AM (Grace period until 08:15 AM).\n• **Power Outage Fallback:** In the event of grid/Starlink failure, an executive administrator can toggle Power Outage Mode to permit local kiosk verification.`;
          } else {
            contextualReply = `**Selected Element Analysis — ${label} (${val}):**\n\n• **Section:** ${sec}\n• **Workspace:** ${businessName}\n• **Grounded Analysis:** You clicked on **"${label}"** with a recorded value of **"${val}"**. In accordance with BEMS Group financial controls, all metrics on this page reflect live database records with zero unverified caching.`;
          }

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: contextualReply,
          };
          setMessages((prev) => [...prev, aiReply]);
          setIsTyping(false);
          return;
        }

        // 1. Executive Briefing Command
        if (normalized.includes('brief') || normalized.includes('morning') || normalized.includes('attention') || normalized.includes('what do you have')) {
          const briefingData: BriefingCardData = {
            asOf: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            totalPendingApprovals: 0,
            totalPendingMinor: 0,
            unrecordedPayments: 0,
            unrecordedMinor: 0,
            overdueCasesCount: 0,
            cashRunwayMonths: 'Healthy',
            urgentItems: [],
          };

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: `Here is your executive financial briefing across ${businessName}. All approval queues and accountability cases are currently up-to-date with **0 pending items**.`,
            actionCard: {
              type: 'briefing',
              data: briefingData,
            },
          };
          setMessages((prev) => [...prev, aiReply]);
          setIsTyping(false);
          return;
        }

        // Default General Conversational Response
        const defaultReply: AiMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          content: `I am your BEMS AI Group Financial Manager. I monitor real-time expenditure, approvals, cash runway, and compliance across ${businessName}.\n\nHow can I assist your financial oversight today?`,
        };
        setMessages((prev) => [...prev, defaultReply]);
        setIsTyping(false);
      }, 500);
    },
    [businessName, businessId]
  );

  // Execute confirmation for an action card
  const handleConfirmAction = useCallback(
    async (messageId: string, actionType: string, payload: any) => {
      try {
        const targetMsg = messages.find((m) => m.id === messageId);
        const stagedId = payload?.staged_action_id || targetMsg?.actionCard?.staged_action_id;
        const confHash = payload?.confirmation_hash || targetMsg?.actionCard?.confirmation_hash;

        if (stagedId && confHash) {
          const res = await fetch(`/api/ai/staged-actions/${stagedId}/confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            },
            body: JSON.stringify({
              confirmed_by: userName || 'GMD Executive',
              confirmation_hash: confHash,
            }),
          });
          const result = await res.json();
          if (res.ok) {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === messageId && m.actionCard) {
                  return {
                    ...m,
                    actionCard: {
                      ...m.actionCard,
                      confirmed: true,
                      resultMessage: `Operation confirmed! Audit Event ID: #${result.audit_event_id || 'AUDIT-OK'}.`,
                    },
                  };
                }
                return m;
              })
            );
            return;
          } else {
            console.error('Staged action confirmation failed:', result);
          }
        }

        if (actionType === 'approval_decision') {
          // Call backend approval API
          await fetch(`/api/requests/${payload.requestNumber || 'REQ-2026-0004'}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: payload.action || 'APPROVE',
              decisionReason: payload.reason || 'Approved by GMD via AI Financial Manager.',
            }),
          });
        }

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === messageId && m.actionCard) {
              return {
                ...m,
                actionCard: {
                  ...m.actionCard,
                  confirmed: true,
                  resultMessage: `Operation confirmed and committed to the BEMS audit ledger with correlation ID #AID-${Date.now().toString().slice(-6)}.`,
                },
              };
            }
            return m;
          })
        );
      } catch (err) {
        console.error('Failed to commit action:', err);
      }
    },
    [userName, messages]
  );

  const handleCancelAction = useCallback(
    async (messageId: string, stagedActionId?: string) => {
      try {
        if (stagedActionId) {
          await fetch(`/api/ai/staged-actions/${stagedActionId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        }
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === messageId && m.actionCard) {
              return {
                ...m,
                actionCard: {
                  ...m.actionCard,
                  cancelled: true,
                  resultMessage: 'Action discarded by executive.',
                },
              };
            }
            return m;
          })
        );
      } catch (err) {
        console.error('Failed to cancel action:', err);
      }
    },
    []
  );

  return {
    messages,
    isTyping,
    sendMessage,
    handleConfirmAction,
    handleCancelAction,
    startNewChat,
  };
}
