import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/staff_models.dart';
import '../theme/subsidiary_theme.dart';
import 'staff_module_gallery_screen.dart';

class SubsidiaryWelcomeScreen extends StatefulWidget {
  final StaffUser user;

  const SubsidiaryWelcomeScreen({super.key, required this.user});

  @override
  State<SubsidiaryWelcomeScreen> createState() => _SubsidiaryWelcomeScreenState();
}

class _SubsidiaryWelcomeScreenState extends State<SubsidiaryWelcomeScreen>
    with TickerProviderStateMixin {
  late final AnimationController _wordController;
  late final AnimationController _orbitController;
  late final List<_ScatteredWordSpec> _wordSpecs;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    SubsidiaryTheme.applyUser(widget.user);

    final subName = widget.user.subsidiary.trim().isNotEmpty
        ? widget.user.subsidiary.trim()
        : SubsidiaryTheme.current.name;

    final rawWords = <String>[
      'Welcome',
      'to',
      'your',
      ...subName.split(RegExp(r'\s+')).where((w) => w.isNotEmpty),
      'Workspace',
    ];

    // Pre-compute deterministic, balanced scatter vectors around the center
    _wordSpecs = List.generate(rawWords.length, (i) {
      final isHighlighted = i >= 3 && i < rawWords.length - 1;
      final angleSeed = (i * 2.399963) + 0.45; // golden angle spread
      final radius = 95.0 + ((i % 3) * 42.0);
      final dx = math.cos(angleSeed) * radius;
      final dy = math.sin(angleSeed) * (radius * 0.78);
      final tilt = ((i % 2 == 0 ? 1 : -1) * (0.18 + (i % 4) * 0.07));
      final start = (i * 0.045).clamp(0.0, 0.45);
      final end = (start + 0.52).clamp(0.55, 1.0);
      return _ScatteredWordSpec(
        word: rawWords[i],
        highlighted: isHighlighted,
        offset: Offset(dx, dy),
        tiltRadians: tilt,
        start: start,
        end: end,
      );
    });

    _wordController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1450),
    );
    _orbitController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..forward();

    _wordController.forward();

    Future.delayed(const Duration(milliseconds: 2750), _goToModules);
  }

  void _goToModules() {
    if (!mounted || _navigated) return;
    _navigated = true;
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 480),
        pageBuilder: (_, __, ___) => StaffModuleGalleryScreen(user: widget.user),
        transitionsBuilder: (_, animation, __, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  void dispose() {
    _wordController.dispose();
    _orbitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brand = SubsidiaryTheme.current;
    final accent = brand.color;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: -90,
              right: -70,
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: accent.withOpacity(0.08),
                ),
              ),
            ),
            Positioned(
              bottom: -100,
              left: -80,
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: accent.withOpacity(0.06),
                ),
              ),
            ),
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Animated Logo Entrance
                    AnimatedBuilder(
                      animation: _wordController,
                      builder: (context, child) {
                        final t = Curves.easeOutBack.transform(
                          (_wordController.value * 1.4).clamp(0.0, 1.0),
                        );
                        return Transform.scale(
                          scale: 0.65 + (0.35 * t),
                          child: Opacity(
                            opacity: (_wordController.value * 2.2).clamp(0.0, 1.0),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: accent.withOpacity(0.07),
                                border: Border.all(
                                  color: accent.withOpacity(0.24),
                                  width: 1.5,
                                ),
                              ),
                              child: child,
                            ),
                          ),
                        );
                      },
                      child: const SubsidiaryLogoBadge(size: 88, borderRadius: 22),
                    ),

                    const SizedBox(height: 28),

                    // Scattered Words Flying Together into Aligned Headline
                    AnimatedBuilder(
                      animation: _wordController,
                      builder: (context, _) {
                        return Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 8,
                          runSpacing: 8,
                          children: _wordSpecs.map((spec) {
                            final rawProgress =
                                ((_wordController.value - spec.start) / (spec.end - spec.start))
                                    .clamp(0.0, 1.0);
                            final eased = Curves.easeOutBack.transform(rawProgress);
                            final fade = Curves.easeOut.transform(
                              (rawProgress * 1.35).clamp(0.0, 1.0),
                            );
                            final currentOffset = Offset(
                              spec.offset.dx * (1.0 - eased),
                              spec.offset.dy * (1.0 - eased),
                            );
                            final currentAngle = spec.tiltRadians * (1.0 - eased);
                            final currentScale = 0.52 + (0.48 * eased);

                            return Transform.translate(
                              offset: currentOffset,
                              child: Transform.rotate(
                                angle: currentAngle,
                                child: Transform.scale(
                                  scale: currentScale,
                                  child: Opacity(
                                    opacity: fade,
                                    child: Text(
                                      spec.word,
                                      style: TextStyle(
                                        fontSize: spec.highlighted ? 26 : 23,
                                        fontWeight: spec.highlighted
                                            ? FontWeight.w900
                                            : FontWeight.w800,
                                        color: spec.highlighted
                                            ? accent
                                            : const Color(0xFF0F172A),
                                        letterSpacing: -0.6,
                                        height: 1.15,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        );
                      },
                    ),

                    const SizedBox(height: 18),

                    AnimatedBuilder(
                      animation: _wordController,
                      builder: (context, child) {
                        final subFade = ((_wordController.value - 0.55) / 0.45).clamp(0.0, 1.0);
                        return Opacity(opacity: subFade, child: child);
                      },
                      child: Column(
                        children: [
                          Text(
                            widget.user.fullName.isNotEmpty
                                ? 'Signed in as ${widget.user.fullName}'
                                : 'Workspace Ready',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF475569),
                            ),
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: 160,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: AnimatedBuilder(
                                animation: _orbitController,
                                builder: (context, _) {
                                  return LinearProgressIndicator(
                                    value: Curves.easeInOut.transform(_orbitController.value),
                                    minHeight: 4,
                                    backgroundColor: const Color(0xFFE2E8F0),
                                    valueColor: AlwaysStoppedAnimation<Color>(accent),
                                  );
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScatteredWordSpec {
  final String word;
  final bool highlighted;
  final Offset offset;
  final double tiltRadians;
  final double start;
  final double end;

  const _ScatteredWordSpec({
    required this.word,
    required this.highlighted,
    required this.offset,
    required this.tiltRadians,
    required this.start,
    required this.end,
  });
}

