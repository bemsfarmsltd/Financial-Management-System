import 'package:flutter/material.dart';
import '../services/staff_api_service.dart';
import '../services/staff_storage_service.dart';
import 'staff_main_screen.dart';

class StaffLoginScreen extends StatefulWidget {
  const StaffLoginScreen({super.key});

  @override
  State<StaffLoginScreen> createState() => _StaffLoginScreenState();
}

class _StaffLoginScreenState extends State<StaffLoginScreen> {
  final _emailController = TextEditingController(text: 'damilola@bemsfarms.com');
  final _passwordController = TextEditingController(text: '123456');
  bool _isLoading = false;
  String? _errorMessage;

  final List<Map<String, String>> _quickStaff = [
    {
      'name': 'Engr. Damilola Adeyemi',
      'email': 'damilola@bemsfarms.com',
      'role': 'Feed Operations Director',
      'subsidiary': 'BEMS Feed Mill Operations',
    },
    {
      'name': 'Musa Haruna',
      'email': 'haruna@bemsfarms.com',
      'role': 'Farm Irrigation Lead',
      'subsidiary': 'BEMS Farms Ltd',
    },
    {
      'name': 'Chinedu Eze',
      'email': 'chinedu@bemsfarms.com',
      'role': 'Fleet Coordinator',
      'subsidiary': 'BEMS Logistics & Haulage',
    },
  ];

  Future<void> _handleLogin({String? overrideEmail}) async {
    final email = (overrideEmail ?? _emailController.text).trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Please enter your corporate email.');
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
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF04060C),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.6),
            radius: 1.4,
            colors: [
              Color(0xFF381404),
              Color(0xFF140803),
              Color(0xFF04060C),
            ],
            stops: [0.0, 0.45, 1.0],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Icon / Logo
                  Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEA580C).withOpacity(0.18),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.4), width: 1.5),
                      ),
                      child: const Icon(Icons.badge_rounded, color: Color(0xFFFB923C), size: 30),
                    ),
                  ),

                  const SizedBox(height: 20),

                  const Text(
                    'BEMS Staff Workspace',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: -0.6,
                    ),
                  ),

                  const SizedBox(height: 6),

                  Text(
                    'Operational Fund Requests · 72h SLA Accountability',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.55)),
                  ),

                  const SizedBox(height: 32),

                  if (_errorMessage != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFDC2626).withOpacity(0.4)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(fontSize: 12, color: Color(0xFFFCA5A5)),
                      ),
                    ),

                  // Email Input
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: TextField(
                      controller: _emailController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.mail_outline_rounded, color: Colors.white54, size: 18),
                        hintText: 'Corporate Email',
                        hintStyle: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 13),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Password Input
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: TextField(
                      controller: _passwordController,
                      obscureText: true,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.lock_outline_rounded, color: Colors.white54, size: 18),
                        hintText: 'PIN or Password',
                        hintStyle: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 13),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Sign In Button
                  ElevatedButton(
                    onPressed: _isLoading ? null : () => _handleLogin(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text(
                            'Sign In to Staff Workspace',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                          ),
                  ),

                  const SizedBox(height: 32),

                  // Quick Demo Switcher
                  Row(
                    children: [
                      const Expanded(child: Divider(color: Colors.white12)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'OR QUICK SIGN-IN AS',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.1,
                            color: Colors.white.withOpacity(0.4),
                          ),
                        ),
                      ),
                      const Expanded(child: Divider(color: Colors.white12)),
                    ],
                  ),

                  const SizedBox(height: 16),

                  ..._quickStaff.map((staff) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        onTap: () {
                          _emailController.text = staff['email']!;
                          _handleLogin(overrideEmail: staff['email']);
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.04),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withOpacity(0.08)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEA580C).withOpacity(0.18),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    staff['name']![0],
                                    style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFFB923C)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      staff['name']!,
                                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white),
                                    ),
                                    Text(
                                      '${staff['role']} · ${staff['subsidiary']}',
                                      style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.45)),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.white38),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
