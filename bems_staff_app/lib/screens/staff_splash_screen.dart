import 'package:flutter/material.dart';
import '../services/staff_storage_service.dart';
import '../widgets/kinetic_torus_iris.dart';
import 'staff_login_screen.dart';
import 'staff_main_screen.dart';

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
    final user = await StaffStorageService.getUser();

    final elapsed = DateTime.now().difference(startTime);
    final remaining = const Duration(milliseconds: 3500) - elapsed;
    if (remaining > Duration.zero) {
      await Future.delayed(remaining);
    }

    if (!mounted) return;

    final nextScreen = user != null ? StaffMainScreen(user: user) : const StaffLoginScreen();

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 600),
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
      backgroundColor: const Color(0xFFFBF9F5),
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              KineticTorusIris(size: irisSize.clamp(240.0, 320.0)),
              const SizedBox(height: 28),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'BEMS Staff · Operational Ledger Workspace',
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
