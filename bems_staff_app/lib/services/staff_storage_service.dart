import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/staff_models.dart';

class StaffStorageService {
  static const _secure = FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  static Future<Map<String,dynamic>> walletIntent(String employeeId,Map<String,dynamic> input) async {
    final key='wallet-intent:$employeeId';final old=await _secure.read(key:key);
    if(old!=null){final parsed=jsonDecode(old) as Map<String,dynamic>;if(parsed['amountMinor']==input['amountMinor']&&parsed['bankAccountId']==input['bankAccountId']&&jsonEncode(parsed['creditAllocations'])==jsonEncode(input['creditAllocations']))return parsed;}
    await _secure.write(key:key,value:jsonEncode(input));return input;
  }
  static Future<void> clearWalletIntent(String employeeId) => _secure.delete(key:'wallet-intent:$employeeId');
  static const _keyUser = 'bems_staff_user';
  static const _keySeenOnboardingCarousel = 'bems_staff_seen_onboarding_carousel_v1';
  static const _keyLastSeenJourneyVersion = 'bems_staff_last_seen_journey_version';
  static const _keyBioConfigured = 'bems_staff_biometric_configured';
  static const _keyBioEnabled = 'bems_staff_biometric_enabled';
  static const _keyBioEnrolledAt = 'bems_staff_biometric_enrolled_at';
  static const _keySavedEmail = 'bems_staff_saved_email';
  static const _keySavedPassword = 'bems_staff_saved_password';

  static Future<void> saveUser(StaffUser user) async {
    final prefs = await SharedPreferences.getInstance();
    await _secure.write(key: _keyUser, value: jsonEncode(user.toJson()));
    await prefs.remove(_keyUser);
  }

  static Future<StaffUser?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final legacyUser = prefs.getString(_keyUser);
    if (legacyUser != null) {
      await _secure.write(key: _keyUser, value: legacyUser);
      await prefs.remove(_keyUser);
    }
    final data = await _secure.read(key: _keyUser);
    if (data == null) return null;
    try {
      return StaffUser.fromJson(jsonDecode(data));
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearUser() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUser);
    await _secure.delete(key: _keyUser);
  }

  static Future<bool> hasSeenOnboardingCarousel({String? version}) async {
    final prefs = await SharedPreferences.getInstance();
    if (version != null && version.isNotEmpty) {
      final lastVersion = prefs.getString(_keyLastSeenJourneyVersion);
      return lastVersion == version;
    }
    return prefs.getBool(_keySeenOnboardingCarousel) ?? false;
  }

  static Future<void> setSeenOnboardingCarousel(bool seen, {String? version}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keySeenOnboardingCarousel, seen);
    if (version != null && version.isNotEmpty) {
      await prefs.setString(_keyLastSeenJourneyVersion, version);
    }
  }

  // --- Biometric Authentication Settings ---
  static Future<bool> isBiometricConfigured() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyBioConfigured) ?? false;
  }

  static Future<void> setBiometricConfigured(bool configured) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyBioConfigured, configured);
    if (configured) {
      await prefs.setBool(_keyBioEnabled, true);
      if (prefs.getString(_keyBioEnrolledAt) == null) {
        await prefs.setString(_keyBioEnrolledAt, DateTime.now().toIso8601String());
      }
    }
  }

  static Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    final configured = prefs.getBool(_keyBioConfigured) ?? false;
    if (!configured) return false;
    return prefs.getBool(_keyBioEnabled) ?? true;
  }

  static Future<void> setBiometricEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyBioEnabled, enabled);
  }

  static Future<String?> getBiometricEnrolledAt() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyBioEnrolledAt);
  }

  static Future<void> saveCredentials({required String email, required String password}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySavedEmail);
    await prefs.remove(_keySavedPassword);
    await _secure.write(key: _keySavedEmail, value: email);
    await _secure.write(key: _keySavedPassword, value: password);
  }

  static Future<Map<String, String>?> getSavedCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    final email = await _secure.read(key: _keySavedEmail);
    await prefs.remove(_keySavedPassword);
    final password = await _secure.read(key: _keySavedPassword);
    if (email != null && password != null && email.isNotEmpty && password.isNotEmpty) {
      return {'email': email, 'password': password};
    }
    return null;
  }

  static Future<void> clearCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySavedEmail);
    await prefs.remove(_keySavedPassword);
    await _secure.delete(key: _keySavedEmail);
    await _secure.delete(key: _keySavedPassword);
  }

  static Future<void> resetBiometrics() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyBioConfigured);
    await prefs.remove(_keyBioEnabled);
    await prefs.remove(_keyBioEnrolledAt);
    await prefs.remove(_keySavedEmail);
    await prefs.remove(_keySavedPassword);
    await _secure.delete(key: _keySavedEmail);
    await _secure.delete(key: _keySavedPassword);
  }
}
