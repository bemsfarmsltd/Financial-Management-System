import 'package:flutter/material.dart';
import '../services/staff_api_service.dart';
import '../services/staff_storage_service.dart';
import 'staff_main_screen.dart';
import 'staff_register_screen.dart';
import 'staff_forgot_password_screen.dart';

class StaffLoginScreen extends StatefulWidget {
  const StaffLoginScreen({super.key});

  @override
  State<StaffLoginScreen> createState() => _StaffLoginScreenState();
}

class _StaffLoginScreenState extends State<StaffLoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin({String? overrideEmail}) async {
    final email = (overrideEmail ?? _emailController.text).trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Please enter your corporate email address.');
      return;
    }
    if (password.isEmpty) {
      setState(() => _errorMessage = 'Please enter your password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final user = await StaffApiService.login(email: email, password: password);
      await StaffStorageService.saveUser(user);

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => StaffMainScreen(user: user)),
      );
    } catch (e) {
      final raw = e.toString().replaceAll('Exception: ', '');
      final friendly = raw.contains('SocketException') ||
              raw.contains('Failed host lookup') ||
              raw.contains('ClientException') ||
              raw.contains('errno = 7')
          ? 'Unable to reach servers. Please check your mobile data or Wi-Fi internet connection and try again.'
          : raw;
      setState(() => _errorMessage = friendly);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleBiometricAuth() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 24),
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: const Icon(Icons.fingerprint_rounded, size: 44, color: Color(0xFFEA580C)),
            ),
            const SizedBox(height: 16),
            const Text(
              'Biometric Authentication',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),
            const Text(
              'Confirm Touch ID / Face ID to verify your corporate identity and unlock the staff workspace.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  _handleLogin();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Verify Biometrics', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Brand Header
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFEA580C), Color(0xFFFB923C)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFEA580C).withOpacity(0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 36),
                  ),
                ),

                const SizedBox(height: 20),

                const Text(
                  'BEMS Staff Workspace',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.6,
                  ),
                ),

                const SizedBox(height: 6),

                const Text(
                  'Operational Fund Requisitions · 72h SLA Clearance',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),

                const SizedBox(height: 28),

                // Login Card
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_errorMessage != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFF87171)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Email Field
                      const Text(
                        'CORPORATE EMAIL',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
                          decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.mail_outline_rounded, color: Color(0xFF94A3B8), size: 18),
                            hintText: 'name@bemsfarms.com',
                            hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Password Field
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'PASSWORD',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8),
                          ),
                          InkWell(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const StaffForgotPasswordScreen()),
                              );
                            },
                            child: const Text(
                              'Forgot Password?',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: TextField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
                          decoration: InputDecoration(
                            prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF94A3B8), size: 18),
                            suffixIcon: IconButton(
                              icon: Icon(_obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: const Color(0xFF94A3B8), size: 18),
                              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                            ),
                            hintText: '••••••••',
                            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                        ),
                      ),

                      const SizedBox(height: 22),

                      // Sign In Button
                      ElevatedButton(
                        onPressed: _isLoading ? null : () => _handleLogin(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA580C),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 2,
                          shadowColor: const Color(0xFFEA580C).withOpacity(0.4),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'Sign In to Workspace',
                                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                              ),
                      ),

                      const SizedBox(height: 12),

                      // Biometric button
                      OutlinedButton.icon(
                        onPressed: _handleBiometricAuth,
                        icon: const Icon(Icons.fingerprint_rounded, size: 20, color: Color(0xFFEA580C)),
                        label: const Text('Quick Sign In with Biometrics', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Register Link Banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: const BoxDecoration(
                          color: Color(0xFFEFF6FF),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFF2563EB), size: 18),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('New Staff Member?', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                            Text('Create your profile to access requisitions.', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const StaffRegisterScreen()),
                          );
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFFEA580C),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                        child: const Text('Register', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
