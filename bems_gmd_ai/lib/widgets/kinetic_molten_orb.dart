import 'dart:math' as math;
import 'package:flutter/material.dart';

class KineticMoltenOrb extends StatefulWidget {
  final double size;
  final bool isListening;
  final bool isSpeaking;
  final VoidCallback? onTap;

  const KineticMoltenOrb({
    super.key,
    this.size = 220,
    this.isListening = false,
    this.isSpeaking = false,
    this.onTap,
  });

  @override
  State<KineticMoltenOrb> createState() => _KineticMoltenOrbState();
}

class _KineticMoltenOrbState extends State<KineticMoltenOrb> with TickerProviderStateMixin {
  late AnimationController _rotationController;
  late AnimationController _pulseController;
  late AnimationController _waveController;
  late AnimationController _coronaController;

  Offset _touchOffset = Offset.zero;

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);

    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();

    _coronaController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..repeat();
  }

  @override
  void didUpdateWidget(covariant KineticMoltenOrb oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isSpeaking != oldWidget.isSpeaking) {
      if (widget.isSpeaking) {
        _pulseController.duration = const Duration(milliseconds: 900);
        _rotationController.duration = const Duration(seconds: 4);
      } else {
        _pulseController.duration = const Duration(milliseconds: 2200);
        _rotationController.duration = const Duration(seconds: 8);
      }
    }
  }

  @override
  void dispose() {
    _rotationController.dispose();
    _pulseController.dispose();
    _waveController.dispose();
    _coronaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onPanUpdate: (details) {
        setState(() {
          _touchOffset = Offset(
            (_touchOffset.dx + details.delta.dx * 0.4).clamp(-widget.size * 0.35, widget.size * 0.35),
            (_touchOffset.dy + details.delta.dy * 0.4).clamp(-widget.size * 0.35, widget.size * 0.35),
          );
        });
      },
      onPanEnd: (_) {
        setState(() {
          _touchOffset = Offset.zero;
        });
      },
      child: AnimatedBuilder(
        animation: Listenable.merge([_rotationController, _pulseController, _waveController, _coronaController]),
        builder: (context, child) {
          final double pulse = _pulseController.value;
          final double rotation = _rotationController.value * 2 * math.pi;
          final double wave = _waveController.value;
          final double corona = _coronaController.value * 2 * math.pi;

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

                // 2. Deep Radiant Ambient Atmospheric Glow
                Container(
                  width: widget.size * (1.25 + pulse * 0.12),
                  height: widget.size * (1.25 + pulse * 0.12),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFEA580C).withOpacity(0.4 + (widget.isSpeaking ? 0.25 : 0.05)),
                        blurRadius: 90,
                        spreadRadius: 24,
                      ),
                      BoxShadow(
                        color: const Color(0xFFF97316).withOpacity(0.25),
                        blurRadius: 140,
                        spreadRadius: 45,
                      ),
                      BoxShadow(
                        color: const Color(0xFFFED7AA).withOpacity(widget.isSpeaking ? 0.15 : 0.05),
                        blurRadius: 60,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                ),

                // 3. Corona Flare Filament Particles around perimeter
                CustomPaint(
                  size: Size(widget.size * 1.35, widget.size * 1.35),
                  painter: _CoronaFlarePainter(
                    coronaAngle: corona,
                    isSpeaking: widget.isSpeaking,
                    isListening: widget.isListening,
                  ),
                ),

                // 4. The 3D Molten Amber Core Painter
                CustomPaint(
                  size: Size(widget.size, widget.size),
                  painter: _MoltenOrbPainter(
                    rotation: rotation,
                    pulse: pulse,
                    isListening: widget.isListening,
                    isSpeaking: widget.isSpeaking,
                    touchOffset: _touchOffset,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildAcousticRing(double progress, double offset) {
    final double radius = widget.size * 0.48 + progress * (widget.size * 0.46);
    final double opacity = (1.0 - progress).clamp(0.0, 0.65);

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

class _CoronaFlarePainter extends CustomPainter {
  final double coronaAngle;
  final bool isSpeaking;
  final bool isListening;

  _CoronaFlarePainter({
    required this.coronaAngle,
    required this.isSpeaking,
    required this.isListening,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final baseRadius = size.width * 0.40;
    final particleCount = isSpeaking ? 16 : (isListening ? 10 : 6);

    final paint = Paint()
      ..color = const Color(0xFFFB923C).withOpacity(isSpeaking ? 0.45 : 0.25)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);

    for (int i = 0; i < particleCount; i++) {
      final angle = coronaAngle + (i * 2 * math.pi / particleCount);
      final r = baseRadius + math.sin(coronaAngle * 2 + i) * (isSpeaking ? 18.0 : 8.0);
      final x = center.dx + math.cos(angle) * r;
      final y = center.dy + math.sin(angle) * r;
      final pRadius = (i % 3 == 0) ? 2.8 : 1.8;

      canvas.drawCircle(Offset(x, y), pRadius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _CoronaFlarePainter oldDelegate) {
    return oldDelegate.coronaAngle != coronaAngle ||
        oldDelegate.isSpeaking != isSpeaking ||
        oldDelegate.isListening != isListening;
  }
}

class _MoltenOrbPainter extends CustomPainter {
  final double rotation;
  final double pulse;
  final bool isListening;
  final bool isSpeaking;
  final Offset touchOffset;

  _MoltenOrbPainter({
    required this.rotation,
    required this.pulse,
    required this.isListening,
    required this.isSpeaking,
    required this.touchOffset,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 * (0.94 + pulse * 0.06);

    // Focal point moves gently along an elliptical orbit + reacts to touch
    final focalOffset = Offset(
      center.dx + math.cos(rotation) * (radius * 0.35) + touchOffset.dx,
      center.dy + math.sin(rotation) * (radius * 0.25) + touchOffset.dy,
    );

    // Layer 1: Core 3D Spherical Radial Gradient
    final spherePaint = Paint()
      ..shader = RadialGradient(
        center: Alignment(
          ((focalOffset.dx - center.dx) / radius - 0.15).clamp(-0.8, 0.8),
          ((focalOffset.dy - center.dy) / radius - 0.15).clamp(-0.8, 0.8),
        ),
        radius: 1.05,
        colors: const [
          Color(0xFFFFF7ED), // Molten golden-white highlight
          Color(0xFFFED7AA), // Radiant peach
          Color(0xFFF97316), // Vivid molten amber
          Color(0xFFEA580C), // Deep fiery orange
          Color(0xFF9A3412), // Deep burnt terracotta
          Color(0xFF431407), // Shadow occlusion
          Color(0xFF1F0904), // Void rim
        ],
        stops: const [0.0, 0.12, 0.35, 0.60, 0.80, 0.94, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, spherePaint);

    // Layer 2: Plasma swirl / Internal fluid vortex
    final swirlPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment(
          math.cos(rotation * 1.2) * 0.25,
          math.sin(rotation * 1.2) * 0.25,
        ),
        startAngle: rotation,
        endAngle: rotation + math.pi * 2,
        colors: [
          Colors.transparent,
          const Color(0xFFF97316).withOpacity(0.4),
          Colors.transparent,
          const Color(0xFFFED7AA).withOpacity(0.55),
          Colors.transparent,
        ],
        stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..blendMode = BlendMode.screen;

    canvas.drawCircle(center, radius * 0.98, swirlPaint);

    // Layer 3: Specular top-left glare
    final glarePaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.4, -0.4),
        radius: 0.6,
        colors: [
          Colors.white.withOpacity(0.45),
          const Color(0xFFFED7AA).withOpacity(0.2),
          Colors.transparent,
        ],
        stops: const [0.0, 0.35, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius * 0.95, glarePaint);
  }

  @override
  bool shouldRepaint(covariant _MoltenOrbPainter oldDelegate) {
    return oldDelegate.rotation != rotation ||
        oldDelegate.pulse != pulse ||
        oldDelegate.isListening != isListening ||
        oldDelegate.isSpeaking != isSpeaking ||
        oldDelegate.touchOffset != touchOffset;
  }
}
