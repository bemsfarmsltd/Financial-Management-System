import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/constants.dart';

class HeroAccountabilityCard extends StatelessWidget {
  final double activeAdvance;
  final double disbursedMtd;
  final double pendingReview;
  final String complianceMessage;
  final VoidCallback onRetireTap;

  const HeroAccountabilityCard({
    super.key,
    required this.activeAdvance,
    required this.disbursedMtd,
    required this.pendingReview,
    this.complianceMessage = 'Your advance retirement is due in 24 hours.',
    required this.onRetireTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Title from Image 1: "You are on Top of your Finances"
        const Text(
          'You are on Top',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: BemsTheme.textPrimary,
            letterSpacing: -0.6,
            height: 1.1,
          ),
        ),
        const Text(
          'of your Requests',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: BemsTheme.textSecondary,
            letterSpacing: -0.6,
          ),
        ),
        const SizedBox(height: 14),

        // Main White Card with Balance & Trend curve
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: BemsTheme.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: BemsTheme.cardBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Active Advance',
                        style: TextStyle(fontSize: 12, color: BemsTheme.textSecondary, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        AppConstants.formatNaira(activeAdvance),
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: BemsTheme.textPrimary,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                  // SLA Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: BemsTheme.warningAmber.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: BemsTheme.warningAmber.withOpacity(0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.hourglass_bottom_rounded, size: 13, color: BemsTheme.warningAmber),
                        SizedBox(width: 4),
                        Text(
                          '72h SLA',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: BemsTheme.warningAmber),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Visual trend track (custom painter style curve)
              SizedBox(
                height: 48,
                child: CustomPaint(
                  size: const Size(double.infinity, 48),
                  painter: _TrendChartPainter(),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Side-by-side sub-cards: Income/Expense style from Image 1
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: BemsTheme.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: BemsTheme.cardBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('Disbursed MTD', style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary, fontWeight: FontWeight.w500)),
                        Icon(Icons.arrow_outward_rounded, size: 16, color: BemsTheme.successEmerald),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      AppConstants.formatNaira(disbursedMtd),
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: BemsTheme.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: BemsTheme.cardBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('Under Review', style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary, fontWeight: FontWeight.w500)),
                        Icon(Icons.schedule_rounded, size: 16, color: BemsTheme.primaryCobalt),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      AppConstants.formatNaira(pendingReview),
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // "Your Activity" notice banner from Image 1
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: BemsTheme.brandOrangeSubtle, // Soft warm orange cream
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: BemsTheme.brandOrangeBorder),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(
                  color: BemsTheme.brandOrange,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.receipt_long_rounded, size: 14, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  complianceMessage,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF9A3412)),
                ),
              ),
              GestureDetector(
                onTap: onRetireTap,
                child: const Text(
                  'Retire →',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BemsTheme.brandOrangeDark),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TrendChartPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = BemsTheme.primaryCobalt
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;

    final path = Path();
    path.moveTo(0, size.height * 0.7);
    path.cubicTo(
      size.width * 0.25, size.height * 0.85,
      size.width * 0.45, size.height * 0.2,
      size.width * 0.65, size.height * 0.4,
    );
    path.cubicTo(
      size.width * 0.8, size.height * 0.55,
      size.width * 0.9, size.height * 0.1,
      size.width, size.height * 0.2,
    );
    canvas.drawPath(path, paint);

    // Active marker dot
    final dotPaint = Paint()..color = BemsTheme.primaryCobalt;
    final dotOuter = Paint()
      ..color = BemsTheme.primaryCobalt.withOpacity(0.2)
      ..style = PaintingStyle.fill;

    const dotOffset = Offset(170, 18);
    canvas.drawCircle(dotOffset, 8, dotOuter);
    canvas.drawCircle(dotOffset, 4, dotPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
