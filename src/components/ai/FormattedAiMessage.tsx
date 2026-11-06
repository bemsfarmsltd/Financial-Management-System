'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Clock,
  PieChart,
  FileText,
  Calendar,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import { AiVisualChart, ChartDataPoint } from './AiVisualChart';
import { AiKpiMetrics, KpiMetricItem } from './AiKpiMetrics';
import { cleanMarkdownTables } from '@/lib/ai/markdown-normalizer';

interface FormattedAiMessageProps {
  content: string;
  isUser?: boolean;
  quickReplies?: string[];
  onSelectQuickReply?: (prompt: string) => void;
  onNavigateToRequest?: (requestNumber: string) => void;
}

interface AiExecutiveTableProps {
  headers: string[];
  rows: string[][];
  renderInline: (text: string) => React.ReactNode;
}

function AiExecutiveTable({ headers, rows, renderInline }: AiExecutiveTableProps) {
  const isNumericOrCurrency = (cell: string) => {
    const trimmed = cell.trim();
    if (!trimmed || trimmed === '—' || trimmed === '-') return false;
    return /[₦$€£]/.test(trimmed) || /^[\d,.\s/+\-%]+$/.test(trimmed);
  };

  const isNumericCol = (colIdx: number) => {
    return rows.length > 0 && rows.every((r) => {
      const cell = (r[colIdx] || '').trim();
      if (!cell || cell === '—' || cell === '-') return true;
      return isNumericOrCurrency(cell);
    });
  };

  return (
    <div
      style={{
        overflowX: 'auto',
        margin: '12px 0',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {headers.map((h, i) => {
              const numCol = isNumericCol(i);
              return (
                <th
                  key={i}
                  style={{
                    padding: '9px 14px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#475569',
                    whiteSpace: 'nowrap',
                    textAlign: numCol ? 'right' : 'left',
                  }}
                >
                  {renderInline(h)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => {
            const isEven = rIdx % 2 === 0;
            return (
              <tr
                key={rIdx}
                style={{
                  background: isEven ? '#ffffff' : '#fafbfc',
                  borderBottom: rIdx < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}
              >
                {headers.map((_, cIdx) => {
                  const cell = (row[cIdx] || '').trim();
                  const numCol = isNumericCol(cIdx);
                  const isCurrency = /[₦$€£]/.test(cell);
                  return (
                    <td
                      key={cIdx}
                      style={{
                        padding: '9px 14px',
                        fontSize: '12px',
                        color: '#1e293b',
                        whiteSpace: 'nowrap',
                        textAlign: numCol ? 'right' : 'left',
                        fontFamily: isCurrency || numCol ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit',
                        fontWeight: isCurrency ? 600 : 450,
                      }}
                    >
                      {renderInline(cell)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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

  // Parse inline formatting: **bold**, *italics*, `code`, and [links]
  const renderInlineFormatted = (text: string) => {
    // Clean up malformed markdown tags like *What the section is for:**
    let clean = text.replace(/^\*([^*]+):\*\*/, '**$1:**');

    const tokens = clean.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return tokens.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} style={{ fontWeight: 700, color: '#0f172a' }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return (
          <em key={idx} style={{ fontStyle: 'italic', color: '#334155' }}>
            {part.slice(1, -1)}
          </em>
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

  // Structured Requisition Line Parser
  const parseRequisitionDetails = (line: string) => {
    const clean = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    const reqMatch = clean.match(/(REQ-\d{4}-\d{3,5})/i);
    const amountMatch = clean.match(/(₦[\d,]+(?:\.\d+)?(?:m|k|b)?)/i);

    if (!reqMatch) return null;

    const reqNumber = reqMatch[1].toUpperCase();
    const amount = amountMatch ? amountMatch[1] : null;

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

    let deadline = '';
    const dateMatch = clean.match(/(needed by [^,.:;\n]+|due [^,.:;\n]+|recorded as paid on [^,.:;\n]+|on \d{1,2} [A-Za-z]{3})/i);
    if (dateMatch) {
      deadline = dateMatch[1].trim();
    }

    let narrative = clean
      .replace(reqMatch[0], '')
      .replace(parenMatch ? parenMatch[0] : '', '')
      .replace(amountMatch ? amountMatch[0] : '', '')
      .trim();

    narrative = narrative
      .replace(/^[\s,.:;—-]+/, '')
      .replace(/[\s,.:;—-]+$/, '')
      .replace(/:\s*\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .trim();

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
    } else if (lowerNarrative.includes('awaiting confirmation')) {
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

  // Helper to detect and parse explicit chart blocks: ```chart[:type] ... ```
  const parseChartBlock = (block: string) => {
    const lines = block.split('\n');
    let title = 'Data Breakdown';
    let type: 'histogram' | 'bar' = 'histogram';
    const dataPoints: ChartDataPoint[] = [];

    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('bar')) type = 'bar';
    if (firstLine.includes('histogram')) type = 'histogram';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('```')) continue;

      if (line.toLowerCase().startsWith('title:')) {
        title = line.replace(/^title:\s*/i, '').replace(/["']/g, '').trim();
        continue;
      }

      // Format: Label: Value or Label | Value or Label, Value
      const parts = line.split(/[:|]/);
      if (parts.length >= 2) {
        const label = parts[0].replace(/^[-*•]\s*/, '').trim();
        const rawVal = parts[1].replace(/[₦,\s]/g, '').trim();
        const numVal = parseFloat(rawVal);
        if (!isNaN(numVal)) {
          dataPoints.push({
            label,
            value: numVal,
            formattedValue: parts[1].includes('₦') ? parts[1].trim() : undefined,
          });
        }
      }
    }

    if (dataPoints.length > 0) {
      return { title, type, dataPoints };
    }
    return null;
  };

  // Helper to parse markdown tables into structured chart/table data
  const parseMarkdownTable = (lines: string[]) => {
    if (lines.length < 3) return null;
    const headerRow = lines[0].split('|').map((s) => s.trim()).filter(Boolean);
    if (headerRow.length < 2) return null;

    const dataPoints: ChartDataPoint[] = [];
    for (let i = 2; i < lines.length; i++) {
      const row = lines[i].split('|').map((s) => s.trim()).filter(Boolean);
      if (row.length >= 2) {
        const label = row[0];
        const valStr = row[1];
        const num = parseFloat(valStr.replace(/[₦,\s]/g, ''));
        if (!isNaN(num)) {
          dataPoints.push({
            label,
            value: num,
            formattedValue: valStr,
          });
        }
      }
    }

    if (dataPoints.length > 0) {
      return {
        title: headerRow[0] && headerRow[1] ? `${headerRow[0]} vs ${headerRow[1]}` : 'Comparative Distribution',
        type: 'histogram' as const,
        dataPoints,
      };
    }
    return null;
  };

  // Helper to parse markdown table rows and columns for executive data table
  const parseTableData = (tableLines: string[]) => {
    if (tableLines.length < 2) return null;
    const headerParts = tableLines[0].split('|').map((s) => s.trim());
    if (headerParts.length > 0 && headerParts[0] === '') headerParts.shift();
    if (headerParts.length > 0 && headerParts[headerParts.length - 1] === '') headerParts.pop();

    if (headerParts.length === 0) return null;

    const rows: string[][] = [];
    for (let i = 2; i < tableLines.length; i++) {
      const line = tableLines[i].trim();
      if (!line || !line.startsWith('|')) continue;
      const cellParts = line.split('|').map((s) => s.trim());
      if (cellParts.length > 0 && cellParts[0] === '') cellParts.shift();
      if (cellParts.length > 0 && cellParts[cellParts.length - 1] === '') cellParts.pop();
      if (cellParts.length > 0) {
        rows.push(cellParts);
      }
    }

    return { headers: headerParts, rows };
  };

  // Helper to isolate table from within a paragraph block if mixed
  const extractTableFromBlock = (block: string) => {
    const lines = block.split('\n');
    let tableStartIndex = -1;
    let tableEndIndex = -1;

    for (let i = 0; i < lines.length - 1; i++) {
      const l1 = lines[i].trim();
      const l2 = lines[i + 1].trim();
      if (l1.startsWith('|') && l1.endsWith('|') && l2.startsWith('|') && /\|[-:\s|]{3,}\|/.test(l2)) {
        tableStartIndex = i;
        break;
      }
    }

    if (tableStartIndex !== -1) {
      for (let i = tableStartIndex + 2; i < lines.length; i++) {
        const l = lines[i].trim();
        if (!l.startsWith('|')) {
          tableEndIndex = i;
          break;
        }
      }
      if (tableEndIndex === -1) tableEndIndex = lines.length;

      const preLines = lines.slice(0, tableStartIndex).filter(Boolean);
      const tableLines = lines.slice(tableStartIndex, tableEndIndex).map((l) => l.trim());
      const postLines = lines.slice(tableEndIndex).filter(Boolean);

      return {
        preText: preLines.join('\n').trim(),
        tableLines,
        postText: postLines.join('\n').trim(),
      };
    }
    return null;
  };

  // Pre-normalize glued markdown tables (e.g. ||---|---| or || row | or table glued to prose)
  const normalizedContent = cleanMarkdownTables(content);

  // Render elements in document order
  const rawParagraphs = normalizedContent.split(/\n\s*\n/);
  const elements: React.ReactNode[] = [];

  rawParagraphs.forEach((para, pIdx) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    // Check 1: Explicit Chart code block (```chart ... ```)
    if (trimmed.startsWith('```chart') || trimmed.startsWith('```histogram') || trimmed.startsWith('```bar')) {
      const parsedChart = parseChartBlock(trimmed);
      if (parsedChart) {
        elements.push(
          <AiVisualChart
            key={`chart-${pIdx}`}
            title={parsedChart.title}
            chartType={parsedChart.type}
            data={parsedChart.dataPoints}
          />
        );
        return;
      }
    }

    // Check 2: Markdown Table (either standalone or embedded with text)
    const tableBlock = extractTableFromBlock(trimmed);
    if (tableBlock && tableBlock.tableLines.length >= 2) {
      // 1. Render preceding text if any
      if (tableBlock.preText) {
        elements.push(
          <p key={`pre-tbl-${pIdx}`} style={{ margin: '8px 0', fontSize: '13px', color: '#1e293b', lineHeight: 1.68, fontWeight: 450 }}>
            {renderInlineFormatted(tableBlock.preText)}
          </p>
        );
      }

      // 2. Render table data
      const parsedTbl = parseTableData(tableBlock.tableLines);
      if (parsedTbl && parsedTbl.rows.length > 0) {
        elements.push(
          <AiExecutiveTable
            key={`table-${pIdx}`}
            headers={parsedTbl.headers}
            rows={parsedTbl.rows}
            renderInline={renderInlineFormatted}
          />
        );
      }

      // 3. Render trailing text if any
      if (tableBlock.postText) {
        elements.push(
          <p key={`post-tbl-${pIdx}`} style={{ margin: '8px 0', fontSize: '13px', color: '#1e293b', lineHeight: 1.68, fontWeight: 450 }}>
            {renderInlineFormatted(tableBlock.postText)}
          </p>
        );
      }
      return;
    }

    // Check 3: Multi-line block with bullets / requisitions
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    const hasRequisition = lines.some((l) => /(REQ-\d{4}-\d{3,5})/i.test(l));
    const allBullets = lines.every((l) => l.startsWith('-') || l.startsWith('*') || l.startsWith('•') || /^\d+\.\s/.test(l));

    // If it has actual requisitions, render as high-impact Requisition Cards
    if (hasRequisition) {
      elements.push(
        <div key={`req-group-${pIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '8px 0' }}>
          {lines.map((line, lIdx) => {
            const reqData = parseRequisitionDetails(line);
            if (reqData) {
              return (
                <div
                  key={lIdx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(226, 232, 240, 0.95)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => onNavigateToRequest && onNavigateToRequest(reqData.reqNumber)}
                        style={{
                          background: 'rgba(234, 88, 12, 0.09)',
                          color: '#ea580c',
                          border: '1px solid rgba(234, 88, 12, 0.3)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{reqData.reqNumber}</span>
                        <ExternalLink size={10} />
                      </button>
                      {reqData.subsidiary && (
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                          {reqData.subsidiary}
                        </span>
                      )}
                    </div>

                    {reqData.amount && (
                      <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                        {reqData.amount}
                      </span>
                    )}
                  </div>

                  {reqData.title && (
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                      {reqData.title}
                    </div>
                  )}

                  {reqData.narrative && (
                    <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.5 }}>
                      {renderInlineFormatted(reqData.narrative)}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', paddingTop: '6px', borderTop: '1px dashed #f1f5f9' }}>
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: reqData.statusBg,
                        color: reqData.statusColor,
                        textTransform: 'uppercase',
                      }}
                    >
                      {reqData.statusLabel}
                    </span>
                    {reqData.deadline && (
                      <span style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={11} color="#94a3b8" />
                        <span>{reqData.deadline}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <p key={lIdx} style={{ margin: '4px 0', fontSize: '12.5px', color: '#334155' }}>
                {renderInlineFormatted(line)}
              </p>
            );
          })}
        </div>
      );
      return;
    }

    // Check 4: Check if this block is a list of financial comparative numbers that would look great as a visual histogram
    const numericLines: { label: string; val: number; strVal: string }[] = [];
    lines.forEach((l) => {
      const match = l.match(/^[-*•]?\s*([^:—–|]+)[:—–|]\s*(₦[\d,]+(?:\.\d+)?(?:m|k|b)?|[\d,]+(?:\.\d+)?%?)/i);
      if (match) {
        const label = match[1].trim();
        const strVal = match[2].trim();
        const num = parseFloat(strVal.replace(/[₦,%\s]/g, ''));
        if (!isNaN(num) && num > 0) {
          numericLines.push({ label, val: num, strVal });
        }
      }
    });

    if (numericLines.length >= 3 && numericLines.length === lines.length) {
      elements.push(
        <AiVisualChart
          key={`auto-chart-${pIdx}`}
          title="Comparative Breakdown"
          chartType="histogram"
          data={numericLines.map((n) => ({
            label: n.label,
            value: n.val,
            formattedValue: n.strVal,
          }))}
        />
      );
      return;
    }

    // Check 5: Standard Header
    const isHeader = trimmed.startsWith('#') || (trimmed.startsWith('**') && trimmed.endsWith(':') && trimmed.length < 60);
    if (isHeader) {
      const title = trimmed.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').replace(/:$/, '').trim();
      elements.push(
        <div key={`header-${pIdx}`} style={{ margin: '14px 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} color="#ea580c" />
          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
            {title}
          </h4>
        </div>
      );
      return;
    }

    // Check 6: Bullet list (render as clean, breathable executive list with bullets, NOT giant nested cards)
    if (allBullets) {
      elements.push(
        <ul key={`list-${pIdx}`} style={{ margin: '8px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {lines.map((l, lIdx) => {
            const cleanText = l.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
            return (
              <li key={lIdx} style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.6 }}>
                {renderInlineFormatted(cleanText)}
              </li>
            );
          })}
        </ul>
      );
      return;
    }

    // Check 7: Default — Clean, fluent executive English paragraph!
    // No artificial boxes, no "OVERVIEW" badges. Beautiful continuous text.
    elements.push(
      <p
        key={`para-${pIdx}`}
        style={{
          margin: '8px 0',
          fontSize: '13px',
          color: '#1e293b',
          lineHeight: 1.68,
          fontWeight: 450,
        }}
      >
        {renderInlineFormatted(trimmed)}
      </p>
    );
  });

  return (
    <div className="formatted-ai-response" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {elements}

      {/* Quick Replies */}
      {quickReplies && quickReplies.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px dashed rgba(226, 232, 240, 0.8)',
          }}
        >
          {quickReplies.map((qr, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectQuickReply && onSelectQuickReply(qr)}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #cbd5e1',
                borderRadius: '999px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{qr}</span>
              <ChevronRight size={11} color="#94a3b8" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
