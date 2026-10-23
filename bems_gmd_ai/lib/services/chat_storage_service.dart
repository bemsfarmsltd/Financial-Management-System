import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/auth_models.dart';
import '../models/chat_models.dart';

class ChatStorageService {
  static const String _keyUser = 'bems_auth_user';
  static const String _keySeenWelcome = 'bems_seen_first_welcome';
  static const String _keySessions = 'bems_chat_sessions';
  static const String _keyActiveSessionId = 'bems_active_session_id';

  // --- Auth & User ---
  static Future<void> saveUser(AuthUser user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUser, jsonEncode(user.toJson()));
  }

  static Future<AuthUser?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_keyUser);
    if (data == null || data.isEmpty) return null;
    try {
      return AuthUser.fromJson(jsonDecode(data));
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearUser() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUser);
    await prefs.remove(_keySeenWelcome);
  }

  // --- First Login Welcome ---
  static Future<bool> hasSeenWelcome() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keySeenWelcome) ?? false;
  }

  static Future<void> setSeenWelcome(bool seen) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keySeenWelcome, seen);
  }

  // --- Chat Sessions ---
  static Future<List<ChatSession>> getSessions() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_keySessions);
    if (data == null || data.isEmpty) {
      // Default welcome initial session
      return [
        ChatSession(
          id: 'session-default',
          title: 'Autonomous Ledger Governance',
          updatedAt: 'Today',
          messages: [
            ChatMessage(
              id: 'msg-0',
              sender: 'assistant',
              timestamp: 'Just now',
              content:
                  'Good day, Executive. I am your BEMS Executive Copilot. Your treasury reserves, requisition approvals, and 72-hour advances are synchronized.',
            ),
          ],
        ),
      ];
    }
    try {
      final list = jsonDecode(data) as List<dynamic>;
      return list.map((item) => ChatSession.fromJson(item as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveSessions(List<ChatSession> sessions) async {
    final prefs = await SharedPreferences.getInstance();
    final data = jsonEncode(sessions.map((s) => s.toJson()).toList());
    await prefs.setString(_keySessions, data);
  }

  static Future<void> upsertSession(ChatSession session) async {
    final sessions = await getSessions();
    final index = sessions.indexWhere((s) => s.id == session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.insert(0, session);
    }
    await saveSessions(sessions);
  }

  static Future<void> deleteSession(String sessionId) async {
    final sessions = await getSessions();
    sessions.removeWhere((s) => s.id == sessionId);
    await saveSessions(sessions);
  }

  static Future<String?> getActiveSessionId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyActiveSessionId);
  }

  static Future<void> setActiveSessionId(String id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyActiveSessionId, id);
  }
}
