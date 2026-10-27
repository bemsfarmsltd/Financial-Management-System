import 'dart:async';
import 'package:flutter/material.dart';
import '../services/chat_storage_service.dart';
import '../widgets/kinetic_torus_iris.dart';
import 'login_screen.dart';
import 'welcome_entry_screen.dart';
import 'executive_home_screen.dart';
import 'biometric_auth_screen.dart';

class BemiSplashScreen extends StatefulWidget {
  const BemiSplashScreen({super.key});

  @override
  State<BemiSplashScreen> createState() => _BemiSplashScreenState();
}

class _BemiSplashScreenState extends State<BemiSplashScreen> {
  @override
  void initState() {
    super.initState();
    _bootstrapApp();
  }

  Future<void> _bootstrapApp() async {
    final startTime = DateTime.now();

    // 1. Resolve session and security configuration in background
    final user = await ChatStorageService.getUser();
    final hasSeenWelcome = await ChatStorageService.hasSeenWelcome();
    final isBioConfigured = await ChatStorageService.isBiometricConfigured();
    final isBioEnabled = await ChatStorageService.isBiometricEnabled();

    // 2. Guarantee a smooth 4.5s display duration
    final elapsed = DateTime.now().difference(startTime);
    final remaining = const Duration(milliseconds: 4500) - elapsed;
    if (remaining > Duration.zero) {
      await Future.delayed(remaining);
    }

    if (!mounted) return;

    Widget nextScreen;
    if (user == null) {
      nextScreen = const LoginScreen();
    } else if (isBioConfigured && isBioEnabled) {
      // Biometrics are configured: Always gate access with BiometricAuthScreen
      nextScreen = BiometricAuthScreen(userName: user.fullName);
    } else if (!hasSeenWelcome) {
      nextScreen = WelcomeEntryScreen(userName: user.fullName);
    } else {
      // Not configured: Pass showBiometricPrompt: true to prompt GMD immediately
      nextScreen = ExecutiveHomeScreen(
        userName: user.fullName,
        showBiometricPrompt: !isBioConfigured,
      );
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
      backgroundColor: const Color(0xFFFBF9F5), // Warm ivory matching kinetic iris aesthetic
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Moving kinetic iris graphic
              KineticTorusIris(
                size: irisSize.clamp(240.0, 320.0),
              ),

              const SizedBox(height: 28),

              // Short note under moving image
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'BEMi · Bems Enterprise Machine Intelligence',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: Color(0xFFEA580C),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
