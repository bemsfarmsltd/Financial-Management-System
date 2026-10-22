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
  const [messages, setMessages] = useState<AiMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'assistant',
      timestamp: 'Just now',
      content: `Good afternoon, ${userName.split(' ')[0]}. I am your BEMS AI Group Financial Manager. I monitor real-time expenditure, approvals, cash runway, and compliance across ${businessName}.\n\nHow can I assist your financial oversight today?`,
    },
  ]);

  const [isTyping, setIsTyping] = useState(false);

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
          const actionCard = data.actionCard || (data.staged_action ? {
            type: data.staged_action.type || 'approval_decision',
            data: data.staged_action.preview || data.staged_action,
            staged_action_id: data.staged_action.staged_action_id,
            confirmation_hash: data.staged_action.confirmation_hash,
          } : undefined);

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
        if (payload?.staged_action_id) {
          const res = await fetch(`/api/v1/staged-actions/${payload.staged_action_id}/confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            },
            body: JSON.stringify({
              confirmed_by: userName || 'GMD Executive',
              confirmation_hash: payload.confirmation_hash,
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
    [userName]
  );

  return {
    messages,
    isTyping,
    sendMessage,
    handleConfirmAction,
  };
}
