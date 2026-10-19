'use client';

import { useState, useCallback, useEffect } from 'react';
import { AiMessage, AiRole, BriefingCardData, ApprovalDecisionCardData, BudgetProposalCardData, SalaryAdjustmentCardData, DisbursementRecordCardData, ScenarioSimulatorCardData } from './types';

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
    async (text: string) => {
      const userMsg: AiMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        content: text,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      const normalized = text.toLowerCase();

      setTimeout(() => {
        // 1. Executive Briefing Command
        if (normalized.includes('brief') || normalized.includes('morning') || normalized.includes('attention') || normalized.includes('what do you have')) {
          const briefingData: BriefingCardData = {
            asOf: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            totalPendingApprovals: 1,
            totalPendingMinor: 65000000,
            unrecordedPayments: 1,
            unrecordedMinor: 400000000,
            overdueCasesCount: 0,
            cashRunwayMonths: '11.4 Months',
            urgentItems: [
              {
                id: 'req-0004',
                requestNumber: 'REQ-2026-0004',
                title: 'Microsoft Cloud Developer Licenses Q4',
                amountNaira: 650000,
                subsidiaryName: 'BemsSoft Hub Ltd',
                urgency: 'HIGH',
                dueInHours: 24,
              },
            ],
          };

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: `Here is your executive financial briefing across ${businessName}. There is **1 high-priority requisition** awaiting your sign-off, and all accountability cases currently remain on schedule.`,
            actionCard: {
              type: 'briefing',
              data: briefingData,
            },
          };
          setMessages((prev) => [...prev, aiReply]);
          setIsTyping(false);
          return;
        }

        // 2. Request Review / Decision Gate Command
        if (normalized.includes('req-2026') || normalized.includes('approval') || normalized.includes('decide') || normalized.includes('microsoft')) {
          const decisionData: ApprovalDecisionCardData = {
            requestId: 'req-2026-0004',
            requestNumber: 'REQ-2026-0004',
            title: 'Microsoft Cloud Developer Licenses Q4',
            subsidiaryName: 'BemsSoft Hub Ltd',
            requesterName: 'Bems system Admin',
            category: 'IT_SOFTWARE',
            amountNaira: 650000,
            currency: 'NGN',
            justification: 'Subscription extension for engineering IDEs and cloud telemetry tools required for DevOps deployment.',
            budgetImpact: {
              budgetTotal: 25000000,
              currentSpent: 450000,
              newTotalAfterApproval: 1100000,
              headroomPercentage: 95,
            },
            policyChecks: [
              { check: 'Within Tier 2 Financial Authority Cap', passed: true, note: 'Threshold <= ₦2,000,000' },
              { check: 'Allocated Departmental Budget Available', passed: true, note: '₦23.9M headroom remaining' },
              { check: 'Approved Corporate Vendor on File', passed: true, note: 'Vendor verified' },
            ],
          };

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: `I have pulled the complete dossier for **REQ-2026-0004**. The requisition is fully compliant with departmental budget headroom. Please review the preview card below and authorize or clarify as desired:`,
            actionCard: {
              type: 'approval_decision',
              data: decisionData,
            },
          };
          setMessages((prev) => [...prev, aiReply]);
          setIsTyping(false);
          return;
        }

        // 3. What-if Scenario Simulation
        if (normalized.includes('simulate') || normalized.includes('what-if') || normalized.includes('runway') || normalized.includes('burn')) {
          const simData: ScenarioSimulatorCardData = {
            initialRunwayMonths: 11.4,
            initialLiquidNaira: 84200000,
            monthlyBurnNaira: 7400000,
            pendingCommitmentsNaira: 4650000,
          };

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: `I have launched the **Cash Runway Modeler** for ${businessName}. You can test the financial impact of postponing non-critical commitments or injecting additional capex below without altering any active production ledgers:`,
            actionCard: {
              type: 'scenario_simulator',
              data: simData,
            },
          };
          setMessages((prev) => [...prev, aiReply]);
          setIsTyping(false);
          return;
        }

        // 4. Budget Creation / Proposal
        if (normalized.includes('budget') || normalized.includes('draft') || normalized.includes('allocation')) {
          const budgetData: BudgetProposalCardData = {
            organizationId: businessId,
            organizationName: 'BemsSoft Hub Ltd',
            periodName: 'Q1 2027 — Software & Cloud Expansion',
            fiscalYear: 2027,
            fiscalPeriod: 'Q1',
            totalAmount: 25000000,
            currency: 'NGN',
            lines: [
              { departmentName: 'Engineering & Cloud', category: 'Cloud Infrastructure & VPS Hosting', allocatedAmount: 14000000 },
              { departmentName: 'Corporate Services', category: 'Developer Tooling & Licenses', allocatedAmount: 6000000 },
              { departmentName: 'Operations', category: 'Technical QA & Testing Sandbox', allocatedAmount: 5000000 },
            ],
            varianceFromPrevious: 3000000,
          };

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: `I have drafted the departmental budget proposal for **${budgetData.organizationName}**. The allocation matches the total ceiling. Please inspect the line items and click confirm when ready:`,
            actionCard: {
              type: 'budget_proposal',
              data: budgetData,
            },
          };
          setMessages((prev) => [...prev, aiReply]);
          setIsTyping(false);
          return;
        }

        // 5. Salary Adjustment Proposal
        if (normalized.includes('salary') || normalized.includes('compensation') || normalized.includes('tunde')) {
          const salaryData: SalaryAdjustmentCardData = {
            employeeId: 'emp-2026-0002',
            employeeName: 'Engr. Tunde Adeleke',
            employeeNumber: 'EMP-2026-0002',
            subsidiaryName: 'BemsSoft Hub Ltd',
            departmentName: 'Engineering & Cloud',
            currentSalary: 1400000,
            proposedSalary: 1650000,
            changeType: 'ADDITION',
            effectiveDate: '1 November 2026',
            reason: 'Annual executive performance increment and group technical leadership expansion.',
            willNotifyEmployee: true,
          };

          const aiReply: AiMessage = {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            content: `Here is the proposed compensation review for **${salaryData.employeeName}**. Per policy, executing this will generate an audited compensation version and send an automated notification:`,
            actionCard: {
              type: 'salary_adjustment',
              data: salaryData,
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
          content: `I understand your request regarding "${text}".\n\nI can retrieve real-time telemetry, draft budget ceilings, review pending requisitions, simulate your cash burn rate, or prepare executive decisions. Choose one of the quick commands above or provide a specific requisition reference to proceed.`,
        };
        setMessages((prev) => [...prev, defaultReply]);
        setIsTyping(false);
      }, 700);
    },
    [userName, businessName, businessId]
  );

  // Execute confirmation for an action card
  const handleConfirmAction = useCallback(
    async (messageId: string, actionType: string, payload: any) => {
      try {
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
    []
  );

  return {
    messages,
    isTyping,
    sendMessage,
    handleConfirmAction,
  };
}
