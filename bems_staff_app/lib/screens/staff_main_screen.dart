import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import '../models/staff_models.dart';
import '../services/staff_api_service.dart';
import '../services/staff_storage_service.dart';
import '../services/staff_download_helper.dart';
import 'new_fund_request_screen.dart';
import 'staff_login_screen.dart';
import 'wallet/staff_wallet_screen.dart';
import 'request_chat_screen.dart';
import 'staff_admin_chat_screen.dart';
import 'attendance_scan_screen.dart';
import 'attendance_monthly_screen.dart';
import '../widgets/bems_pie_chart.dart';
import '../services/staff_biometric_service.dart';
import '../services/staff_notification_service.dart';
import 'staff_module_gallery_screen.dart';

class StaffMainScreen extends StatefulWidget {
  final StaffUser user;
  final bool fromGallery;

  const StaffMainScreen({super.key, required this.user, this.fromGallery = false});

  @override
  State<StaffMainScreen> createState() => _StaffMainScreenState();
}

class _StaffMainScreenState extends State<StaffMainScreen> {
  late StaffUser _currentUser;
  int _currentIndex = 0;
  bool _isLoading = true;
  bool _hideBalance = false;

  List<FundRequestItem> _requests = [];
  List<DisbursementItem> _disbursementsAwaiting = [];
  List<AccountabilityCaseItem> _cases = [];
  Map<String, dynamic>? _todayAttendance;
  bool _isTodayOffDay = false;
  Timer? _attendanceReminderTimer;
  bool _isAttendanceModalOpen = false;
  bool _attendanceModalDismissed = false;

  List<AccountabilityCaseItem> get _activeAdvanceCases => _cases.where((c) {
    final s = c.status.toUpperCase();
    return s != 'CLOSED' && s != 'VERIFIED';
  }).toList();

  List<AccountabilityCaseItem> get _pendingRetirementCases => _cases.where((c) {
    final s = c.status.toUpperCase();
    return s != 'EVIDENCE_SUBMITTED' && s != 'CLOSED' && s != 'VERIFIED';
  }).toList();

  List<AccountabilityCaseItem> get _submittedUnderReviewCases => _cases.where((c) {
    final s = c.status.toUpperCase();
    return s == 'EVIDENCE_SUBMITTED';
  }).toList();

  void _openEnterpriseGallery() {
    if (widget.fromGallery && Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => StaffModuleGalleryScreen(user: _currentUser)),
      );
    }
  }

  // Search & Filter state for Requisitions
  String _searchQuery = '';
  String _selectedStatusFilter = 'ALL';
  String _requisitionChartMetric = 'Category';
  bool _isBiometricConfigured = false;
  bool _isBiometricEnabled = false;
  bool _isProfileUpdateGateActive = false;
  final PageController _priceCardController = PageController();
  late final PageController _pageController;
  int _priceCardPage = 0;
  Map<String, dynamic>? _walletData;

  void _navigateToTab(int index) {
    if (_currentIndex == index) return;
    setState(() => _currentIndex = index);
    if (_pageController.hasClients) {
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _downloadAndroidApk() async {
    final effectiveUrl = StaffApiService.resolveUrl('/download/staff-app.apk');
    final success = await downloadFile(effectiveUrl, 'BEMS-Staff-Portal-v1.3.8.apk');
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Starting APK download... Check your browser downloads.'),
            backgroundColor: Color(0xFF059669),
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        Clipboard.setData(ClipboardData(text: effectiveUrl));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Direct link copied: $effectiveUrl'),
            backgroundColor: const Color(0xFFEA580C),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  void _openProfileScreen() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            title: const Text(
              'My Profile & Credentials',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A)),
            ),
            backgroundColor: Colors.white,
            elevation: 0,
            surfaceTintColor: Colors.transparent,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: SafeArea(child: _buildProfileTab()),
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
    _currentUser = widget.user;
    _loadData();
    _loadBiometricSettings();
    StaffNotificationService().startPeriodicSync(_currentUser);
  }

  @override
  void dispose() {
    StaffNotificationService().stopPeriodicSync();
    _attendanceReminderTimer?.cancel();
    _pageController.dispose();
    _priceCardController.dispose();
    super.dispose();
  }

  Future<void> _loadBiometricSettings() async {
    final configured = await StaffStorageService.isBiometricConfigured();
    final enabled = await StaffStorageService.isBiometricEnabled();
    if (mounted) {
      setState(() {
        _isBiometricConfigured = configured;
        _isBiometricEnabled = enabled;
      });
    }
  }

  Future<void> _toggleBiometric(bool value) async {
    if (value) {
      final hasHardware = await StaffBiometricService.isHardwareAvailable();
      if (!hasHardware) {
        if (!mounted || !context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Biometric hardware is not available on this device.'),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
        return;
      }
      final authenticated = await StaffBiometricService.authenticateWithPhoneFingerprint(
        reason: 'Verify your fingerprint to enable biometric unlock',
      );
      if (authenticated) {
        await StaffStorageService.setBiometricConfigured(true);
        await StaffStorageService.setBiometricEnabled(true);
        if (mounted) {
          setState(() {
            _isBiometricConfigured = true;
            _isBiometricEnabled = true;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Fingerprint unlock enabled for this device.'),
              backgroundColor: Color(0xFFEA580C),
            ),
          );
        }
      }
    } else {
      await StaffStorageService.setBiometricEnabled(false);
      if (mounted) {
        setState(() => _isBiometricEnabled = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fingerprint unlock disabled.'),
            backgroundColor: Color(0xFF475569),
          ),
        );
      }
    }
  }

  Future<void> _loadData() async {
    final results = await Future.wait([
      StaffApiService.fetchStaffDashboard(
        userEmail: _currentUser.email,
        employeeId: _currentUser.id,
        token: _currentUser.token,
      ),
      StaffApiService.fetchTodayAttendanceBundle(
        employeeId: _currentUser.id,
        token: _currentUser.token,
      ),
      StaffApiService.fetchMyProfile(_currentUser),
    ]);
    final data = results[0] as Map<String, dynamic>;
    final attendanceBundle = results[1] as Map<String, dynamic>;
    final refreshedUser = results[2] as StaffUser;

    Map<String, dynamic>? wallet;
    try {
      wallet = await StaffApiService.getOwnWallet(refreshedUser);
    } catch (_) {}

    if (mounted) {
      setState(() {
        _currentUser = refreshedUser;
        _requests = data['requests'] as List<FundRequestItem>;
        _disbursementsAwaiting = data['disbursementsAwaiting'] as List<DisbursementItem>;
        _cases = data['accountabilityCases'] as List<AccountabilityCaseItem>;
        _todayAttendance = attendanceBundle['record'] as Map<String, dynamic>?;
        _isTodayOffDay = attendanceBundle['isOffDay'] == true;
        _walletData = wallet;
        _isLoading = false;
      });
      _checkProfileUpdateGate();
      _evaluateAttendancePrompt();
      StaffNotificationService().syncAndNotify(refreshedUser);
    }
  }

  void _evaluateAttendancePrompt() {
    final role = _currentUser.role.toUpperCase();
    final isExecutive = role == 'GMD' || role == 'SUPER_ADMIN' || role == 'SYSTEM_ADMIN' || _currentUser.employeeNumber == 'BEMS-GRO-2026-0001';
    if (isExecutive) return;

    final isPunchedIn = _todayAttendance != null && _todayAttendance!['checkInTime'] != null;
    if (isPunchedIn || _isTodayOffDay || _attendanceModalDismissed) {
      _attendanceReminderTimer?.cancel();
      _attendanceReminderTimer = null;
      return;
    }

    // Auto-display modal once upon initial load if not checked in today and not dismissed
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 600), () {
        if (mounted && !_attendanceModalDismissed) {
          _checkAndShowAttendanceModal();
        }
      });
    });
  }

  void _checkAndShowAttendanceModal() {
    final role = _currentUser.role.toUpperCase();
    final isExecutive = role == 'GMD' || role == 'SUPER_ADMIN' || role == 'SYSTEM_ADMIN' || _currentUser.employeeNumber == 'BEMS-GRO-2026-0001';
    if (isExecutive) return;

    final isPunchedIn = _todayAttendance != null && _todayAttendance!['checkInTime'] != null;
    if (isPunchedIn || _isTodayOffDay || _attendanceModalDismissed) return;
    if (_isAttendanceModalOpen) return;
    if (!mounted) return;

    _showAttendanceModal();
  }

  void _showAttendanceModal() {
    _isAttendanceModalOpen = true;
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: Colors.white,
        elevation: 8,
        surfaceTintColor: Colors.transparent,
        child: Container(
          width: 440,
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Header with Clock Icon & Kicker
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFED7AA)),
                    ),
                    child: const Icon(
                      Icons.access_time_filled_rounded,
                      color: Color(0xFFEA580C),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'DAILY ATTENDANCE & PRESENCE',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Not Checked In Today',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                    onPressed: () {
                      _attendanceModalDismissed = true;
                      Navigator.pop(dialogCtx);
                    },
                    tooltip: 'Dismiss',
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text(
                'You have not recorded your attendance for today\'s shift. Clock in via office QR scan and GPS to verify your physical presence and safeguard your punctuality record.',
                style: TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 20),

              // Button 1: Clock In (GPS + QR)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    Navigator.pop(dialogCtx);
                    final res = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => AttendanceScanScreen(
                          currentUser: _currentUser,
                          isCheckIn: true,
                        ),
                      ),
                    );
                    if (res == true) {
                      await _loadData();
                    }
                  },
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                  label: const Text(
                    'CLOCK IN (GPS + QR)',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.3),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Button 2: View Monthly Attendance Calendar
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(dialogCtx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => AttendanceMonthlyScreen(currentUser: _currentUser),
                      ),
                    );
                  },
                  icon: const Icon(Icons.calendar_month_rounded, size: 16, color: Color(0xFF0F172A)),
                  label: const Text(
                    'View Monthly Attendance Calendar',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: const Color(0xFFF8FAFC),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 8),

              // Hint: Remind me in 3 mins
              Center(
                child: TextButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text(
                    'Remind me in 3 minutes',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).then((_) {
      _isAttendanceModalOpen = false;
    });
  }

  Future<void> _handleConfirmPayment(DisbursementItem disb) async {
    await StaffApiService.confirmDisbursement(
      disbursementId: disb.id,
      employeeId: _currentUser.id,
      token: _currentUser.token,
      decision: 'RECEIVED',
    );
    if (!mounted || !context.mounted) return;
    setState(() {
      _disbursementsAwaiting.removeWhere((d) => d.id == disb.id);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('✓ Payment confirmed! 72-Hour Evidence Window activated.'),
        backgroundColor: Color(0xFF059669),
      ),
    );
    _loadData();
  }

  Future<void> _handleReportIssue(DisbursementItem disb) async {
    final noteController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Report Payment Discrepancy', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Let Finance know what issue you experienced with reference ${disb.reference}:',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                maxLines: 2,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  hintText: 'e.g. Funds not reflected in bank account yet.',
                  hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await StaffApiService.confirmDisbursement(
                  disbursementId: disb.id,
                  employeeId: _currentUser.id,
                  decision: 'NOT_RECEIVED',
                  note: noteController.text.trim(),
                );
                if (!mounted || !context.mounted) return;
                setState(() => _disbursementsAwaiting.removeWhere((d) => d.id == disb.id));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Discrepancy reported to Finance & Audit team for investigation.'),
                    backgroundColor: Color(0xFFDC2626),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Submit Report'),
            ),
          ],
        );
      },
    );
  }

  void _checkProfileUpdateGate() {
    if (_isProfileUpdateGateActive) return;
    StaffApiService.fetchPendingProfileUpdate(
      employeeId: _currentUser.id,
      token: _currentUser.token,
    ).then((pending) {
      if (mounted && pending != null && pending['hasPendingUpdate'] == true) {
        _isProfileUpdateGateActive = true;
        _showProfileUpdateDialog(pending).then((_) {
          _isProfileUpdateGateActive = false;
        });
      }
    });
  }

  Future<void> _showProfileUpdateDialog(Map<String, dynamic> pending) async {
    final req = pending['request'] as Map<String, dynamic>? ?? {};
    final cur = pending['currentData'] as Map<String, dynamic>? ?? {};
    final fields = (req['requestedFields'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
    final instructions = req['instructions']?.toString();
    final requestedBy = req['requestedBy']?.toString() ?? 'Administrator';
    final requestId = req['id']?.toString() ?? '';

    String? avatarUrl = cur['avatarUrl']?.toString();
    final ninController = TextEditingController(text: cur['nin']?.toString() ?? '');
    final bankNameController = TextEditingController(text: cur['bankName']?.toString() ?? '');
    final accountNumController = TextEditingController(text: cur['accountNumber']?.toString() ?? '');
    final accountNameController = TextEditingController(text: cur['accountName']?.toString() ?? '');
    final nokNameController = TextEditingController(text: cur['nextOfKinName']?.toString() ?? '');
    final nokPhoneController = TextEditingController(text: cur['nextOfKinPhone']?.toString() ?? '');
    final resAddressController = TextEditingController(text: cur['residentialAddress']?.toString() ?? '');
    final cityStateController = TextEditingController(text: cur['cityState']?.toString() ?? '');
    final pinController = TextEditingController();
    String maritalStatus = cur['maritalStatus']?.toString() ?? 'SINGLE';
    String highestEducation = cur['highestEducation']?.toString() ?? 'BACHELORS';

    bool isSubmitting = false;
    bool isUploadingPhoto = false;
    String? localError;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return PopScope(
              canPop: false,
              child: Dialog(
                backgroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 520, maxHeight: 680),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Header
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: const BoxDecoration(
                          color: Color(0xFFEA580C),
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(20),
                            topRight: Radius.circular(20),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.shield_outlined, color: Colors.white, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'ACTION REQUIRED',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.1,
                                    ),
                                  ),
                                  const Text(
                                    'Update Profile Records',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Text(
                                    'Requested by $requestedBy',
                                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Scrollable form fields
                      Flexible(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (instructions != null && instructions.isNotEmpty) ...[
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF7ED),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFFED7AA)),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.info_outline, color: Color(0xFFEA580C), size: 18),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          instructions,
                                          style: const TextStyle(fontSize: 12, color: Color(0xFF9A3412)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 14),
                              ],
                              if (localError != null) ...[
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF2F2),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFFFECACA)),
                                  ),
                                  child: Text(
                                    localError!,
                                    style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                ),
                                const SizedBox(height: 14),
                              ],

                              // 1. Passport Photograph
                              if (fields.contains('avatarUrl')) ...[
                                const Text('PASSPORT PHOTOGRAPH', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 28,
                                      backgroundColor: const Color(0xFFF1F5F9),
                                      backgroundImage: (avatarUrl != null && avatarUrl!.startsWith('http'))
                                          ? NetworkImage(avatarUrl!)
                                          : null,
                                      child: (avatarUrl == null || !avatarUrl!.startsWith('http'))
                                          ? const Icon(Icons.person, color: Color(0xFF94A3B8), size: 30)
                                          : null,
                                    ),
                                    const SizedBox(width: 14),
                                    ElevatedButton.icon(
                                      onPressed: isUploadingPhoto
                                          ? null
                                          : () async {
                                              final picker = ImagePicker();
                                              final photo = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
                                              if (photo != null) {
                                                setDialogState(() => isUploadingPhoto = true);
                                                try {
                                                  final bytes = await photo.readAsBytes();
                                                  final uploaded = await StaffApiService.uploadAvatar(
                                                    bytes: bytes,
                                                    filename: photo.name,
                                                  );
                                                  setDialogState(() {
                                                    avatarUrl = uploaded;
                                                    isUploadingPhoto = false;
                                                  });
                                                } catch (e) {
                                                  setDialogState(() {
                                                    localError = e.toString();
                                                    isUploadingPhoto = false;
                                                  });
                                                }
                                              }
                                            },
                                      icon: isUploadingPhoto
                                          ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                          : const Icon(Icons.upload, size: 16),
                                      label: Text(isUploadingPhoto ? 'Uploading...' : 'Upload Passport Photo'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFFEA580C),
                                        foregroundColor: Colors.white,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                              ],

                              // 2. NIN
                              if (fields.contains('nin')) ...[
                                const Text('NATIONAL IDENTITY NUMBER (NIN)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: ninController,
                                  keyboardType: TextInputType.number,
                                  maxLength: 11,
                                  decoration: InputDecoration(
                                    hintText: '11-digit NIN',
                                    counterText: '',
                                    filled: true,
                                    fillColor: const Color(0xFFF8FAFC),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],

                              // 3. Bank Details
                              if (fields.contains('bankDetails') || fields.contains('bankName') || fields.contains('accountNumber') || fields.contains('accountName')) ...[
                                const Text('BANK DISBURSEMENT DETAILS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 6),
                                if (fields.contains('bankDetails') || fields.contains('bankName')) ...[
                                  TextField(
                                    controller: bankNameController,
                                    decoration: InputDecoration(
                                      hintText: 'Bank Name (e.g. Access Bank)',
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],
                                if (fields.contains('bankDetails') || fields.contains('accountNumber')) ...[
                                  TextField(
                                    controller: accountNumController,
                                    keyboardType: TextInputType.number,
                                    maxLength: 10,
                                    decoration: InputDecoration(
                                      hintText: '10-digit Account Number',
                                      counterText: '',
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],
                                if (fields.contains('bankDetails') || fields.contains('accountName')) ...[
                                  TextField(
                                    controller: accountNameController,
                                    decoration: InputDecoration(
                                      hintText: 'Account Holder Legal Name',
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 16),
                              ],

                              // 4. Next of Kin
                              if (fields.contains('nextOfKin') || fields.contains('nextOfKinName') || fields.contains('nextOfKinPhone')) ...[
                                const Text('NEXT OF KIN RECORDS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 6),
                                if (fields.contains('nextOfKin') || fields.contains('nextOfKinName')) ...[
                                  TextField(
                                    controller: nokNameController,
                                    decoration: InputDecoration(
                                      hintText: 'Full Name',
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],
                                if (fields.contains('nextOfKin') || fields.contains('nextOfKinPhone')) ...[
                                  TextField(
                                    controller: nokPhoneController,
                                    keyboardType: TextInputType.phone,
                                    decoration: InputDecoration(
                                      hintText: 'Phone Number',
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 16),
                              ],

                              // 5. Residential Address
                              if (fields.contains('residentialAddress') || fields.contains('cityState')) ...[
                                const Text('RESIDENTIAL ADDRESS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 6),
                                if (fields.contains('residentialAddress')) ...[
                                  TextField(
                                    controller: resAddressController,
                                    decoration: InputDecoration(
                                      hintText: 'Street Address',
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],
                                if (fields.contains('cityState')) ...[
                                  TextField(
                                    controller: cityStateController,
                                    decoration: InputDecoration(
                                      hintText: 'City, State',
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 16),
                              ],

                              // 6. Demographics
                              if (fields.contains('demographics') || fields.contains('maritalStatus')) ...[
                                const Text('MARITAL STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 6),
                                DropdownButtonFormField<String>(
                                  value: maritalStatus,
                                  items: const [
                                    DropdownMenuItem(value: 'SINGLE', child: Text('Single')),
                                    DropdownMenuItem(value: 'MARRIED', child: Text('Married')),
                                    DropdownMenuItem(value: 'DIVORCED', child: Text('Divorced')),
                                    DropdownMenuItem(value: 'WIDOWED', child: Text('Widowed')),
                                  ],
                                  onChanged: (val) => setDialogState(() => maritalStatus = val ?? 'SINGLE'),
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: const Color(0xFFF8FAFC),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],

                              // 7. Security PIN
                              if (fields.contains('securityPin')) ...[
                                const Text('SET 4-DIGIT SECURITY PIN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: pinController,
                                  keyboardType: TextInputType.number,
                                  maxLength: 4,
                                  obscureText: true,
                                  decoration: InputDecoration(
                                    hintText: '4-digit PIN',
                                    counterText: '',
                                    filled: true,
                                    fillColor: const Color(0xFFF8FAFC),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],
                            ],
                          ),
                        ),
                      ),
                      // Action Button
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: const BoxDecoration(
                          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                        child: SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: isSubmitting
                                ? null
                                : () async {
                                    setDialogState(() => localError = null);
                                    if (fields.contains('avatarUrl') && (avatarUrl == null || !avatarUrl!.startsWith('http'))) {
                                      setDialogState(() => localError = 'Please upload your passport photograph.');
                                      return;
                                    }
                                    if (fields.contains('nin') && ninController.text.trim().length != 11) {
                                      setDialogState(() => localError = 'NIN must be 11 digits.');
                                      return;
                                    }
                                    if ((fields.contains('bankDetails') || fields.contains('accountNumber')) && accountNumController.text.trim().isNotEmpty && accountNumController.text.trim().length != 10) {
                                      setDialogState(() => localError = 'Account number must be 10 digits.');
                                      return;
                                    }
                                    if (fields.contains('securityPin') && pinController.text.trim().length != 4) {
                                      setDialogState(() => localError = 'Security PIN must be 4 digits.');
                                      return;
                                    }

                                    setDialogState(() => isSubmitting = true);
                                    try {
                                      final updates = <String, dynamic>{};
                                      if (fields.contains('avatarUrl') && avatarUrl != null) updates['avatarUrl'] = avatarUrl;
                                      if (fields.contains('nin')) updates['nin'] = ninController.text.trim();
                                      if (fields.contains('bankName')) updates['bankName'] = bankNameController.text.trim();
                                      if (fields.contains('accountNumber')) updates['accountNumber'] = accountNumController.text.trim();
                                      if (fields.contains('accountName')) updates['accountName'] = accountNameController.text.trim();
                                      if (fields.contains('bankDetails')) {
                                        updates['bankName'] = bankNameController.text.trim();
                                        updates['accountNumber'] = accountNumController.text.trim();
                                        updates['accountName'] = accountNameController.text.trim();
                                      }
                                      if (fields.contains('nextOfKinName') || fields.contains('nextOfKin')) {
                                        updates['nextOfKinName'] = nokNameController.text.trim();
                                      }
                                      if (fields.contains('nextOfKinPhone') || fields.contains('nextOfKin')) {
                                        updates['nextOfKinPhone'] = nokPhoneController.text.trim();
                                      }
                                      if (fields.contains('residentialAddress')) {
                                        updates['residentialAddress'] = resAddressController.text.trim();
                                      }
                                      if (fields.contains('cityState')) {
                                        updates['cityState'] = cityStateController.text.trim();
                                      }
                                      if (fields.contains('demographics') || fields.contains('maritalStatus')) {
                                        updates['maritalStatus'] = maritalStatus;
                                      }
                                      if (fields.contains('highestEducation')) {
                                        updates['highestEducation'] = highestEducation;
                                      }
                                      if (fields.contains('securityPin')) {
                                        updates['securityPin'] = pinController.text.trim();
                                      }

                                      await StaffApiService.submitProfileUpdate(
                                        employeeId: _currentUser.id,
                                        requestId: requestId,
                                        updates: updates,
                                        token: _currentUser.token,
                                      );

                                      if (mounted && context.mounted && ctx.mounted) {
                                        Navigator.pop(ctx);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(
                                            content: Text('✓ Profile updated successfully! Access granted.'),
                                            backgroundColor: Color(0xFF059669),
                                          ),
                                        );
                                        _loadData();
                                      }
                                    } catch (e) {
                                      setDialogState(() {
                                        localError = e.toString();
                                        isSubmitting = false;
                                      });
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEA580C),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: isSubmitting
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Text('Save & Continue →', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  // 1. REQUISITION AUDIT INSPECTOR MODAL SHEET
  void _showRequisitionAuditSheet(FundRequestItem req, NumberFormat formatter) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (_, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(22, 12, 22, 30),
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 5,
                    decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(3)),
                  ),
                ),
                const SizedBox(height: 18),

                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          req.title.isNotEmpty ? req.title : req.requestNumber,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${req.requestNumber} · ${req.subsidiary}${req.department.isNotEmpty ? " · ${req.department}" : ""}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFFEA580C), fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    Text(
                      formatter.format(req.amountNaira),
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),

                const SizedBox(height: 16),
                const Divider(color: Color(0xFFE2E8F0)),
                const SizedBox(height: 14),

                // Payee Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: req.avatarUrl.isNotEmpty && req.avatarUrl.startsWith('http')
                            ? Image.network(
                                req.avatarUrl,
                                width: 48,
                                height: 48,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 48,
                                  height: 48,
                                  color: const Color(0xFFFFF7ED),
                                  child: const Icon(Icons.business_rounded, color: Color(0xFFEA580C), size: 24),
                                ),
                              )
                            : Container(
                                width: 48,
                                height: 48,
                                color: const Color(0xFFFFF7ED),
                                child: const Icon(Icons.business_rounded, color: Color(0xFFEA580C), size: 24),
                              ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('PAYEE / BENEFICIARY', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
                            const SizedBox(height: 2),
                            Text(
                              req.payeeName.isNotEmpty
                                  ? req.payeeName
                                  : (req.vendorName != null && req.vendorName!.isNotEmpty
                                      ? req.vendorName!
                                      : (req.subsidiary.isNotEmpty ? req.subsidiary : 'BEMS Internal Payee')),
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                            ),
                            Text('Category: ${req.category} · Priority: ${req.urgency}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // Purpose & Justification
                _buildAuditInfoBlock('Operational Purpose', req.title),
                const SizedBox(height: 12),
                _buildAuditInfoBlock('Business Justification', req.justification),
                const SizedBox(height: 12),
                _buildAuditInfoBlock('Mandatory 72h Deliverable Proof', req.deliverable),
                const SizedBox(height: 12),
                _buildAuditInfoBlock('Disbursement Due Date', req.dueDate),
                const SizedBox(height: 12),
                if (req.isRecurring) ...[
                  _buildAuditInfoBlock('Recurrence Policy', '${req.recurringInterval ?? "MONTHLY"} (Admin & Treasury alerted 7 days prior)'),
                  const SizedBox(height: 12),
                ],
                if (req.vendorName != null) ...[
                  _buildAuditInfoBlock('Vendor Registry 3-Way Match', req.vendorName!),
                  const SizedBox(height: 12),
                ],

                const SizedBox(height: 14),

                if (req.paymentStatus == 'PAID') ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        final target = _cases.firstWhere(
                          (item) => item.requestNumber == req.requestNumber,
                          orElse: () => _cases.isNotEmpty
                              ? _cases.first
                              : AccountabilityCaseItem(
                                  id: 'case-req',
                                  requestNumber: req.requestNumber,
                                  title: req.title,
                                  amountNaira: req.amountNaira,
                                  hoursRemaining: 36,
                                  bankReference: 'BEMS-TRX-2026-9041',
                                  disbursedAt: 'Today, 08:30 AM',
                                ),
                        );
                        _showRetirementEvidenceDialog(target);
                      },
                      icon: const Icon(Icons.receipt_long_rounded, size: 18),
                      label: const Text('Upload Proof of Expenditure & Receipts', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                const SizedBox(height: 20),

                // 5-Stage Approval Hierarchy Visualizer
                const Text(
                  'CORPORATE APPROVAL TIMELINE',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8),
                ),
                const SizedBox(height: 12),

                _buildTimelineStep(
                  stepNum: '1',
                  title: 'Requisition Drafted & Submitted',
                  subtitle: '${_currentUser.fullName} · ${req.createdAt}',
                  isDone: true,
                ),
                _buildTimelineStep(
                  stepNum: '2',
                  title: 'Department Head Review & Endorsement',
                  subtitle: 'Head of Operations · Approved',
                  isDone: true,
                ),
                _buildTimelineStep(
                  stepNum: '3',
                  title: 'Internal Audit & Budget Verification',
                  subtitle: 'Finance Desk · Reconciled with Q4 Budget',
                  isDone: true,
                ),
                _buildTimelineStep(
                  stepNum: '4',
                  title: 'GMD Executive Final Sign-Off',
                  subtitle: req.approvalStatus == 'APPROVED' ? 'Executive Signed Off' : 'Currently in GMD Review Queue',
                  isDone: req.approvalStatus == 'APPROVED',
                  isCurrent: req.approvalStatus != 'APPROVED',
                ),
                _buildTimelineStep(
                  stepNum: '5',
                  title: 'Treasury Bank Disbursal Batch',
                  subtitle: req.paymentStatus == 'PAID' ? 'Transferred to Bank Account' : 'Awaiting Final Payout Batch',
                  isDone: req.paymentStatus == 'PAID',
                  isLast: true,
                ),

                const SizedBox(height: 24),

                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => RequestChatScreen(
                          requestNumber: req.requestNumber,
                          requestTitle: req.title.isNotEmpty ? req.title : req.payeeName,
                          currentUser: _currentUser,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                  label: const Text('Open Request Chat & Queries', style: TextStyle(fontWeight: FontWeight.w800)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
                const SizedBox(height: 10),

                if (req.approvalStatus != 'APPROVED') ...[
                  OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _confirmDeleteRequest(req);
                    },
                    icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFDC2626)),
                    label: const Text('Delete / Cancel Requisition', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFDC2626))),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFFCA5A5)),
                      backgroundColor: const Color(0xFFFEF2F2),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                  const SizedBox(height: 10),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.lock_rounded, size: 16, color: Color(0xFF16A34A)),
                        SizedBox(width: 8),
                        Text(
                          'Locked: Approved by Admin (Cannot be deleted)',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF16A34A)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                ],

                OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0F172A),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                  ),
                  child: const Text('Close Details', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _confirmDeleteRequest(FundRequestItem req) {
    if (req.approvalStatus == 'APPROVED') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot delete request: This requisition has already been approved by Admin/Management.'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (dialogCtx) {
        bool isDeleting = false;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.delete_forever_rounded, color: Color(0xFFDC2626), size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Text('Delete Requisition', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Are you sure you want to permanently delete requisition ${req.requestNumber} (${req.amountNaira > 0 ? "₦${req.amountNaira.toStringAsFixed(0)}" : req.title})?',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFFEDD5)),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFFEA580C)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Staff can only retract and delete requisitions before admin sign-off. Once approved, requisitions are permanently locked.',
                            style: TextStyle(fontSize: 11, color: Color(0xFF9A3412)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: isDeleting ? null : () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
                ),
                ElevatedButton(
                  onPressed: isDeleting
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(context);
                          final navigator = Navigator.of(dialogCtx);
                          setDialogState(() => isDeleting = true);
                          try {
                            await StaffApiService.deleteFundRequest(
                              requestNumber: req.requestNumber,
                              employeeId: _currentUser.id,
                            );

                            navigator.pop();
                            if (mounted) {
                              setState(() {
                                _requests.removeWhere((item) => item.requestNumber == req.requestNumber || item.id == req.id);
                              });
                            }
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text('Requisition ${req.requestNumber} was deleted successfully.'),
                                backgroundColor: const Color(0xFF059669),
                              ),
                            );
                          } catch (e) {
                            setDialogState(() => isDeleting = false);
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text(e.toString().replaceAll('Exception: ', '')),
                                backgroundColor: const Color(0xFFDC2626),
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: isDeleting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Yes, Delete', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildAuditInfoBlock(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  Widget _buildTimelineStep({
    required String stepNum,
    required String title,
    required String subtitle,
    required bool isDone,
    bool isCurrent = false,
    bool isLast = false,
  }) {
    Color circleColor = isDone
        ? const Color(0xFF10B981)
        : isCurrent
            ? const Color(0xFFEA580C)
            : const Color(0xFFCBD5E1);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: circleColor,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: isDone
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : Text(stepNum, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: isDone ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
                    margin: const EdgeInsets.symmetric(vertical: 4),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: isDone || isCurrent ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 11, color: isCurrent ? const Color(0xFFEA580C) : const Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }



  // NOTIFICATIONS DIALOG MODAL SHEET
  void _showNotificationsDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return FutureBuilder<List<Map<String, dynamic>>>(
              future: StaffApiService.fetchNotifications(employeeId: _currentUser.id),
              builder: (context, snapshot) {
                final isLoading = snapshot.connectionState == ConnectionState.waiting;
                final notifications = snapshot.data ?? [];

                return SafeArea(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Center(
                          child: Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Text('Notifications', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                                const SizedBox(width: 8),
                                if (notifications.isNotEmpty)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: const Color(0xFFEA580C), borderRadius: BorderRadius.circular(10)),
                                    child: Text('${notifications.length}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                                  ),
                              ],
                            ),
                            if (notifications.isNotEmpty)
                              TextButton(
                                onPressed: () async {
                                  await StaffApiService.markNotificationsRead(employeeId: _currentUser.id);
                                  setModalState(() {});
                                },
                                child: const Text('Mark all read', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFEA580C))),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Divider(color: Color(0xFFF1F5F9)),
                        if (isLoading)
                          const Padding(
                            padding: EdgeInsets.all(40),
                            child: Center(child: CircularProgressIndicator(color: Color(0xFFEA580C))),
                          )
                        else if (notifications.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 40),
                            child: Center(
                              child: Column(
                                children: [
                                  Icon(Icons.notifications_off_outlined, size: 44, color: Colors.grey.shade400),
                                  const SizedBox(height: 10),
                                  const Text('No new notifications', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
                                  const SizedBox(height: 4),
                                  const Text('You will be notified of disbursement and audit alerts here.', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                                ],
                              ),
                            ),
                          )
                        else
                          Flexible(
                            child: ListView.separated(
                              shrinkWrap: true,
                              itemCount: notifications.length,
                              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                              itemBuilder: (context, idx) {
                                final n = notifications[idx];
                                return ListTile(
                                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                                  leading: Container(
                                    width: 38,
                                    height: 38,
                                    decoration: const BoxDecoration(color: Color(0xFFFFF7ED), shape: BoxShape.circle),
                                    child: const Icon(Icons.notifications_active_outlined, color: Color(0xFFEA580C), size: 20),
                                  ),
                                  title: Text(n['title']?.toString() ?? 'Alert', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A))),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text(n['body']?.toString() ?? '', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                                  ),
                                );
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  // 2. 72H EVIDENCE RETIREMENT MODAL SHEET (REAL CAMERA & FILE PICKING)
  void _showRetirementEvidenceDialog(AccountabilityCaseItem c) {
    final receiptNumController = TextEditingController();
    final spentAmountController = TextEditingController(text: c.amountNaira.toInt().toString());
    final noteController = TextEditingController();
    final formatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

    List<Map<String, dynamic>> uploadedAttachments = [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final advance = c.amountNaira;
            final spent = double.tryParse(spentAmountController.text.replaceAll(',', '').replaceAll('₦', '').trim()) ?? advance;
            final diff = advance - spent;

            return DraggableScrollableSheet(
              initialChildSize: 0.88,
              minChildSize: 0.5,
              maxChildSize: 0.95,
              expand: false,
              builder: (_, scrollController) {
                return ListView(
                  controller: scrollController,
                  padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(3)),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Proof of Fund Utilization',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              'Requisition: ${c.requestNumber} · Disbursed: ${formatter.format(c.amountNaira)}',
                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${c.hoursRemaining}h left',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Divider(color: Color(0xFFE2E8F0)),
                    const SizedBox(height: 12),

                    // ATTACHMENT ACTION BUTTONS (Real Camera vs Device Storage)
                    const Text(
                      'ATTACH PROOF OF EXPENDITURE *',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 8),

                    Row(
                      children: [
                        // Option 1: Snap Picture via Camera
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final messenger = ScaffoldMessenger.of(context);
                              try {
                                final picker = ImagePicker();
                                final photo = await picker.pickImage(
                                  source: ImageSource.camera,
                                  maxWidth: 1600,
                                  maxHeight: 1600,
                                  imageQuality: 85,
                                );
                                if (photo != null) {
                                  final bytes = await photo.readAsBytes();
                                  final sizeKb = (bytes.length / 1024).round();
                                  final sizeStr = sizeKb > 1024 ? '${(sizeKb / 1024).toStringAsFixed(1)} MB' : '$sizeKb KB';
                                  setModalState(() {
                                    uploadedAttachments.add({
                                      'name': photo.name,
                                      'type': 'PHOTO',
                                      'size': sizeStr,
                                      'bytes': bytes,
                                      'contentType': 'image/jpeg',
                                    });
                                  });
                                }
                              } catch (err) {
                                messenger.showSnackBar(
                                  SnackBar(content: Text('Camera error: $err'), backgroundColor: const Color(0xFFDC2626)),
                                );
                              }
                            },
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFFED7AA)),
                              ),
                              child: const Column(
                                children: [
                                  Icon(Icons.camera_alt_rounded, color: Color(0xFFEA580C), size: 22),
                                  SizedBox(height: 5),
                                  Text('Camera', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF9A3412))),
                                  SizedBox(height: 2),
                                  Text('Live snapshot', style: TextStyle(fontSize: 8.5, color: Color(0xFFB45309))),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Option 2: Choose from Photo Gallery
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final messenger = ScaffoldMessenger.of(context);
                              try {
                                final picker = ImagePicker();
                                final photo = await picker.pickImage(
                                  source: ImageSource.gallery,
                                  maxWidth: 1600,
                                  maxHeight: 1600,
                                  imageQuality: 85,
                                );
                                if (photo != null) {
                                  final bytes = await photo.readAsBytes();
                                  final sizeKb = (bytes.length / 1024).round();
                                  final sizeStr = sizeKb > 1024 ? '${(sizeKb / 1024).toStringAsFixed(1)} MB' : '$sizeKb KB';
                                  setModalState(() {
                                    uploadedAttachments.add({
                                      'name': photo.name,
                                      'type': 'PHOTO',
                                      'size': sizeStr,
                                      'bytes': bytes,
                                      'contentType': 'image/jpeg',
                                    });
                                  });
                                }
                              } catch (err) {
                                messenger.showSnackBar(
                                  SnackBar(content: Text('Gallery error: $err'), backgroundColor: const Color(0xFFDC2626)),
                                );
                              }
                            },
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFBBF7D0)),
                              ),
                              child: const Column(
                                children: [
                                  Icon(Icons.photo_library_rounded, color: Color(0xFF16A34A), size: 22),
                                  SizedBox(height: 5),
                                  Text('Photo Gallery', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF15803D))),
                                  SizedBox(height: 2),
                                  Text('Select photo', style: TextStyle(fontSize: 8.5, color: Color(0xFF166534))),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Option 3: Upload Document or PDF
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final messenger = ScaffoldMessenger.of(context);
                              try {
                                final result = await FilePicker.platform.pickFiles(
                                  type: FileType.custom,
                                  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
                                  withData: true,
                                );
                                if (result != null && result.files.isNotEmpty) {
                                  final file = result.files.first;
                                  final bytes = file.bytes;
                                  if (bytes != null) {
                                    final ext = (file.extension ?? '').toLowerCase();
                                    final isPdf = ext == 'pdf';
                                    final sizeKb = (bytes.length / 1024).round();
                                    final sizeStr = sizeKb > 1024 ? '${(sizeKb / 1024).toStringAsFixed(1)} MB' : '$sizeKb KB';
                                    setModalState(() {
                                      uploadedAttachments.add({
                                        'name': file.name,
                                        'type': isPdf ? 'DOCUMENT' : 'PHOTO',
                                        'size': sizeStr,
                                        'bytes': bytes,
                                        'contentType': isPdf ? 'application/pdf' : 'image/jpeg',
                                      });
                                    });
                                  }
                                }
                              } catch (err) {
                                messenger.showSnackBar(
                                  SnackBar(content: Text('File picker error: $err'), backgroundColor: const Color(0xFFDC2626)),
                                );
                              }
                            },
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: const Column(
                                children: [
                                  Icon(Icons.upload_file_rounded, color: Color(0xFF2563EB), size: 22),
                                  SizedBox(height: 5),
                                  Text('Doc / PDF', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF1E40AF))),
                                  SizedBox(height: 2),
                                  Text('Attach invoice', style: TextStyle(fontSize: 8.5, color: Color(0xFF1D4ED8))),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Display attached files list
                    if (uploadedAttachments.isNotEmpty) ...[
                      Column(
                        children: uploadedAttachments.asMap().entries.map((entry) {
                          final idx = entry.key;
                          final item = entry.value;
                          final isPhoto = item['type'] == 'PHOTO';
                          return Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                Icon(isPhoto ? Icons.photo_outlined : Icons.picture_as_pdf_outlined, size: 18, color: isPhoto ? const Color(0xFFEA580C) : const Color(0xFF2563EB)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item['name'] as String, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                                      Text(item['size'] as String, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFFDC2626)),
                                  onPressed: () => setModalState(() => uploadedAttachments.removeAt(idx)),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Receipt Number Field
                    TextField(
                      controller: receiptNumController,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        labelText: 'RECEIPT / INVOICE / GRN NUMBER *',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        hintText: 'e.g. GRN-2026-42 or INV-98104',
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Spent Amount Field with live calculation
                    TextField(
                      controller: spentAmountController,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setModalState(() {}),
                      style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), fontWeight: FontWeight.w800),
                      decoration: InputDecoration(
                        labelText: 'ACTUAL AMOUNT SPENT (NGN)',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        prefixText: '₦ ',
                        prefixStyle: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),

                    const SizedBox(height: 10),

                    // REAL-TIME REFUND / REIMBURSEMENT CALCULATOR
                    if (diff > 0)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.price_change_rounded, color: Color(0xFF059669), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Refund Due to BEMS Treasury: ${formatter.format(diff)}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF065F46)),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'Please refund unspent balance into BEMS Advance Settlement Account.',
                                    style: TextStyle(fontSize: 10.5, color: Color(0xFF047857)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    else if (diff < 0)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.account_balance_wallet_rounded, color: Color(0xFF2563EB), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Reimbursement Due to Staff: ${formatter.format(-diff)}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF1E40AF)),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'Approved excess spend will be credited directly to your bank account.',
                                    style: TextStyle(fontSize: 10.5, color: Color(0xFF1D4ED8)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle_outline_rounded, color: Color(0xFF64748B), size: 18),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Advance 100% Balanced (₦0 Difference)',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                              ),
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 12),

                    TextField(
                      controller: noteController,
                      maxLines: 2,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        labelText: 'DELIVERY & INSPECTION NOTES',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        hintText: 'e.g. Items verified in full count and certified at destination...',
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),

                    const SizedBox(height: 20),

                    ElevatedButton(
                      onPressed: () async {
                        if (uploadedAttachments.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please snap a picture or upload a receipt file before submitting.'),
                              backgroundColor: Color(0xFFDC2626),
                            ),
                          );
                          return;
                        }
                        if (receiptNumController.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please enter the receipt or invoice number.'),
                              backgroundColor: Color(0xFFDC2626),
                            ),
                          );
                          return;
                        }

                        Navigator.pop(ctx);
                        final messenger = ScaffoldMessenger.of(context);
                        final firstAtt = uploadedAttachments.first;
                        final bytes = firstAtt['bytes'] as List<int>;
                        final safeFileName = firstAtt['name'].toString();
                        final contentType = firstAtt['contentType']?.toString() ?? 'image/jpeg';

                        try {
                          await StaffApiService.submitRetirementEvidence(
                            caseId: c.id,
                            notes: '${noteController.text.trim()} (Receipt: ${receiptNumController.text.trim()})',
                            receiptName: safeFileName,
                            fileBytes: bytes,
                            employeeId: _currentUser.id,
                            contentType: contentType,
                          );
                          if (!mounted || !context.mounted) return;
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text('✓ Proof of fund utilization ($safeFileName) uploaded for Audit clearance.'),
                              backgroundColor: const Color(0xFF059669),
                            ),
                          );
                          _loadData();
                        } catch (e) {
                          if (!mounted || !context.mounted) return;
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text('Evidence upload failed: $e'),
                              backgroundColor: const Color(0xFFDC2626),
                            ),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.verified_outlined, size: 18),
                          SizedBox(width: 8),
                          Text('Submit Proof for Audit Clearance', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                        ],
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  // 3. CHANGE PASSWORD DIALOG
  void _showChangePasswordDialog() {
    final oldPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          title: const Text('Change Account Password', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: oldPasswordController,
                obscureText: true,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'CURRENT PASSWORD',
                  labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: newPasswordController,
                obscureText: true,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'NEW PASSWORD (MIN 10 CHARS)',
                  labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmPasswordController,
                obscureText: true,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'CONFIRM NEW PASSWORD',
                  labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final oldP = oldPasswordController.text;
                final newP = newPasswordController.text;
                final confirmP = confirmPasswordController.text;

                if (newP.length < 10) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password must be at least 10 characters long.')));
                  return;
                }
                if (newP != confirmP) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Passwords do not match.')));
                  return;
                }

                Navigator.pop(ctx);
                await StaffApiService.changePassword(employeeId: _currentUser.id, oldPassword: oldP, newPassword: newP);
                if (!mounted || !context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('✓ Password successfully updated!'), backgroundColor: Color(0xFF059669)),
                );
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
              child: const Text('Update Password'),
            ),
          ],
        );
      },
    );
  }

  // 4. UPDATE PHONE NUMBER DIALOG
  void _showUpdatePhoneDialog() {
    final phoneController = TextEditingController(text: _currentUser.phone);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          title: const Text('Update Contact Phone', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
          content: TextField(
            controller: phoneController,
            keyboardType: TextInputType.phone,
            style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              labelText: 'MOBILE PHONE NUMBER',
              labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
              prefixIcon: const Icon(Icons.phone_outlined, color: Color(0xFFEA580C), size: 18),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final newPhone = phoneController.text.trim();
                Navigator.pop(ctx);
                await StaffApiService.updatePhoneNumber(employeeId: _currentUser.id, phone: newPhone);
                final updated = _currentUser.copyWith(phone: newPhone);
                await StaffStorageService.saveUser(updated);
                if (!mounted || !context.mounted) return;
                setState(() => _currentUser = updated);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('✓ Phone number updated!'), backgroundColor: Color(0xFF059669)),
                );
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
              child: const Text('Save Phone'),
            ),
          ],
        );
      },
    );
  }

  // 5. UPDATE BANK ACCOUNTS DIALOG
  void _showUpdateBankAccountsDialog() {
    final bankNameController = TextEditingController(text: _currentUser.bankName);
    final accountNumberController = TextEditingController(text: _currentUser.accountNumber);
    final accountNameController = TextEditingController(text: _currentUser.accountName);

    bool useSameForSalary = _currentUser.bankName == _currentUser.salaryBankName &&
        _currentUser.accountNumber == _currentUser.salaryAccountNumber;
    final salaryBankNameController = TextEditingController(text: _currentUser.salaryBankName);
    final salaryAccountNumberController = TextEditingController(text: _currentUser.salaryAccountNumber);
    final salaryAccountNameController = TextEditingController(text: _currentUser.salaryAccountName);

    final bankOptions = [
      'Access Bank PLC',
      'Zenith Bank PLC',
      'First Bank of Nigeria',
      'Guaranty Trust Bank (GTBank)',
      'United Bank for Africa (UBA)',
      'Stanbic IBTC Bank',
      'Fidelity Bank PLC',
    ];

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
              title: const Text('Update Bank Accounts', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('PRIMARY ADVANCE SETTLEMENT BANK', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: bankOptions.contains(bankNameController.text) ? bankNameController.text : bankOptions.first,
                          isExpanded: true,
                          items: bankOptions.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))).toList(),
                          onChanged: (v) => setDialogState(() => bankNameController.text = v!),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: accountNumberController,
                      keyboardType: TextInputType.number,
                      maxLength: 10,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                      decoration: InputDecoration(
                        labelText: 'ADVANCE NUBAN (10 DIGITS)',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        counterText: '',
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: accountNameController,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                      decoration: InputDecoration(
                        labelText: 'BENEFICIARY ACCOUNT NAME',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Checkbox(
                          value: useSameForSalary,
                          activeColor: const Color(0xFFEA580C),
                          onChanged: (v) => setDialogState(() => useSameForSalary = v ?? true),
                        ),
                        const Expanded(
                          child: Text('Use exact details for monthly payroll/salary', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                        ),
                      ],
                    ),
                    if (!useSameForSalary) ...[
                      const SizedBox(height: 10),
                      const Text('SEPARATE PAYROLL / SALARY BANK', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF475569))),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: bankOptions.contains(salaryBankNameController.text) ? salaryBankNameController.text : bankOptions.first,
                            isExpanded: true,
                            items: bankOptions.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))).toList(),
                            onChanged: (v) => setDialogState(() => salaryBankNameController.text = v!),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: salaryAccountNumberController,
                        keyboardType: TextInputType.number,
                        maxLength: 10,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          labelText: 'SALARY ACCOUNT NUMBER',
                          labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                          counterText: '',
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: salaryAccountNameController,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          labelText: 'SALARY BENEFICIARY NAME',
                          labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final bName = bankNameController.text.trim();
                    final accNo = accountNumberController.text.trim();
                    final accName = accountNameController.text.trim();
                    final sBank = useSameForSalary ? bName : salaryBankNameController.text.trim();
                    final sAccNo = useSameForSalary ? accNo : salaryAccountNumberController.text.trim();
                    final sAccName = useSameForSalary ? accName : salaryAccountNameController.text.trim();

                    if (accNo.length < 10) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Advance Account number must be 10 digits.')));
                      return;
                    }

                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    await StaffApiService.updateBankAccounts(
                      employeeId: _currentUser.id,
                      bankName: bName,
                      accountNumber: accNo,
                      accountName: accName,
                      salaryBankName: sBank,
                      salaryAccountNumber: sAccNo,
                      salaryAccountName: sAccName,
                    );

                    final updated = _currentUser.copyWith(
                      bankName: bName,
                      accountNumber: accNo,
                      accountName: accName,
                      salaryBankName: sBank,
                      salaryAccountNumber: sAccNo,
                      salaryAccountName: sAccName,
                    );
                    await StaffStorageService.saveUser(updated);
                    if (!mounted || !context.mounted) return;
                    setState(() => _currentUser = updated);
                    messenger.showSnackBar(
                      const SnackBar(content: Text('✓ Corporate banking accounts updated!'), backgroundColor: Color(0xFF059669)),
                    );
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                  child: const Text('Save Accounts'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // 6. MY SALARY & PAYSLIPS MODAL
  void _showMyPayslipsModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.88,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: StatefulBuilder(
                builder: (context, setModalState) {
                  return FutureBuilder<Map<String, dynamic>>(
                    future: StaffApiService.fetchMyPayslips(employeeId: _currentUser.id),
                    builder: (context, snapshot) {
                      return ListView(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
                        children: [
                          Center(
                            child: Container(
                              width: 44,
                              height: 4,
                              decoration: BoxDecoration(
                                color: const Color(0xFFCBD5E1),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Text(
                                        'My Salary & Payslips',
                                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFFF7ED),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFFFED7AA)),
                                        ),
                                        child: const Text('PAYDAY: 3RD', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  const Text('Monthly vouchers, statutory deductions, & receipt confirmations', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                ],
                              ),
                              IconButton(
                                icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                                onPressed: () => Navigator.pop(ctx),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (snapshot.connectionState == ConnectionState.waiting) ...[
                            const SizedBox(height: 60),
                            const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C))),
                            const SizedBox(height: 12),
                            const Center(child: Text('Loading salary agreement & payslips...', style: TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
                          ] else if (snapshot.hasError) ...[
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(16)),
                              child: Text('Could not load salary records: ${snapshot.error}', style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12)),
                            ),
                          ] else if (snapshot.hasData) ...[
                            Builder(
                              builder: (context) {
                                final data = snapshot.data!;
                                final comp = data['compensation'] as Map<String, dynamic>?;
                                final payslips = (data['payslips'] as List<dynamic>?) ?? [];

                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Compensation Summary Card
                                    Container(
                                      padding: const EdgeInsets.all(18),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(color: const Color(0xFFFED7AA)),
                                        boxShadow: [
                                          BoxShadow(color: const Color(0xFFEA580C).withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 4)),
                                        ],
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text('ACTIVE COMPENSATION AGREEMENT', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8)),
                                          const SizedBox(height: 6),
                                          Text(
                                            comp?['grossFormatted'] ?? '₦0',
                                            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0F172A), letterSpacing: -0.5),
                                          ),
                                          Text(
                                            'Gross Monthly Pay · ${comp?['primarySubsidiary'] ?? 'BEMS Group'}',
                                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                          ),
                                          const Divider(color: Color(0xFFF1F5F9), height: 20),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  const Text('DEDUCTIONS (LATENESS ONLY)', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    comp?['latenessDeductionsFormatted'] != null && comp?['latenessDeductionsFormatted'] != '₦0'
                                                        ? 'Lateness: ${comp?['latenessDeductionsFormatted']}'
                                                        : '₦0 (No Tax / Punctual)',
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.w700,
                                                      color: comp?['latenessDeductionsFormatted'] != null && comp?['latenessDeductionsFormatted'] != '₦0'
                                                          ? const Color(0xFFB91C1C)
                                                          : const Color(0xFF059669),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.end,
                                                children: [
                                                  const Text('ESTIMATED TAKE-HOME', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF059669))),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    comp?['estimatedNetFormatted'] ?? '₦0',
                                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF059669)),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)),
                                            child: Row(
                                              children: [
                                                const Icon(Icons.account_balance_rounded, size: 13, color: Color(0xFF64748B)),
                                                const SizedBox(width: 6),
                                                Expanded(
                                                  child: Text(
                                                    'Salary Destination: ${comp?['salaryBankName']} (${comp?['salaryAccountNumber']})',
                                                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF334155), fontWeight: FontWeight.w700),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 20),
                                    const Text('MONTHLY PAYSLIPS & DISBURSEMENTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF475569), letterSpacing: 0.8)),
                                    const SizedBox(height: 8),
                                    if (payslips.isEmpty)
                                      Container(
                                        padding: const EdgeInsets.all(24),
                                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E8F0))),
                                        child: const Center(
                                          child: Text('No monthly payslips compiled yet.\nBatches are prepared ahead of the 3rd of each month.',
                                            textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4)),
                                        ),
                                      )
                                    else
                                      ...payslips.map((p) {
                                        final isPaid = p['paymentStatus'] == 'PAID';
                                        final conf = p['confirmation'] as Map<String, dynamic>?;
                                        final disbId = p['disbursementId']?.toString();

                                        return Container(
                                          margin: const EdgeInsets.only(bottom: 12),
                                          padding: const EdgeInsets.all(16),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(18),
                                            border: Border.all(color: const Color(0xFFE2E8F0)),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  Text(p['periodName'] ?? 'Payroll', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                    decoration: BoxDecoration(
                                                      color: isPaid ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                                                      borderRadius: BorderRadius.circular(6),
                                                      border: Border.all(color: isPaid ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A)),
                                                    ),
                                                    child: Text(
                                                      isPaid ? 'PAID & CREDITED' : p['batchStatus'] == 'APPROVED' ? 'APPROVED FOR PAYMENT' : 'PREPARED',
                                                      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: isPaid ? const Color(0xFF059669) : const Color(0xFFB45309)),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 8),
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text('Gross: ${p['grossFormatted']} · Ded: -${p['deductionsFormatted']}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                                      const SizedBox(height: 2),
                                                      Text('Net Take-Home: ${p['netFormatted']}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF059669))),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                              if (p['reference'] != null) ...[
                                                const SizedBox(height: 6),
                                                Text('Bank Reference: ${p['reference']}', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontFamily: 'monospace')),
                                              ],
                                              const SizedBox(height: 12),
                                              if (conf != null) ...[
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                  decoration: BoxDecoration(
                                                    color: conf['decision'] == 'RECEIVED' ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(color: conf['decision'] == 'RECEIVED' ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA)),
                                                  ),
                                                  child: Row(
                                                    children: [
                                                      Icon(conf['decision'] == 'RECEIVED' ? Icons.check_circle_rounded : Icons.report_problem_rounded,
                                                        size: 14, color: conf['decision'] == 'RECEIVED' ? const Color(0xFF059669) : const Color(0xFFDC2626)),
                                                      const SizedBox(width: 6),
                                                      Expanded(
                                                        child: Text(
                                                          conf['decision'] == 'RECEIVED' ? 'Receipt Confirmed by Staff' : 'Issue Reported: ${conf['note'] ?? 'Discrepancy'}',
                                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: conf['decision'] == 'RECEIVED' ? const Color(0xFF059669) : const Color(0xFFDC2626)),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ] else if (isPaid && disbId != null) ...[
                                                Row(
                                                  children: [
                                                    Expanded(
                                                      child: ElevatedButton.icon(
                                                        onPressed: () async {
                                                          try {
                                                            await StaffApiService.confirmPayslipDisbursement(
                                                              disbursementId: disbId,
                                                              decision: 'RECEIVED',
                                                              employeeId: _currentUser.id,
                                                            );
                                                            if (!mounted || !context.mounted) return;
                                                            ScaffoldMessenger.of(context).showSnackBar(
                                                              const SnackBar(content: Text('✓ Salary receipt confirmed!'), backgroundColor: Color(0xFF059669)),
                                                            );
                                                            setModalState(() {});
                                                          } catch (e) {
                                                            if (!mounted || !context.mounted) return;
                                                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                                                          }
                                                        },
                                                        icon: const Icon(Icons.check_circle_outline_rounded, size: 14),
                                                        label: const Text('Confirm Received', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
                                                        style: ElevatedButton.styleFrom(
                                                          backgroundColor: const Color(0xFF059669),
                                                          foregroundColor: Colors.white,
                                                          elevation: 0,
                                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                                        ),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    OutlinedButton(
                                                      onPressed: () async {
                                                        final noteController = TextEditingController();
                                                        final reported = await showDialog<bool>(
                                                          context: context,
                                                          builder: (dCtx) => AlertDialog(
                                                            title: const Text('Report Salary Issue', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                                                            content: TextField(
                                                              controller: noteController,
                                                              decoration: const InputDecoration(labelText: 'Explain issue (e.g. alert not received)', border: OutlineInputBorder()),
                                                            ),
                                                            actions: [
                                                              TextButton(onPressed: () => Navigator.pop(dCtx, false), child: const Text('Cancel')),
                                                              ElevatedButton(onPressed: () => Navigator.pop(dCtx, true), child: const Text('Submit Issue')),
                                                            ],
                                                          ),
                                                        );
                                                        if (reported == true && noteController.text.trim().isNotEmpty) {
                                                          await StaffApiService.confirmPayslipDisbursement(
                                                            disbursementId: disbId,
                                                            decision: 'NOT_RECEIVED',
                                                            note: noteController.text.trim(),
                                                            employeeId: _currentUser.id,
                                                          );
                                                          if (!mounted || !context.mounted) return;
                                                          ScaffoldMessenger.of(context).showSnackBar(
                                                            const SnackBar(content: Text('Salary issue reported to Finance.')),
                                                          );
                                                          setModalState(() {});
                                                        }
                                                      },
                                                      style: OutlinedButton.styleFrom(
                                                        foregroundColor: const Color(0xFFB91C1C),
                                                        side: const BorderSide(color: Color(0xFFFECACA)),
                                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                                      ),
                                                      child: const Text('Report Issue', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11)),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ],
                                          ),
                                        );
                                      }),
                                  ],
                                );
                              },
                            ),
                          ],
                        ],
                      );
                    },
                  );
                },
              ),
            );
          },
        );
      },
    );
  }

  void _openNewRequestModal() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NewFundRequestScreen(
          user: _currentUser,
          onSubmitted: _loadData,
        ),
      ),
    );
  }

  void _handleLogout() async {
    await StaffStorageService.clearUser();
    if (!mounted || !context.mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const StaffLoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        automaticallyImplyLeading: false,
        toolbarHeight: 68,
        titleSpacing: 16,
        title: InkWell(
          onTap: _openProfileScreen,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: _currentUser.avatarUrl.isNotEmpty && _currentUser.avatarUrl.startsWith('http')
                      ? Image.network(
                          _currentUser.avatarUrl,
                          width: 40,
                          height: 40,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 40,
                            height: 40,
                            color: const Color(0xFFEA580C).withOpacity(0.1),
                            child: const Icon(Icons.person, color: Color(0xFFEA580C), size: 22),
                          ),
                        )
                      : Container(
                          width: 40,
                          height: 40,
                          color: const Color(0xFFEA580C).withOpacity(0.1),
                          child: const Icon(Icons.person, color: Color(0xFFEA580C), size: 22),
                        ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Text(
                          _currentUser.fullName,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.verified_rounded, size: 14, color: Color(0xFFEA580C)),
                      ],
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '${_currentUser.employeeNumber} · ${_currentUser.subsidiary.isNotEmpty ? _currentUser.subsidiary : "BEMS Group"}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        actions: [
          // Modules Hub (Icon Only)
          InkWell(
            onTap: _openEnterpriseGallery,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFEA580C).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.2)),
              ),
              child: const Icon(
                Icons.grid_view_rounded,
                size: 19,
                color: Color(0xFFEA580C),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Notifications Bell
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              icon: const Icon(Icons.notifications_none_rounded, size: 20, color: Color(0xFF0F172A)),
              onPressed: _showNotificationsDialog,
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFFEA580C), strokeWidth: 2.5),
              )
            : PageView(
                controller: _pageController,
                physics: const BouncingScrollPhysics(),
                onPageChanged: (idx) {
                  setState(() => _currentIndex = idx);
                },
                children: [
                  _buildHomeTab(formatter),
                  _buildRequestsTab(formatter),
                  _buildRetirementTab(formatter),
                  StaffWalletScreen(
                    user: _currentUser,
                    isEmbedded: true,
                    onRequestFunds: _openNewRequestModal,
                    onNavigateToTab: _navigateToTab,
                    onShowPayslips: _showMyPayslipsModal,
                  ),
                ],
              ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex >= 2 ? _currentIndex + 1 : _currentIndex,
          onTap: (idx) {
            if (idx == 2) {
              // Center FAB: New Request
              _openNewRequestModal();
            } else {
              final target = idx > 2 ? idx - 1 : idx;
              _navigateToTab(target);
            }
          },
          backgroundColor: Colors.white,
          selectedItemColor: const Color(0xFFEA580C),
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                children: [
                  const Icon(Icons.receipt_long_outlined),
                  if (_requests.isNotEmpty)
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(color: Color(0xFFEA580C), shape: BoxShape.circle),
                        constraints: const BoxConstraints(minWidth: 8, minHeight: 8),
                      ),
                    ),
                ],
              ),
              activeIcon: const Icon(Icons.receipt_long_rounded),
              label: 'Requisitions',
            ),
            // Elevated Center Button
            BottomNavigationBarItem(
              icon: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEA580C), Color(0xFFFB923C)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEA580C).withOpacity(0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.add_rounded, color: Colors.white, size: 26),
              ),
              label: '',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                children: [
                  const Icon(Icons.timer_outlined),
                  if (_pendingRetirementCases.isNotEmpty)
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
                        constraints: const BoxConstraints(minWidth: 8, minHeight: 8),
                      ),
                    ),
                ],
              ),
              activeIcon: const Icon(Icons.timer_rounded),
              label: '72h SLA',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.account_balance_wallet_outlined),
              activeIcon: Icon(Icons.account_balance_wallet_rounded),
              label: 'Wallet',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShiftAttendanceCard() {
    final role = widget.user.role.toUpperCase();
    if (role == 'GMD' || role == 'SUPER_ADMIN' || role == 'SYSTEM_ADMIN') {
      return const SizedBox.shrink();
    }
    if (_isTodayOffDay) return const SizedBox.shrink();

    final isPunchedIn = _todayAttendance != null && _todayAttendance!['checkInTime'] != null;
    final checkInStr = _todayAttendance?['checkInTime']?.toString();
    final checkOutStr = _todayAttendance?['checkOutTime']?.toString();

    DateTime? checkInDt;
    if (checkInStr != null) {
      try {
        checkInDt = DateTime.parse(checkInStr).toLocal();
      } catch (_) {}
    }
    final timeFormatted = checkInDt != null ? DateFormat('hh:mm a').format(checkInDt) : '';

    if (!isPunchedIn) {
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7ED),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFFED7AA)),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFEA580C).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.qr_code_scanner_rounded, color: Color(0xFFEA580C), size: 20),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Shift Attendance Pending',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Clock in to verify physical presence',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            FilledButton.icon(
              onPressed: () async {
                final result = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AttendanceScanScreen(
                      currentUser: _currentUser,
                      isCheckIn: true,
                    ),
                  ),
                );
                if (result == true) _loadData();
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFEA580C),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              icon: const Icon(Icons.touch_app_rounded, size: 14),
              label: const Text('Clock In', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      );
    }

    if (checkOutStr == null) {
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFBBF7D0)),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.shield_outlined, color: Color(0xFF16A34A), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Shift Active - Clocked In',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF15803D),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    timeFormatted.isNotEmpty
                        ? 'Registered at $timeFormatted · Office station verified'
                        : 'Shift verified · Office station active',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF166534)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              onPressed: () async {
                final result = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AttendanceScanScreen(
                      currentUser: _currentUser,
                      isCheckIn: false,
                    ),
                  ),
                );
                if (result == true) _loadData();
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF15803D),
                side: const BorderSide(color: Color(0xFF86EFAC)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                backgroundColor: Colors.white,
              ),
              icon: const Icon(Icons.logout_rounded, size: 14),
              label: const Text('Check Out', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Row(
        children: [
          Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF64748B)),
          SizedBox(width: 8),
          Text(
            'Shift Completed for Today · Verified Check-Out',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }

  // TAB 0: HOME WORKSPACE
  Widget _buildHomeTab(NumberFormat formatter) {
    final activeAdvanceAmount = _activeAdvanceCases.fold<double>(0, (sum, c) => sum + c.amountNaira);

    return RefreshIndicator(
      onRefresh: _loadData,
      color: const Color(0xFFEA580C),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
        children: [
          // Multi-Metric Financial Carousel (Replaces Single Hero Card)
          _buildMultiMetricFinancialCarousel(formatter, activeAdvanceAmount),

          const SizedBox(height: 16),

          // Monthly Salary & Payslips Quick Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 3)),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFED7AA)),
                  ),
                  child: const Icon(Icons.wallet_outlined, color: Color(0xFFEA580C), size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Monthly Salary & Payslips',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Scheduled Payday: 3rd · Bank: ${_currentUser.salaryBankName.isNotEmpty ? _currentUser.salaryBankName : _currentUser.bankName}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: _showMyPayslipsModal,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF8FAFC),
                    foregroundColor: const Color(0xFF0F172A),
                    elevation: 0,
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('View Slips', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Dual-Key Maker Checker
          if (_disbursementsAwaiting.isNotEmpty) ...[
            ..._disbursementsAwaiting.map((disb) {
              return Container(
                margin: const EdgeInsets.only(bottom: 18),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Treasury Payout Received',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF9A3412)),
                        ),
                        Text(
                          formatter.format(disb.amountNaira),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF9A3412)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${disb.title} (Ref: ${disb.reference})',
                      style: const TextStyle(fontSize: 12, color: Color(0xFFC2410C), fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => _handleConfirmPayment(disb),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEA580C),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('Confirm Received', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () => _handleReportIssue(disb),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFDC2626),
                            side: const BorderSide(color: Color(0xFFFCA5A5)),
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Discrepancy', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],

          // Quick Actions Grid (6 clean, balanced executive cards)
          const Text('Quick Actions', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildActionTile(
                  title: 'New Request',
                  subtitle: 'Operational',
                  icon: Icons.add_shopping_cart_rounded,
                  iconColor: const Color(0xFFEA580C),
                  iconBgColor: const Color(0xFFFFF7ED),
                  onTap: _openNewRequestModal,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionTile(
                  title: 'Confirm Funds',
                  subtitle: 'Dual-Key Auth',
                  icon: Icons.price_check_rounded,
                  iconColor: const Color(0xFFEA580C),
                  iconBgColor: const Color(0xFFFFF7ED),
                  onTap: () {
                    if (_disbursementsAwaiting.isNotEmpty) {
                      _handleConfirmPayment(_disbursementsAwaiting.first);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No pending disbursements to confirm at this time.')));
                    }
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildActionTile(
                  title: '72h Evidence',
                  subtitle: 'Retire Advance',
                  icon: Icons.receipt_long_rounded,
                  iconColor: const Color(0xFF0F172A),
                  iconBgColor: const Color(0xFFF1F5F9),
                  onTap: () => _navigateToTab(2),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionTile(
                  title: 'Requisitions',
                  subtitle: 'View All & Chat',
                  icon: Icons.chat_bubble_outline_rounded,
                  iconColor: const Color(0xFF0F172A),
                  iconBgColor: const Color(0xFFF1F5F9),
                  onTap: () => _navigateToTab(1),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildActionTile(
                  title: 'Enterprise Hub',
                  subtitle: 'All 8 Workstations',
                  icon: Icons.grid_view_rounded,
                  iconColor: const Color(0xFFEA580C),
                  iconBgColor: const Color(0xFFFFF7ED),
                  onTap: _openEnterpriseGallery,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionTile(
                  title: 'Admin Helpdesk',
                  subtitle: 'Chat With Admin',
                  icon: Icons.support_agent_rounded,
                  iconColor: const Color(0xFFEA580C),
                  iconBgColor: const Color(0xFFFFF7ED),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => StaffAdminChatScreen(currentUser: _currentUser),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // 1. DEDICATED PROOF OF UTILIZATION CARD (SNAP PICTURE / UPLOAD DOCUMENT)
          _buildUploadProofBannerCard(formatter),

          // 2. REAL INFOGRAPHICS SUITE (MONTHLY SPEND BAR CHART + CATEGORY SEGMENTS + SLA SCORECARD)
          _buildInfographicsSection(formatter),

          const SizedBox(height: 24),

          // Recent Activity
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Recent Requisitions', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
              GestureDetector(
                onTap: () => _navigateToTab(1),
                child: const Text('See More', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
              ),
            ],
          ),

          const SizedBox(height: 12),

          ..._requests.take(3).map((req) => _buildTransactionCard(req, formatter)),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required VoidCallback onTap,
    Color iconColor = const Color(0xFFEA580C),
    Color iconBgColor = const Color(0xFFF1F5F9),
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadProofBannerCard(NumberFormat formatter) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 20),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Upload Proof of Expenditure',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.verified_user_outlined, size: 11, color: Color(0xFF475569)),
                    SizedBox(width: 3),
                    Text(
                      '72H POLICY',
                      style: TextStyle(color: Color(0xFF475569), fontSize: 9.5, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Photograph original physical store receipts or attach vendor invoice PDFs to retire outstanding advances and clear your SLA window.',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 11.5, height: 1.35, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _openProofOfExpenditure(source: 'camera'),
                  icon: const Icon(Icons.camera_alt_rounded, size: 15, color: Colors.white),
                  label: const Text('Camera', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _openProofOfExpenditure(source: 'gallery'),
                  icon: const Icon(Icons.photo_library_rounded, size: 15, color: Color(0xFF15803D)),
                  label: const Text('Gallery', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF15803D))),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF0FDF4),
                    foregroundColor: const Color(0xFF15803D),
                    elevation: 0,
                    side: const BorderSide(color: Color(0xFFBBF7D0)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _openProofOfExpenditure(source: 'document'),
                  icon: const Icon(Icons.upload_file_rounded, size: 15, color: Color(0xFF0F172A)),
                  label: const Text('Doc / PDF', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF0F172A))),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF8FAFC),
                    foregroundColor: const Color(0xFF0F172A),
                    elevation: 0,
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _openProofOfExpenditure({required String source}) {
    if (_pendingRetirementCases.isNotEmpty) {
      _showRetirementEvidenceDialog(_pendingRetirementCases.first);
      return;
    }
    _showGeneralEvidenceUploadSheet(initialSource: source);
  }

  void _showGeneralEvidenceUploadSheet({required String initialSource}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 24),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Expenditure Evidence Scanner', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                          Text('Capture or upload receipt proofs from your phone', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline_rounded, size: 18, color: Color(0xFF0284C7)),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'You have ₦0 pending advances requiring 72h retirement. Choose Camera, Photo Gallery, or Document to test or stage proof of store receipts.',
                          style: TextStyle(fontSize: 11, color: Color(0xFF334155), height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          Navigator.pop(ctx);
                          final picker = ImagePicker();
                          final photo = await picker.pickImage(source: ImageSource.camera, maxWidth: 1600, maxHeight: 1600, imageQuality: 85);
                          if (photo != null && mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Camera snapshot captured: ${photo.name}'),
                                backgroundColor: const Color(0xFF059669),
                              ),
                            );
                          }
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFFED7AA)),
                          ),
                          child: const Column(
                            children: [
                              Icon(Icons.camera_alt_rounded, color: Color(0xFFEA580C), size: 24),
                              SizedBox(height: 6),
                              Text('Snap Camera', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF9A3412))),
                              SizedBox(height: 2),
                              Text('Live snapshot', style: TextStyle(fontSize: 9, color: Color(0xFFB45309))),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          Navigator.pop(ctx);
                          final picker = ImagePicker();
                          final photo = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, maxHeight: 1600, imageQuality: 85);
                          if (photo != null && mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Photo selected from Gallery: ${photo.name}'),
                                backgroundColor: const Color(0xFF059669),
                              ),
                            );
                          }
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: const Column(
                            children: [
                              Icon(Icons.photo_library_rounded, color: Color(0xFF16A34A), size: 24),
                              SizedBox(height: 6),
                              Text('Photo Gallery', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF15803D))),
                              SizedBox(height: 2),
                              Text('Choose photo', style: TextStyle(fontSize: 9, color: Color(0xFF166534))),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          Navigator.pop(ctx);
                          final result = await FilePicker.platform.pickFiles(
                            type: FileType.custom,
                            allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
                          );
                          if (result != null && result.files.isNotEmpty && mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Document chosen: ${result.files.first.name}'),
                                backgroundColor: const Color(0xFF059669),
                              ),
                            );
                          }
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFBFDBFE)),
                          ),
                          child: const Column(
                            children: [
                              Icon(Icons.upload_file_rounded, color: Color(0xFF2563EB), size: 24),
                              SizedBox(height: 6),
                              Text('Doc / PDF', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF1E40AF))),
                              SizedBox(height: 2),
                              Text('Attach PDF', style: TextStyle(fontSize: 9, color: Color(0xFF1D4ED8))),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInfographicsSection(NumberFormat formatter) {
    final totalAmount = _requests.fold<double>(0, (sum, r) => sum + r.amountNaira);

    if (_requests.isEmpty) {
      return Container(
        margin: const EdgeInsets.only(bottom: 24),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 14, offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Requisitions & Spend Analytics',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                    SizedBox(height: 2),
                    Text('Real-time spend aggregation & category distribution', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Text('ANALYTICS', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF475569))),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Center(
              child: Column(
                children: [
                  Icon(Icons.bar_chart_rounded, size: 48, color: Colors.grey.shade300),
                  const SizedBox(height: 10),
                  const Text('No Requisition Data Yet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF475569))),
                  const SizedBox(height: 4),
                  const Text(
                    'Requisition volumes, category allocations, and spend trends will dynamically populate here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      );
    }

    // Dynamic Category Distribution
    final categoryTotals = <String, double>{};
    for (final r in _requests) {
      final cat = r.category.trim().isNotEmpty ? r.category.trim() : 'General Ops';
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + r.amountNaira;
    }

    final categoryColors = [
      const Color(0xFFEA580C),
      const Color(0xFFF97316),
      const Color(0xFFFB923C),
      const Color(0xFFFDBA74),
      const Color(0xFF334155),
      const Color(0xFF475569),
    ];

    final sortedCats = categoryTotals.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    // Dynamic Recent Requests (up to 5)
    final recent = _requests.take(5).toList().reversed.toList();
    final maxRecentVal = recent.map((r) => r.amountNaira).fold<double>(1.0, (a, b) => a > b ? a : b);

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 14, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Requisitions & Spend Analytics',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  SizedBox(height: 2),
                  Text('Dynamic Requisition Volume & Spend Trend', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Text('ANALYTICS', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF475569))),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // 1. Dynamic Bar Chart Infographic
          SizedBox(
            height: 160,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: recent.asMap().entries.map((entry) {
                final idx = entry.key;
                final r = entry.value;
                final isLast = idx == recent.length - 1;
                final ratio = maxRecentVal > 0 ? (r.amountNaira / maxRecentVal) : 0.5;
                final barHeight = (ratio * 100).clamp(24.0, 110.0);
                final label = r.requestNumber.length > 8 ? r.requestNumber.substring(r.requestNumber.length - 4) : r.requestNumber;

                return Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      r.amountNaira >= 1000000
                          ? '₦${(r.amountNaira / 1000000).toStringAsFixed(1)}M'
                          : '₦${(r.amountNaira / 1000).toInt()}k',
                      style: TextStyle(
                        color: isLast ? const Color(0xFFEA580C) : const Color(0xFF94A3B8),
                        fontSize: 9,
                        fontWeight: isLast ? FontWeight.w800 : FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      width: 32,
                      height: barHeight,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isLast
                              ? [const Color(0xFFEA580C), const Color(0xFFFB923C)]
                              : [const Color(0xFF94A3B8), const Color(0xFFCBD5E1)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: isLast ? FontWeight.w900 : FontWeight.w600,
                        color: isLast ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 20),
          const Divider(color: Color(0xFFF1F5F9)),
          const SizedBox(height: 12),

          // 2. Category Allocation Segmented Infographic
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('CATEGORY DISTRIBUTION', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
              Text('Total: ${formatter.format(totalAmount)}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 8),

          // Dynamic Segmented Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Row(
              children: sortedCats.take(4).toList().asMap().entries.map((entry) {
                final idx = entry.key;
                final catEntry = entry.value;
                final flex = totalAmount > 0 ? ((catEntry.value / totalAmount) * 100).round() : 25;
                final color = categoryColors[idx % categoryColors.length];
                return Expanded(
                  flex: flex > 0 ? flex : 1,
                  child: Container(
                    height: 10,
                    margin: const EdgeInsets.symmetric(horizontal: 1),
                    color: color,
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 10),

          // Dynamic Legend
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: sortedCats.take(4).toList().asMap().entries.map((entry) {
              final idx = entry.key;
              final catEntry = entry.value;
              final pct = totalAmount > 0 ? ((catEntry.value / totalAmount) * 100).round() : 0;
              final color = categoryColors[idx % categoryColors.length];
              return _LegendItem(color: color, label: '${catEntry.key} ($pct%)');
            }).toList(),
          ),

          const SizedBox(height: 18),

          // 3. 72h SLA Scorecard
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.verified_rounded, color: Color(0xFF059669), size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('100% On-Time 72h SLA Clearance', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      SizedBox(height: 2),
                      Text('Average resolution time: 48h · Zero overdue strikes', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFF059669), borderRadius: BorderRadius.circular(6)),
                  child: const Text('GRADE A', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // TAB 1: REQUISITIONS DESK (DEEP IMPLEMENTATION)
  Widget _buildRequestsTab(NumberFormat formatter) {
    var filtered = _requests.where((r) {
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchCode = r.requestNumber.toLowerCase().contains(q);
        final matchTitle = r.title.toLowerCase().contains(q);
        final matchPayee = r.payeeName.toLowerCase().contains(q);
        if (!matchCode && !matchTitle && !matchPayee) return false;
      }
      final isDisbursed = r.paymentStatus == 'PAID' ||
          r.paymentStatus == 'RECIPIENT_CONFIRMED' ||
          r.accountabilityStatus == 'EVIDENCE_SUBMITTED' ||
          r.accountabilityStatus == 'CLOSED' ||
          r.accountabilityStatus == 'VERIFIED';

      if (_selectedStatusFilter == 'PENDING') return r.approvalStatus == 'SUBMITTED' || r.approvalStatus == 'IN_REVIEW';
      if (_selectedStatusFilter == 'APPROVED') return r.approvalStatus == 'APPROVED' && !isDisbursed;
      if (_selectedStatusFilter == 'PAID') return isDisbursed;
      if (_selectedStatusFilter == 'REJECTED') return r.approvalStatus == 'REJECTED';
      if (_selectedStatusFilter == 'RECURRING') return r.isRecurring;
      return true;
    }).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Expenditure Requisitions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                Text('Manage & inspect your procurement requests (${_requests.length})', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
            ElevatedButton.icon(
              onPressed: _openNewRequestModal,
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text('New', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA580C),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // Search Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                  decoration: const InputDecoration(
                    hintText: 'Search by REQ code, vendor, or item...',
                    hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Status Filter Chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildFilterChip('ALL', 'All Requests (${_requests.length})'),
              _buildFilterChip('PENDING', 'In Review'),
              _buildFilterChip('APPROVED', 'Approved'),
              _buildFilterChip('PAID', 'Disbursed'),
              _buildFilterChip('RECURRING', '🔁 Recurring'),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Donut / Pie Chart Analytics Card
        _buildRequisitionsAnalyticsCard(formatter),

        if (filtered.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Center(
              child: Text('No requisitions match your filter.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            ),
          )
        else
          ...filtered.map((req) => _buildTransactionCard(req, formatter)),
      ],
    );
  }

  Widget _buildFilterChip(String code, String label) {
    final isSelected = _selectedStatusFilter == code;
    return GestureDetector(
      onTap: () => setState(() => _selectedStatusFilter = code),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEA580C) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildRequisitionsAnalyticsCard(NumberFormat formatter) {
    if (_requests.isEmpty) return const SizedBox.shrink();

    final totalVal = _requests.fold<double>(0.0, (sum, r) => sum + r.amountNaira);
    List<PieChartSegment> segments = [];

    if (_requisitionChartMetric == 'Category') {
      final Map<String, double> catMap = {};
      final Map<String, int> countMap = {};
      for (final r in _requests) {
        catMap[r.category] = (catMap[r.category] ?? 0.0) + r.amountNaira;
        countMap[r.category] = (countMap[r.category] ?? 0) + 1;
      }
      final colorPalette = [
        const Color(0xFFEA580C), // Orange
        const Color(0xFF3B82F6), // Blue
        const Color(0xFF10B981), // Emerald
        const Color(0xFF8B5CF6), // Purple
        const Color(0xFF06B6D4), // Cyan
        const Color(0xFFF59E0B), // Amber
        const Color(0xFF64748B), // Slate
      ];
      int colorIdx = 0;
      final sorted = catMap.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
      for (final entry in sorted) {
        final label = entry.key
            .replaceAll('_', ' ')
            .toLowerCase()
            .split(' ')
            .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
            .join(' ');
        segments.add(PieChartSegment(
          label: label,
          value: entry.value,
          count: countMap[entry.key] ?? 1,
          color: colorPalette[colorIdx % colorPalette.length],
        ));
        colorIdx++;
      }
    } else {
      // By Status
      double inReviewVal = 0.0;
      int inReviewCount = 0;
      double approvedVal = 0.0;
      int approvedCount = 0;
      double disbursedVal = 0.0;
      int disbursedCount = 0;
      double rejectedVal = 0.0;
      int rejectedCount = 0;

      for (final r in _requests) {
        final isDisbursed = r.paymentStatus == 'PAID' ||
            r.paymentStatus == 'RECIPIENT_CONFIRMED' ||
            r.accountabilityStatus == 'EVIDENCE_SUBMITTED' ||
            r.accountabilityStatus == 'CLOSED' ||
            r.accountabilityStatus == 'VERIFIED';

        if (isDisbursed) {
          disbursedVal += r.amountNaira;
          disbursedCount++;
        } else if (r.approvalStatus == 'APPROVED') {
          approvedVal += r.amountNaira;
          approvedCount++;
        } else if (r.approvalStatus == 'REJECTED') {
          rejectedVal += r.amountNaira;
          rejectedCount++;
        } else {
          inReviewVal += r.amountNaira;
          inReviewCount++;
        }
      }

      if (inReviewCount > 0) {
        segments.add(PieChartSegment(
          label: 'In Review',
          value: inReviewVal > 0 ? inReviewVal : inReviewCount.toDouble(),
          count: inReviewCount,
          color: const Color(0xFFEA580C),
        ));
      }
      if (approvedCount > 0) {
        segments.add(PieChartSegment(
          label: 'Approved',
          value: approvedVal > 0 ? approvedVal : approvedCount.toDouble(),
          count: approvedCount,
          color: const Color(0xFF3B82F6),
        ));
      }
      if (disbursedCount > 0) {
        segments.add(PieChartSegment(
          label: 'Disbursed',
          value: disbursedVal > 0 ? disbursedVal : disbursedCount.toDouble(),
          count: disbursedCount,
          color: const Color(0xFF10B981),
        ));
      }
      if (rejectedCount > 0) {
        segments.add(PieChartSegment(
          label: 'Declined',
          value: rejectedVal > 0 ? rejectedVal : rejectedCount.toDouble(),
          count: rejectedCount,
          color: const Color(0xFFEF4444),
        ));
      }
    }

    String compactTotal = '';
    if (totalVal >= 1000000000000) {
      compactTotal = '₦${(totalVal / 1000000000000).toStringAsFixed(1)}T';
    } else if (totalVal >= 1000000000) {
      compactTotal = '₦${(totalVal / 1000000000).toStringAsFixed(1)}B';
    } else if (totalVal >= 1000000) {
      compactTotal = '₦${(totalVal / 1000000).toStringAsFixed(1)}M';
    } else if (totalVal >= 1000) {
      compactTotal = '₦${(totalVal / 1000).toStringAsFixed(0)}K';
    } else {
      compactTotal = '₦${totalVal.toStringAsFixed(0)}';
    }

    return BemsAnalyticsChartCard(
      title: 'Expenditure Distribution',
      subtitle: 'Allocation by ${_requisitionChartMetric.toLowerCase()} (${_requests.length} requests total)',
      icon: Icons.pie_chart_rounded,
      segments: segments,
      formatter: formatter,
      centerLabel: compactTotal,
      centerSublabel: 'TOTAL VALUE',
      activeView: _requisitionChartMetric,
      viewOptions: const ['Category', 'Status'],
      onViewChanged: (newView) {
        setState(() {
          _requisitionChartMetric = newView;
        });
      },
    );
  }

  Widget _buildSlaAnalyticsCard(NumberFormat formatter) {
    int clearedCount = _cases.where((c) {
      final s = c.status.toUpperCase();
      return s == 'CLOSED' || s == 'VERIFIED' || s == 'EVIDENCE_SUBMITTED';
    }).length;
    int inGraceCount = _cases.where((c) {
      final s = c.status.toUpperCase();
      return !c.isOverdue && s != 'CLOSED' && s != 'VERIFIED' && s != 'EVIDENCE_SUBMITTED';
    }).length;
    int overdueCount = _cases.where((c) {
      final s = c.status.toUpperCase();
      return c.isOverdue && s != 'CLOSED' && s != 'VERIFIED' && s != 'EVIDENCE_SUBMITTED';
    }).length;

    List<PieChartSegment> segments = [];
    if (clearedCount == 0 && inGraceCount == 0 && overdueCount == 0) {
      segments.add(const PieChartSegment(
        label: 'Policy Compliant (Clean)',
        value: 100,
        count: 0,
        color: Color(0xFFEA580C),
      ));
    } else {
      if (clearedCount > 0) {
        segments.add(PieChartSegment(
          label: 'Cleared & Verified',
          value: clearedCount.toDouble(),
          count: clearedCount,
          color: const Color(0xFFEA580C),
        ));
      }
      if (inGraceCount > 0) {
        segments.add(PieChartSegment(
          label: 'Active in 72h Grace',
          value: inGraceCount.toDouble(),
          count: inGraceCount,
          color: const Color(0xFFEA580C),
        ));
      }
      if (overdueCount > 0) {
        segments.add(PieChartSegment(
          label: 'Overdue Risk',
          value: overdueCount.toDouble(),
          count: overdueCount,
          color: const Color(0xFFEF4444),
        ));
      }
    }

    final totalCases = clearedCount + inGraceCount + overdueCount;
    final compliancePct = overdueCount > 0 ? ((clearedCount + inGraceCount) / totalCases * 100).round() : 100;

    return BemsAnalyticsChartCard(
      title: '72h SLA Compliance Radar',
      subtitle: 'Expense retirement compliance & deliverable audit score',
      icon: Icons.track_changes_rounded,
      segments: segments,
      formatter: formatter,
      centerLabel: '$compliancePct%',
      centerSublabel: 'COMPLIANCE',
      isCurrency: false,
      viewOptions: const [],
    );
  }

  Widget _buildTransactionCard(FundRequestItem req, NumberFormat formatter) {
    Color statusBg;
    Color statusTextColor;
    String statusLabel;

    final isDisbursed = req.paymentStatus == 'PAID' ||
        req.paymentStatus == 'RECIPIENT_CONFIRMED' ||
        req.accountabilityStatus == 'EVIDENCE_SUBMITTED' ||
        req.accountabilityStatus == 'CLOSED' ||
        req.accountabilityStatus == 'VERIFIED';

    if (isDisbursed) {
      statusBg = const Color(0xFFECFDF5);
      statusTextColor = const Color(0xFF059669);
      statusLabel = 'DISBURSED';
    } else if (req.approvalStatus == 'APPROVED') {
      statusBg = const Color(0xFFEFF6FF);
      statusTextColor = const Color(0xFF2563EB);
      statusLabel = 'Approved';
    } else if (req.approvalStatus == 'REJECTED') {
      statusBg = const Color(0xFFFEF2F2);
      statusTextColor = const Color(0xFFDC2626);
      statusLabel = 'Declined';
    } else {
      statusBg = const Color(0xFFFFF7ED);
      statusTextColor = const Color(0xFFEA580C);
      statusLabel = 'In Review';
    }

    return InkWell(
      onTap: () => _showRequisitionAuditSheet(req, formatter),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isDisbursed ? const Color(0xFF6EE7B7) : const Color(0xFFE2E8F0),
            width: isDisbursed ? 1.5 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: isDisbursed
                  ? const Color(0xFF059669).withOpacity(0.06)
                  : Colors.black.withOpacity(0.015),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: req.avatarUrl.isNotEmpty && req.avatarUrl.startsWith('http')
                      ? Image.network(
                          req.avatarUrl,
                          width: 44,
                          height: 44,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 44,
                            height: 44,
                            color: const Color(0xFFEA580C).withOpacity(0.1),
                            child: const Icon(Icons.person, color: Color(0xFFEA580C)),
                          ),
                        )
                      : Container(
                          width: 44,
                          height: 44,
                          color: const Color(0xFFEA580C).withOpacity(0.1),
                          child: const Icon(Icons.person, color: Color(0xFFEA580C)),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              req.title.isNotEmpty ? req.title : (req.purpose.isNotEmpty ? req.purpose : req.requestNumber),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (req.isRecurring)
                            Container(
                              margin: const EdgeInsets.only(left: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(5),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: const Text('🔁 RECURRING', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Color(0xFF1D4ED8))),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          req.requestNumber,
                          if (req.subsidiary.isNotEmpty) req.subsidiary,
                          if (req.dueDate.isNotEmpty && req.dueDate.trim() != 'Due:')
                            'Due: ${req.dueDate.split(",").first.replaceAll("Due:", "").trim()}',
                        ].where((s) => s.isNotEmpty).join(' · '),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatter.format(req.amountNaira),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: statusTextColor),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Request Collaboration Chat Button
                    InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => RequestChatScreen(
                              requestNumber: req.requestNumber,
                              requestTitle: req.title.isNotEmpty ? req.title : req.payeeName,
                              currentUser: _currentUser,
                            ),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFED7AA)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.chat_bubble_outline_rounded, size: 12, color: Color(0xFFEA580C)),
                            SizedBox(width: 4),
                            Text(
                              'Request Chat',
                              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (req.approvalStatus != 'APPROVED') ...[
                      const SizedBox(width: 6),
                      InkWell(
                        onTap: () => _confirmDeleteRequest(req),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFFECACA)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.delete_outline_rounded, size: 12, color: Color(0xFFDC2626)),
                              SizedBox(width: 3),
                              Text(
                                'Delete',
                                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),

                if (req.paymentStatus == 'PAID' && req.accountabilityStatus != 'EVIDENCE_SUBMITTED' && req.accountabilityStatus != 'CLOSED' && req.accountabilityStatus != 'VERIFIED')
                  InkWell(
                    onTap: () {
                      final target = _cases.firstWhere(
                        (item) => item.requestNumber == req.requestNumber,
                        orElse: () => _cases.isNotEmpty
                            ? _cases.first
                            : AccountabilityCaseItem(
                                id: 'case-paid',
                                requestNumber: req.requestNumber,
                                title: req.title,
                                amountNaira: req.amountNaira,
                                hoursRemaining: 28,
                                bankReference: 'BEMS-TRX-2026-9041',
                                disbursedAt: 'Today',
                              ),
                      );
                      _showRetirementEvidenceDialog(target);
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEA580C),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.upload_file_rounded, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text('Upload Proof', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Colors.white)),
                        ],
                      ),
                    ),
                  )
                else
                  const Row(
                    children: [
                      Text(
                        'Details & Audit',
                        style: TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.w700),
                      ),
                      SizedBox(width: 2),
                      Icon(Icons.chevron_right_rounded, size: 14, color: Color(0xFF94A3B8)),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // TAB 2: 72H SLA EVIDENCE RETIREMENT (DEEP IMPLEMENTATION)
  Widget _buildRetirementTab(NumberFormat formatter) {
    final nearestCase = _pendingRetirementCases.isNotEmpty
        ? _pendingRetirementCases.first
        : (_activeAdvanceCases.isNotEmpty ? _activeAdvanceCases.first : null);
    final hoursRemaining = nearestCase != null ? nearestCase.hoursRemaining : 72;
    final hoursElapsed = (72 - hoursRemaining).clamp(0, 72);
    final progress = nearestCase != null ? (hoursElapsed / 72.0).clamp(0.0, 1.0) : 1.0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
      children: [
        const Text(
          '72-Hour SLA Command Center',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 2),
        const Text(
          'Expense receipt retirement & deliverable compliance tracking',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),

        const SizedBox(height: 18),

        // Visual Countdown Radar Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ACTIVE SLA RADAR', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: nearestCase != null && nearestCase.status == 'EVIDENCE_SUBMITTED'
                          ? const Color(0xFFFFF7ED)
                          : (nearestCase != null ? const Color(0xFFFEF3C7) : const Color(0xFFFFF7ED)),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFED7AA)),
                    ),
                    child: Text(
                      nearestCase != null
                          ? (nearestCase.status == 'EVIDENCE_SUBMITTED' ? 'IN FINANCE REVIEW' : 'ACTIVE ADVANCE')
                          : 'POLICY COMPLIANT',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: nearestCase != null && nearestCase.status == 'EVIDENCE_SUBMITTED'
                            ? const Color(0xFFEA580C)
                            : (nearestCase != null ? const Color(0xFFD97706) : const Color(0xFFEA580C)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  // Circular Progress Indicator
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 64,
                        height: 64,
                        child: CircularProgressIndicator(
                          value: progress,
                          strokeWidth: 6,
                          backgroundColor: const Color(0xFFF1F5F9),
                          valueColor: AlwaysStoppedAnimation<Color>(
                            nearestCase != null
                                ? (nearestCase.status == 'EVIDENCE_SUBMITTED' ? const Color(0xFFEA580C) : const Color(0xFFEA580C))
                                : const Color(0xFFEA580C),
                          ),
                        ),
                      ),
                      Text(nearestCase != null ? '${hoursRemaining}h' : '0h', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
                    ],
                  ),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          nearestCase != null
                              ? (nearestCase.status == 'EVIDENCE_SUBMITTED'
                                  ? 'Evidence Submitted · Awaiting Finance Verification'
                                  : '$hoursElapsed Hours Elapsed · $hoursRemaining Hours Left')
                              : '100% Policy Compliant · 0 Advances Due',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          nearestCase != null
                              ? (nearestCase.status == 'EVIDENCE_SUBMITTED'
                                  ? 'Receipts for ${nearestCase.requestNumber} are submitted and under review by Finance.'
                                  : 'Physical receipts for ${nearestCase.requestNumber} must be photographed and submitted before deadline.')
                              : 'All operational funds are fully accounted for. Great job maintaining company compliance!',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 18),

        // 72h SLA Compliance Donut / Pie Chart
        _buildSlaAnalyticsCard(formatter),

        const SizedBox(height: 18),

        const Text('Active Advances Requiring Proof', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
        const SizedBox(height: 12),

        if (_activeAdvanceCases.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.verified_user_rounded, color: Color(0xFFEA580C), size: 48),
                  SizedBox(height: 12),
                  Text('Zero Advance Liabilities', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                  SizedBox(height: 4),
                  Text('All your past cash advances are 100% reconciled and cleared by Finance.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ],
              ),
            ),
          )
        else
          ..._activeAdvanceCases.map((c) {
            final isSubmitted = c.status == 'EVIDENCE_SUBMITTED';

            return Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: isSubmitted ? const Color(0xFFFFF7ED) : Colors.white,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: isSubmitted
                      ? const Color(0xFFFED7AA)
                      : (c.isOverdue ? const Color(0xFFFCA5A5) : const Color(0xFFFDE68A)),
                ),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: c.avatarUrl.isNotEmpty && c.avatarUrl.startsWith('http')
                                ? Image.network(
                                    c.avatarUrl,
                                    width: 32,
                                    height: 32,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      width: 32,
                                      height: 32,
                                      color: const Color(0xFFEA580C).withOpacity(0.1),
                                      child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 18),
                                    ),
                                  )
                                : Container(
                                    width: 32,
                                    height: 32,
                                    color: const Color(0xFFEA580C).withOpacity(0.1),
                                    child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 18),
                                  ),
                          ),
                          const SizedBox(width: 8),
                          Text(c.requestNumber, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isSubmitted
                              ? const Color(0xFFFFF7ED)
                              : (c.isOverdue ? const Color(0xFFFEF2F2) : const Color(0xFFFEF3C7)),
                          borderRadius: BorderRadius.circular(8),
                          border: isSubmitted ? Border.all(color: const Color(0xFFFED7AA)) : null,
                        ),
                        child: Text(
                          isSubmitted
                              ? '● Evidence Submitted (Review)'
                              : (c.isOverdue ? '24h Overdue' : '${c.hoursRemaining}h Left'),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: isSubmitted
                                ? const Color(0xFFEA580C)
                                : (c.isOverdue ? const Color(0xFFDC2626) : const Color(0xFFD97706)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(c.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 4),
                  Text('Disbursed Amount: ${formatter.format(c.amountNaira)} · Ref: ${c.bankReference}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSubmitted ? Colors.white : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isSubmitted ? const Color(0xFFFED7AA) : const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Required Proof: ${c.requiredDeliverables}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    onPressed: () => _showRetirementEvidenceDialog(c),
                    icon: Icon(isSubmitted ? Icons.check_circle_rounded : Icons.camera_alt_rounded, size: 16),
                    label: Text(
                      isSubmitted ? 'Evidence Submitted (Update Proof)' : 'Upload Physical Receipts & GRN',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                  ),
                ],
              ),
            );
          }),

        const SizedBox(height: 16),

        // History Archive Section
        const Text('Cleared Retirement Archive', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
        const SizedBox(height: 10),

        Builder(
          builder: (context) {
            final clearedRequests = _requests.where((r) {
              final acc = r.accountabilityStatus.toUpperCase();
              return acc == 'CLOSED' || acc == 'VERIFIED';
            }).toList();

            if (clearedRequests.isNotEmpty) {
              return Column(
                children: clearedRequests.map((r) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
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
                          decoration: const BoxDecoration(color: Color(0xFFFFF7ED), shape: BoxShape.circle),
                          child: const Icon(Icons.check_circle_rounded, color: Color(0xFFEA580C), size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${r.requestNumber} · ${r.title}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                              Text('${formatter.format(r.amountNaira)} · ${r.department}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFFED7AA))),
                          child: Text(r.accountabilityStatus.isNotEmpty ? r.accountabilityStatus : 'CLEARED', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );
            }

            return Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.inventory_2_outlined, color: Color(0xFF94A3B8), size: 24),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'No retired advances archived yet. Completed accountability reconciliations will be archived here.',
                      style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Future<void> _changeProfileAvatar() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Update Passport Photograph', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 16),
              ListTile(
                leading: const CircleAvatar(backgroundColor: Color(0xFFFFF7ED), child: Icon(Icons.camera_alt_rounded, color: Color(0xFFEA580C))),
                title: const Text('Take New Photo with Camera', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                subtitle: const Text('Capture direct passport face photograph', style: TextStyle(fontSize: 11)),
                onTap: () async {
                  Navigator.pop(ctx);
                  await _pickAndUploadProfileAvatar(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const CircleAvatar(backgroundColor: Color(0xFFEFF6FF), child: Icon(Icons.photo_library_rounded, color: Color(0xFF2563EB))),
                title: const Text('Choose from Photo Gallery', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                subtitle: const Text('Select existing photo from phone files', style: TextStyle(fontSize: 11)),
                onTap: () async {
                  Navigator.pop(ctx);
                  await _pickAndUploadProfileAvatar(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickAndUploadProfileAvatar(ImageSource source) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (photo == null) return;

      messenger.showSnackBar(
        const SnackBar(content: Text('Uploading passport photograph...'), duration: Duration(seconds: 2)),
      );

      final bytes = await photo.readAsBytes();
      final newUrl = await StaffApiService.uploadAvatar(
        bytes: bytes,
        filename: photo.name,
        employeeId: _currentUser.id,
        token: _currentUser.token,
      );

      await StaffApiService.updateEmployeeAvatar(
        employeeId: _currentUser.id,
        avatarUrl: newUrl,
        token: _currentUser.token,
      );

      final updatedUser = _currentUser.copyWith(avatarUrl: newUrl);

      await StaffStorageService.saveUser(updatedUser);
      if (mounted) {
        setState(() {
          _currentUser = updatedUser;
        });
        messenger.showSnackBar(
          const SnackBar(content: Text('✓ Passport photograph updated successfully!'), backgroundColor: Color(0xFF059669)),
        );
      }
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Failed to update photo: $e'), backgroundColor: const Color(0xFFDC2626)),
      );
    }
  }

  // TAB 3: COMPLETE STAFF PROFILE & REGISTRATION DETAILS
  Widget _buildProfileTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        const Text(
          'Staff Identity & Credentials',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 2),
        const Text(
          'Personal details, corporate placement & authorized disbursal accounts',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),

        const SizedBox(height: 20),

        // 1. Employee Identity Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
            ],
          ),
          child: Row(
            children: [
              InkWell(
                onTap: _changeProfileAvatar,
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: _currentUser.avatarUrl.isNotEmpty && _currentUser.avatarUrl.startsWith('http')
                          ? Image.network(
                              _currentUser.avatarUrl,
                              width: 64,
                              height: 64,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 64,
                                height: 64,
                                color: const Color(0xFFEA580C).withOpacity(0.1),
                                child: const Icon(Icons.person, color: Color(0xFFEA580C), size: 32),
                              ),
                            )
                          : Container(
                              width: 64,
                              height: 64,
                              color: const Color(0xFFEA580C).withOpacity(0.1),
                              child: const Icon(Icons.person, color: Color(0xFFEA580C), size: 32),
                            ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEA580C),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.camera_alt_rounded, size: 12, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_currentUser.fullName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                    const SizedBox(height: 2),
                    Text(_currentUser.jobTitle, style: const TextStyle(fontSize: 11.5, color: Color(0xFFEA580C), fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('${_currentUser.subsidiary} · ${_currentUser.department}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                      child: Text('EMP CODE: ${_currentUser.employeeNumber}', style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF475569))),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Shift Attendance Card (Moved from Home under Profile)
        _buildShiftAttendanceCard(),

        const SizedBox(height: 20),

        // 2. Personal Information Section
        _buildProfileSectionHeader('PERSONAL IDENTITY & CONTACT'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              _buildDataRow(
                label: 'Corporate Email',
                value: _currentUser.email,
                icon: Icons.email_outlined,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Phone Number',
                value: _currentUser.phone,
                icon: Icons.phone_outlined,
                actionLabel: 'Edit',
                onAction: _showUpdatePhoneDialog,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Gender & Date of Birth',
                value: '${_currentUser.gender} · ${_currentUser.dateOfBirth}',
                icon: Icons.cake_outlined,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Residential Address',
                value: '${_currentUser.residentialAddress}, ${_currentUser.cityState}',
                icon: Icons.home_outlined,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Origin & Statutory',
                value: '${_currentUser.lga}, ${_currentUser.stateOfOrigin} · Marital: ${_currentUser.maritalStatus}',
                icon: Icons.location_city_outlined,
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 3. Corporate Placement Section
        _buildProfileSectionHeader('CORPORATE & EMPLOYMENT DETAILS'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              _buildDataRow(label: 'Subsidiary Entity', value: _currentUser.subsidiary, icon: Icons.business_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Department Unit', value: _currentUser.department, icon: Icons.work_outline_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Employment Type & Grade', value: '${_currentUser.employmentType} (${_currentUser.staffGrade})', icon: Icons.badge_outlined),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Work Location & Resumption', value: '${_currentUser.workLocation} · Resumed: ${_currentUser.resumptionDate}', icon: Icons.pin_drop_outlined),
            ],
          ),
        ),

        // Monthly Salary & Payslips Section
        _buildProfileSectionHeader('MONTHLY SALARY & PAYSLIP VOUCHERS'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 3)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('OFFICIAL MONTHLY SALARY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFFED7AA))),
                    child: const Text('PAYDAY: 3RD', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text('Review statutory gross-to-net salary breakdown, past payment vouchers, and confirm bank transfer receipt.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4)),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _showMyPayslipsModal,
                  icon: const Icon(Icons.wallet_outlined, size: 17, color: Colors.white),
                  label: const Text('View My Salary & Payslips', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 4. Dual Banking Section
        _buildProfileSectionHeader('DISBURSEMENT & SALARY BANK ACCOUNTS'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Operational Advance Bank
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('PRIMARY DISBURSAL ACCOUNT (ADVANCES)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(6)),
                    child: const Text('VERIFIED', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF059669))),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(_currentUser.bankName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
              Text('Account: ${_currentUser.accountNumber} · ${_currentUser.accountName}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontFamily: 'monospace')),

              const Divider(color: Color(0xFFE2E8F0), height: 24),

              // Salary Bank
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('PAYROLL / SALARY ACCOUNT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF475569), letterSpacing: 0.8)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                    child: const Text('ACTIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF475569))),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(_currentUser.salaryBankName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
              Text('Account: ${_currentUser.salaryAccountNumber} · ${_currentUser.salaryAccountName}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontFamily: 'monospace')),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _showUpdateBankAccountsDialog,
                  icon: const Icon(Icons.account_balance_wallet_outlined, size: 16, color: Color(0xFFEA580C)),
                  label: const Text('Change / Update Bank Accounts', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFFED7AA)),
                    backgroundColor: const Color(0xFFFFF7ED),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 5. Emergency & Next of Kin
        _buildProfileSectionHeader('EMERGENCY CONTACT & NEXT OF KIN'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              _buildDataRow(label: 'Next of Kin Name', value: _currentUser.nextOfKinName, icon: Icons.person_outline_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Relationship', value: _currentUser.nextOfKinRelationship, icon: Icons.family_restroom_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Contact Phone', value: _currentUser.nextOfKinPhone, icon: Icons.phone_android_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Address', value: _currentUser.nextOfKinAddress, icon: Icons.map_outlined),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 6. Security & Credentials
        _buildProfileSectionHeader('SECURITY & CREDENTIALS'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                secondary: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFFFF7ED), shape: BoxShape.circle),
                  child: const Icon(Icons.fingerprint_rounded, color: Color(0xFFEA580C), size: 20),
                ),
                title: const Text('Fingerprint & Biometric Sign-In', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: Text(
                  _isBiometricEnabled
                      ? 'Active · Fingerprint required to unlock'
                      : (_isBiometricConfigured
                          ? 'Temporarily paused · Tap to reactivate'
                          : 'Not configured · Tap switch to enroll'),
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
                activeColor: const Color(0xFFEA580C),
                value: _isBiometricEnabled,
                onChanged: _toggleBiometric,
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFFFF7ED), shape: BoxShape.circle),
                  child: const Icon(Icons.support_agent_rounded, color: Color(0xFFEA580C), size: 20),
                ),
                title: const Text('Finance & Admin Helpdesk Chat', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: const Text('Direct messaging with Executive Admin & GMD', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => StaffAdminChatScreen(currentUser: _currentUser),
                    ),
                  );
                },
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFFFF7ED), shape: BoxShape.circle),
                  child: const Icon(Icons.lock_reset_rounded, color: Color(0xFFEA580C), size: 20),
                ),
                title: const Text('Change Password', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: const Text('Update your corporate login credentials', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: _showChangePasswordDialog,
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
                  child: const Icon(Icons.phone_iphone_rounded, color: Color(0xFF2563EB), size: 20),
                ),
                title: const Text('Update Contact Phone Number', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: Text('Current: ${_currentUser.phone}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: _showUpdatePhoneDialog,
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFF0FDF4), shape: BoxShape.circle),
                  child: const Icon(Icons.account_balance_rounded, color: Color(0xFF16A34A), size: 20),
                ),
                title: const Text('Change Bank Account Details', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: Text('Advance: ${_currentUser.bankName} · ${_currentUser.accountNumber}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: _showUpdateBankAccountsDialog,
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Enterprise Workstation Gallery Switcher
        OutlinedButton.icon(
          onPressed: _openEnterpriseGallery,
          icon: const Icon(Icons.grid_view_rounded, size: 16, color: Color(0xFF0F172A)),
          label: const Text('Open Enterprise Modules Gallery', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A))),
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Color(0xFFCBD5E1)),
            backgroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),

        const SizedBox(height: 14),

        // Download Android APK (Available under profile for web users)
        if (kIsWeb) ...[
          OutlinedButton.icon(
            onPressed: _downloadAndroidApk,
            icon: const Icon(Icons.download_rounded, size: 16, color: Color(0xFFEA580C)),
            label: const Text('Download Android Mobile App (v1.3.8)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFFEA580C))),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFFED7AA)),
              backgroundColor: const Color(0xFFFFF7ED),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Logout
        OutlinedButton.icon(
          onPressed: _handleLogout,
          icon: const Icon(Icons.logout_rounded, size: 16, color: Color(0xFFDC2626)),
          label: const Text('Sign Out of Staff Workspace', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFFDC2626))),
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Color(0xFFFCA5A5)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileSectionHeader(String text) {
    return Text(
      text,
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8),
    );
  }

  Widget _buildDataRow({
    required String label,
    required String value,
    required IconData icon,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFF94A3B8)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
            ],
          ),
        ),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFFEDD5)),
              ),
              child: Text(actionLabel, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
            ),
          ),
      ],
    );
  }

  Widget _buildMultiMetricFinancialCarousel(NumberFormat formatter, double activeAdvanceAmount) {
    final lifetimeRaised = _requests.fold<double>(0.0, (acc, r) => acc + r.amountNaira);
    final approvedCount = _requests.where((r) => r.approvalStatus.toUpperCase() == 'APPROVED' || r.approvalStatus.toUpperCase() == 'SETTLED' || r.paymentStatus.toUpperCase() == 'DISBURSED').length;
    final rejectedCount = _requests.where((r) => r.approvalStatus.toUpperCase() == 'REJECTED').length;

    final pendingCases = _requests.where((r) => r.approvalStatus.toUpperCase() == 'PENDING' || r.approvalStatus.toUpperCase() == 'SUBMITTED' || r.approvalStatus.toUpperCase() == 'APPROVED_AWAITING_DISBURSEMENT').toList();
    final pendingValue = pendingCases.fold<double>(0.0, (acc, r) => acc + r.amountNaira);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 236,
          child: PageView(
            controller: _priceCardController,
            onPageChanged: (idx) => setState(() => _priceCardPage = idx),
            children: [
              // Slide 1: BEMS Digital Wallet & Operational Advance
              _buildHeroCardContainer(
                gradientColors: const [Color(0xFFEA580C), Color(0xFFC2410C), Color(0xFF9A3412)],
                shadowColor: const Color(0xFFEA580C).withOpacity(0.32),
                title: 'BEMS DIGITAL WALLET & ADVANCES',
                canHideBalance: true,
                valueText: _hideBalance
                    ? '₦ ••••••••'
                    : (_walletData != null && _walletData!['availableMinor'] != null
                        ? walletMoney(_walletData!['availableMinor'].toString())
                        : formatter.format(activeAdvanceAmount)),
                subText: 'Avail: ${_walletData != null ? walletMoney(_walletData!['availableMinor']?.toString() ?? "0") : "₦0"} · Adv. Held: ${formatter.format(activeAdvanceAmount)}',
                statusBadge: _walletData != null && (BigInt.tryParse(_walletData!['availableMinor']?.toString() ?? '0') ?? BigInt.zero) > BigInt.zero
                    ? 'Ready for Direct Bank Withdrawal'
                    : (_submittedUnderReviewCases.isNotEmpty
                        ? 'Evidence Submitted · Awaiting Clearance'
                        : (_pendingRetirementCases.isNotEmpty
                            ? '${_pendingRetirementCases.length} Pending 72h Retirement'
                            : 'Wallet Active · Company Pays Fees')),
                primaryActionLabel: 'Withdraw to Bank',
                primaryActionIcon: Icons.arrow_upward_rounded,
                primaryActionColor: const Color(0xFFEA580C),
                onPrimaryAction: () {
                  _navigateToTab(3);
                },
              ),

              // Slide 2: Lifetime Requests Raised
              _buildHeroCardContainer(
                gradientColors: const [Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF334155)],
                shadowColor: const Color(0xFF0F172A).withOpacity(0.35),
                title: 'LIFETIME REQUISITIONS RAISED',
                canHideBalance: true,
                valueText: _hideBalance ? '₦ ••••••••' : formatter.format(lifetimeRaised),
                subText: '$approvedCount Approved · $rejectedCount Rejected · ${_requests.length} Total Raised',
                statusBadge: '${_requests.length} Total Submissions in Career',
                primaryActionLabel: 'New Request',
                primaryActionIcon: Icons.add_circle_outline_rounded,
                primaryActionColor: const Color(0xFF0F172A),
                onPrimaryAction: _openNewRequestModal,
                secondaryActionLabel: 'View History',
                secondaryActionIcon: Icons.history_rounded,
                onSecondaryAction: () => _navigateToTab(1),
              ),

              // Slide 3: Pending Pipeline Value
              _buildHeroCardContainer(
                gradientColors: const [Color(0xFF0369A1), Color(0xFF0284C7), Color(0xFF0EA5E9)],
                shadowColor: const Color(0xFF0284C7).withOpacity(0.32),
                title: 'PENDING PIPELINE VALUE',
                canHideBalance: true,
                valueText: _hideBalance ? '₦ ••••••••' : formatter.format(pendingValue),
                subText: '${pendingCases.length} in transit awaiting GMD / Treasury action',
                statusBadge: pendingCases.isNotEmpty ? 'Awaiting Action' : 'All Clear · No Pending Requests',
                primaryActionLabel: 'Track Pipeline',
                primaryActionIcon: Icons.timeline_rounded,
                primaryActionColor: const Color(0xFF0284C7),
                onPrimaryAction: () => _navigateToTab(1),
                secondaryActionLabel: 'Confirm Funds',
                secondaryActionIcon: Icons.price_check_rounded,
                onSecondaryAction: () {
                  if (_disbursementsAwaiting.isNotEmpty) {
                    _handleConfirmPayment(_disbursementsAwaiting.first);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('No pending disbursements to confirm at this time.')),
                    );
                  }
                },
              ),

              // Slide 4: Monthly Remuneration & Payroll
              _buildHeroCardContainer(
                gradientColors: const [Color(0xFF065F46), Color(0xFF047857), Color(0xFF059669)],
                shadowColor: const Color(0xFF047857).withOpacity(0.32),
                title: 'MONTHLY REMUNERATION & PAYROLL',
                canHideBalance: false,
                valueText: 'Payday: 3rd',
                subText: 'Bank: ${_currentUser.salaryBankName.isNotEmpty ? _currentUser.salaryBankName : (_currentUser.bankName.isNotEmpty ? _currentUser.bankName : "Corporate Payroll")}',
                statusBadge: 'Verified Payroll Account',
                primaryActionLabel: 'View Payslips',
                primaryActionIcon: Icons.receipt_long_rounded,
                primaryActionColor: const Color(0xFF047857),
                onPrimaryAction: _showMyPayslipsModal,
                secondaryActionLabel: 'Update Bank',
                secondaryActionIcon: Icons.account_balance_wallet_rounded,
                onSecondaryAction: () => _navigateToTab(3),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        // Dots Indicator
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(4, (index) {
            final isActive = _priceCardPage == index;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: isActive ? 22 : 7,
              height: 7,
              decoration: BoxDecoration(
                color: isActive ? const Color(0xFFEA580C) : const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(4),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildHeroCardContainer({
    required List<Color> gradientColors,
    required Color shadowColor,
    required String title,
    required bool canHideBalance,
    required String valueText,
    required String subText,
    String? statusBadge,
    required String primaryActionLabel,
    required IconData primaryActionIcon,
    required Color primaryActionColor,
    required VoidCallback onPrimaryAction,
    String? secondaryActionLabel,
    IconData? secondaryActionIcon,
    VoidCallback? onSecondaryAction,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: shadowColor,
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(26),
        child: Stack(
          children: [
            Positioned(
              bottom: -35,
              left: -35,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withOpacity(0.08),
                ),
              ),
            ),
            Positioned(
              top: -18,
              right: -18,
              child: Opacity(
                opacity: 0.14,
                child: Image.asset(
                  'assets/images/bems-mark.png',
                  width: 155,
                  height: 155,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              shape: BoxShape.circle,
                            ),
                            child: Image.asset(
                              'assets/images/bems-mark.png',
                              width: 13,
                              height: 13,
                              errorBuilder: (_, __, ___) => Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            title,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: Colors.white.withOpacity(0.9),
                            ),
                          ),
                        ],
                      ),
                      if (canHideBalance)
                        GestureDetector(
                          onTap: () => setState(() => _hideBalance = !_hideBalance),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.12),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              _hideBalance ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                              color: Colors.white,
                              size: 17,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    valueText,
                    style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.8),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.account_balance_rounded, size: 13, color: Colors.white.withOpacity(0.75)),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          subText,
                          style: TextStyle(fontSize: 11.5, color: Colors.white.withOpacity(0.85), fontWeight: FontWeight.w500),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  if (statusBadge != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.16),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.25)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            statusBadge,
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const Spacer(),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: onPrimaryAction,
                          icon: Icon(primaryActionIcon, size: 16, color: primaryActionColor),
                          label: Text(
                            primaryActionLabel,
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: primaryActionColor),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            elevation: 2,
                            shadowColor: Colors.black.withOpacity(0.2),
                            padding: const EdgeInsets.symmetric(vertical: 11),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                      if (secondaryActionLabel != null && onSecondaryAction != null) ...[
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: onSecondaryAction,
                            icon: Icon(secondaryActionIcon ?? Icons.arrow_forward_rounded, size: 16, color: Colors.white),
                            label: Text(
                              secondaryActionLabel,
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white.withOpacity(0.22),
                              elevation: 0,
                              side: BorderSide(color: Colors.white.withOpacity(0.35)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          ),
                        ),
                      ],
                    ],
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

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
      ],
    );
  }
}
