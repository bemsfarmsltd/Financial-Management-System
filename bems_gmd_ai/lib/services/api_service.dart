import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/auth_models.dart';
import '../models/chat_models.dart';

class ApiService {
  static const String primaryBaseUrl = 'https://bemserp.work';
  static const String fallbackBaseUrl = 'https://pink-horse-318730.hostingersite.com';
  static String _activeBaseUrl = primaryBaseUrl;

  static String get baseUrl => _activeBaseUrl;

  static List<String> get _candidateHosts => [
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
        return res;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError is Exception
        ? lastError
        : Exception('Connection failed. Please check your internet connectivity.');
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
        return AuthUser.fromJson(data['user']);
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
          headers: {
            'Content-Type': 'application/json',
            'x-bems-mobile-role': 'GMD',
          },
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
          headers: {
            'Content-Type': 'application/json',
            'x-bems-mobile-role': 'GMD',
          },
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
          'treasury': {
            'total': '₦0',
            'reserveRatio': '100% Reconciled',
            'runwayWeeks': 'N/A',
            'accounts': [],
            'recentDisbursements': disbursements,
          },
          'pendingRequests': pending,
          'pendingCount': pending.length,
          'pendingSum': pendingSum,
          'accountabilityCases': accountabilityCases,
          'overdueCount': overdue.length,
          'budgets': budgets,
          'organizations': orgs,
        };
      }
    } catch (_) {}

    return {
      'treasury': {
        'total': '₦0',
        'reserveRatio': '100% Reconciled',
        'runwayWeeks': 'N/A',
        'accounts': [],
        'recentDisbursements': [],
      },
      'pendingRequests': [],
      'pendingCount': 0,
      'pendingSum': 0,
      'accountabilityCases': [],
      'overdueCount': 0,
      'budgets': [],
      'organizations': [],
    };
  }

  static Future<Map<String, dynamic>> sendAiMessage({
    required String message,
    required List<ChatMessage> history,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/ai/chat'),
        headers: {
          'Content-Type': 'application/json',
          'x-bems-mobile-role': 'GMD',
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-bems-mobile-role': 'GMD',
        },
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
