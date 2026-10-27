import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

class BiometricService {
  static final LocalAuthentication _auth = LocalAuthentication();

  /// Check if the device hardware supports biometrics (fingerprint/face)
  static Future<bool> isHardwareAvailable() async {
    if (kIsWeb) return false;
    try {
      final bool canAuthenticateWithBiometrics = await _auth.canCheckBiometrics;
      final bool canAuthenticate = canAuthenticateWithBiometrics || await _auth.isDeviceSupported();
      return canAuthenticate;
    } on PlatformException catch (e) {
      debugPrint('Biometric hardware check failed: $e');
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Get the list of enrolled biometric types (e.g. fingerprint, face)
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    if (kIsWeb) return [];
    try {
      return await _auth.getAvailableBiometrics();
    } catch (_) {
      return [];
    }
  }

  /// Triggers the Phone's own native hardware fingerprint dialog
  /// On Android: Android BiometricPrompt ("Verify your fingerprint")
  /// On iOS: Touch ID / Face ID
  static Future<bool> authenticateWithPhoneFingerprint({
    String reason = 'Verify your fingerprint to access the GMD Executive Cockpit',
  }) async {
    final available = await isHardwareAvailable();
    if (!available) {
      // Running on Web or device without hardware sensor
      return false;
    }

    try {
      final bool didAuthenticate = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          useErrorDialogs: true,
          sensitiveTransaction: true,
        ),
      );
      return didAuthenticate;
    } on PlatformException catch (e) {
      debugPrint('Biometric authentication failed: ${e.code} - ${e.message}');
      return false;
    } catch (e) {
      debugPrint('Unexpected biometric error: $e');
      return false;
    }
  }

  /// Cancels any ongoing authentication
  static Future<void> stopAuthentication() async {
    try {
      await _auth.stopAuthentication();
    } catch (_) {}
  }
}
