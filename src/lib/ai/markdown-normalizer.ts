/**
 * Shared Markdown Normalizer for BEMS AI Copilot (Web & Mobile)
 * Normalizes Markdown tables, code blocks, and whitespace so that
 * multi-column tabular data and cards render impeccably.
 */

export function cleanMarkdownTables(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  let str = raw;

  // 1. Break glued row boundaries: '||' or '| |' -> '|\n|'
  if (str.includes('||')) {
    str = str.replace(/\|\s*\|/g, '|\n|');
  }

  // 2. Separate text before table header and after table end
  const lines = str.split('\n');
  const newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // If next line is a markdown table delimiter (|---|---|), this line is the table header
    if (nextLine && /^\s*\|[-:\s|]{3,}\|\s*$/.test(nextLine)) {
      const firstPipe = line.indexOf('|');
      if (firstPipe > 0) {
        const textBefore = line.slice(0, firstPipe).trim();
        const tableHeader = line.slice(firstPipe).trim();
        if (textBefore) newLines.push(textBefore + '\n');
        newLines.push(tableHeader);
        continue;
      }
    }

    // If this line is a table row and has prose trailing after the last pipe:
    // e.g. "| BemsSoft Hub Ltd | Oct 2026 | ₦50m | ₦0 | Every budget is also one undivided..."
    if (i > 0 && lines[i - 1].trim().startsWith('|') && line.trim().startsWith('|')) {
      const lastPipe = line.lastIndexOf('|');
      if (lastPipe !== -1 && lastPipe < line.length - 1) {
        const afterLastPipe = line.slice(lastPipe + 1).trim();
        if (afterLastPipe && !afterLastPipe.startsWith('|')) {
          const tableRow = line.slice(0, lastPipe + 1).trim();
          newLines.push(tableRow);
          newLines.push('\n' + afterLastPipe);
          continue;
        }
      }
    }

    newLines.push(line);
  }

  return newLines.join('\n');
}

