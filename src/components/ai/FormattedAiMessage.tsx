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
    // Match **bold** or `code` or ₦amount
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} style={{ fontWeight: 600, color: '#0f172a' }}>
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

    // Check for section header: **Header** or ### Header
    const isHeader =
      (rawLine.startsWith('**') && rawLine.endsWith('**') && rawLine.length < 90 && !rawLine.includes(':')) ||
      rawLine.startsWith('### ') ||
      rawLine.startsWith('## ');

    if (isHeader) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const title = rawLine.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim();
      const lower = title.toLowerCase();

      let type: ParsedSection['type'] = 'general';
      if (lower.includes('decision') || lower.includes('pending') || lower.includes('action')) {
        type = 'decision';
      } else if (lower.includes('unpaid') || lower.includes('not yet paid') || lower.includes('payment')) {
        type = 'unpaid';
      } else if (lower.includes('confirmation') || lower.includes('confirm') || lower.includes('transfer')) {
        type = 'confirmation';
      } else if (lower.includes('accountability') || lower.includes('retirement') || lower.includes('sla')) {
        type = 'accountability';
      } else if (lower.includes('budget') || lower.includes('allocation') || lower.includes('capital')) {
        type = 'budget';
      } else if (lower.includes('review') || lower.includes('audit') || lower.includes('worth a look')) {
        type = 'audit';
      }

      currentSection = { title, type, lines: [] };
    } else if (currentSection) {
      // Check if this is the final outro question (e.g., "Would you like me to look at any of these?")
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
      introLines.push(rawLine);
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
      case 'confirmation':
        return {
          border: '1px solid #ddd6fe',
          bg: '#fbfaff',
          headerBg: '#f3e8ff',
          text: '#6b21a8',
          pillBg: '#7c3aed',
          pillText: '#ffffff',
          icon: Clock,
          badgeLabel: 'CONFIRMATION PENDING',
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
          badgeLabel: 'BUDGET PORTFOLIO',
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
          badgeLabel: 'UPDATE',
        };
    }
  };

  // Helper to extract REQ-2026-XXXX and Naira amounts from bullet lines
  const parseRequisitionLine = (line: string) => {
    const clean = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
    const reqMatch = clean.match(/(REQ-\d{4}-\d{4,5})/i);
    const amountMatch = clean.match(/(₦[\d,]+(?:\.\d+)?(?:m|k|b)?)/i);

    return {
      reqNumber: reqMatch ? reqMatch[1] : null,
      amount: amountMatch ? amountMatch[1] : null,
      raw: clean,
    };
  };

  return (
    <div className="formatted-ai-response" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 1. Intro greeting / preamble */}
      {introLines.length > 0 && (
        <div
          style={{
            fontSize: '12.5px',
            color: '#1e293b',
            lineHeight: 1.55,
            fontWeight: 500,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
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
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            {/* Section Header Bar */}
            <div
              style={{
                background: theme.headerBg,
                padding: '7px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: theme.border,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconComp style={{ width: 14, height: 14, color: theme.text }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: theme.text, letterSpacing: '0.01em' }}>
                  {section.title}
                </span>
              </div>
              <span
                style={{
                  background: theme.pillBg,
                  color: theme.pillText,
                  fontSize: '9.5px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  textTransform: 'uppercase',
                }}
              >
                {theme.badgeLabel}
              </span>
            </div>

            {/* Section Items */}
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {section.lines.map((line, lIdx) => {
                const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().startsWith('•');
                const isNumbered = /^\d+\./.test(line.trim());
                const parsed = parseRequisitionLine(line);

                // Highlighted Requisition Card
                if (parsed.reqNumber) {
                  return (
                    <div
                      key={lIdx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid rgba(226, 232, 240, 0.9)',
                        borderRadius: '7px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            onClick={() => onNavigateToRequest && onNavigateToRequest(parsed.reqNumber!)}
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '11px',
                              color: '#ea580c',
                              background: '#fff7ed',
                              border: '1px solid #ffedd5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              cursor: onNavigateToRequest ? 'pointer' : 'default',
                            }}
                          >
                            {parsed.reqNumber}
                          </span>
                        </div>
                        {parsed.amount && (
                          <span
                            style={{
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              fontWeight: 700,
                              fontSize: '12px',
                              color: '#0f172a',
                              background: '#f1f5f9',
                              padding: '2px 7px',
                              borderRadius: '5px',
                            }}
                          >
                            {parsed.amount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.45 }}>
                        {renderInlineFormatted(parsed.raw.replace(parsed.reqNumber, '').replace(parsed.amount || '', ''))}
                      </div>
                    </div>
                  );
                }

                // Numbered list item
                if (isNumbered) {
                  const numberMatch = line.match(/^(\d+)\.\s*(.*)/);
                  const num = numberMatch ? numberMatch[1] : `${lIdx + 1}`;
                  const rest = numberMatch ? numberMatch[2] : line;

                  return (
                    <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#334155' }}>
                      <span
                        style={{
                          background: theme.headerBg,
                          color: theme.text,
                          fontWeight: 700,
                          fontSize: '10px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {num}
                      </span>
                      <div style={{ flex: 1, lineHeight: 1.45 }}>{renderInlineFormatted(rest)}</div>
                    </div>
                  );
                }

                // Standard bullet line
                return (
                  <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#334155' }}>
                    <div
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: theme.pillBg,
                        marginTop: '6px',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, lineHeight: 1.45 }}>{renderInlineFormatted(line.replace(/^[-*•]\s*/, ''))}</div>
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
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#1e293b',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Sparkles style={{ width: 14, height: 14, color: '#ea580c', flexShrink: 0 }} />
          <span>{outroLines.join(' ')}</span>
        </div>
      )}

      {/* 4. Clickable Quick-Reply Chips */}
      {quickReplies.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
          {quickReplies.map((qr, qIdx) => (
            <button
              key={qIdx}
              onClick={() => onSelectQuickReply && onSelectQuickReply(qr)}
              style={{
                background: '#ffffff',
                border: '1px solid #fed7aa',
                color: '#c2410c',
                fontSize: '11px',
                fontWeight: 600,
                padding: '5px 11px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
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
              <ArrowRight style={{ width: 11, height: 11 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
