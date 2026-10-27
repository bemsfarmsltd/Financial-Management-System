import 'dart:math' as math;
import 'package:flutter/material.dart';

class AccountabilitySlaGauge extends StatefulWidget {
  final int totalAdvances;
  final int retiredOnTime;
  final int inProgress;
  final int overdueCount;

  const AccountabilitySlaGauge({
    super.key,
    this.totalAdvances = 38,
    this.retiredOnTime = 32,
    this.inProgress = 4,
    this.overdueCount = 2,
  });

  @override
  State<AccountabilitySlaGauge> createState() => _AccountabilitySlaGaugeState();
}

class _AccountabilitySlaGaugeState extends State<AccountabilitySlaGauge> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.totalAdvances > 0 ? widget.totalAdvances : 1;
    final complianceRate = (widget.retiredOnTime / total) * 100;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Icon(Icons.timer_outlined, color: Color(0xFFD97706), size: 18),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'STAFF ADVANCE RECEIPTS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'Tracking receipts for money given to staff',
                        style: TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: widget.overdueCount > 0 ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: widget.overdueCount > 0 ? const Color(0xFFFECACA) : const Color(0xFFA7F3D0),
                  ),
                ),
                child: Text(
                  widget.overdueCount > 0 ? '${widget.overdueCount} LATE' : 'ALL RECEIPTS ON TIME',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: widget.overdueCount > 0 ? const Color(0xFFDC2626) : const Color(0xFF059669),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),

          Row(
            children: [
              // Gauge Chart
              SizedBox(
                width: 120,
                height: 120,
                child: AnimatedBuilder(
                  animation: _animation,
                  builder: (context, _) {
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        CustomPaint(
                          size: const Size(120, 120),
                          painter: _GaugeChartPainter(
                            onTimeShare: widget.retiredOnTime / total,
                            inProgressShare: widget.inProgress / total,
                            overdueShare: widget.overdueCount / total,
                            progress: _animation.value,
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${complianceRate.toStringAsFixed(0)}%',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const Text(
                              'ON-TIME RATE',
                              style: TextStyle(
                                fontSize: 8,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ),

              const SizedBox(width: 18),

              // Breakdown Pills
              Expanded(
                child: Column(
                  children: [
                    _buildStatusPill(
                      label: 'Receipts On-Time',
                      count: widget.retiredOnTime,
                      color: const Color(0xFF059669),
                      bgColor: const Color(0xFFECFDF5),
                    ),
                    const SizedBox(height: 8),
                    _buildStatusPill(
                      label: 'Within 3 Days (Safe)',
                      count: widget.inProgress,
                      color: const Color(0xFFD97706),
                      bgColor: const Color(0xFFFFFBEB),
                    ),
                    const SizedBox(height: 8),
                    _buildStatusPill(
                      label: 'Late With Receipts',
                      count: widget.overdueCount,
                      color: const Color(0xFFDC2626),
                      bgColor: const Color(0xFFFEF2F2),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill({
    required String label,
    required int count,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
              ),
            ],
          ),
          Text(
            '$count cases',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color),
          ),
        ],
      ),
    );
  }
}

class _GaugeChartPainter extends CustomPainter {
  final double onTimeShare;
  final double inProgressShare;
  final double overdueShare;
  final double progress;

  _GaugeChartPainter({
    required this.onTimeShare,
    required this.inProgressShare,
    required this.overdueShare,
    required this.progress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const strokeWidth = 14.0;
    final rect = Rect.fromCircle(center: center, radius: radius - (strokeWidth / 2));

    const totalAngle = 2 * math.pi;
    final animatedTotal = totalAngle * progress;

    double currentAngle = -math.pi / 2;

    void drawSegment(double share, Color color) {
      if (share <= 0) return;
      final sweep = share * animatedTotal;
      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(rect, currentAngle, sweep, false, paint);
      currentAngle += sweep;
    }

    drawSegment(onTimeShare, const Color(0xFF059669));
    drawSegment(inProgressShare, const Color(0xFFD97706));
    drawSegment(overdueShare, const Color(0xFFDC2626));
  }

  @override
  bool shouldRepaint(covariant _GaugeChartPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.onTimeShare != onTimeShare ||
        oldDelegate.inProgressShare != inProgressShare ||
        oldDelegate.overdueShare != overdueShare;
  }
}
