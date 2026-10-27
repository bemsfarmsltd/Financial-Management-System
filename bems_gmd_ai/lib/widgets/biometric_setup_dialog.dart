import 'package:flutter/material.dart';
import '../screens/gmd_profile_screen.dart';

class BiometricSetupPromptDialog extends StatelessWidget {
  final VoidCallback? onDismiss;
  final VoidCallback? onConfigured;

  const BiometricSetupPromptDialog({
    super.key,
    this.onDismiss,
    this.onConfigured,
  });

  static Future<void> show(
    BuildContext context, {
    VoidCallback? onDismiss,
    VoidCallback? onConfigured,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => BiometricSetupPromptDialog(
        onDismiss: onDismiss,
        onConfigured: onConfigured,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      elevation: 20,
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Top Shield / Fingerprint icon with animated radiant glow
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFF7ED), Color(0xFFFFEDD5)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(color: const Color(0xFFFDBA74), width: 2),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x26EA580C),
                    blurRadius: 20,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(
                  Icons.fingerprint_rounded,
                  size: 46,
                  color: Color(0xFFEA580C),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Tier 1 Clearance Pill
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shield_outlined, size: 14, color: Color(0xFFB45309)),
                  SizedBox(width: 6),
                  Text(
                    'SECURITY ACTION REQUIRED',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: Color(0xFFB45309),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Title
            const Text(
              'Set Up Fingerprint Security',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: -0.3,
              ),
            ),

            const SizedBox(height: 10),

            // Description
            const Text(
              'As Group Managing Director, your cockpit has sovereign authorization over group treasury, multi-million requisitions, and cash advances.\n\nBiometric fingerprint authentication is required to secure every session.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w400,
              ),
            ),

            const SizedBox(height: 26),

            // Primary Configure Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: () async {
                  Navigator.of(context).pop();
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const GmdProfileScreen(autoOpenEnrollment: true),
                    ),
                  );
                  if (result == true && onConfigured != null) {
                    onConfigured!();
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: const Icon(Icons.fingerprint_rounded, size: 22),
                label: const Text(
                  'Configure Fingerprint Now',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 10),

            // Secondary Remind Later Button
            SizedBox(
              width: double.infinity,
              height: 44,
              child: TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  if (onDismiss != null) onDismiss!();
                },
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF64748B),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Remind Me Next Session',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
