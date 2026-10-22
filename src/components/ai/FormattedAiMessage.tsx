'use client';

import React from 'react';
import {
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Clock,
  PieChart,
  Search,
  FileText,
  Building2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Calendar,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface FormattedAiMessageProps {
  content: string;
  isUser?: boolean;
  quickReplies?: string[];
  onSelectQuickReply?: (prompt: string) => void;
  onNavigateToRequest?: (requestNumber: string) => void;
}

interface ParsedSection {
  title: string;
  type: 'decision' | 'unpaid' | 'confirmation' | 'accountability' | 'budget' | 'audit' | 'general';
  lines: string[];
}

export function FormattedAiMessage({
  content,
  isUser = false,
  quickReplies = [],
  onSelectQuickReply,
  onNavigateToRequest,
}: FormattedAiMessageProps) {
  if (isUser) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
  }

  // Parse markdown bold and inline tokens
  const renderInlineFormatted = (text: string) => {
    // Match **bold** or `code`
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} style={{ fontWeight: 700, color: '#0f172a' }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            style={{
              background: 'rgba(15, 23, 42, 0.06)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#ea580c',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // Split content into intro, structured sections, and outro
  const lines = content.split('\n');
  const introLines: string[] = [];
  const sections: ParsedSection[] = [];
  const outroLines: string[] = [];

  let currentSection: ParsedSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const isBullet = rawLine.startsWith('-') || rawLine.startsWith('*') || rawLine.startsWith('•');

    // Advanced Section Header Detection:
    // 1. Markdown headers (### Header)
    // 2. Bold headers (**Header** or **Header:**)
    // 3. Short colon headers (Needs action:, In progress:, Next steps:, Treasury Status:)
    // 4. Numbered headers (1. Requests (5 in total, ₦5,550,000))
    const isMarkdownHeader = rawLine.startsWith('#');
    const isBoldHeader =
      (rawLine.startsWith('**') && rawLine.endsWith('**') && rawLine.length < 90) ||
      (rawLine.startsWith('**') && rawLine.includes('**') && rawLine.endsWith(':') && rawLine.length < 90);
    const isColonHeader = !isBullet && rawLine.endsWith(':') && rawLine.length < 65 && !rawLine.includes('₦');
    const isNumberedHeader = !isBullet && /^\d+\.\s+[A-Za-z]/.test(rawLine) && (rawLine.includes('(') || rawLine.length < 80);

    const isHeader = isMarkdownHeader || isBoldHeader || isColonHeader || isNumberedHeader;

    if (isHeader) {
      if (currentSection) {
        sections.push(currentSection);
      }
      // Clean up title
      let title = rawLine
        .replace(/^#+\s*/, '')
        .replace(/^\*\*|\*\*$/g, '')
        .replace(/^\*\*|\*\*:$/g, '')
        .replace(/:$/, '')
        .trim();

      const lower = title.toLowerCase();

      let type: ParsedSection['type'] = 'general';
      if (
        lower.includes('action') ||
        lower.includes('decision') ||
        lower.includes('pending') ||
        lower.includes('urgent') ||
        lower.includes('needs action')
      ) {
        type = 'decision';
      } else if (
        lower.includes('in progress') ||
        lower.includes('progress') ||
        lower.includes('flight') ||
        lower.includes('confirm') ||
        lower.includes('awaiting')
      ) {
        type = 'confirmation';
      } else if (lower.includes('unpaid') || lower.includes('not yet paid') || lower.includes('payment') || lower.includes('disburse')) {
        type = 'unpaid';
      } else if (lower.includes('accountability') || lower.includes('retirement') || lower.includes('sla') || lower.includes('receipt')) {
        type = 'accountability';
      } else if (lower.includes('budget') || lower.includes('allocation') || lower.includes('capital') || lower.includes('treasury') || lower.includes('balance')) {
        type = 'budget';
      } else if (lower.includes('review') || lower.includes('audit') || lower.includes('advisory')) {
        type = 'audit';
      }

      currentSection = { title, type, lines: [] };
    } else if (currentSection) {
      // Check if this is the final outro question
      if (
        i >= lines.length - 2 &&
        (rawLine.toLowerCase().startsWith('would you like') ||
          rawLine.toLowerCase().startsWith('how would you like') ||
          rawLine.endsWith('?'))
      ) {
        outroLines.push(rawLine);
      } else {
        currentSection.lines.push(rawLine);
      }
    } else {
      // If we see a bullet line before any header was declared, create a default "Summary Updates" section
      if (isBullet && !currentSection) {
        currentSection = { title: 'Executive Overview', type: 'general', lines: [rawLine] };
      } else {
        introLines.push(rawLine);
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // Visual themes for sections
  const getSectionTheme = (type: ParsedSection['type']) => {
    switch (type) {
      case 'decision':
        return {
          border: '1px solid #fed7aa',
          bg: '#fffaf5',
          headerBg: '#ffedd5',
          text: '#9a3412',
          pillBg: '#ea580c',
          pillText: '#ffffff',
          icon: AlertTriangle,
          badgeLabel: 'ACTION REQUIRED',
        };
      case 'confirmation':
        return {
          border: '1px solid #bae6fd',
          bg: '#f0f9ff',
          headerBg: '#e0f2fe',
          text: '#0369a1',
          pillBg: '#0284c7',
          pillText: '#ffffff',
          icon: Clock,
          badgeLabel: 'IN PROGRESS · IN FLIGHT',
        };
      case 'unpaid':
        return {
          border: '1px solid #bfdbfe',
          bg: '#f8fafc',
          headerBg: '#eff6ff',
          text: '#1e40af',
          pillBg: '#2563eb',
          pillText: '#ffffff',
          icon: CreditCard,
          badgeLabel: 'APPROVED · UNPAID',
        };
      case 'accountability':
        return {
          border: '1px solid #a7f3d0',
          bg: '#f6fbf9',
          headerBg: '#ecfdf5',
          text: '#065f46',
          pillBg: '#059669',
          pillText: '#ffffff',
          icon: CheckCircle2,
          badgeLabel: 'COMPLIANCE & 72H SLA',
        };
      case 'budget':
        return {
          border: '1px solid #e2e8f0',
          bg: '#f8fafc',
          headerBg: '#f1f5f9',
          text: '#334155',
          pillBg: '#475569',
          pillText: '#ffffff',
          icon: PieChart,
          badgeLabel: 'CAPITAL & RESERVES',
        };
      case 'audit':
        return {
          border: '1px solid #fecdd3',
          bg: '#fff8f9',
          headerBg: '#ffe4e6',
          text: '#9f1239',
          pillBg: '#e11d48',
          pillText: '#ffffff',
          icon: ShieldAlert,
          badgeLabel: 'AUDIT ADVISORY',
        };
      default:
        return {
          border: '1px solid #e2e8f0',
          bg: '#ffffff',
          headerBg: '#f8fafc',
          text: '#1e293b',
          pillBg: '#64748b',
          pillText: '#ffffff',
          icon: FileText,
          badgeLabel: 'OVERVIEW',
        };
    }
  };

  // Structured Requisition Line Parser
  const parseRequisitionDetails = (line: string) => {
    const clean = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    const reqMatch = clean.match(/(REQ-\d{4}-\d{3,5})/i);
    const amountMatch = clean.match(/(₦[\d,]+(?:\.\d+)?(?:m|k|b)?)/i);

    if (!reqMatch) {
      return null;
    }

    const reqNumber = reqMatch[1].toUpperCase();
    const amount = amountMatch ? amountMatch[1] : null;

    // Extract parentheses (e.g. "(Microsoft Cloud Developer Licenses Q4, BemsSoft Hub)")
    let title = '';
    let subsidiary = '';
    const parenMatch = clean.match(/\(([^)]+)\)/);

    if (parenMatch) {
      const insideParens = parenMatch[1].trim();
      const parts = insideParens.split(',').map((p) => p.trim());
      if (parts.length > 1) {
        title = parts[0];
        subsidiary = parts.slice(1).join(', ');
      } else {
        title = insideParens;
      }
    }

    // Extract date/deadline if present (e.g. "Needed by 26 Oct", "due 24 Oct", "paid on 19 Oct")
    let deadline = '';
    const dateMatch = clean.match(/(needed by [^,.:;\n]+|due [^,.:;\n]+|recorded as paid on [^,.:;\n]+|on \d{1,2} [A-Za-z]{3})/i);
    if (dateMatch) {
      deadline = dateMatch[1].trim();
    }

    // Clean remaining narrative
    let narrative = clean
      .replace(reqMatch[0], '')
      .replace(parenMatch ? parenMatch[0] : '', '')
      .replace(amountMatch ? amountMatch[0] : '', '')
      .trim();

    // Clean punctuation artifacts (e.g. leading commas, colons, double dots)
    narrative = narrative
      .replace(/^[\s,.:;—-]+/, '')
      .replace(/[\s,.:;—-]+$/, '')
      .replace(/:\s*\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Detect status badge
    const lowerNarrative = clean.toLowerCase();
    let statusLabel = 'ACTIVE';
    let statusBg = '#eff6ff';
    let statusColor = '#1d4ed8';

    if (lowerNarrative.includes('submitted but no approval') || lowerNarrative.includes('no approver has been asked')) {
      statusLabel = 'ROUTING MISSING';
      statusBg = '#fef2f2';
      statusColor = '#dc2626';
    } else if (lowerNarrative.includes('requires clarification')) {
      statusLabel = 'CLARIFICATION NEEDED';
      statusBg = '#fff7ed';
      statusColor = '#c2410c';
    } else if (lowerNarrative.includes('approved and unpaid')) {
      statusLabel = 'READY FOR PAYMENT';
      statusBg = '#f0fdf4';
      statusColor = '#15803d';
    } else if (lowerNarrative.includes('awaiting the recipient') || lowerNarrative.includes('awaiting confirmation')) {
      statusLabel = 'AWAITING RECIPIENT PROOF';
      statusBg = '#faf5ff';
      statusColor = '#7e22ce';
    } else if (lowerNarrative.includes('evidence has been submitted')) {
      statusLabel = 'EVIDENCE SUBMITTED';
      statusBg = '#ecfdf5';
      statusColor = '#047857';
    }

    return {
      reqNumber,
      amount,
      title: title || reqNumber,
      subsidiary,
      narrative,
      deadline,
      statusLabel,
      statusBg,
      statusColor,
    };
  };

  return (
    <div className="formatted-ai-response" style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* 1. Intro greeting / executive preamble */}
      {introLines.length > 0 && (
        <div
          style={{
            fontSize: '13px',
            color: '#1e293b',
            lineHeight: 1.6,
            fontWeight: 500,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '2px 4px',
          }}
        >
          {introLines.map((line, idx) => (
            <p key={idx} style={{ margin: 0 }}>
              {renderInlineFormatted(line)}
            </p>
          ))}
        </div>
      )}

      {/* 2. Structured Section Cards */}
      {sections.map((section, sIdx) => {
        const theme = getSectionTheme(section.type);
        const IconComp = theme.icon;

        return (
          <div
            key={sIdx}
            style={{
              background: theme.bg,
              border: theme.border,
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Section Header Bar */}
            <div
              style={{
                background: theme.headerBg,
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: theme.border,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconComp style={{ width: 15, height: 15, color: theme.text }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: theme.text, letterSpacing: '-0.01em' }}>
                  {section.title}
                </span>
              </div>
              <span
                style={{
                  background: theme.pillBg,
                  color: theme.pillText,
                  fontSize: '9.5px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                }}
              >
                {theme.badgeLabel}
              </span>
            </div>

            {/* Section Items */}
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {section.lines.map((line, lIdx) => {
                const reqData = parseRequisitionDetails(line);

                // HIGH-END STRUCTURED REQUISITION CARD
                if (reqData) {
                  return (
                    <div
                      key={lIdx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid rgba(226, 232, 240, 0.95)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      {/* Top Bar: Identifier, Subsidiary, Amount */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => onNavigateToRequest && onNavigateToRequest(reqData.reqNumber)}
                            title="Open requisition details"
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '11.5px',
                              color: '#ea580c',
                              background: '#fff7ed',
                              border: '1px solid #fed7aa',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              cursor: onNavigateToRequest ? 'pointer' : 'default',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{reqData.reqNumber}</span>
                            {onNavigateToRequest && <ExternalLink size={10} />}
                          </button>

                          {reqData.subsidiary && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 650,
                                color: '#475569',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '2px 7px',
                                borderRadius: '5px',
                              }}
                            >
                              <Building2 size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: '-1px' }} />
                              {reqData.subsidiary}
                            </span>
                          )}
                        </div>

                        {reqData.amount && (
                          <span
                            style={{
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              fontWeight: 800,
                              fontSize: '13.5px',
                              color: '#0f172a',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '2px 9px',
                              borderRadius: '6px',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {reqData.amount}
                          </span>
                        )}
                      </div>

                      {/* Title / Purpose */}
                      {reqData.title && (
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
                          {reqData.title}
                        </div>
                      )}

                      {/* Executive Narrative */}
                      {reqData.narrative && (
                        <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                          {renderInlineFormatted(reqData.narrative)}
                        </div>
                      )}

                      {/* Meta Footer: Status Tag & Deadline */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '6px',
                          paddingTop: '6px',
                          borderTop: '1px dashed #f1f5f9',
                          marginTop: '2px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: reqData.statusBg,
                            color: reqData.statusColor,
                          }}
                        >
                          {reqData.statusLabel}
                        </span>

                        {reqData.deadline && (
                          <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} color="#94a3b8" />
                            <span>{reqData.deadline}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // Standard Bullet Line
                const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().startsWith('•');
                const cleanBullet = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');

                return (
                  <div
                    key={lIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '9px',
                      fontSize: '12.5px',
                      color: '#334155',
                      background: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(226, 232, 240, 0.7)',
                    }}
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: theme.pillBg,
                        marginTop: '6px',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, lineHeight: 1.5 }}>{renderInlineFormatted(cleanBullet)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 3. Outro conclusion / follow-up prompt */}
      {outroLines.length > 0 && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(226, 232, 240, 0.85)',
            borderRadius: '10px',
            fontSize: '12.5px',
            color: '#1e293b',
            fontWeight: 650,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles style={{ width: 15, height: 15, color: '#ea580c', flexShrink: 0 }} />
          <span>{outroLines.join(' ')}</span>
        </div>
      )}

      {/* 4. Clickable Quick-Reply Chips */}
      {quickReplies.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '4px' }}>
          {quickReplies.map((qr, qIdx) => (
            <button
              key={qIdx}
              onClick={() => onSelectQuickReply && onSelectQuickReply(qr)}
              style={{
                background: '#ffffff',
                border: '1px solid #fed7aa',
                color: '#c2410c',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '999px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(234, 88, 12, 0.08)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ea580c';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#ea580c';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#c2410c';
                e.currentTarget.style.borderColor = '#fed7aa';
              }}
            >
              <span>{qr}</span>
              <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
