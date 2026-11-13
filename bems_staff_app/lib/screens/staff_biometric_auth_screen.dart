import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/staff_models.dart';
import '../services/staff_biometric_service.dart';
import 'staff_module_gallery_screen.dart';
import 'staff_login_screen.dart';
import '../theme/subsidiary_theme.dart';

class StaffBiometricAuthScreen extends StatefulWidget {
  final StaffUser user;

  const StaffBiometricAuthScreen({
    super.key,
    required this.user,
  });

  @override
  State<StaffBiometricAuthScreen> createState() => _StaffBiometricAuthScreenState();
}

class _StaffBiometricAuthScreenState extends State<StaffBiometricAuthScreen>
    with SingleTickerProviderStateMixin {
  bool _isAuthenticating = false;
  bool _authSuccess = false;
  String? _statusMessage;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.94, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Automatically prompt device fingerprint on screen load
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _triggerBiometricVerification();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _triggerBiometricVerification() async {
    if (_isAuthenticating || _authSuccess) return;

    setState(() {
      _isAuthenticating = true;
      _statusMessage = 'Touch phone fingerprint sensor to unlock...';
    });
    HapticFeedback.lightImpact();

    final hasHardware = await StaffBiometricService.isHardwareAvailable();
    if (hasHardware) {
      final success = await StaffBiometricService.authenticateWithPhoneFingerprint(
        reason: 'Verify your fingerprint to access your Staff Workspace',
      );
      if (!mounted) return;

      if (success) {
        setState(() {
          _isAuthenticating = false;
          _authSuccess = true;
          _statusMessage = 'Fingerprint Verified · Welcome';
        });
        HapticFeedback.heavyImpact();
        await Future.delayed(const Duration(milliseconds: 300));
        _unlockApp();
      } else {
        setState(() {
          _isAuthenticating = false;
          _statusMessage = 'Fingerprint not recognized. Tap icon to retry.';
        });
      }
    } else {
      setState(() {
        _isAuthenticating = false;
        _statusMessage = 'Biometric sensor not available on this device.';
      });
    }
  }

  void _unlockApp() {
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
  }

  void _usePasswordInstead() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const StaffLoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final displayName = widget.user.fullName.isNotEmpty
        ? widget.user.fullName
        : widget.user.email.split('@').first;

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F5), // Cohesive warm ivory canvas
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: Column(
            children: [
              const Spacer(),

              // User Avatar & Greeting
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: SubsidiaryTheme.current.color,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: SubsidiaryTheme.current.color.withOpacity(0.2),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    displayName.isNotEmpty ? displayName[0].toUpperCase() : 'B',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Welcome, $displayName',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Text(
                  widget.user.jobTitle.isNotEmpty ? widget.user.jobTitle : 'STAFF',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: SubsidiaryTheme.current.color,
                  ),
                ),
              ),

              const SizedBox(height: 48),

              // Interactive Pulsing Fingerprint Sensor
              GestureDetector(
                onTap: _triggerBiometricVerification,
                child: ScaleTransition(
                  scale: _pulseAnimation,
                  child: Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _authSuccess
                          ? const Color(0xFF10B981).withOpacity(0.12)
                          : SubsidiaryTheme.current.color.withOpacity(0.06),
                      border: Border.all(
                        color: _authSuccess
                            ? const Color(0xFF10B981)
                            : SubsidiaryTheme.current.color.withOpacity(0.35),
                        width: 2.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: (_authSuccess
                                  ? const Color(0xFF10B981)
                                  : SubsidiaryTheme.current.color)
                              .withOpacity(0.14),
                          blurRadius: 24,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        _authSuccess
                            ? Icons.check_circle_rounded
                            : Icons.fingerprint_rounded,
                        size: 58,
                        color: _authSuccess
                            ? const Color(0xFF10B981)
                            : SubsidiaryTheme.current.color,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Status message
              Text(
                _statusMessage ?? 'Tap icon or touch phone sensor',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _authSuccess
                      ? const Color(0xFF059669)
                      : const Color(0xFF64748B),
                ),
              ),

              const Spacer(),

              // Switch to Password Button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _usePasswordInstead,
                  icon: const Icon(Icons.lock_outline_rounded, size: 18),
                  label: const Text(
                    'Use Password Instead',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0F172A),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
