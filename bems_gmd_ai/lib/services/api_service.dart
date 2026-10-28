import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/auth_models.dart';
import '../models/chat_models.dart';

class ApiService {
  static const String serviceToken = 'bems_ai_svc_9a7e2b1c4d6f80931e5f72ab4c10de';
  static const String primaryBaseUrl = 'https://bemserp.work';
  static const String fallbackBaseUrl = 'https://pink-horse-318730.hostingersite.com';
  static String _activeBaseUrl = primaryBaseUrl;

  static const String appVersion = '1.0.1';
  static const String appId = 'GMD_APP';

  // Active user session attributes
  static String? activeUserToken;
  static String? activeUserId;

  // Global callbacks for app-level interception
  static void Function(Map<String, dynamic> updateInfo)? onUpgradeRequired;
  static void Function()? onSessionInvalidated;

  static String get baseUrl => _activeBaseUrl;

  static Map<String, String> get authHeaders => {
        'Content-Type': 'application/json',
        'Authorization': (activeUserToken != null && activeUserToken!.isNotEmpty)
            ? 'Bearer $activeUserToken'
            : 'Bearer $serviceToken',
        if (activeUserId != null && activeUserId!.isNotEmpty) 'x-user-id': activeUserId!,
        'x-bems-mobile-role': 'GMD',
        'x-app-id': appId,
        'x-app-version': appVersion,
      };

  static List<String> get _candidateHosts => [
        if (kIsWeb) Uri.base.origin,
        _activeBaseUrl,
        if (_activeBaseUrl == primaryBaseUrl) fallbackBaseUrl else primaryBaseUrl,
      ];

  /// Resilient request executor with automatic edge failover
  static Future<http.Response> _executeWithFailover(
    Future<http.Response> Function(String host) requestFn, {
    Duration timeout = const Duration(seconds: 15),
  }) async {
    dynamic lastError;
    for (final host in _candidateHosts) {
      try {
        final res = await requestFn(host).timeout(timeout);
        _activeBaseUrl = host;

        if (res.statusCode == 426) {
          try {
            final data = jsonDecode(res.body);
            onUpgradeRequired?.call(data is Map<String, dynamic> ? data : {});
          } catch (_) {
            onUpgradeRequired?.call({});
          }
        } else if (res.statusCode == 401 || res.statusCode == 403) {
          onSessionInvalidated?.call();
        }

        return res;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError is Exception
        ? lastError
        : Exception('Connection failed. Please check your internet connectivity.');
  }

  /// Verify session with backend on startup
  static Future<bool> verifySession(AuthUser user) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/auth/session'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': (user.token != null && user.token!.isNotEmpty)
                ? 'Bearer ${user.token}'
                : 'Bearer $serviceToken',
            'x-user-id': user.id,
            'x-bems-mobile-role': 'GMD',
            'x-app-id': appId,
            'x-app-version': appVersion,
          },
        ),
        timeout: const Duration(seconds: 8),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map<String, dynamic> && data['user'] != null) {
          final returnedUser = data['user'];
          if (returnedUser['id'] == user.id || returnedUser['workEmail'] == user.email) {
            activeUserToken = user.token;
            activeUserId = user.id;
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  /// Check version gate status against backend
  static Future<Map<String, dynamic>?> checkVersionGate() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/mobile/version-check?appId=$appId&version=$appVersion'),
          headers: authHeaders,
        ),
        timeout: const Duration(seconds: 8),
      );

      if (res.statusCode == 200 || res.statusCode == 426) {
        final data = jsonDecode(res.body);
        if (data is Map<String, dynamic>) {
          return data;
        }
      }
    } catch (_) {}
    return null;
  }

  static Future<AuthUser> login({
    required String email,
    required String password,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email.trim().toLowerCase(),
          'password': password,
        }),
      ),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['user'] != null) {
        final userMap = Map<String, dynamic>.from(data['user']);
        if (data['token'] != null) {
          userMap['token'] = data['token'];
          activeUserToken = data['token']?.toString();
        }
        final authUser = AuthUser.fromJson(userMap);
        activeUserId = authUser.id;
        return authUser;
      }
      throw Exception('Invalid user payload from server');
    } else {
      final err = jsonDecode(response.body);
      throw Exception(err['error'] ?? 'Sign in failed (${response.statusCode})');
    }
  }

  static Future<Map<String, dynamic>> fetchBriefingStats() async {
    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      final response = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/briefing?_t=$now'),
          headers: authHeaders,
        ),
        timeout: const Duration(seconds: 10),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final requests = (data['requests'] as List<dynamic>?) ?? [];
        final pending = requests
            .where((r) =>
                r['approvalStatus'] == 'SUBMITTED' ||
                r['approvalStatus'] == 'IN_REVIEW')
            .toList();
        final pendingSum = pending.fold<num>(
            0,
            (sum, r) =>
                sum + (num.tryParse(r['amountNaira']?.toString() ?? '0') ?? 0));
        return {
          'pendingCount': pending.length,
          'pendingSum': pendingSum,
          'requests': requests,
        };
      }
    } catch (_) {}

    return {
      'pendingCount': 0,
      'pendingSum': 0,
      'requests': [],
    };
  }

  static Future<Map<String, dynamic>> fetchDashboardData() async {
    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      final response = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/briefing?_t=$now'),
          headers: authHeaders,
        ),
        timeout: const Duration(seconds: 12),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final requests = (data['requests'] as List<dynamic>?) ?? [];
        final pending = requests
            .where((r) =>
                r['approvalStatus'] == 'SUBMITTED' ||
                r['approvalStatus'] == 'IN_REVIEW')
            .toList();
        final pendingSum = pending.fold<num>(
            0,
            (sum, r) =>
                sum + (num.tryParse(r['amountNaira']?.toString() ?? '0') ?? 0));
        final accountabilityCases =
            (data['accountabilityCases'] as List<dynamic>?) ?? [];
        final overdue =
            accountabilityCases.where((c) => c['status'] == 'OVERDUE').toList();
        final budgets = (data['budgets'] as List<dynamic>?) ?? [];
        final orgs = (data['organizations'] as List<dynamic>?) ?? [];
        final disbursements = (data['disbursements'] as List<dynamic>?) ?? [];

        return {
          'requests': requests,
          'pendingRequests': pending,
          'pendingCount': pending.length,
          'pendingSum': pendingSum,
          'accountabilityCases': accountabilityCases,
          'overdueCount': overdue.length,
          'budgets': budgets,
          'organizations': orgs,
          'disbursements': disbursements,
          'treasuryAccounts': (data['treasuryAccounts'] as List<dynamic>?) ?? [],
        };
      }
    } catch (_) {}

    return {
      'requests': [],
      'pendingRequests': [],
      'pendingCount': 0,
      'pendingSum': 0,
      'accountabilityCases': [],
      'overdueCount': 0,
      'budgets': [],
      'organizations': [],
      'disbursements': [],
      'treasuryAccounts': [],
    };
  }

  static Future<Map<String, dynamic>> sendAiMessage({
    required String message,
    required List<ChatMessage> history,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/ai/chat'),
        headers: authHeaders,
        body: jsonEncode({
          'message': message,
          'history':
              history.map((m) => {'role': m.sender, 'content': m.content}).toList(),
        }),
      ),
      timeout: const Duration(seconds: 25),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final err = jsonDecode(response.body);
      throw Exception(err['error'] ?? 'Server error (${response.statusCode})');
    }
  }

  static Future<bool> decideApproval({
    required String requestId,
    required String decision, // 'APPROVE' or 'REJECT'
    String? note,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/approvals/decide'),
        headers: authHeaders,
        body: jsonEncode({
          'requestId': requestId,
          'decision': decision,
          'note': note ?? 'Actioned via BEMS GMD Executive AI mobile',
        }),
      ),
      timeout: const Duration(seconds: 12),
    );

    return response.statusCode == 200;
  }

  static Future<Map<String, dynamic>> fetchTelemetry() async {
    try {
      final stats = await fetchBriefingStats();
      return {
        'cash': 'Live',
        'pending': stats['pendingCount'] ?? 0,
        'openCases': 0,
        'staff': 0,
      };
    } catch (_) {
      return {
        'cash': 'N/A',
        'pending': 0,
        'openCases': 0,
        'staff': 0,
      };
    }
  }
}
