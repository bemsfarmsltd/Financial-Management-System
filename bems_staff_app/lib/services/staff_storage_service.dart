import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/staff_models.dart';

class StaffStorageService {
  static const _keyUser = 'bems_staff_user';

  static Future<void> saveUser(StaffUser user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUser, jsonEncode(user.toJson()));
  }

  static Future<StaffUser?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_keyUser);
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
  }
}
