import 'dart:async';
import 'package:flutter/material.dart';
import '../services/chat_storage_service.dart';
import '../widgets/kinetic_torus_iris.dart';
import 'login_screen.dart';
import 'welcome_entry_screen.dart';
import 'executive_home_screen.dart';

class BemiSplashScreen extends StatefulWidget {
  const BemiSplashScreen({super.key});

  @override
  State<BemiSplashScreen> createState() => _BemiSplashScreenState();
}

class _BemiSplashScreenState extends State<BemiSplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _bootstrapApp();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _bootstrapApp() async {
    final startTime = DateTime.now();

    // 1. Resolve session in background
    final user = await ChatStorageService.getUser();
    final hasSeenWelcome = await ChatStorageService.hasSeenWelcome();

    // 2. Guarantee a smooth 2.2s minimum display for cinematic splash feel
    final elapsed = DateTime.now().difference(startTime);
    final remaining = const Duration(milliseconds: 2200) - elapsed;
    if (remaining > Duration.zero) {
      await Future.delayed(remaining);
    }

    if (!mounted) return;

    Widget nextScreen;
    if (user == null) {
      nextScreen = const LoginScreen();
    } else if (!hasSeenWelcome) {
      nextScreen = WelcomeEntryScreen(userName: user.fullName);
    } else {
      nextScreen = ExecutiveHomeScreen(userName: user.fullName);
    }

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 700),
        pageBuilder: (context, animation, secondaryAnimation) => nextScreen,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final irisSize = MediaQuery.of(context).size.width * 0.72;

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F5), // Warm ivory matching screenshot
      body: SafeArea(
        child: Column(
          children: [
            // Top minimal header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Color(0xFFEA580C),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'BEMi · AUTONOMOUS LEDGER GOVERNANCE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                  const Text(
                    'BEMS Group',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF334155),
                    ),
                  ),
                ],
              ),
            ),

            const Spacer(),

            // Centered Kinetic Iris Graphic
            Center(
              child: KineticTorusIris(
                size: irisSize.clamp(240.0, 320.0),
              ),
            ),

            const SizedBox(height: 32),

            // Brand Typography
            const Text(
              'BEMi',
              style: TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.w900,
                letterSpacing: -1.2,
                color: Color(0xFF0F172A),
              ),
            ),

            const SizedBox(height: 6),

            const Text(
              'Bems Enterprise Machine Intelligence',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: Color(0xFFEA580C),
              ),
            ),

            const SizedBox(height: 24),

            // Pulsing Status Pill
            AnimatedBuilder(
              animation: _pulseAnimation,
              builder: (context, child) {
                return Opacity(
                  opacity: _pulseAnimation.value,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEA580C).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFFEA580C).withOpacity(0.25),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: Color(0xFFEA580C),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'INITIALIZING LEDGER INTELLIGENCE',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                            color: Color(0xFFC2410C),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

            const Spacer(),

            // Footer
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'BEMS Group · Executive Governance',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  Text(
                    'Enterprise Command Cockpit',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
