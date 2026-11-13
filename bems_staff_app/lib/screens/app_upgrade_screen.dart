import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/staff_api_service.dart';
import '../services/staff_download_helper.dart';

class StaffAppUpgradeScreen extends StatelessWidget {
  final String currentVersion;
  final String requiredVersion;
  final String downloadUrl;
  final String notes;

  const StaffAppUpgradeScreen({
    super.key,
    required this.currentVersion,
    required this.requiredVersion,
    required this.downloadUrl,
    required this.notes,
  });

  String get _effectiveUrl {
    final candidate = downloadUrl.isNotEmpty ? downloadUrl : '/download/staff-app.apk';
    return StaffApiService.resolveUrl(candidate);
  }

  Future<void> _launchDownload(BuildContext context) async {
    final url = _effectiveUrl;
    final filename = 'BEMS-Staff-Portal-v$requiredVersion.apk';
    final success = await downloadFile(url, filename);

    if (context.mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Starting APK download... Check your browser or notifications tray.'),
            backgroundColor: Color(0xFF059669),
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        Clipboard.setData(ClipboardData(text: url));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Direct link copied: $url'),
            backgroundColor: const Color(0xFF0284C7),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false, // Prevents backing out of forced upgrade gate
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // App Icon Container
                  Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0F2FE),
                      border: Border.all(color: const Color(0xFFBAE6FD), width: 2),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0284C7).withOpacity(0.15),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text('📱', style: TextStyle(fontSize: 36)),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Kicker Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      border: Border.all(color: const Color(0xFFFECACA)),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'CRITICAL UPDATE REQUIRED · HTTP 426',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                  ),

                  const SizedBox(height: 14),

                  const Text(
                    'Update Staff App',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: Color(0xFF0F172A),
                    ),
                  ),

                  const SizedBox(height: 8),

                  Text(
                    'To protect system security and ensure proper disbursement logging, your staff app build must be updated before submitting further fund requests.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.5,
                      color: Colors.blueGrey[600],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Version Transition Pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Column(
                          children: [
                            const Text(
                              'YOUR VERSION',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8)),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'v$currentVersion',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFFDC2626)),
                            ),
                          ],
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 20),
                          child: Icon(Icons.arrow_forward_rounded, color: Color(0xFFCBD5E1), size: 18),
                        ),
                        Column(
                          children: [
                            const Text(
                              'REQUIRED BUILD',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8)),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'v$requiredVersion',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0284C7)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Release notes box
                  if (notes.isNotEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F9FF),
                        border: Border.all(color: const Color(0xFFBAE6FD)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'UPGRADE NOTES',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF0369A1)),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            notes,
                            style: const TextStyle(fontSize: 12, height: 1.4, color: Color(0xFF0C4A6E)),
                          ),
                        ],
                      ),
                    ),

                  const SizedBox(height: 28),

                  // Primary CTA
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: () => _launchDownload(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.download_rounded, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Download & Install Update',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Conflict / Signature advisory
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('💡', style: TextStyle(fontSize: 14)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'If installation says "app already exists / conflicting package", simply uninstall the old BEMS app first, then install this APK.',
                            style: TextStyle(fontSize: 11, color: Color(0xFF92400E), height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Direct link display card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.link_rounded, size: 16, color: Color(0xFF64748B)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: SelectableText(
                            _effectiveUrl,
                            style: const TextStyle(fontSize: 11, color: Color(0xFF334155), fontFamily: 'monospace'),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Secondary action: Copy Link
                  TextButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: _effectiveUrl));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('✓ Download link copied: $_effectiveUrl'),
                          backgroundColor: const Color(0xFF0F172A),
                          duration: const Duration(seconds: 3),
                        ),
                      );
                    },
                    icon: const Icon(Icons.copy_rounded, size: 16, color: Color(0xFF64748B)),
                    label: const Text(
                      'Copy Direct APK Link',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                    ),
                  ),

                  if (kIsWeb) ...[
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: () {
                        StaffApiService.fetchMyProfile;
                        Navigator.pushReplacementNamed(context, '/');
                      },
                      icon: const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFFEA580C)),
                      label: const Text(
                        'Reload Web Workspace',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
