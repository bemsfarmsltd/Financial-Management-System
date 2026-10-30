import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../models/staff_models.dart';
import '../services/staff_api_service.dart';

class AttendanceScanScreen extends StatefulWidget {
  final StaffUser currentUser;
  final bool isCheckIn;

  const AttendanceScanScreen({
    super.key,
    required this.currentUser,
    this.isCheckIn = true,
  });

  @override
  State<AttendanceScanScreen> createState() => _AttendanceScanScreenState();
}

class _AttendanceScanScreenState extends State<AttendanceScanScreen>
    with SingleTickerProviderStateMixin {
  static const Color brandOrange = Color(0xFFEA580C);
  static const Color cobaltDark = Color(0xFF0F172A);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);

  late final MobileScannerController _scannerController;
  late final AnimationController _laserController;
  late final Animation<double> _laserAnimation;

  bool _isTorchOn = false;
  bool _isFrontCamera = false;
  bool _isPunching = false;
  bool _hasScanned = false;

  bool _isVerifyingGates = true;
  bool _isStarlinkConnected = false;
  bool _isGeofenceVerified = false;

  @override
  void initState() {
    super.initState();
    _laserController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);

    _laserAnimation = CurvedAnimation(
      parent: _laserController,
      curve: Curves.easeInOut,
    );

    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
    );

    _verifySecurityGates();
  }

  @override
  void dispose() {
    _laserController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _verifySecurityGates() async {
    setState(() => _isVerifyingGates = true);
    try {
      final check = await StaffApiService.verifyGeofence(
        employeeId: widget.currentUser.id,
        latitude: 6.4281,
        longitude: 3.4219,
        token: widget.currentUser.token,
      );
      if (!mounted) return;
      setState(() {
        _isVerifyingGates = false;
        _isStarlinkConnected = check['isIpAllowed'] == true;
        _isGeofenceVerified = check['isInsideGeofence'] == true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isVerifyingGates = false;
      });
    }
  }

  void _handleBarcodeDetected(BarcodeCapture capture) {
    if (_isPunching || _hasScanned) return;

    final barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final raw = barcode.rawValue;
      if (raw != null && raw.trim().isNotEmpty) {
        _hasScanned = true;
        _punchWithToken(raw.trim());
        break;
      }
    }
  }

  Future<void> _punchWithToken(String token) async {
    if (_isPunching) return;
    setState(() => _isPunching = true);

    try {
      final res = await StaffApiService.punchAttendance(
        employeeId: widget.currentUser.id,
        qrToken: token,
        latitude: 6.4281,
        longitude: 3.4219,
        type: widget.isCheckIn ? 'CHECK_IN' : 'CHECK_OUT',
        token: widget.currentUser.token,
      );

      if (!mounted) return;
      setState(() => _isPunching = false);
      _showPunchSuccessSheet(res);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isPunching = false;
        _hasScanned = false; // allow retry
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: const Color(0xFFDC2626),
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  void _showPunchSuccessSheet(Map<String, dynamic> data) {
    final record = data['record'] ?? {};
    final checkInTime = record['checkInTime'] ?? 'Registered';
    final status = record['status'] ?? (widget.isCheckIn ? 'PRESENT' : 'COMPLETED');

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          boxShadow: [
            BoxShadow(
              color: Colors.black12,
              blurRadius: 30,
              offset: Offset(0, -10),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              height: 64,
              width: 64,
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF059669),
                size: 34,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              widget.isCheckIn ? 'Clock-In Registered!' : 'Clock-Out Registered!',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: textPrimary,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Dynamic QR & Starlink Geofence verified successfully.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.isCheckIn ? 'Check-In Time' : 'Check-Out Time',
                        style: const TextStyle(fontSize: 11, color: textSecondary),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        checkInTime.toString(),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0284C7),
                        ),
                      ),
                    ],
                  ),
                  Container(height: 32, width: 1, color: const Color(0xFFE2E8F0)),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Shift Status',
                        style: TextStyle(fontSize: 11, color: textSecondary),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        status.toString().toUpperCase(),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: status == 'LATE' ? const Color(0xFFEA580C) : const Color(0xFF059669),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop(true);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: cobaltDark,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: const Text(
                  'Done & Return',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showManualTokenSheet() {
    final tokenController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Manual Token Entry',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textPrimary),
              ),
              const SizedBox(height: 6),
              const Text(
                'If your camera has difficulty focusing, paste or enter the rotating code from the kiosk.',
                style: TextStyle(fontSize: 12, color: textSecondary),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: tokenController,
                autofocus: true,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                decoration: InputDecoration(
                  hintText: 'e.g. bems_stk_...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(Icons.qr_code_rounded, size: 20),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    final t = tokenController.text.trim();
                    if (t.isNotEmpty) {
                      Navigator.of(ctx).pop();
                      _punchWithToken(t);
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: brandOrange,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Submit Attendance Token', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: Container(
              height: 38,
              width: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: textPrimary),
            ),
          ),
        ),
        centerTitle: true,
        title: Column(
          children: [
            Text(
              widget.isCheckIn ? 'Attendance Scanner' : 'Check-Out Scanner',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            const Text(
              'BEMS Enterprise Timekeeping',
              style: TextStyle(
                fontSize: 11,
                color: textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Column(
            children: [
              const SizedBox(height: 6),

              // Airplane Window Squircle Viewport
              Center(
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    // Outer Aircraft Beveled Rim
                    Container(
                      width: 290,
                      height: 380,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(95),
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Colors.white,
                            Color(0xFFE2E8F0),
                            Color(0xFFCBD5E1),
                          ],
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x280F172A),
                            blurRadius: 40,
                            offset: Offset(0, 20),
                          ),
                          BoxShadow(
                            color: Colors.white,
                            blurRadius: 4,
                            offset: Offset(-2, -2),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.all(14),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(82),
                          color: const Color(0xFF040711),
                          boxShadow: const [
                            BoxShadow(
                              color: Colors.black45,
                              blurRadius: 15,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            // Live Mobile Camera Feed
                            MobileScanner(
                              controller: _scannerController,
                              onDetect: _handleBarcodeDetected,
                              errorBuilder: (context, error, child) {
                                return Container(
                                  color: const Color(0xFF0F172A),
                                  padding: const EdgeInsets.all(20),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.videocam_off_rounded, color: Colors.white70, size: 40),
                                      const SizedBox(height: 10),
                                      const Text(
                                        'Camera Viewfinder',
                                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        error.errorDetails?.message ?? 'Please allow camera permission',
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(color: Colors.white60, fontSize: 11),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),

                            // Animated Laser Beam
                            AnimatedBuilder(
                              animation: _laserAnimation,
                              builder: (context, child) {
                                return Positioned(
                                  top: 30 + (_laserAnimation.value * 270),
                                  left: 0,
                                  right: 0,
                                  child: Container(
                                    height: 3,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [
                                          Colors.transparent,
                                          brandOrange,
                                          Color(0xFFFDBA74),
                                          Colors.transparent,
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: brandOrange.withOpacity(0.8),
                                          blurRadius: 12,
                                          spreadRadius: 2,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),

                            // Corner Reticles
                            Center(
                              child: Container(
                                width: 160,
                                height: 160,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.4),
                                    width: 2.5,
                                  ),
                                ),
                              ),
                            ),

                            // Aircraft Window Glass Glare (Upper 45%)
                            Positioned(
                              top: 0,
                              left: 0,
                              right: 0,
                              height: 140,
                              child: IgnorePointer(
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(82)),
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        Colors.white.withOpacity(0.18),
                                        Colors.transparent,
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),

                            // In-flight Punching Spinner Overlay
                            if (_isPunching)
                              Container(
                                color: Colors.black54,
                                child: const Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                                      SizedBox(height: 12),
                                      Text(
                                        'Verifying Dynamic QR...',
                                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),

                    // Quick Camera Controls Overlapping the Rim
                    Positioned(
                      bottom: -18,
                      child: Row(
                        children: [
                          _buildCircleIconButton(
                            icon: _isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                            isActive: _isTorchOn,
                            onTap: () {
                              _scannerController.toggleTorch();
                              setState(() => _isTorchOn = !_isTorchOn);
                            },
                          ),
                          const SizedBox(width: 14),
                          _buildCircleIconButton(
                            icon: Icons.flip_camera_ios_rounded,
                            isActive: _isFrontCamera,
                            onTap: () {
                              _scannerController.switchCamera();
                              setState(() => _isFrontCamera = !_isFrontCamera);
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 38),

              // Title & Subtitle Matching VoyageNow Reference
              const Text(
                'Align Dynamic QR Code',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: textPrimary,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 6),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'Point camera at the reception kiosk screen to automatically register attendance.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: textSecondary,
                    height: 1.4,
                  ),
                ),
              ),

              const SizedBox(height: 18),

              // Security Gate Badges
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  _buildStatusPill(
                    icon: Icons.wifi_rounded,
                    label: _isVerifyingGates
                        ? 'Verifying Wi-Fi...'
                        : (_isStarlinkConnected ? 'Starlink Wi-Fi Verified' : 'Starlink IP Required'),
                    isOk: _isStarlinkConnected,
                  ),
                  _buildStatusPill(
                    icon: Icons.location_on_rounded,
                    label: _isVerifyingGates
                        ? 'Verifying GPS...'
                        : (_isGeofenceVerified ? 'HQ Geofence Active (Within 500m)' : 'Outside HQ Geofence'),
                    isOk: _isGeofenceVerified,
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Manual Entry Backup Option
              TextButton.icon(
                onPressed: _showManualTokenSheet,
                icon: const Icon(Icons.keyboard_alt_outlined, size: 16, color: Color(0xFF64748B)),
                label: const Text(
                  'Camera issue? Enter token manually',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCircleIconButton({
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        width: 44,
        decoration: BoxDecoration(
          color: isActive ? brandOrange : Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: const [
            BoxShadow(
              color: Colors.black12,
              blurRadius: 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Icon(
          icon,
          size: 20,
          color: isActive ? Colors.white : const Color(0xFF334155),
        ),
      ),
    );
  }

  Widget _buildStatusPill({
    required IconData icon,
    required String label,
    required bool isOk,
  }) {
    final bg = isOk ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2);
    final border = isOk ? const Color(0xFFA7F3D0) : const Color(0xFFFECACA);
    final fg = isOk ? const Color(0xFF059669) : const Color(0xFFDC2626);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}
