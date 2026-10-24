import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class PieChartSegment {
  final String label;
  final double value;
  final Color color;
  final int count;
  final IconData? icon;

  const PieChartSegment({
    required this.label,
    required this.value,
    required this.color,
    this.count = 1,
    this.icon,
  });
}

class BemsDonutChart extends StatelessWidget {
  final List<PieChartSegment> segments;
  final double size;
  final double strokeWidth;
  final String centerLabel;
  final String centerSublabel;

  const BemsDonutChart({
    super.key,
    required this.segments,
    this.size = 140,
    this.strokeWidth = 20,
    required this.centerLabel,
    this.centerSublabel = 'TOTAL',
  });

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<double>(0.0, (sum, s) => sum + s.value);

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _DonutChartPainter(
              segments: segments,
              total: total,
              strokeWidth: strokeWidth,
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                centerLabel,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                centerSublabel.toUpperCase(),
                style: const TextStyle(
                  fontSize: 8.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF94A3B8),
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DonutChartPainter extends CustomPainter {
  final List<PieChartSegment> segments;
  final double total;
  final double strokeWidth;

  _DonutChartPainter({
    required this.segments,
    required this.total,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    if (total <= 0 || segments.isEmpty) {
      final emptyPaint = Paint()
        ..color = const Color(0xFFF1F5F9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth;
      canvas.drawCircle(center, radius, emptyPaint);
      return;
    }

    // If only one segment, draw full circle without gaps
    final nonZeroSegments = segments.where((s) => s.value > 0).toList();
    if (nonZeroSegments.length == 1) {
      final paint = Paint()
        ..color = nonZeroSegments.first.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;
      canvas.drawCircle(center, radius, paint);
      return;
    }

    double startAngle = -math.pi / 2;
    const double gapAngle = 0.05; // radians gap between slices

    for (final segment in nonZeroSegments) {
      final sweepAngle = (segment.value / total) * 2 * math.pi;
      final effectiveSweep = math.max(0.01, sweepAngle - gapAngle);

      final paint = Paint()
        ..color = segment.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      final rect = Rect.fromCircle(center: center, radius: radius);
      canvas.drawArc(rect, startAngle + (gapAngle / 2), effectiveSweep, false, paint);

      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutChartPainter oldDelegate) {
    return oldDelegate.total != total || oldDelegate.segments != segments;
  }
}

class BemsAnalyticsChartCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final List<PieChartSegment> segments;
  final NumberFormat formatter;
  final String centerLabel;
  final String centerSublabel;
  final String? activeView;
  final ValueChanged<String>? onViewChanged;
  final List<String> viewOptions;
  final bool isCurrency;

  const BemsAnalyticsChartCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.segments,
    required this.formatter,
    required this.centerLabel,
    this.centerSublabel = 'TOTAL',
    this.activeView,
    this.onViewChanged,
    this.viewOptions = const ['Category', 'Status'],
    this.isCurrency = true,
  });

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<double>(0.0, (sum, s) => sum + s.value);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with Title & Optional Toggle
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFFEDD5)),
                    ),
                    child: Icon(icon, color: const Color(0xFFEA580C), size: 17),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        subtitle,
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
              ),
              if (onViewChanged != null && viewOptions.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: viewOptions.map((opt) {
                      final isSelected = activeView == opt;
                      return InkWell(
                        onTap: () => onViewChanged!(opt),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: isSelected ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: isSelected
                                ? [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1))]
                                : null,
                          ),
                          child: Text(
                            opt,
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                              color: isSelected ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 18),

          // Donut Chart + Legend Side-by-Side
          LayoutBuilder(
            builder: (context, constraints) {
              final isNarrow = constraints.maxWidth < 420;

              final chartWidget = BemsDonutChart(
                segments: segments,
                size: 130,
                strokeWidth: 18,
                centerLabel: centerLabel,
                centerSublabel: centerSublabel,
              );

              final legendWidget = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: segments.map((seg) {
                  final pct = total > 0 ? ((seg.value / total) * 100).round() : 0;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: seg.color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            seg.label,
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF334155),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          isCurrency ? formatter.format(seg.value) : '${seg.value.round()}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: seg.color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '$pct%',
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                              color: seg.color,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );

              if (isNarrow) {
                return Column(
                  children: [
                    Center(child: chartWidget),
                    const SizedBox(height: 16),
                    legendWidget,
                  ],
                );
              }

              return Row(
                children: [
                  chartWidget,
                  const SizedBox(width: 20),
                  Expanded(child: legendWidget),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
