import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/staff_models.dart';

class StaffApiService {
  static String get baseUrl => 'https://bemserp.work';

  /// Authenticate against production Next.js backend with work credentials
  static Future<StaffUser> login({
    required String email,
    required String password,
  }) async {
    final uri = Uri.parse('$baseUrl/api/auth/login');
    final response = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'email': email.trim().toLowerCase(),
            'password': password,
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = jsonDecode(response.body);

    if (response.statusCode == 200 && data['user'] != null) {
      return StaffUser.fromJson(data['user']);
    }

    final errorMessage = data['error']?.toString() ?? 'Invalid work credentials. Please check your email and password.';
    throw Exception(errorMessage);
  }

  /// Upload staff passport photograph / profile picture directly to backend storage
  static Future<String> uploadAvatar({
    required List<int> bytes,
    required String filename,
  }) async {
    final uri = Uri.parse('$baseUrl/api/upload');
    final request = http.MultipartRequest('POST', uri)
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));

    final streamedResponse = await request.send().timeout(const Duration(seconds: 20));
    final response = await http.Response.fromStream(streamedResponse);
    final data = jsonDecode(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300 && data['url'] != null) {
      final url = data['url'].toString();
      return url.startsWith('http') ? url : '$baseUrl$url';
    }

    final err = data['error']?.toString() ?? 'Could not upload passport photo.';
    throw Exception(err);
  }

  /// Live dashboard queries returning authoritative records from PostgreSQL
  static Future<Map<String, dynamic>> fetchStaffDashboard({required String userEmail}) async {
    final reqUri = Uri.parse('$baseUrl/api/requests?_t=${DateTime.now().millisecondsSinceEpoch}');
    final disbUri = Uri.parse('$baseUrl/api/staff/disbursements?_t=${DateTime.now().millisecondsSinceEpoch}');
    final accUri = Uri.parse('$baseUrl/api/accountability?_t=${DateTime.now().millisecondsSinceEpoch}');

    final responses = await Future.wait([
      http.get(reqUri).timeout(const Duration(seconds: 12)),
      http.get(disbUri).timeout(const Duration(seconds: 12)),
      http.get(accUri).timeout(const Duration(seconds: 12)),
    ]);

    List<FundRequestItem> liveRequests = [];
    if (responses[0].statusCode == 200) {
      final data = jsonDecode(responses[0].body);
      final list = (data['requests'] as List<dynamic>?) ?? [];
      liveRequests = list.map((item) => FundRequestItem.fromJson(item)).toList();
    }

    List<DisbursementItem> liveDisbursements = [];
    if (responses[1].statusCode == 200) {
      final data = jsonDecode(responses[1].body);
      final list = (data['awaitingConfirmation'] as List<dynamic>?) ?? [];
      liveDisbursements = list.map((item) => DisbursementItem.fromJson(item)).toList();
    }

    List<AccountabilityCaseItem> liveCases = [];
    if (responses[2].statusCode == 200) {
      final data = jsonDecode(responses[2].body);
      final list = (data['cases'] as List<dynamic>?) ?? [];
      liveCases = list.map((item) => AccountabilityCaseItem.fromJson(item)).toList();
    }

    return {
      'requests': liveRequests,
      'disbursementsAwaiting': liveDisbursements,
      'accountabilityCases': liveCases,
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
    String? dueDate,
    bool isRecurring = false,
    String? recurringInterval,
    String? vendorName,
    bool isIntercompany = false,
  }) async {
    final uri = Uri.parse('$baseUrl/api/requests');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
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
          }),
        )
        .timeout(const Duration(seconds: 15));

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
    String? note,
  }) async {
    final uri = Uri.parse('$baseUrl/api/disbursements/confirm');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'disbursementId': disbursementId,
            'decision': decision,
            'note': note ?? '',
          }),
        )
        .timeout(const Duration(seconds: 15));

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not confirm receipt of funds.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Failed to record recipient payment confirmation.');
    }
  }

  /// Submit 72-Hour SLA accountability receipts & deliverables
  static Future<bool> submitRetirementEvidence({
    required String caseId,
    required String notes,
    required String receiptName,
    double? actualSpentNaira,
    double? refundOrReimbursementNaira,
    List<String> attachments = const [],
  }) async {
    final uri = Uri.parse('$baseUrl/api/accountability/evidence');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'caseId': caseId,
            'notes': notes,
            'attachmentName': receiptName,
            'actualSpent': actualSpentNaira ?? 0,
            'refundOrReimbursement': refundOrReimbursementNaira ?? 0,
            'attachments': attachments,
          }),
        )
        .timeout(const Duration(seconds: 15));

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not upload accountability proof.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Failed to submit retirement proof.');
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
  }) async {
    final uri = Uri.parse('$baseUrl/api/staff/$employeeId/banking');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'bankName': bankName,
            'accountNumber': accountNumber,
            'accountName': accountName,
            'salaryBankName': salaryBankName,
            'salaryAccountNumber': salaryAccountNumber,
            'salaryAccountName': salaryAccountName,
          }),
        )
        .timeout(const Duration(seconds: 15));

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
  }) async {
    final uri = Uri.parse('$baseUrl/api/staff/$employeeId/contact');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'phone': phone}),
        )
        .timeout(const Duration(seconds: 15));

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
  }) async {
    final uri = Uri.parse('$baseUrl/api/staff/$employeeId/password');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'oldPassword': oldPassword,
            'newPassword': newPassword,
          }),
        )
        .timeout(const Duration(seconds: 15));

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
    final uri = Uri.parse('$baseUrl/api/auth/signup');
    final response = await http
        .post(
          uri,
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
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(response.body);

    if (response.statusCode == 200 || response.statusCode == 201) {
      return {
        'success': true,
        'employeeNumber': data['employeeNumber'] ?? 'BEMS-REG-${DateTime.now().millisecondsSinceEpoch % 10000}',
        'message': data['message'] ?? 'Registration successful! Your staff account has been submitted for Admin sign-off.',
      };
    }

    final errorMessage = data['error']?.toString() ?? 'Registration failed. Please check your information.';
    return {'success': false, 'error': errorMessage};
  }

  /// Request Password Reset Link via corporate email
  static Future<Map<String, dynamic>> requestPasswordReset(String email) async {
    final uri = Uri.parse('$baseUrl/api/auth/magic-link');
    final response = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email.trim().toLowerCase()}),
        )
        .timeout(const Duration(seconds: 15));

    final data = jsonDecode(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {'success': true, 'message': data['message'] ?? 'Password reset link sent to $email'};
    }

    return {'success': false, 'error': data['error'] ?? 'Could not dispatch password reset link.'};
  }

  /// Reset Password with Token / OTP verification
  static Future<bool> resetPasswordWithToken({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    final uri = Uri.parse('$baseUrl/api/auth/reset-password');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'email': email.trim().toLowerCase(),
            'code': code.trim(),
            'newPassword': newPassword,
          }),
        )
        .timeout(const Duration(seconds: 15));

    if (res.statusCode >= 200 && res.statusCode < 300) return true;

    try {
      final data = jsonDecode(res.body);
      throw Exception(data['error']?.toString() ?? 'Could not reset password.');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Password reset failed.');
    }
  }
}

