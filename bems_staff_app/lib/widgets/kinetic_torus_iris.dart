import 'dart:math' as math;
import 'package:flutter/material.dart';

class KineticTorusIris extends StatefulWidget {
  final double size;

  const KineticTorusIris({
    super.key,
    this.size = 280,
  });

  @override
  State<KineticTorusIris> createState() => _KineticTorusIrisState();
}

class _KineticTorusIrisState extends State<KineticTorusIris>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          size: Size(widget.size, widget.size),
          painter: _TorusIrisPainter(progress: _controller.value),
        );
      },
    );
  }
}

class _FinData {
  final double x1;
  final double y1;
  final double x2;
  final double y2;
  final double depth;
  final Color color;
  final double strokeWidth;

  _FinData({
    required this.x1,
    required this.y1,
    required this.x2,
    required this.y2,
    required this.depth,
    required this.color,
    required this.strokeWidth,
  });
}

class _TorusIrisPainter extends CustomPainter {
  final double progress;

  _TorusIrisPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final centerX = size.width / 2;
    final centerY = size.height / 2;
    final majorRadius = size.width * 0.33;
    final minorRadius = size.width * 0.12;
    final angleOffset = progress * math.pi * 2;
    const totalFins = 160;

    // 1. Draw central glowing iris aura
    final centralAuraPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFFFDE68A).withOpacity(0.55),
          const Color(0xFFFDBA74).withOpacity(0.35),
          const Color(0xFFFB923C).withOpacity(0.12),
          Colors.transparent,
        ],
        stops: const [0.0, 0.35, 0.7, 1.0],
      ).createShader(Rect.fromCircle(
        center: Offset(centerX, centerY),
        radius: majorRadius * 0.85,
      ));

    canvas.drawCircle(Offset(centerX, centerY), majorRadius * 0.85, centralAuraPaint);

    // 2. Generate 3D mobius fins
    final List<_FinData> fins = [];

    for (int i = 0; i < totalFins; i++) {
      final u = (i / totalFins) * math.pi * 2;
      final twist = u * 1.5 + angleOffset;

      // Position on the elliptic ring
      final rx = majorRadius * math.cos(u + angleOffset * 0.45);
      final ry = majorRadius * math.sin(u + angleOffset * 0.45) * 0.88;

      // 3D fin vector
      final dx = math.cos(twist) * minorRadius;
      final dy = math.sin(twist) * minorRadius * 0.65;
      final depth = math.sin(twist);

      final x1 = centerX + rx - dx;
      final y1 = centerY + ry - dy;
      final x2 = centerX + rx + dx;
      final y2 = centerY + ry + dy;

      // Color split matching screenshot:
      // Half ring in dark slate/charcoal (#475569), half in vibrant molten orange (#EA580C)
      final normPos = (u + angleOffset * 0.45) % (math.pi * 2);
      final isOrange = normPos >= 0.7 && normPos <= 3.8;

      Color finColor;
      if (isOrange) {
        finColor = const Color(0xFFEA580C);
      } else {
        finColor = const Color(0xFF475569);
      }

      // Add alpha & depth styling
      final alpha = ((depth + 1.2) / 2.2).clamp(0.25, 0.95);
      final strokeW = depth > 0 ? 1.4 : 0.9;

      fins.add(_FinData(
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        depth: depth,
        color: finColor.withOpacity(alpha),
        strokeWidth: strokeW,
      ));
    }

    // 3. Sort back to front (painter's algorithm)
    fins.sort((a, b) => a.depth.compareTo(b.depth));

    // 4. Render fins
    final paint = Paint()
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (final fin in fins) {
      paint.color = fin.color;
      paint.strokeWidth = fin.strokeWidth;
      canvas.drawLine(Offset(fin.x1, fin.y1), Offset(fin.x2, fin.y2), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _TorusIrisPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
