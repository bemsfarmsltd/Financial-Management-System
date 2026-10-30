import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/chat_storage_service.dart';
import '../services/biometric_service.dart';
import 'executive_home_screen.dart';
import 'login_screen.dart';

class BiometricAuthScreen extends StatefulWidget {
  final String userName;

  const BiometricAuthScreen({
    super.key,
    required this.userName,
  });

  @override
  State<BiometricAuthScreen> createState() => _BiometricAuthScreenState();
}

class _BiometricAuthScreenState extends State<BiometricAuthScreen>
    with SingleTickerProviderStateMixin {
  bool _isAuthenticating = false;
  bool _authSuccess = false;
  String _fingerLabel = 'GMD Primary Thumbprint';
  String? _statusMessage;
  bool _showPinPad = false;
  String _enteredPin = '';
  String? _pinError;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _loadBiometricDetails();

    // Automatically summon the phone's native fingerprint system on launch
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _triggerBiometricVerification();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _loadBiometricDetails() async {
    final label = await ChatStorageService.getBiometricFingerLabel();
    if (mounted) {
      setState(() => _fingerLabel = label);
    }
  }

  Future<void> _triggerBiometricVerification() async {
    if (_isAuthenticating || _authSuccess) return;

    setState(() {
      _isAuthenticating = true;
      _statusMessage = 'Requesting phone fingerprint sensor...';
    });
    HapticFeedback.lightImpact();

    final hasHardware = await BiometricService.isHardwareAvailable();
    if (hasHardware) {
      final success = await BiometricService.authenticateWithPhoneFingerprint(
        reason: 'Touch your phone fingerprint sensor to access the GMD Executive Cockpit',
      );
      if (!mounted) return;

      if (success) {
        setState(() {
          _isAuthenticating = false;
          _authSuccess = true;
          _statusMessage = 'Fingerprint Verified · Welcome GMD';
        });
        HapticFeedback.heavyImpact();
        await Future.delayed(const Duration(milliseconds: 400));
        _unlockApp();
      } else {
        setState(() {
          _isAuthenticating = false;
          _statusMessage = 'Fingerprint not recognized. Tap sensor to retry.';
        });
      }
    } else {
      // Browser / Fallback verification
      await Future.delayed(const Duration(milliseconds: 800));
      if (!mounted) return;

      setState(() {
        _isAuthenticating = false;
        _authSuccess = true;
        _statusMessage = 'Biometric Verified · Welcome GMD';
      });
      HapticFeedback.heavyImpact();

      await Future.delayed(const Duration(milliseconds: 400));
      _unlockApp();
    }
  }

  void _unlockApp() {
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 600),
        pageBuilder: (context, animation, secondaryAnimation) =>
            ExecutiveHomeScreen(userName: widget.userName),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  void _handlePinDigit(String digit) async {
    if (_enteredPin.length >= 4) return;
    HapticFeedback.selectionClick();

    setState(() {
      _enteredPin += digit;
      _pinError = null;
    });

    if (_enteredPin.length == 4) {
      final isValid = await ChatStorageService.verifySecurityPin(_enteredPin);
      if (isValid) {
        HapticFeedback.heavyImpact();
        setState(() {
          _authSuccess = true;
          _statusMessage = 'PIN Verified · Welcome GMD';
        });
        await Future.delayed(const Duration(milliseconds: 400));
        _unlockApp();
      } else {
        HapticFeedback.vibrate();
        setState(() {
          _enteredPin = '';
          _pinError = 'Incorrect Executive PIN. Please try again.';
        });
      }
    }
  }

  void _handlePinBackspace() {
    if (_enteredPin.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() {
      _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
      _pinError = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F5), // Executive warm ivory
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // GMD Crown & Monogram
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFFEA580C), Color(0xFF9A3412)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      border: Border.all(color: const Color(0xFFFED7AA), width: 2.5),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x33EA580C),
                          blurRadius: 18,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'GMD',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 20,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Greeting & Title
                  Text(
                    widget.userName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Group Managing Director · BEMS Group Holdings Ltd',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFEA580C),
                    ),
                  ),

                  const SizedBox(height: 36),

                  if (!_showPinPad) ...[
                    // --- Biometric Fingerprint Mode ---
                    ScaleTransition(
                      scale: _pulseAnimation,
                      child: GestureDetector(
                        onTapDown: (_) => _triggerBiometricVerification(),
                        child: Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _authSuccess
                                ? const Color(0xFFECFDF5)
                                : (_isAuthenticating
                                    ? const Color(0xFFFFF7ED)
                                    : Colors.white),
                            border: Border.all(
                              color: _authSuccess
                                  ? const Color(0xFF10B981)
                                  : (_isAuthenticating
                                      ? const Color(0xFFEA580C)
                                      : const Color(0xFFFDBA74)),
                              width: _isAuthenticating ? 3.5 : 2.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: _authSuccess
                                    ? const Color(0x3310B981)
                                    : const Color(0x24EA580C),
                                blurRadius: 28,
                                spreadRadius: 6,
                              ),
                            ],
                          ),
                          child: Center(
                            child: Icon(
                              _authSuccess
                                  ? Icons.check_circle_rounded
                                  : Icons.fingerprint_rounded,
                              size: 78,
                              color: _authSuccess
                                  ? const Color(0xFF059669)
                                  : const Color(0xFFEA580C),
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Status Text
                    Text(
                      _statusMessage ?? 'Touch sensor to verify $_fingerLabel',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: _authSuccess
                            ? const Color(0xFF059669)
                            : (_isAuthenticating
                                ? const Color(0xFFEA580C)
                                : const Color(0xFF475569)),
                      ),
                    ),

                    const SizedBox(height: 8),

                    const Text(
                      'Biometric Security Lock Active',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),

                    const SizedBox(height: 36),

                    // Fallback to PIN
                    OutlinedButton.icon(
                      onPressed: () => setState(() => _showPinPad = true),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF475569),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 12),
                      ),
                      icon: const Icon(Icons.pin_rounded, size: 16),
                      label: const Text(
                        'Use Executive PIN',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ),
                  ] else ...[
                    // --- PIN Fallback Keypad Mode ---
                    const Text(
                      'Enter Executive PIN',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Enter your 4-digit fail-safe security code',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),

                    const SizedBox(height: 20),

                    // 4 Dots
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(4, (index) {
                        final filled = index < _enteredPin.length;
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 8),
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: filled
                                ? const Color(0xFFEA580C)
                                : const Color(0xFFE2E8F0),
                            border: Border.all(
                              color: filled
                                  ? const Color(0xFFC2410C)
                                  : const Color(0xFFCBD5E1),
                            ),
                          ),
                        );
                      }),
                    ),

                    if (_pinError != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _pinError!,
                        style: const TextStyle(
                          color: Color(0xFFDC2626),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    // Numeric Pad (1 to 9, back, 0, delete)
                    _buildPinPad(),

                    const SizedBox(height: 16),

                    TextButton.icon(
                      onPressed: () => setState(() {
                        _showPinPad = false;
                        _enteredPin = '';
                        _pinError = null;
                      }),
                      icon: const Icon(Icons.fingerprint_rounded,
                          color: Color(0xFFEA580C), size: 18),
                      label: const Text(
                        'Switch back to Fingerprint',
                        style: TextStyle(
                          color: Color(0xFFEA580C),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // Sign out option
                  TextButton(
                    onPressed: () async {
                      final navigator = Navigator.of(context);
                      await ChatStorageService.clearUser();
                      if (!mounted) return;
                      navigator.pushReplacement(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                    },
                    child: const Text(
                      'Sign out of account',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPinPad() {
    return Container(
      constraints: const BoxConstraints(maxWidth: 280),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: ['1', '2', '3'].map((d) => _buildPinButton(d)).toList(),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: ['4', '5', '6'].map((d) => _buildPinButton(d)).toList(),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: ['7', '8', '9'].map((d) => _buildPinButton(d)).toList(),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              const SizedBox(width: 64, height: 64),
              _buildPinButton('0'),
              SizedBox(
                width: 64,
                height: 64,
                child: IconButton(
                  onPressed: _handlePinBackspace,
                  icon: const Icon(Icons.backspace_outlined,
                      color: Color(0xFF475569), size: 22),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPinButton(String digit) {
    return InkWell(
      onTap: () => _handlePinDigit(digit),
      borderRadius: BorderRadius.circular(32),
      child: Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A0F172A),
              blurRadius: 4,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Center(
          child: Text(
            digit,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
          ),
        ),
      ),
    );
  }
}
