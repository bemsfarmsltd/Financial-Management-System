import 'package:flutter/material.dart';
import '../core/theme.dart';

class AttendanceScanScreen extends StatefulWidget {
  const AttendanceScanScreen({super.key});

  @override
  State<AttendanceScanScreen> createState() => _AttendanceScanScreenState();
}

class _AttendanceScanScreenState extends State<AttendanceScanScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _laserController;
  late Animation<double> _laserAnimation;

  bool _isTorchOn = false;
  bool _isFrontCamera = false;
  bool _isPunching = false;
  bool _isStarlinkConnected = true;
  bool _isGeofenceVerified = true;

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
  }

  @override
  void dispose() {
    _laserController.dispose();
    super.dispose();
  }

  void _simulateScanAndPunch() async {
    setState(() => _isPunching = true);
    await Future.delayed(const Duration(milliseconds: 1400));
    if (!mounted) return;
    setState(() => _isPunching = false);

    _showPunchSuccessSheet();
  }

  void _showPunchSuccessSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
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
            const Text(
              'Clock-In Registered!',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: BemsTheme.textPrimary,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Dynamic QR & Starlink Geofence verified successfully.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: BemsTheme.textSecondary,
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
                    children: const [
                      Text(
                        'Check-In Time',
                        style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary),
                      ),
                      SizedBox(height: 3),
                      Text(
                        '07:44 AM WAT',
                        style: TextStyle(
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
                    children: const [
                      Text(
                        'Shift Status',
                        style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'PRESENT (ON-TIME)',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF059669),
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
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: BemsTheme.cobaltDark,
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
              child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: BemsTheme.textPrimary),
            ),
          ),
        ),
        centerTitle: true,
        title: Column(
          children: const [
            Text(
              'Attendance Scanner',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: BemsTheme.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            Text(
              'BEMS Enterprise Timekeeping',
              style: TextStyle(
                fontSize: 11,
                color: BemsTheme.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Column(
            children: [
              const SizedBox(height: 10),

              // Airplane Window Squircle Viewport
              Center(
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    // Outer Aircraft Beveled Rim
                    Container(
                      width: 280,
                      height: 370,
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
                            // Viewfinder Scenic / Camera Placeholder
                            Container(
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Color(0xFF1E293B),
                                    Color(0xFF0F172A),
                                  ],
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.qr_code_scanner_rounded,
                                    size: 48,
                                    color: BemsTheme.brandOrange.withOpacity(0.8),
                                  ),
                                  const SizedBox(height: 12),
                                  const Text(
                                    'Camera Viewfinder Active',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Hold steady before kiosk QR',
                                    style: TextStyle(
                                      color: Color(0xFF94A3B8),
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
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
                                          BemsTheme.brandOrange,
                                          Color(0xFFFDBA74),
                                          Colors.transparent,
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: BemsTheme.brandOrange.withOpacity(0.8),
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
                                width: 150,
                                height: 150,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.35),
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),

                            // Aircraft Window Glass Glare (Upper 45%)
                            Positioned(
                              top: 0,
                              left: 0,
                              right: 0,
                              height: 130,
                              child: Container(
                                decoration: BoxDecoration(
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(82)),
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.white.withOpacity(0.22),
                                      Colors.transparent,
                                    ],
                                  ),
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
                            onTap: () => setState(() => _isTorchOn = !_isTorchOn),
                          ),
                          const SizedBox(width: 14),
                          _buildCircleIconButton(
                            icon: Icons.flip_camera_ios_rounded,
                            isActive: _isFrontCamera,
                            onTap: () => setState(() => _isFrontCamera = !_isFrontCamera),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 44),

              // Title & Subtitle Matching VoyageNow Reference
              const Text(
                'Align Dynamic QR Code',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: BemsTheme.textPrimary,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 8),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'Position the reception desk dynamic QR code within the aircraft portal window to clock in.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: BemsTheme.textSecondary,
                    height: 1.45,
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Status Badges
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  _buildStatusPill(
                    icon: Icons.wifi_rounded,
                    label: 'Starlink Wi-Fi Enforced',
                    isOk: _isStarlinkConnected,
                  ),
                  _buildStatusPill(
                    icon: Icons.location_on_rounded,
                    label: 'HQ Geofence Active (Within 100m)',
                    isOk: _isGeofenceVerified,
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Action Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isPunching ? null : _simulateScanAndPunch,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: BemsTheme.brandOrange,
                    foregroundColor: Colors.white,
                    elevation: 4,
                    shadowColor: BemsTheme.brandOrange.withOpacity(0.4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: _isPunching
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.qr_code_scanner_rounded, size: 20),
                            SizedBox(width: 10),
                            Text(
                              'Scan QR Code & Clock In',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: -0.2,
                              ),
                            ),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 12),
              const Text(
                'Arrival window: 07:00 AM – 08:00 AM WAT · Grace to 08:15 AM',
                style: TextStyle(fontSize: 11, color: BemsTheme.textMuted),
              ),
              const SizedBox(height: 20),
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
          color: isActive ? BemsTheme.brandOrange : Colors.white,
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
