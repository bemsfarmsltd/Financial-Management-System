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
  late final AnimationController _entryController;
  late final AnimationController _pulseController;
  late final Animation<double> _logoScale;
  late final Animation<double> _fadeIn;
  late final Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    SubsidiaryTheme.applyUser(widget.user);

    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    );
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _logoScale = CurvedAnimation(
      parent: _entryController,
      curve: Curves.easeOutBack,
    );
    _fadeIn = CurvedAnimation(
      parent: _entryController,
      curve: const Interval(0.2, 1.0, curve: Curves.easeOut),
    );
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.14),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _entryController,
        curve: const Interval(0.18, 1.0, curve: Curves.easeOutCubic),
      ),
    );

    _entryController.forward();

    Future.delayed(const Duration(milliseconds: 2200), () {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 500),
          pageBuilder: (_, __, ___) => StaffModuleGalleryScreen(user: widget.user),
          transitionsBuilder: (_, animation, __, child) =>
              FadeTransition(opacity: animation, child: child),
        ),
      );
    });
  }

  @override
  void dispose() {
    _entryController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brand = SubsidiaryTheme.current;
    final subName = widget.user.subsidiary.trim().isNotEmpty
        ? widget.user.subsidiary.trim()
        : brand.name;
    final accent = brand.color;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Stack(
          children: [
            // Subtle top-right subsidiary tint glow
            Positioned(
              top: -80,
              right: -80,
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: accent.withOpacity(0.08),
                ),
              ),
            ),
            // Subtle bottom-left subsidiary tint glow
            Positioned(
              bottom: -90,
              left: -70,
              child: Container(
                width: 240,
                height: 240,
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
                    AnimatedBuilder(
                      animation: Listenable.merge([_entryController, _pulseController]),
                      builder: (context, child) {
                        final pulse = 1.0 + (_pulseController.value * 0.08);
                        return Transform.scale(
                          scale: _logoScale.value,
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: accent.withOpacity(0.08 * (2 - pulse)),
                              border: Border.all(
                                color: accent.withOpacity(0.22),
                                width: 1.5,
                              ),
                            ),
                            child: child,
                          ),
                        );
                      },
                      child: const SubsidiaryLogoBadge(size: 92, borderRadius: 24),
                    ),
                    const SizedBox(height: 28),
                    FadeTransition(
                      opacity: _fadeIn,
                      child: SlideTransition(
                        position: _slideUp,
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: accent.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: accent.withOpacity(0.25)),
                              ),
                              child: Text(
                                widget.user.employeeNumber.isNotEmpty
                                    ? 'VERIFIED · ${widget.user.employeeNumber}'
                                    : 'AUTHORIZED ACCESS',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.0,
                                  color: accent,
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Welcome to your\n$subName Workspace',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 25,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                                height: 1.22,
                                letterSpacing: -0.6,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Preparing your modules, requisitions, and attendance desk...',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 32),
                            SizedBox(
                              width: 140,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(99),
                                child: LinearProgressIndicator(
                                  minHeight: 4,
                                  backgroundColor: const Color(0xFFE2E8F0),
                                  valueColor: AlwaysStoppedAnimation<Color>(accent),
                                ),
                              ),
                            ),
                          ],
                        ),
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

