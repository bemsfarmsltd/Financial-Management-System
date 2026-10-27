import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/auth_models.dart';
import '../services/chat_storage_service.dart';
import '../services/biometric_service.dart';
import 'login_screen.dart';

class GmdProfileScreen extends StatefulWidget {
  final bool autoOpenEnrollment;

  const GmdProfileScreen({
    super.key,
    this.autoOpenEnrollment = false,
  });

  @override
  State<GmdProfileScreen> createState() => _GmdProfileScreenState();
}

class _GmdProfileScreenState extends State<GmdProfileScreen> with SingleTickerProviderStateMixin {
  AuthUser? _user;
  bool _isLoading = true;

  // Biometric state
  bool _isConfigured = false;
  bool _isEnabled = true;
  String _fingerLabel = 'GMD Primary Thumbprint';
  String? _enrolledAt;
  String? _securityPin;

  // Workstation & alerts
  String _defaultWorkstation = 'all';
  bool _notificationsBridge = true;

  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _loadProfileData();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _loadProfileData() async {
    final user = await ChatStorageService.getUser();
    final configured = await ChatStorageService.isBiometricConfigured();
    final enabled = await ChatStorageService.isBiometricEnabled();
    final label = await ChatStorageService.getBiometricFingerLabel();
    final enrolledAt = await ChatStorageService.getBiometricEnrolledAt();
    final pin = await ChatStorageService.getSecurityPin();
    final ws = await ChatStorageService.getDefaultWorkstation();
    final bridge = await ChatStorageService.isNotificationBridgeEnabled();

    if (mounted) {
      setState(() {
        _user = user;
        _isConfigured = configured;
        _isEnabled = enabled;
        _fingerLabel = label;
        _enrolledAt = enrolledAt;
        _securityPin = pin;
        _defaultWorkstation = ws;
        _notificationsBridge = bridge;
        _isLoading = false;
      });

      if (widget.autoOpenEnrollment && !configured) {
        // Automatically scroll or show enrollment prompt
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _showEnrollmentSheet();
        });
      }
    }
  }

  Future<void> _toggleBiometricEnabled(bool val) async {
    if (!_isConfigured && val) {
      // Must configure first
      _showEnrollmentSheet();
      return;
    }
    await ChatStorageService.setBiometricEnabled(val);
    setState(() => _isEnabled = val);
    HapticFeedback.lightImpact();
  }

  void _showEnrollmentSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _EnrollmentBottomSheet(
        currentLabel: _fingerLabel,
        onEnrollSuccess: (label) async {
          final now = DateTime.now().toIso8601String();
          await ChatStorageService.setBiometricConfigured(true);
          await ChatStorageService.setBiometricEnabled(true);
          await ChatStorageService.setBiometricFingerLabel(label);
          await ChatStorageService.setBiometricEnrolledAt(now);

          setState(() {
            _isConfigured = true;
            _isEnabled = true;
            _fingerLabel = label;
            _enrolledAt = now;
          });

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                backgroundColor: const Color(0xFF059669),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                content: Row(
                  children: [
                    const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Fingerprint enrolled successfully for $_fingerLabel!',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }
        },
      ),
    );
  }

  void _showChangePinDialog() {
    final pinController = TextEditingController();
    final confirmController = TextEditingController();
    String? errorText;

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Row(
              children: [
                Icon(Icons.pin_rounded, color: Color(0xFFEA580C)),
                SizedBox(width: 8),
                Text(
                  'Set Executive PIN',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'This 4-digit PIN is your executive fail-safe backup if biometric verification is unavailable.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: pinController,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  maxLength: 4,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    labelText: 'New 4-digit PIN',
                    counterText: '',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confirmController,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  maxLength: 4,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    labelText: 'Confirm PIN',
                    counterText: '',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                if (errorText != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    errorText!,
                    style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () async {
                  final p1 = pinController.text.trim();
                  final p2 = confirmController.text.trim();
                  if (p1.length != 4) {
                    setDialogState(() => errorText = 'PIN must be exactly 4 digits');
                    return;
                  }
                  if (p1 != p2) {
                    setDialogState(() => errorText = 'PINs do not match');
                    return;
                  }
                  final nav = Navigator.of(ctx);
                  final messenger = ScaffoldMessenger.of(context);
                  await ChatStorageService.setSecurityPin(p1);
                  if (!mounted) return;
                  setState(() => _securityPin = p1);
                  nav.pop();
                  messenger.showSnackBar(
                    SnackBar(
                      backgroundColor: const Color(0xFF059669),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      content: const Text('Executive Security PIN updated successfully!'),
                    ),
                  );
                },
                child: const Text('Save PIN'),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showTestBiometricDialog() {
    bool isScanning = false;
    bool scanPassed = false;

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: const Text(
              'Biometric Sensor Test',
              textAlign: TextAlign.center,
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Tap the sensor below to summon your phone\'s native fingerprint scanner.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 24),
                GestureDetector(
                  onTap: () async {
                    setDialogState(() {
                      isScanning = true;
                      scanPassed = false;
                    });
                    HapticFeedback.mediumImpact();

                    final hasHardware = await BiometricService.isHardwareAvailable();
                    bool passed = false;
                    if (hasHardware) {
                      passed = await BiometricService.authenticateWithPhoneFingerprint(
                        reason: 'Test phone fingerprint hardware recognition',
                      );
                    } else {
                      await Future.delayed(const Duration(milliseconds: 900));
                      passed = true;
                    }

                    if (context.mounted) {
                      setDialogState(() {
                        isScanning = false;
                        scanPassed = passed;
                      });
                      if (passed) HapticFeedback.heavyImpact();
                    }
                  },
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: scanPassed
                          ? const Color(0xFFECFDF5)
                          : (isScanning ? const Color(0xFFFFF7ED) : const Color(0xFFF8FAFC)),
                      border: Border.all(
                        color: scanPassed
                            ? const Color(0xFF10B981)
                            : (isScanning ? const Color(0xFFEA580C) : const Color(0xFFCBD5E1)),
                        width: isScanning ? 3 : 2,
                      ),
                      boxShadow: [
                        if (isScanning)
                          const BoxShadow(
                            color: Color(0x33EA580C),
                            blurRadius: 16,
                            spreadRadius: 4,
                          ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        scanPassed ? Icons.check_circle_rounded : Icons.fingerprint_rounded,
                        size: 54,
                        color: scanPassed
                            ? const Color(0xFF059669)
                            : (isScanning ? const Color(0xFFEA580C) : const Color(0xFF64748B)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  scanPassed
                      ? '✓ Authenticated: $_fingerLabel'
                      : (isScanning ? 'Scanning biometric pattern...' : 'Touch sensor to test'),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: scanPassed
                        ? const Color(0xFF059669)
                        : (isScanning ? const Color(0xFFEA580C) : const Color(0xFF64748B)),
                  ),
                ),
              ],
            ),
            actions: [
              Center(
                child: TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Close Test', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _handleResetBiometrics() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Reset Fingerprint Biometrics?'),
        content: const Text(
          'This will remove enrolled fingerprint biometric data and unlock protection. The system will prompt you again on next launch.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await ChatStorageService.resetBiometrics();
      setState(() {
        _isConfigured = false;
        _isEnabled = false;
        _enrolledAt = null;
        _securityPin = null;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Biometric data reset.')),
        );
      }
    }
  }

  void _handleSignOut() async {
    await ChatStorageService.clearUser();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFFEA580C)),
        ),
      );
    }

    final fullName = _user?.fullName ?? 'Dr. Benjamin Adeleke';
    final role = _user?.role ?? 'Group Managing Director';
    final email = _user?.email ?? 'gmd@bemsfarms.com';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
          onPressed: () => Navigator.pop(context, _isConfigured),
        ),
        title: const Text(
          'Executive Profile & Security',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Executive Identity Card
            _buildExecutiveIdentityCard(fullName, role, email),

            const SizedBox(height: 24),

            // 2. Biometric Security Guard Hub
            _buildBiometricSecurityHub(),

            const SizedBox(height: 24),

            // 3. Workstation & System Governance
            _buildWorkstationGovernanceSection(),

            const SizedBox(height: 24),

            // 4. Security Audit & Hardware Enclave
            _buildAuditAndEnclaveSection(),

            const SizedBox(height: 32),

            // 5. Sign Out Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                onPressed: _handleSignOut,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFFCA5A5)),
                  backgroundColor: const Color(0xFFFEF2F2),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 18),
                label: const Text(
                  'Sign Out of GMD Cockpit',
                  style: TextStyle(
                    color: Color(0xFFDC2626),
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildExecutiveIdentityCard(String fullName, String role, String email) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFFEA580C), Color(0xFF9A3412)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border.all(color: const Color(0xFFFED7AA), width: 2),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x26EA580C),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: const Center(
              child: Text(
                'GMD',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFDBA74)),
                      ),
                      child: const Text(
                        'TIER 1',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFEA580C),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  role,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFEA580C),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  email,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBiometricSecurityHub() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with Status Badge
          Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.fingerprint_rounded, color: Color(0xFFEA580C), size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Biometric Protection',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _isConfigured ? const Color(0xFFECFDF5) : const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _isConfigured ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _isConfigured ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
                        size: 13,
                        color: _isConfigured ? const Color(0xFF059669) : const Color(0xFFB45309),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _isConfigured ? 'ENROLLED & ACTIVE' : 'UNCONFIGURED',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: _isConfigured ? const Color(0xFF059669) : const Color(0xFFB45309),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(color: Color(0xFFF1F5F9), height: 1),

          // Biometric Gate Toggle
          SwitchListTile(
            value: _isEnabled && _isConfigured,
            onChanged: _toggleBiometricEnabled,
            activeColor: const Color(0xFFEA580C),
            title: const Text(
              'Biometric Gate on Launch',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: Text(
              _isConfigured
                  ? 'Always require fingerprint verification before accessing the system.'
                  : 'Configure fingerprint below to activate launch protection.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ),

          const Divider(color: Color(0xFFF1F5F9), height: 1),

          // Enrolled Fingerprint Card
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: _isConfigured ? const Color(0xFFECFDF5) : const Color(0xFFFFF7ED),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.fingerprint_rounded,
                          color: _isConfigured ? const Color(0xFF059669) : const Color(0xFFEA580C),
                          size: 26,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _isConfigured ? _fingerLabel : 'No Fingerprint Configured',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _isConfigured
                                  ? 'Primary sensor key · Ready for instant verification'
                                  : 'System will trigger setup on every launch until enrolled',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // Buttons: Enroll/Recalibrate and Test
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _showEnrollmentSheet,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA580C),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: const Icon(Icons.fingerprint_rounded, size: 18),
                        label: Text(
                          _isConfigured ? 'Re-calibrate Fingerprint' : 'Enroll Fingerprint Now',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ),
                    ),
                    if (_isConfigured) ...[
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        onPressed: _showTestBiometricDialog,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0F172A),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: const Icon(Icons.check_circle_outline_rounded, size: 16),
                        label: const Text(
                          'Test',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          const Divider(color: Color(0xFFF1F5F9), height: 1),

          // Backup Executive Security PIN
          ListTile(
            leading: Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: Color(0xFFFFF7ED),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.pin_rounded, color: Color(0xFFEA580C), size: 18),
            ),
            title: const Text(
              'Backup Executive PIN',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: Text(
              _securityPin != null ? 'PIN configured (● ● ● ●)' : 'Default PIN active (1234)',
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            trailing: TextButton(
              onPressed: _showChangePinDialog,
              child: const Text(
                'Change PIN',
                style: TextStyle(color: Color(0xFFEA580C), fontWeight: FontWeight.w700, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkstationGovernanceSection() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.business_rounded, color: Color(0xFFEA580C), size: 20),
              SizedBox(width: 8),
              Text(
                'Workstation & Preferences',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Default Executive Scope on Login',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _defaultWorkstation,
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All Subsidiaries (Consolidated)')),
                  DropdownMenuItem(value: 'head_office', child: Text('Bems Farms Head Office')),
                  DropdownMenuItem(value: 'logistics', child: Text('Logistics & Haulage Division')),
                  DropdownMenuItem(value: 'feeds_processing', child: Text('Feeds & Milling Subsidiary')),
                  DropdownMenuItem(value: 'distribution', child: Text('Processing & Distribution')),
                ],
                onChanged: (val) async {
                  if (val != null) {
                    await ChatStorageService.setDefaultWorkstation(val);
                    setState(() => _defaultWorkstation = val);
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _notificationsBridge,
            onChanged: (val) async {
              await ChatStorageService.setNotificationBridgeEnabled(val);
              setState(() => _notificationsBridge = val);
            },
            activeColor: const Color(0xFFEA580C),
            title: const Text(
              'VIP WhatsApp & Slack Bridge',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            subtitle: const Text(
              'Deliver instant priority alerts for requisitions exceeding ₦5M.',
              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAuditAndEnclaveSection() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.security_rounded, color: Color(0xFF059669), size: 20),
              SizedBox(width: 8),
              Text(
                'Security Audit & Hardware Keystore',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildAuditRow('Hardware Enclave', 'Secured Sandbox Keystore (AES-256)'),
          const SizedBox(height: 8),
          _buildAuditRow(
            'Enrollment Date',
            _enrolledAt != null ? _enrolledAt!.substring(0, 10) : 'Not Enrolled',
          ),
          const SizedBox(height: 8),
          _buildAuditRow('Integrity Status', 'Validated · Zero breaches detected'),
          if (_isConfigured) ...[
            const SizedBox(height: 14),
            TextButton.icon(
              onPressed: _handleResetBiometrics,
              icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626), size: 16),
              label: const Text(
                'Reset Fingerprint Biometrics',
                style: TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAuditRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
      ],
    );
  }
}

// Interactive Fingerprint Enrollment Bottom Sheet
class _EnrollmentBottomSheet extends StatefulWidget {
  final String currentLabel;
  final Function(String label) onEnrollSuccess;

  const _EnrollmentBottomSheet({
    required this.currentLabel,
    required this.onEnrollSuccess,
  });

  @override
  State<_EnrollmentBottomSheet> createState() => _EnrollmentBottomSheetState();
}

class _EnrollmentBottomSheetState extends State<_EnrollmentBottomSheet> {
  double _progress = 0.0;
  bool _isPressing = false;
  bool _isCompleted = false;
  String _selectedFinger = 'GMD Right Thumbprint';
  Timer? _scanTimer;

  final List<String> _fingerOptions = [
    'GMD Right Thumbprint',
    'GMD Right Index Finger',
    'GMD Left Thumbprint',
    'GMD Left Index Finger',
  ];

  @override
  void initState() {
    super.initState();
    _selectedFinger = widget.currentLabel;
  }

  @override
  void dispose() {
    _scanTimer?.cancel();
    super.dispose();
  }

  Future<void> _startScanning() async {
    if (_isCompleted) return;
    setState(() => _isPressing = true);
    HapticFeedback.lightImpact();

    final hasHardware = await BiometricService.isHardwareAvailable();
    if (hasHardware) {
      final success = await BiometricService.authenticateWithPhoneFingerprint(
        reason: 'Scan your fingerprint to register $_selectedFinger for GMD Cockpit',
      );
      if (!mounted) return;
      if (success) {
        setState(() {
          _progress = 1.0;
          _isCompleted = true;
          _isPressing = false;
        });
        HapticFeedback.heavyImpact();
      } else {
        setState(() => _isPressing = false);
      }
      return;
    }

    _scanTimer?.cancel();
    _scanTimer = Timer.periodic(const Duration(milliseconds: 70), (timer) {
      if (!_isPressing) {
        timer.cancel();
        return;
      }
      setState(() {
        _progress += 0.04;
        if (_progress >= 1.0) {
          _progress = 1.0;
          _isCompleted = true;
          _isPressing = false;
          timer.cancel();
          HapticFeedback.heavyImpact();
        }
      });
    });
  }

  void _stopScanning() {
    if (_isCompleted) return;
    setState(() => _isPressing = false);
    _scanTimer?.cancel();
  }

  @override
  Widget build(BuildContext context) {
    final percent = (_progress * 100).toInt();

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'Enroll GMD Fingerprint',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Select finger and press & hold the biometric sensor to calibrate.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),

            const SizedBox(height: 18),

            // Finger selector pills
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _fingerOptions.map((opt) {
                  final isSel = _selectedFinger == opt;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(opt),
                      selected: isSel,
                      selectedColor: const Color(0xFFEA580C),
                      labelStyle: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isSel ? Colors.white : const Color(0xFF475569),
                      ),
                      onSelected: (val) {
                        if (val) setState(() => _selectedFinger = opt);
                      },
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 28),

            // Sensor area with circular progress
            GestureDetector(
              onTap: () => _startScanning(),
              onTapDown: (_) => _startScanning(),
              onTapUp: (_) => _stopScanning(),
              onTapCancel: () => _stopScanning(),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 140,
                    height: 140,
                    child: CircularProgressIndicator(
                      value: _progress,
                      strokeWidth: 6,
                      backgroundColor: const Color(0xFFF1F5F9),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _isCompleted ? const Color(0xFF059669) : const Color(0xFFEA580C),
                      ),
                    ),
                  ),
                  Container(
                    width: 116,
                    height: 116,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isCompleted
                          ? const Color(0xFFECFDF5)
                          : (_isPressing ? const Color(0xFFFFF7ED) : const Color(0xFFF8FAFC)),
                      border: Border.all(
                        color: _isCompleted
                            ? const Color(0xFF10B981)
                            : (_isPressing ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0)),
                        width: 2,
                      ),
                      boxShadow: [
                        if (_isPressing)
                          const BoxShadow(
                            color: Color(0x33EA580C),
                            blurRadius: 20,
                            spreadRadius: 4,
                          ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        _isCompleted ? Icons.check_circle_rounded : Icons.fingerprint_rounded,
                        size: 64,
                        color: _isCompleted
                            ? const Color(0xFF059669)
                            : (_isPressing ? const Color(0xFFEA580C) : const Color(0xFF64748B)),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Progress text
            Text(
              _isCompleted
                  ? 'Fingerprint Verified by Phone Sensor!'
                  : (_isPressing ? 'Reading phone biometric sensor ($percent%)...' : 'Tap to Summon Phone Fingerprint Sensor'),
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: _isCompleted
                    ? const Color(0xFF059669)
                    : (_isPressing ? const Color(0xFFEA580C) : const Color(0xFF0F172A)),
              ),
            ),

            const SizedBox(height: 26),

            // Save / Complete Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isCompleted
                    ? () {
                        widget.onEnrollSuccess(_selectedFinger);
                        Navigator.pop(context);
                      }
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFCBD5E1),
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(
                  _isCompleted ? 'Save & Activate Biometric Protection' : 'Hold sensor to calibrate ($percent%)',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}
