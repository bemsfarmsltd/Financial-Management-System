import 'package:flutter/material.dart';

class ExecutiveMarkdownBody extends StatelessWidget {
  final String content;

  const ExecutiveMarkdownBody({
    super.key,
    required this.content,
  });

  @override
  Widget build(BuildContext context) {
    if (content.trim().isEmpty) {
      return const SizedBox.shrink();
    }

    // 1. Pre-normalize glued markdown table rows (e.g. '||---|---|' or '|| row |')
    String normalized = content;
    if (normalized.contains('||') && RegExp(r'\|[-:\s|]{3,}\|').hasMatch(normalized)) {
      normalized = normalized.replaceAll(RegExp(r'\|\s*\|'), '|\n|');
    }

    // 2. Split content into logical blocks by double newlines
    final blocks = normalized.split(RegExp(r'\n\s*\n'));
    final List<Widget> children = [];

    for (int bIdx = 0; bIdx < blocks.length; bIdx++) {
      final block = blocks[bIdx].trim();
      if (block.isEmpty) continue;

      // Check if this block contains a Markdown table (either standalone or embedded)
      final tableMatch = _extractTableFromBlock(block);
      if (tableMatch != null) {
        if (tableMatch.preText.isNotEmpty) {
          children.add(_buildParagraph(tableMatch.preText));
          children.add(const SizedBox(height: 8));
        }

        children.add(_buildTableCard(tableMatch.tableLines));

        if (tableMatch.postText.isNotEmpty) {
          children.add(const SizedBox(height: 8));
          children.add(_buildParagraph(tableMatch.postText));
        }
        if (bIdx < blocks.length - 1) {
          children.add(const SizedBox(height: 10));
        }
        continue;
      }

      // Check for Header (#, ##, ###)
      if (block.startsWith('#')) {
        final title = block.replaceFirst(RegExp(r'^#+\s*'), '').trim();
        children.add(
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: -0.2,
              ),
            ),
          ),
        );
        if (bIdx < blocks.length - 1) children.add(const SizedBox(height: 6));
        continue;
      }

      // Check for multi-line bullet lists
      final lines = block.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
      final isAllBullets = lines.length > 1 &&
          lines.every((l) =>
              l.startsWith('-') ||
              l.startsWith('*') ||
              l.startsWith('•') ||
              RegExp(r'^\d+\.\s').hasMatch(l));

      if (isAllBullets) {
        for (final line in lines) {
          final cleanLine = line.replaceFirst(RegExp(r'^[-*•]\s*|^\d+\.\s*'), '');
          children.add(
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 6, right: 8),
                    width: 5,
                    height: 5,
                    decoration: const BoxDecoration(
                      color: Color(0xFFEA580C),
                      shape: BoxShape.circle,
                    ),
                  ),
                  Expanded(child: _buildRichText(cleanLine)),
                ],
              ),
            ),
          );
        }
        if (bIdx < blocks.length - 1) children.add(const SizedBox(height: 6));
        continue;
      }

      // Default: Clean executive prose paragraph
      children.add(_buildParagraph(block));
      if (bIdx < blocks.length - 1) {
        children.add(const SizedBox(height: 8));
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }

  Widget _buildParagraph(String text) {
    return _buildRichText(text);
  }

  Widget _buildRichText(String text) {
    // Parse inline bold (**bold**), italic (*italic*), and code (`code`)
    final spans = _parseInlineMarkdown(text);
    return RichText(
      text: TextSpan(
        style: const TextStyle(
          fontSize: 13.5,
          color: Color(0xFF1E293B),
          height: 1.48,
          fontWeight: FontWeight.w400,
        ),
        children: spans,
      ),
    );
  }

  List<InlineSpan> _parseInlineMarkdown(String text) {
    final List<InlineSpan> spans = [];
    final pattern = RegExp(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)');
    final matches = pattern.allMatches(text);

    int lastIndex = 0;
    for (final match in matches) {
      if (match.start > lastIndex) {
        spans.add(TextSpan(text: text.substring(lastIndex, match.start)));
      }

      final matchedText = match.group(0)!;
      if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
        spans.add(
          TextSpan(
            text: matchedText.substring(2, matchedText.length - 2),
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
          ),
        );
      } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
        spans.add(
          TextSpan(
            text: matchedText.substring(1, matchedText.length - 1),
            style: const TextStyle(
              fontStyle: FontStyle.italic,
              color: Color(0xFF334155),
            ),
          ),
        );
      } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                matchedText.substring(1, matchedText.length - 1),
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 11.5,
                  color: Color(0xFFEA580C),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        );
      }

      lastIndex = match.end;
    }

    if (lastIndex < text.length) {
      spans.add(TextSpan(text: text.substring(lastIndex)));
    }

    return spans;
  }

  Widget _buildTableCard(List<String> tableLines) {
    if (tableLines.length < 2) return const SizedBox.shrink();

    // 1. Parse Headers
    final headerParts = tableLines[0].split('|').map((s) => s.trim()).toList();
    if (headerParts.isNotEmpty && headerParts.first.isEmpty) headerParts.removeAt(0);
    if (headerParts.isNotEmpty && headerParts.last.isEmpty) headerParts.removeLast();

    if (headerParts.isEmpty) return const SizedBox.shrink();

    // 2. Parse Rows
    final List<List<String>> rows = [];
    for (int i = 2; i < tableLines.length; i++) {
      final line = tableLines[i].trim();
      if (!line.startsWith('|')) continue;
      final cellParts = line.split('|').map((s) => s.trim()).toList();
      if (cellParts.isNotEmpty && cellParts.first.isEmpty) cellParts.removeAt(0);
      if (cellParts.isNotEmpty && cellParts.last.isEmpty) cellParts.removeLast();
      if (cellParts.isNotEmpty) {
        rows.add(cellParts);
      }
    }

    if (rows.isEmpty) return const SizedBox.shrink();

    // Check if column is numeric/currency
    bool isNumericColumn(int colIdx) {
      return rows.every((r) {
        if (colIdx >= r.length) return true;
        final cell = r[colIdx];
        if (cell.isEmpty || cell == '—' || cell == '-') return true;
        return cell.contains('₦') ||
            cell.contains('\$') ||
            RegExp(r'^[\d,.\s/+\-%]+$').hasMatch(cell);
      });
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: DataTable(
          headingRowHeight: 38,
          dataRowMinHeight: 38,
          dataRowMaxHeight: 48,
          horizontalMargin: 12,
          columnSpacing: 16,
          headingRowColor: WidgetStateProperty.all(const Color(0xFFF8FAFC)),
          border: const TableBorder(
            horizontalInside: BorderSide(color: Color(0xFFF1F5F9), width: 1),
          ),
          columns: List.generate(headerParts.length, (colIdx) {
            final h = headerParts[colIdx];
            final isNum = isNumericColumn(colIdx);
            return DataColumn(
              numeric: isNum,
              label: Text(
                h.replaceAll(RegExp(r'[*_]'), '').toUpperCase(),
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF475569),
                  letterSpacing: 0.3,
                ),
              ),
            );
          }),
          rows: List.generate(rows.length, (rowIdx) {
            final r = rows[rowIdx];
            final isEven = rowIdx % 2 == 0;
            return DataRow(
              color: WidgetStateProperty.all(isEven ? Colors.white : const Color(0xFFFAFBFC)),
              cells: List.generate(headerParts.length, (colIdx) {
                final cell = colIdx < r.length ? r[colIdx] : '';
                final isCurrency = cell.contains('₦') || cell.contains('\$');
                final isNum = isNumericColumn(colIdx);

                return DataCell(
                  Text(
                    cell.replaceAll(RegExp(r'[*_]'), ''),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isCurrency ? FontWeight.w600 : FontWeight.w400,
                      color: const Color(0xFF0F172A),
                      fontFamily: isNum || isCurrency ? 'monospace' : null,
                    ),
                  ),
                );
              }),
            );
          }),
        ),
      ),
    );
  }

  _TableMatch? _extractTableFromBlock(String block) {
    final lines = block.split('\n');
    int tableStartIndex = -1;
    int tableEndIndex = -1;

    for (int i = 0; i < lines.length - 1; i++) {
      final l1 = lines[i].trim();
      final l2 = lines[i + 1].trim();
      if (l1.startsWith('|') &&
          l1.endsWith('|') &&
          l2.startsWith('|') &&
          RegExp(r'\|[-:\s|]{3,}\|').hasMatch(l2)) {
        tableStartIndex = i;
        break;
      }
    }

    if (tableStartIndex != -1) {
      for (int i = tableStartIndex + 2; i < lines.length; i++) {
        final l = lines[i].trim();
        if (!l.startsWith('|')) {
          tableEndIndex = i;
          break;
        }
      }
      if (tableEndIndex == -1) tableEndIndex = lines.length;

      final preLines = lines.sublist(0, tableStartIndex).where((l) => l.trim().isNotEmpty).toList();
      final tableLines = lines.sublist(tableStartIndex, tableEndIndex).map((l) => l.trim()).toList();
      final postLines = lines.sublist(tableEndIndex).where((l) => l.trim().isNotEmpty).toList();

      return _TableMatch(
        preText: preLines.join('\n').trim(),
        tableLines: tableLines,
        postText: postLines.join('\n').trim(),
      );
    }
    return null;
  }
}

class _TableMatch {
  final String preText;
  final List<String> tableLines;
  final String postText;

  _TableMatch({
    required this.preText,
    required this.tableLines,
    required this.postText,
  });
}

