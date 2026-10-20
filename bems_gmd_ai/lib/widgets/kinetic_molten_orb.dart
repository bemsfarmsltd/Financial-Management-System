import 'dart:math' as math;
import 'package:flutter/material.dart';

class KineticMoltenOrb extends StatefulWidget {
  final double size;
  final bool isListening;
  final bool isSpeaking;

  const KineticMoltenOrb({
    super.key,
    this.size = 220,
    this.isListening = false,
    this.isSpeaking = false,
  });

  @override
  State<KineticMoltenOrb> createState() => _KineticMoltenOrbState();
}

class _KineticMoltenOrbState extends State<KineticMoltenOrb> with TickerProviderStateMixin {
  late AnimationController _rotationController;
  late AnimationController _pulseController;
  late AnimationController _waveController;

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);

    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
  }

  @override
  void dispose() {
    _rotationController.dispose();
    _pulseController.dispose();
    _waveController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_rotationController, _pulseController, _waveController]),
      builder: (context, child) {
        final double pulse = _pulseController.value;
        final double rotation = _rotationController.value * 2 * math.pi;
        final double wave = _waveController.value;

        return SizedBox(
          width: widget.size * 1.5,
          height: widget.size * 1.5,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 1. Concentric Acoustic Waves when listening/speaking
              if (widget.isListening || widget.isSpeaking) ...[
                _buildAcousticRing(wave, 0.0),
                _buildAcousticRing((wave + 0.33) % 1.0, 0.33),
                _buildAcousticRing((wave + 0.66) % 1.0, 0.66),
              ],

              // 2. Deep Ambient Atmospheric Glow
              Container(
                width: widget.size * (1.2 + pulse * 0.1),
                height: widget.size * (1.2 + pulse * 0.1),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEA580C).withOpacity(0.35 + (widget.isSpeaking ? 0.2 : 0)),
                      blurRadius: 80,
                      spreadRadius: 20,
                    ),
                    BoxShadow(
                      color: const Color(0xFFF97316).withOpacity(0.2),
                      blurRadius: 120,
                      spreadRadius: 40,
                    ),
                  ],
                ),
              ),

              // 3. The 3D Molten Amber Core Painter
              CustomPaint(
                size: Size(widget.size, widget.size),
                painter: _MoltenOrbPainter(
                  rotation: rotation,
                  pulse: pulse,
                  isListening: widget.isListening,
                  isSpeaking: widget.isSpeaking,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAcousticRing(double progress, double offset) {
    final double radius = widget.size * 0.5 + progress * (widget.size * 0.5);
    final double opacity = (1.0 - progress).clamp(0.0, 0.6);

    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: const Color(0xFFF97316).withOpacity(opacity),
          width: 1.5,
        ),
      ),
    );
  }
}

class _MoltenOrbPainter extends CustomPainter {
  final double rotation;
  final double pulse;
  final bool isListening;
  final bool isSpeaking;

  _MoltenOrbPainter({
    required this.rotation,
    required this.pulse,
    required this.isListening,
    required this.isSpeaking,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 * (0.94 + pulse * 0.06);

    // Focal point moves gently along an elliptical orbit
    final focalOffset = Offset(
      center.dx + math.cos(rotation) * (radius * 0.35),
      center.dy + math.sin(rotation) * (radius * 0.25),
    );

    // Layer 1: Core 3D Spherical Radial Gradient
    final spherePaint = Paint()
      ..shader = RadialGradient(
        center: Alignment(
          (focalOffset.dx - center.dx) / radius,
          (focalOffset.dy - center.dy) / radius,
        ),
        radius: 0.95,
        colors: const [
          Color(0xFFFFF7ED), // Molten white-hot core
          Color(0xFFFED7AA), // Light peach
          Color(0xFFFB923C), // Amber-orange
          Color(0xFFEA580C), // Deep burnt orange
          Color(0xFF9A3412), // Deep shadow rust
          Color(0xFF431407), // Rim occlusion
        ],
        stops: const [0.0, 0.15, 0.40, 0.65, 0.85, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, spherePaint);

    // Layer 2: Plasma swirl / Internal light vortex
    final swirlPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment(
          math.cos(rotation * 1.5) * 0.2,
          math.sin(rotation * 1.5) * 0.2,
        ),
        startAngle: rotation,
        endAngle: rotation + math.pi * 2,
        colors: [
          Colors.transparent,
          const Color(0xFFF97316).withOpacity(0.35),
          Colors.transparent,
          const Color(0xFFFED7AA).withOpacity(0.45),
          Colors.transparent,
        ],
        stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..blendMode = BlendMode.screen;

    canvas.drawCircle(center, radius * 0.98, swirlPaint);

    // Layer 3: Glass Rim specular reflection
    final rimPaint = Paint()
      ..shader = RadialGradient(
        center: Alignment.topCenter,
        radius: 1.0,
        colors: [
          Colors.white.withOpacity(0.4),
          Colors.white.withOpacity(0.0),
        ],
        stops: const [0.0, 0.6],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..maskFilter = const MaskFilter.blur(BlurStyle.inner, 4);

    canvas.drawCircle(center, radius, rimPaint);
  }

  @override
  bool shouldRepaint(covariant _MoltenOrbPainter oldDelegate) {
    return oldDelegate.rotation != rotation ||
        oldDelegate.pulse != pulse ||
        oldDelegate.isListening != isListening ||
        oldDelegate.isSpeaking != isSpeaking;
  }
}
