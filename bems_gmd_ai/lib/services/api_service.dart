import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/auth_models.dart';
import '../models/chat_models.dart';

class ApiService {
  static Future<Map<String, dynamic>> getWalletFunding() async {
    final response = await _executeWithFailover((host) => http.get(Uri.parse('$host/api/wallet/funding'), headers: authHeaders));
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) throw Exception(data['error'] ?? 'Funding unavailable.');
    return data;
  }

  static Future<void> approveWalletRelease(String id, String confirmationHash, String password) async {
    // Financial mutations use the active host once. Network uncertainty is
    // resolved by reloading the stored proposal, never host-failover resubmission.
    final proof = await walletRequest('challenges', {'purpose':'RELEASE','payload':{'id':id,'confirmationHash':confirmationHash},'password':password});
    final response = await http.post(Uri.parse('$baseUrl/api/wallet/releases/${Uri.encodeComponent(id)}/approve'), headers: authHeaders, body: jsonEncode({'confirmationHash': confirmationHash,'challengeId':proof['id'],'challengeToken':proof['token']})).timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(data['error'] ?? 'Release could not be confirmed. Refresh its status before retrying.');
    }
  }

  static Future<Map<String,dynamic>> walletRequest(String path, Map<String,dynamic> body, {String method='POST'}) async {
    final headers={...authHeaders,if(path=='envelopes'&&body['idempotencyKey']!=null)'Idempotency-Key':body['idempotencyKey'].toString()};
    final response=await (method=='PATCH'?http.patch(Uri.parse('$baseUrl/api/wallet/$path'),headers:headers,body:jsonEncode(body)):http.post(Uri.parse('$baseUrl/api/wallet/$path'),headers:headers,body:jsonEncode(body))).timeout(const Duration(seconds:30));
    final data=jsonDecode(response.body) as Map<String,dynamic>;
    if(response.statusCode!=200) throw Exception(data['error'] ?? 'Wallet operation failed. Refresh its status before retrying.');
    return data;
  }

  static Future<List<dynamic>> walletBanks() async {
    final response=await http.get(Uri.parse('$baseUrl/api/wallet/banks'),headers:authHeaders).timeout(const Duration(seconds:20));
    final data=jsonDecode(response.body) as Map<String,dynamic>;
    if(response.statusCode!=200)throw Exception(data['error'] ?? 'Supported bank list unavailable.');
    return data['banks'] as List<dynamic>;
  }

  static const String primaryBaseUrl = 'https://bemserp.work';
  static const String fallbackBaseUrl = 'https://pink-horse-318730.hostingersite.com';
  static String _activeBaseUrl = primaryBaseUrl;

  static const String appVersion = '1.3.3';
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
        if (activeUserToken != null && activeUserToken!.isNotEmpty) 'Authorization': 'Bearer $activeUserToken',
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
            if (user.token != null && user.token!.isNotEmpty) 'Authorization': 'Bearer ${user.token}',
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
          if (returnedUser['role'] == 'GMD' && (returnedUser['id'] == user.id || returnedUser['workEmail'] == user.email)) {
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
    String? conversationId,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/ai/chat'),
        headers: authHeaders,
        body: jsonEncode({
          'message': message,
          'conversation_id': conversationId,
          'history':
              history.map((m) => {'role': m.sender, 'content': m.content}).toList(),
        }),
      ),
      timeout: const Duration(seconds: 120),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final err = jsonDecode(response.body);
      throw Exception(err['error'] ?? 'Server error (${response.statusCode})');
    }
  }

  static Future<Map<String, dynamic>> confirmStagedAction({
    required String stagedActionId,
    required String confirmationHash,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/ai/staged-actions/${Uri.encodeComponent(stagedActionId)}/confirm'),
        headers: authHeaders,
        body: jsonEncode({
          'confirmation_hash': confirmationHash,
        }),
      ),
      timeout: const Duration(seconds: 25),
    );

    try {
      final data = jsonDecode(response.body);
      if (data is Map<String, dynamic>) {
        return {
          'httpStatus': response.statusCode,
          ...data,
        };
      }
    } catch (_) {}
    return {
      'httpStatus': response.statusCode,
      'ok': false,
      'error': 'Server returned status ${response.statusCode}',
    };
  }

  static Future<Map<String, dynamic>> cancelStagedAction({
    required String stagedActionId,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/ai/staged-actions/${Uri.encodeComponent(stagedActionId)}/cancel'),
        headers: authHeaders,
      ),
      timeout: const Duration(seconds: 15),
    );

    try {
      final data = jsonDecode(response.body);
      if (data is Map<String, dynamic>) {
        return {
          'httpStatus': response.statusCode,
          ...data,
        };
      }
    } catch (_) {}
    return {
      'httpStatus': response.statusCode,
      'ok': false,
      'error': 'Server returned status ${response.statusCode}',
    };
  }

  static Future<Map<String, dynamic>?> getStagedActionStatus({
    required String stagedActionId,
  }) async {
    try {
      final response = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/ai/staged-actions/${Uri.encodeComponent(stagedActionId)}'),
          headers: authHeaders,
        ),
        timeout: const Duration(seconds: 10),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is Map<String, dynamic>) {
          return data;
        }
      }
    } catch (_) {}
    return null;
  }

  static Future<Map<String, dynamic>> decideApprovalWithDetails({
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

    if (response.statusCode == 200) {
      try {
        final data = jsonDecode(response.body);
        return {
          'success': true,
          'data': data,
          'disbursementAccount': data['requesterDisbursementAccount'] ??
              (data['results'] is List && (data['results'] as List).isNotEmpty
                  ? (data['results'] as List)[0]['requesterDisbursementAccount']
                  : null),
        };
      } catch (_) {
        return {'success': true, 'data': null, 'disbursementAccount': null};
      }
    }
    return {'success': false, 'error': 'Server returned ${response.statusCode}'};
  }

  static Future<bool> decideApproval({
    required String requestId,
    required String decision, // 'APPROVE' or 'REJECT'
    String? note,
  }) async {
    final res = await decideApprovalWithDetails(
      requestId: requestId,
      decision: decision,
      note: note,
    );
    return res['success'] == true;
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

  // --- STAFF ONBOARDING & DIRECTORY ---
  static Future<Map<String, dynamic>> fetchStaffApprovals() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/auth/approvals'), headers: authHeaders),
        timeout: const Duration(seconds: 10),
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {'employees': [], 'organizations': [], 'departments': []};
  }

  static Future<Map<String, dynamic>> decideStaffApproval({
    required String employeeId,
    required String decision, // 'APPROVE' or 'REJECT'
    String? role,
    String? subsidiaryId,
    String? departmentId,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/auth/approvals'),
        headers: authHeaders,
        body: jsonEncode({
          'employeeId': employeeId,
          'decision': decision,
          if (role != null) 'role': role,
          if (subsidiaryId != null) 'subsidiaryId': subsidiaryId,
          if (departmentId != null) 'departmentId': departmentId,
        }),
      ),
      timeout: const Duration(seconds: 12),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    final err = jsonDecode(res.body);
    throw Exception(err['error'] ?? 'Failed to action signup (${res.statusCode})');
  }

  static Future<List<dynamic>> fetchStaffDirectory({String? subsidiaryId}) async {
    try {
      final query = subsidiaryId != null ? '?subsidiary=$subsidiaryId' : '';
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/staff$query'), headers: authHeaders),
        timeout: const Duration(seconds: 10),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = (data['employees'] as List<dynamic>?) ?? [];
        // Strictly guarantee only STAFF members are returned
        return list.where((emp) {
          final role = (emp['role'] ?? 'STAFF').toString().toUpperCase();
          return role == 'STAFF';
        }).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<bool> updateStaffStatus({
    required String employeeId,
    required String status, // 'ACTIVE', 'SUSPENDED'
  }) async {
    final res = await _executeWithFailover(
      (host) => http.patch(
        Uri.parse('$host/api/admin/employees/$employeeId/status'),
        headers: authHeaders,
        body: jsonEncode({'status': status}),
      ),
      timeout: const Duration(seconds: 10),
    );
    return res.statusCode == 200;
  }

  // --- DISBURSEMENTS & PROOF OF PAYMENT ---
  static Future<Map<String, dynamic>> fetchDisbursementsData({String subsidiary = 'ALL'}) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/disbursements?subsidiary=$subsidiary'),
          headers: authHeaders,
        ),
        timeout: const Duration(seconds: 12),
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {'readyForTransfer': [], 'awaitingChecker': [], 'verifiedDisbursements': []};
  }

  static Future<Map<String, dynamic>> recordDisbursementPayment({
    required String requestId,
    required String payerOrgId,
    required String externalReference,
    required String bankName,
    required String amountMinor,
    String? beneficiaryName,
    String? beneficiaryBank,
    String? beneficiaryAccount,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$_activeBaseUrl/api/disbursements'),
    );
    authHeaders.forEach((k, v) {
      if (k != 'Content-Type') request.headers[k] = v;
    });

    request.fields['requestId'] = requestId;
    request.fields['payerOrgId'] = payerOrgId;
    request.fields['externalReference'] = externalReference;
    request.fields['bankName'] = bankName;
    request.fields['amountMinor'] = amountMinor;
    if (beneficiaryName != null) request.fields['beneficiaryName'] = beneficiaryName;
    if (beneficiaryBank != null) request.fields['beneficiaryBank'] = beneficiaryBank;
    if (beneficiaryAccount != null) request.fields['beneficiaryAccount'] = beneficiaryAccount;

    final streamedRes = await request.send().timeout(const Duration(seconds: 15));
    final res = await http.Response.fromStream(streamedRes);

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    final err = jsonDecode(res.body);
    throw Exception(err['error'] ?? 'Failed to record payment');
  }

  // --- ACCOUNTABILITY & 72h SLA CLOSURE ---
  static Future<List<dynamic>> fetchAccountabilityList() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/accountability'), headers: authHeaders),
        timeout: const Duration(seconds: 12),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return (data['cases'] as List<dynamic>?) ?? [];
      }
    } catch (_) {}
    return [];
  }

  static Future<bool> closeAccountabilityCase({
    required String caseId,
    String? notes,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/accountability/close'),
        headers: authHeaders,
        body: jsonEncode({
          'caseId': caseId,
          'decision': 'CLOSE',
          'closureNotes': notes ?? 'Deliverables inspected and closed via GMD mobile cockpit',
        }),
      ),
      timeout: const Duration(seconds: 10),
    );
    return res.statusCode == 200;
  }

  // --- HYBRID PAYROLL ---
  static Future<Map<String, dynamic>> fetchPayrollFull({int? year, int? month}) async {
    try {
      final query = (year != null && month != null) ? '?year=$year&month=$month' : '';
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/payroll$query'), headers: authHeaders),
        timeout: const Duration(seconds: 14),
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {};
  }

  static Future<List<dynamic>> fetchPayrollAssignees() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/payroll/assignees'), headers: authHeaders),
        timeout: const Duration(seconds: 10),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = (data['employees'] as List<dynamic>?) ?? [];
        // Strictly guarantee only STAFF members are returned
        return list.where((emp) {
          final role = (emp['role'] ?? 'STAFF').toString().toUpperCase();
          return role == 'STAFF';
        }).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<Map<String, dynamic>> approvePayrollBatch({
    required String batchId,
    required String disbursementAssigneeId,
    String? comments,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/payroll'),
        headers: authHeaders,
        body: jsonEncode({
          'batchId': batchId,
          'disbursementAssigneeId': disbursementAssigneeId,
          'comments': comments ?? 'Approved via BEMS GMD Executive AI mobile',
        }),
      ),
      timeout: const Duration(seconds: 15),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    final err = jsonDecode(res.body);
    throw Exception(err['error'] ?? 'Sign-off failed (${res.statusCode})');
  }

  static Future<Map<String, dynamic>> fetchPayrollSummary() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/payroll/summary'), headers: authHeaders),
        timeout: const Duration(seconds: 12),
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {'subsidiaryPayrolls': []};
  }

  static Future<Map<String, dynamic>> updateStaffSalary({
    required String employeeId,
    required String changeType, // ADDITION | DEDUCTION | SET_EXACT
    required double amount,
    required String reason,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/staff/${Uri.encodeComponent(employeeId)}/salary'),
        headers: authHeaders,
        body: jsonEncode({
          'changeType': changeType,
          'amount': amount,
          'reason': reason,
        }),
      ),
      timeout: const Duration(seconds: 15),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode == 200) {
      return data as Map<String, dynamic>;
    }
    throw Exception(data['error'] ?? 'Salary update failed (${res.statusCode})');
  }

  static Future<Map<String, dynamic>> removePayrollItem({
    required String itemId,
    required String scope, // BATCH_ONLY | PERMANENT
    required String reason,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.delete(
        Uri.parse('$host/api/payroll/items/${Uri.encodeComponent(itemId)}?scope=${Uri.encodeQueryComponent(scope)}&reason=${Uri.encodeQueryComponent(reason)}'),
        headers: authHeaders,
      ),
      timeout: const Duration(seconds: 15),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode == 200) {
      return data as Map<String, dynamic>;
    }
    throw Exception(data['error'] ?? 'Removal failed (${res.statusCode})');
  }

  // --- GMD DIRECT STAFF CHAT ---
  static Future<List<dynamic>> fetchStaffChatThreads() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/staff/chat/admin?channel=GMD'), headers: authHeaders),
        timeout: const Duration(seconds: 10),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return (data['threads'] as List<dynamic>?) ?? [];
      }
    } catch (_) {}
    return [];
  }

  static Future<Map<String, dynamic>> fetchStaffChatMessages(String employeeId) async {
    final res = await _executeWithFailover(
      (host) => http.get(
        Uri.parse('$host/api/staff/chat/admin?employeeId=${Uri.encodeComponent(employeeId)}&channel=GMD'),
        headers: authHeaders,
      ),
      timeout: const Duration(seconds: 10),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to load conversation (${res.statusCode})');
  }

  static Future<Map<String, dynamic>> sendStaffChatMessage({
    required String employeeId,
    required String message,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/staff/chat/admin'),
        headers: authHeaders,
        body: jsonEncode({
          'employeeId': employeeId,
          'channel': 'GMD',
          'message': message,
        }),
      ),
      timeout: const Duration(seconds: 12),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode == 200) {
      return data as Map<String, dynamic>;
    }
    throw Exception(data['error'] ?? 'Failed to send message (${res.statusCode})');
  }

  static Future<Map<String, dynamic>> fetchUnreadChatInfo() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/staff/chat/unread'), headers: authHeaders),
        timeout: const Duration(seconds: 6),
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {'unreadCount': 0, 'latestMessage': null};
  }

  // --- VENDORS REGISTRY ---
  static Future<List<dynamic>> fetchVendorsList({String? category, String? search}) async {
    try {
      final params = <String>[];
      if (category != null && category.isNotEmpty) params.add('category=$category');
      if (search != null && search.isNotEmpty) params.add('search=$search');
      final query = params.isNotEmpty ? '?${params.join('&')}' : '';

      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/vendors$query'), headers: authHeaders),
        timeout: const Duration(seconds: 10),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return (data['vendors'] as List<dynamic>?) ?? [];
      }
    } catch (_) {}
    return [];
  }

  static Future<bool> registerVendor(Map<String, dynamic> body) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/vendors'),
        headers: authHeaders,
        body: jsonEncode(body),
      ),
      timeout: const Duration(seconds: 12),
    );
    return res.statusCode == 200;
  }

  // --- INTERCOMPANY NOTES ---
  static Future<List<dynamic>> fetchIntercompanyNotes({String subsidiary = 'ALL'}) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/intercompany?subsidiary=$subsidiary'),
          headers: authHeaders,
        ),
        timeout: const Duration(seconds: 10),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return (data['notes'] as List<dynamic>?) ?? [];
      }
    } catch (_) {}
    return [];
  }

  // --- ATTENDANCE TIMESHEET ---
  static Future<Map<String, dynamic>> fetchAttendanceTimesheet({int? month, int? year, String? date}) async {
    try {
      final params = <String>[];
      if (month != null) params.add('month=$month');
      if (year != null) params.add('year=$year');
      if (date != null && date.isNotEmpty) params.add('date=$date');
      final query = params.isNotEmpty ? '?${params.join('&')}' : '';

      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/attendance/timesheet$query'), headers: authHeaders),
        timeout: const Duration(seconds: 12),
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {'timesheets': []};
  }

  // --- EMERGENCY OVERRIDES ---
  static Future<List<dynamic>> fetchEmergencyIncidents() async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(Uri.parse('$host/api/emergency'), headers: authHeaders),
        timeout: const Duration(seconds: 10),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return (data['incidents'] as List<dynamic>?) ?? [];
      }
    } catch (_) {}
    return [];
  }
}
