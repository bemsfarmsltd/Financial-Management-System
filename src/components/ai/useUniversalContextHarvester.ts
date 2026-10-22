'use client';

export interface ElementContextPayload {
  label: string;
  value?: string;
  section?: string;
  page: string;
  subsidiary: string;
  tableColumn?: string;
  tableRowIdentifier?: string;
  surroundingText?: string;
  rawText: string;
}

export function harvestElementContext(
  target: HTMLElement,
  currentPage: string,
  subsidiaryName: string
): ElementContextPayload {
  const rawText = (target.innerText || target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 400);

  // 1. Detect monetary or numeric values
  const amountMatch = rawText.match(/(₦[\d,]+(?:\.\d+)?(?:m|k|b)?)/i) || rawText.match(/(\b\d+(?:[\d,]*\d)?\b)/);
  const detectedValue = amountMatch ? amountMatch[1] : undefined;

  // 2. Identify label or heading for this element
  let detectedLabel =
    target.getAttribute('data-ai-label') ||
    target.getAttribute('aria-label') ||
    target.getAttribute('title') ||
    '';

  if (!detectedLabel) {
    // Look for adjacent or child small/kicker/strong/label
    const labelEl = target.querySelector('small, .kicker, label, strong, span.hero-label');
    if (labelEl && labelEl.textContent) {
      detectedLabel = labelEl.textContent.trim();
    }
  }

  // 3. Walk up the DOM tree to find section title or card title
  let sectionTitle = '';
  let current: HTMLElement | null = target;
  let depth = 0;

  while (current && depth < 8) {
    if (current.tagName === 'BODY' || current.tagName === 'HTML') break;

    // Check for card/article/section headers
    const heading = current.querySelector('h1, h2, h3, h4, .kicker, .hero-label');
    if (heading && heading !== target && !heading.contains(target)) {
      sectionTitle = heading.textContent?.trim() || '';
      if (sectionTitle) break;
    }

    // Check data attributes
    const sectionAttr = current.getAttribute('data-section-title') || current.getAttribute('aria-label');
    if (sectionAttr) {
      sectionTitle = sectionAttr;
      break;
    }

    current = current.parentElement;
    depth++;
  }

  // 4. If clicked inside a table, extract column and row information
  let tableColumn: string | undefined;
  let tableRowIdentifier: string | undefined;

  const cell = target.closest('td, th');
  if (cell) {
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (row && table) {
      const cellIndex = (cell as HTMLTableCellElement).cellIndex;
      const th = table.querySelectorAll('th')[cellIndex];
      if (th) {
        tableColumn = th.textContent?.trim();
      }
      // Get the first cell or code/link in the row as the identifier (e.g., REQ-2026-0042)
      const idEl = row.querySelector('strong, a, code, td:first-child');
      if (idEl) {
        tableRowIdentifier = idEl.textContent?.trim();
      }
    }
  }

  // Fallback for label
  if (!detectedLabel) {
    if (tableColumn && tableRowIdentifier) {
      detectedLabel = `${tableRowIdentifier} · ${tableColumn}`;
    } else if (sectionTitle) {
      detectedLabel = `${sectionTitle} item`;
    } else {
      detectedLabel = rawText.slice(0, 40) || 'Selected Element';
    }
  }

  return {
    label: detectedLabel,
    value: detectedValue,
    section: sectionTitle || currentPage,
    page: currentPage,
    subsidiary: subsidiaryName,
    tableColumn,
    tableRowIdentifier,
    surroundingText: target.parentElement?.innerText?.trim().replace(/\s+/g, ' ').slice(0, 250),
    rawText,
  };
}
