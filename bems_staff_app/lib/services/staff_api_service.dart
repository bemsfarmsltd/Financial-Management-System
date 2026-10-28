import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/staff_models.dart';

class StaffApiService {
  static const String primaryBaseUrl = 'https://bemserp.work';
  static const String fallbackBaseUrl = 'https://pink-horse-318730.hostingersite.com';
  static String _activeBaseUrl = primaryBaseUrl;

  static String? sessionToken;

  static Map<String, String> _headers({String? token, String? employeeId}) {
    final effectiveToken = (token != null && token.isNotEmpty) ? token : sessionToken;
    return {
      'Content-Type': 'application/json',
      if (effectiveToken != null && effectiveToken.isNotEmpty) 'Authorization': 'Bearer $effectiveToken',
      if (employeeId != null && employeeId.isNotEmpty) 'x-employee-id': employeeId,
    };
  }

  static String get baseUrl => _activeBaseUrl;

  static List<String> get _candidateHosts {
    if (kIsWeb) {
      final webOrigin = Uri.base.origin;
      return [
        webOrigin,
        _activeBaseUrl,
        if (_activeBaseUrl == primaryBaseUrl) fallbackBaseUrl else primaryBaseUrl,
      ];
    }
    return [
      _activeBaseUrl,
      if (_activeBaseUrl == primaryBaseUrl) fallbackBaseUrl else primaryBaseUrl,
    ];
  }

  /// Resilient request executor with automatic edge failover on DNS/Socket errors
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

    final errStr = lastError.toString();
    if (errStr.contains('SocketException') ||
        errStr.contains('Failed host lookup') ||
        errStr.contains('ClientException') ||
        errStr.contains('errno = 7')) {
      throw Exception('Unable to reach BEMS Enterprise servers. Please check your mobile data or Wi-Fi internet connection and try again.');
    }
    throw lastError is Exception
        ? lastError
        : Exception('Connection failed. Please check your internet connectivity.');
  }

  /// Authenticate against production Next.js backend with work credentials
  static Future<StaffUser> login({
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

    final data = jsonDecode(response.body);

    if (response.statusCode == 200 && data['user'] != null) {
      final userMap = Map<String, dynamic>.from(data['user'] as Map);
      if (data['token'] != null) {
        final t = data['token'].toString();
        userMap['token'] = t;
        sessionToken = t;
      }
      return StaffUser.fromJson(userMap);
    }

    final errorMessage = data['error']?.toString() ??
        'Invalid work credentials. Please check your email and password.';
    throw Exception(errorMessage);
  }

  /// Upload staff passport photograph / profile picture directly to backend storage with edge failover
  static Future<String> uploadAvatar({
    required List<int> bytes,
    required String filename,
  }) async {
    dynamic lastError;
    for (final host in _candidateHosts) {
      try {
        final uri = Uri.parse('$host/api/upload');
        final request = http.MultipartRequest('POST', uri)
          ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));

        final streamedResponse =
            await request.send().timeout(const Duration(seconds: 25));
        final response = await http.Response.fromStream(streamedResponse);
        final data = jsonDecode(response.body);

        if (response.statusCode >= 200 &&
            response.statusCode < 300 &&
            data['url'] != null) {
          _activeBaseUrl = host;
          final url = data['url'].toString();
          return url.startsWith('http') ? url : '$host$url';
        }

        final err = data['error']?.toString() ?? 'Could not upload passport photo.';
        throw Exception(err);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError is Exception
        ? lastError
        : Exception('Unable to upload photo. Please check your internet connection.');
  }

  /// Live dashboard queries returning authoritative records from PostgreSQL
  static Future<Map<String, dynamic>> fetchStaffDashboard({
    required String userEmail,
    String? employeeId,
    String? token,
  }) async {
    final headers = _headers(token: token, employeeId: employeeId);

    for (final host in _candidateHosts) {
      try {
        final now = DateTime.now().millisecondsSinceEpoch;
        final reqUri = Uri.parse('$host/api/requests?_t=$now');
        final disbUri = Uri.parse('$host/api/staff/disbursements?_t=$now');
        final accUri = Uri.parse('$host/api/accountability?_t=$now');

        final responses = await Future.wait([
          http.get(reqUri, headers: headers).timeout(const Duration(seconds: 12)),
          http.get(disbUri, headers: headers).timeout(const Duration(seconds: 12)),
          http.get(accUri, headers: headers).timeout(const Duration(seconds: 12)),
        ]);

        List<FundRequestItem> liveRequests = [];
        if (responses[0].statusCode == 200) {
          final decoded = jsonDecode(responses[0].body);
          List<dynamic> list = [];
          if (decoded is List) {
            list = decoded;
          } else if (decoded is Map && decoded['requests'] is List) {
            list = decoded['requests'] as List<dynamic>;
          }
          liveRequests = list
              .whereType<Map>()
              .map((item) => FundRequestItem.fromJson(Map<String, dynamic>.from(item)))
              .toList();
        }

        List<DisbursementItem> liveDisbursements = [];
        if (responses[1].statusCode == 200) {
          final decoded = jsonDecode(responses[1].body);
          List<dynamic> list = [];
          if (decoded is Map && decoded['awaitingConfirmation'] is List) {
            list = decoded['awaitingConfirmation'] as List<dynamic>;
          } else if (decoded is List) {
            list = decoded;
          }
          liveDisbursements = list
              .whereType<Map>()
              .map((item) => DisbursementItem.fromJson(Map<String, dynamic>.from(item)))
              .toList();
        }

        List<AccountabilityCaseItem> liveCases = [];
        if (responses[2].statusCode == 200) {
          final decoded = jsonDecode(responses[2].body);
          List<dynamic> list = [];
          if (decoded is Map && decoded['cases'] is List) {
            list = decoded['cases'] as List<dynamic>;
          } else if (decoded is List) {
            list = decoded;
          }
          liveCases = list
              .whereType<Map>()
              .map((item) => AccountabilityCaseItem.fromJson(Map<String, dynamic>.from(item)))
              .toList();
        }

        _activeBaseUrl = host;
        return {
          'requests': liveRequests,
          'disbursementsAwaiting': liveDisbursements,
          'accountabilityCases': liveCases,
        };
      } catch (_) {}
    }

    return {
      'requests': <FundRequestItem>[],
      'disbursementsAwaiting': <DisbursementItem>[],
      'accountabilityCases': <AccountabilityCaseItem>[],
    };
  }

  /// Post a new fund request with due date, recurrence, and 3-way matching vendor
  static Future<bool> createFundRequest({
    required String title,
    required String justification,
    required String deliverable,
    required String category,
    required String subsidiary,
    required String department,
    required double amountNaira,
    required String urgency,
    required String neededBy,
    String? employeeId,
    String? token,
    String? dueDate,
    bool isRecurring = false,
    String? recurringInterval,
    String? vendorName,
    bool isIntercompany = false,
    List<Map<String, dynamic>>? attachments,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/requests'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({
          'title': title,
          'justification': justification,
          'deliverable': deliverable,
          'category': category,
          'subsidiary': subsidiary,
          'department': department,
          'amountMinor': (amountNaira * 100).toInt(),
          'amountNaira': amountNaira,
          'currency': 'NGN',
          'urgency': urgency,
          'neededBy': neededBy,
          'dueDate': dueDate ?? 'Within 48 Hours',
          'isRecurring': isRecurring,
          'recurringInterval': recurringInterval,
          'vendorName': vendorName,
          'isIntercompany': isIntercompany,
          if (attachments != null && attachments.isNotEmpty) 'attachments': attachments,
        }),
      ),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return true;
    }

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not submit fund requisition.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Server error (${res.statusCode}): Could not submit requisition.');
    }
  }

  /// Personal bank disbursement confirmation by staff
  static Future<bool> confirmDisbursement({
    required String disbursementId,
    required String decision,
    String? employeeId,
    String? token,
    String? note,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/disbursements/confirm'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({
          'disbursementId': disbursementId,
          'decision': decision,
          if (employeeId != null) 'employeeId': employeeId,
          'note': note ?? '',
        }),
      ),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not confirm receipt of funds.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Failed to record recipient payment confirmation.');
    }
  }

  /// Submit 72-Hour SLA accountability receipts & deliverables with real image or document bytes
  static Future<bool> submitRetirementEvidence({
    required String caseId,
    required String notes,
    required String receiptName,
    required List<int> fileBytes,
    String? employeeId,
    String? token,
    String contentType = 'image/jpeg',
  }) async {
    final base64String = base64Encode(fileBytes);
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/accountability/evidence'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({
          'caseId': caseId,
          'notes': notes,
          'fileName': receiptName,
          'contentType': contentType,
          'fileBase64': base64String,
        }),
      ),
      timeout: const Duration(seconds: 25),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not upload accountability proof.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Failed to submit retirement proof.');
    }
  }

  /// Retrieve live corporate enterprise structure (active subsidiaries and departments)
  static Future<List<Map<String, dynamic>>> fetchOrganizationStructure({String? employeeId, String? token}) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/meta/structure'),
          headers: _headers(token: token, employeeId: employeeId),
        ),
      );

      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = jsonDecode(res.body);
        final list = (data['organizations'] as List<dynamic>?) ?? [];
        return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
      }
    } catch (_) {}
    return [];
  }

  /// Retrieve approved vendor registry for 3-way matching
  static Future<List<Map<String, dynamic>>> fetchVendors({String? employeeId, String? token}) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/vendors'),
          headers: _headers(token: token, employeeId: employeeId),
        ),
      );

      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = jsonDecode(res.body);
        final list = (data['vendors'] as List<dynamic>?) ?? [];
        return list.cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return [];
  }

  /// Fetch in-app notifications for staff member
  static Future<List<Map<String, dynamic>>> fetchNotifications({
    required String employeeId,
    String? token,
  }) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/notifications'),
          headers: _headers(token: token, employeeId: employeeId),
        ),
      );

      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = jsonDecode(res.body);
        final list = (data['notifications'] as List<dynamic>?) ?? [];
        return list.cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return [];
  }

  /// Mark all notifications read
  static Future<bool> markNotificationsRead({required String employeeId, String? token}) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.patch(
          Uri.parse('$host/api/notifications'),
          headers: _headers(token: token, employeeId: employeeId),
          body: jsonEncode({'markAllRead': true}),
        ),
      );

      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// Update Dual Banking Accounts (Advances & Salary) in PostgreSQL
  static Future<bool> updateBankAccounts({
    required String employeeId,
    required String bankName,
    required String accountNumber,
    required String accountName,
    required String salaryBankName,
    required String salaryAccountNumber,
    required String salaryAccountName,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/staff/$employeeId/banking'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({
          'bankName': bankName,
          'accountNumber': accountNumber,
          'accountName': accountName,
          'salaryBankName': salaryBankName,
          'salaryAccountNumber': salaryAccountNumber,
          'salaryAccountName': salaryAccountName,
        }),
      ),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not update banking accounts.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Failed to update bank details.');
    }
  }

  /// Update Corporate Contact Phone Number in PostgreSQL
  static Future<bool> updatePhoneNumber({
    required String employeeId,
    required String phone,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/staff/$employeeId/contact'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({'phone': phone}),
      ),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not update phone number.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Failed to update phone number.');
    }
  }

  /// Change Staff Account Password
  static Future<bool> changePassword({
    required String employeeId,
    required String oldPassword,
    required String newPassword,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/staff/$employeeId/password'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({
          'oldPassword': oldPassword,
          'newPassword': newPassword,
        }),
      ),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not change password.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Failed to change password.');
    }
  }

  /// Register new staff member with mandatory passport photograph and verified banking
  static Future<Map<String, dynamic>> registerStaff({
    required String avatarUrl,
    required String fullName,
    required String email,
    required String password,
    required String phone,
    required String gender,
    required String dateOfBirth,
    required String subsidiary,
    required String department,
    required String jobTitle,
    required String staffGrade,
    required String workLocation,
    required String bankName,
    required String accountNumber,
    required String accountName,
    required bool useSameAccountForSalary,
    String? salaryBankName,
    String? salaryAccountNumber,
    String? salaryAccountName,
    String? nin,
    String? bvn,
    String? stateOfOrigin,
    String? lga,
    String? residentialAddress,
    String? nextOfKinName,
    String? nextOfKinRelationship,
    String? nextOfKinPhone,
    String? nextOfKinAddress,
  }) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/auth/signup'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'avatarUrl': avatarUrl,
          'fullName': fullName,
          'email': email.trim().toLowerCase(),
          'password': password,
          'phone': phone,
          'gender': gender,
          'dateOfBirth': dateOfBirth,
          'subsidiaryId': subsidiary,
          'departmentId': department,
          'jobTitle': jobTitle,
          'staffGrade': staffGrade,
          'workLocation': workLocation,
          'bankName': bankName,
          'accountNumber': accountNumber,
          'accountName': accountName,
          'useSameAccountForSalary': useSameAccountForSalary,
          'salaryBankName': salaryBankName ?? bankName,
          'salaryAccountNumber': salaryAccountNumber ?? accountNumber,
          'salaryAccountName': salaryAccountName ?? accountName,
          'nin': nin,
          'bvn': bvn,
          'stateOfOrigin': stateOfOrigin,
          'lga': lga,
          'residentialAddress': residentialAddress,
          'nextOfKinName': nextOfKinName,
          'nextOfKinRelationship': nextOfKinRelationship,
          'nextOfKinPhone': nextOfKinPhone,
          'nextOfKinAddress': nextOfKinAddress,
        }),
      ),
      timeout: const Duration(seconds: 25),
    );

    final data = jsonDecode(response.body);

    if (response.statusCode == 200 || response.statusCode == 201) {
      return {
        'success': true,
        'employeeNumber': data['employeeNumber'] ??
            'BEMS-REG-${DateTime.now().millisecondsSinceEpoch % 10000}',
        'message': data['message'] ??
            'Registration successful! Your staff account has been submitted for Admin sign-off.',
      };
    }

    final errorMessage = data['error']?.toString() ??
        'Registration failed. Please check your information.';
    return {'success': false, 'error': errorMessage};
  }

  /// Request Password Reset Link via corporate email
  static Future<Map<String, dynamic>> requestPasswordReset(String email) async {
    final response = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/auth/magic-link'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email.trim().toLowerCase()}),
      ),
    );

    final data = jsonDecode(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {
        'success': true,
        'message': data['message'] ?? 'Password reset link sent to $email'
      };
    }

    return {
      'success': false,
      'error': data['error'] ?? 'Could not dispatch password reset link.'
    };
  }

  /// Reset Password with Token / OTP verification
  static Future<bool> resetPasswordWithToken({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/auth/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email.trim().toLowerCase(),
          'code': code.trim(),
          'newPassword': newPassword,
        }),
      ),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not reset password.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Password reset failed.');
    }
  }

  /// ----------------------------------------------------
  /// REQUEST-SPECIFIC CHAT & COLLABORATION
  /// ----------------------------------------------------

  /// Fetch conversation thread, participants, and timeline messages for a specific request
  static Future<Map<String, dynamic>> getRequestChat({
    required String requestNumber,
    required String employeeId,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.get(
        Uri.parse('$host/api/requests/${Uri.encodeComponent(requestNumber)}/action'),
        headers: _headers(token: token, employeeId: employeeId),
      ),
    );

    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return Map<String, dynamic>.from(data as Map);
    }
    throw Exception(data['error']?.toString() ?? 'Could not load request messages.');
  }

  /// Post a message to the request collaboration channel (public group or private mention)
  static Future<Map<String, dynamic>> sendRequestMessage({
    required String requestNumber,
    required String employeeId,
    required String text,
    String visibility = 'GROUP',
    String? recipientId,
    String? attachmentUrl,
    String? attachmentName,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/requests/${Uri.encodeComponent(requestNumber)}/action'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({
          'action': 'SEND_MESSAGE',
          'text': text.trim(),
          'visibility': visibility,
          if (recipientId != null) 'recipientId': recipientId,
          if (attachmentUrl != null) 'attachmentUrl': attachmentUrl,
          if (attachmentName != null) 'attachmentName': attachmentName,
        }),
      ),
    );

    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return Map<String, dynamic>.from(data as Map);
    }
    throw Exception(data['error']?.toString() ?? 'Could not post message.');
  }

  /// ----------------------------------------------------
  /// GENERAL STAFF ↔ ADMIN HELPDESK CHAT
  /// ----------------------------------------------------

  /// Fetch direct messages between this staff member and company administrators
  static Future<List<Map<String, dynamic>>> getAdminChat({
    required String employeeId,
    String? token,
  }) async {
    try {
      final res = await _executeWithFailover(
        (host) => http.get(
          Uri.parse('$host/api/staff/chat/admin'),
          headers: _headers(token: token, employeeId: employeeId),
        ),
      );

      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300 && data['messages'] != null) {
        return List<Map<String, dynamic>>.from(data['messages']);
      }
    } catch (_) {}
    return [];
  }

  /// Send a general message from staff to administrators
  static Future<Map<String, dynamic>> sendAdminMessage({
    required String employeeId,
    required String text,
    String? attachmentUrl,
    String? attachmentName,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/staff/chat/admin'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({
          'message': text.trim(),
          if (attachmentUrl != null) 'attachmentUrl': attachmentUrl,
          if (attachmentName != null) 'attachmentName': attachmentName,
        }),
      ),
    );

    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return Map<String, dynamic>.from(data['message'] as Map);
    }
    throw Exception(data['error']?.toString() ?? 'Could not send message to admin.');
  }

  /// Update staff avatar in database
  static Future<bool> updateEmployeeAvatar({
    required String employeeId,
    required String avatarUrl,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.post(
        Uri.parse('$host/api/staff/$employeeId/contact'),
        headers: _headers(token: token, employeeId: employeeId),
        body: jsonEncode({'avatarUrl': avatarUrl}),
      ),
    );

    return res.statusCode >= 200 && res.statusCode < 300;
  }

  /// Delete/retract a fund request before admin approval
  static Future<bool> deleteFundRequest({
    required String requestNumber,
    required String employeeId,
    String? token,
  }) async {
    final res = await _executeWithFailover(
      (host) => http.delete(
        Uri.parse('$host/api/requests/${Uri.encodeComponent(requestNumber)}'),
        headers: _headers(token: token, employeeId: employeeId),
      ),
    );

    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return true;
    }
    throw Exception(data['error']?.toString() ?? 'Failed to delete fund request.');
  }
}
