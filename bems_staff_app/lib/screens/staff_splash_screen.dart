import 'package:flutter/material.dart';
import '../services/staff_api_service.dart';
import '../services/staff_storage_service.dart';
import '../widgets/kinetic_torus_iris.dart';
import 'staff_login_screen.dart';
import 'staff_main_screen.dart';
import 'staff_biometric_auth_screen.dart';
import 'app_upgrade_screen.dart';
import 'staff_onboarding_carousel_screen.dart';

class StaffSplashScreen extends StatefulWidget {
  const StaffSplashScreen({super.key});

  @override
  State<StaffSplashScreen> createState() => _StaffSplashScreenState();
}

class _StaffSplashScreenState extends State<StaffSplashScreen> {
  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final startTime = DateTime.now();
    final gateFuture = StaffApiService.checkVersionGate();
    final user = await StaffStorageService.getUser();
    final hasSeenOnboarding = await StaffStorageService.hasSeenOnboardingCarousel();
    final isBioConfigured = await StaffStorageService.isBiometricConfigured();
    final isBioEnabled = await StaffStorageService.isBiometricEnabled();

    bool isSessionValid = false;
    if (user != null) {
      if (user.token.isNotEmpty) {
        StaffApiService.sessionToken = user.token;
      }
      isSessionValid = await StaffApiService.verifySession(user);
      if (!isSessionValid) {
        await StaffStorageService.clearUser();
      }
    }

    final gateInfo = await gateFuture;

    final elapsed = DateTime.now().difference(startTime);
    final remaining = const Duration(milliseconds: 3200) - elapsed;
    if (remaining > Duration.zero) {
      await Future.delayed(remaining);
    }

    if (!mounted) return;

    Widget nextScreen;
    if (gateInfo != null && gateInfo['upgradeRequired'] == true) {
      nextScreen = StaffAppUpgradeScreen(
        currentVersion: StaffApiService.appVersion,
        requiredVersion: gateInfo['minimumAllowedVersion']?.toString() ?? '1.0.0',
        downloadUrl: gateInfo['directDownloadUrl']?.toString() ?? 'https://bemserp.work/download/staff-app.apk',
        notes: gateInfo['upgradePromptNotes']?.toString() ?? 'A critical update is required to continue.',
      );
    } else {
      final Widget postOnboardingScreen;
      if (user == null || !isSessionValid) {
        postOnboardingScreen = const StaffLoginScreen();
      } else if (isBioConfigured && isBioEnabled) {
        postOnboardingScreen = StaffBiometricAuthScreen(user: user);
      } else {
        postOnboardingScreen = StaffMainScreen(user: user);
      }

      if (!hasSeenOnboarding) {
        nextScreen = StaffOnboardingCarouselScreen(nextScreen: postOnboardingScreen);
      } else {
        nextScreen = postOnboardingScreen;
      }
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
    final irisSize = MediaQuery.of(context).size.width * 0.76;

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F5), // Warm ivory matching kinetic iris aesthetic
      body: SafeArea(
        child: Center(
          child: KineticTorusIris(size: irisSize.clamp(260.0, 360.0)),
        ),
      ),
    );
  }
}
