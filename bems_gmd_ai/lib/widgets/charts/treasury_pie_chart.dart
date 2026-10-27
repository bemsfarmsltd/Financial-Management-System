import 'dart:math' as math;
import 'package:flutter/material.dart';

class BankShareData {
  final String bankName;
  final String accountNumber;
  final double amount;
  final Color color;

  const BankShareData({
    required this.bankName,
    required this.accountNumber,
    required this.amount,
    required this.color,
  });
}

class TreasuryPieChart extends StatefulWidget {
  final double totalBalance;
  final List<BankShareData> bankData;

  const TreasuryPieChart({
    super.key,
    required this.totalBalance,
    required this.bankData,
  });

  @override
  State<TreasuryPieChart> createState() => _TreasuryPieChartState();
}

class _TreasuryPieChartState extends State<TreasuryPieChart> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _animation;
  int? _hoveredIndex;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _animation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    );
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.bankData.fold<double>(0.0, (sum, item) => sum + item.amount);
    final effectiveTotal = total > 0 ? total : widget.totalBalance;

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
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFED7AA)),
                    ),
                    child: const Icon(Icons.pie_chart_rounded, color: Color(0xFFEA580C), size: 18),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MONEY IN BANKS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'Breakdown of cash across all accounts',
                        style: TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, size: 10, color: Color(0xFF059669)),
                    SizedBox(width: 4),
                    Text(
                      'ALL ACCOUNTS BALANCED',
                      style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFF059669)),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Donut Chart with Center Text
          Center(
            child: SizedBox(
              width: 190,
              height: 190,
              child: AnimatedBuilder(
                animation: _animation,
                builder: (context, _) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      CustomPaint(
                        size: const Size(190, 190),
                        painter: _DonutChartPainter(
                          bankData: widget.bankData,
                          total: effectiveTotal,
                          progress: _animation.value,
                          hoveredIndex: _hoveredIndex,
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'TOTAL CASH',
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _formatCompactCurrency(effectiveTotal),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            '3 Institutions',
                            style: TextStyle(
                              fontSize: 9.5,
                              color: Color(0xFF94A3B8),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ),

          const SizedBox(height: 22),

          // Bank breakdown legend items
          ...widget.bankData.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;
            final percent = effectiveTotal > 0 ? (item.amount / effectiveTotal) * 100 : 0.0;
            final isHovered = _hoveredIndex == idx;

            return MouseRegion(
              onEnter: (_) => setState(() => _hoveredIndex = idx),
              onExit: (_) => setState(() => _hoveredIndex = null),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isHovered ? const Color(0xFFF8FAFC) : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isHovered ? const Color(0xFFE2E8F0) : Colors.transparent,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: item.color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.bankName,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              item.accountNumber,
                              style: const TextStyle(
                                fontSize: 9.5,
                                fontFamily: 'monospace',
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Text(
                          _formatCurrency(item.amount),
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: item.color.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${percent.toStringAsFixed(1)}%',
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              color: item.color,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  String _formatCurrency(double amount) {
    if (amount >= 1000000) {
      return '₦${(amount / 1000000).toStringAsFixed(1)}M';
    }
    return '₦${amount.toStringAsFixed(0)}';
  }

  String _formatCompactCurrency(double amount) {
    if (amount >= 1000000) {
      return '₦${(amount / 1000000).toStringAsFixed(1)}M';
    }
    return '₦${amount.toStringAsFixed(0)}';
  }
}

class _DonutChartPainter extends CustomPainter {
  final List<BankShareData> bankData;
  final double total;
  final double progress;
  final int? hoveredIndex;

  _DonutChartPainter({
    required this.bankData,
    required this.total,
    required this.progress,
    this.hoveredIndex,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (total <= 0) return;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const strokeWidth = 24.0;
    const gapAngle = 0.04; // slight gap between segments

    final totalRadians = 2 * math.pi * progress;
    double currentAngle = -math.pi / 2; // start from top

    for (int i = 0; i < bankData.length; i++) {
      final item = bankData[i];
      final sweepAngle = (item.amount / total) * totalRadians;
      final isHovered = hoveredIndex == i;

      final paint = Paint()
        ..color = item.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = isHovered ? strokeWidth + 4 : strokeWidth
        ..strokeCap = StrokeCap.round;

      final arcRect = Rect.fromCircle(
        center: center,
        radius: isHovered ? radius - (strokeWidth / 2) + 2 : radius - (strokeWidth / 2),
      );

      final adjustedSweep = math.max(0.0, sweepAngle - gapAngle);
      canvas.drawArc(arcRect, currentAngle + (gapAngle / 2), adjustedSweep, false, paint);
      currentAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutChartPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.hoveredIndex != hoveredIndex ||
        oldDelegate.total != total;
  }
}
