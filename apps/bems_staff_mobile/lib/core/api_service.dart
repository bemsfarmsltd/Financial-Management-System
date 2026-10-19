import 'dart:convert';
import 'package:http/http.dart' as http;
import 'constants.dart';
import '../models/fund_request.dart';
import '../models/payslip.dart';

class ApiService {
  final String baseUrl;
  final http.Client _client = http.Client();

  ApiService({String? customBaseUrl})
      : baseUrl = customBaseUrl ?? AppConstants.defaultBaseUrl;

  // In-memory local cache for requests so that locally created ones appear immediately
  final List<FundRequestItem> _localRequests = [
    FundRequestItem(
      id: 'req-001',
      requestNumber: 'REQ-2026-0001',
      title: 'Hostinger Cloud VPS Hosting Renewal',
      category: 'Software & Infrastructure',
      amount: 450000.0,
      status: 'HOD_REVIEW',
      statusLabel: 'Under HOD Review',
      stepIndex: 1,
      submittedDate: 'Oct 16, 2026',
      subsidiaryName: 'Bems Group Cloud & Technologies Ltd',
      departmentName: 'Technology & DevOps',
      needsRetirement: false,
      channelComments: [
        'Quote from Hostinger verified against annual budget envelope.',
        'HOD requested confirmation of server backup retention period.'
      ],
    ),
    FundRequestItem(
      id: 'req-002',
      requestNumber: 'REQ-2026-0002',
      title: 'Emergency Generator Diesel Supply (4000L)',
      category: 'Power & Operational Facilities',
      amount: 2800000.0,
      status: 'GMD_APPROVED',
      statusLabel: 'Approved for Banking Transfer',
      stepIndex: 3,
      submittedDate: 'Oct 15, 2026',
      subsidiaryName: 'Bems Group Holdings Ltd',
      departmentName: 'Operations & Facilities',
      needsRetirement: false,
      channelComments: [
        'Three-way match confirmed with Oando Energy invoice #4491.',
        'GMD Henry Nwosu approved expenditure cap.'
      ],
    ),
    FundRequestItem(
      id: 'req-003',
      requestNumber: 'REQ-2026-0003',
      title: 'On-site Fiber Infrastructure Advance',
      category: 'Petty Cash & Field Advance',
      amount: 1200000.0,
      status: 'DISBURSED',
      statusLabel: 'Funds Disbursed — Retirement Due',
      stepIndex: 4,
      submittedDate: 'Oct 14, 2026',
      subsidiaryName: 'Bems Group Cloud & Technologies Ltd',
      departmentName: 'Infrastructure',
      needsRetirement: true,
      channelComments: [
        'Disbursed via Access Bank ref TRF/OCT/88219.',
        'Policy SLA: Upload physical invoices within 72 hours of project completion.'
      ],
    ),
  ];

  // Fetch Requests
  Future<List<FundRequestItem>> getMyRequests() async {
    try {
      final url = Uri.parse('$baseUrl${AppConstants.requestsEndpoint}');
      final response = await _client.get(url).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data is List) {
          final fetched = data.map((item) => FundRequestItem.fromJson(item)).toList();
          return fetched.isNotEmpty ? fetched : _localRequests;
        }
      }
    } catch (_) {
      // Graceful fallback to rich local state
    }
    return _localRequests;
  }

  // Create Fund Request
  Future<FundRequestItem> createFundRequest({
    required String title,
    required String category,
    required double amount,
    required String department,
    required String rationale,
  }) async {
    final newNumber = 'REQ-2026-000${_localRequests.length + 1}';
    final newItem = FundRequestItem(
      id: 'req-${DateTime.now().millisecondsSinceEpoch}',
      requestNumber: newNumber,
      title: title,
      category: category,
      amount: amount,
      status: 'SUBMITTED',
      statusLabel: 'Submitted to HOD',
      stepIndex: 0,
      submittedDate: 'Just now',
      subsidiaryName: 'Bems Group Cloud & Technologies Ltd',
      departmentName: department,
      needsRetirement: category.contains('Advance') || category.contains('Petty Cash'),
      channelComments: ['Request initiated by Temitope Bakare: "$rationale"'],
    );

    // Try API POST
    try {
      final url = Uri.parse('$baseUrl${AppConstants.createRequestEndpoint}');
      await _client.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'title': title,
          'category': category,
          'amountMinor': (amount * 100).toInt(),
          'department': department,
          'rationale': rationale,
        }),
      ).timeout(const Duration(seconds: 4));
    } catch (_) {
      // Local state fallback ensures app always succeeds for demonstration
    }

    _localRequests.insert(0, newItem);
    return newItem;
  }

  // Submit Advance Retirement
  Future<bool> submitAdvanceRetirement({
    required String requestId,
    required double actualSpent,
    required double refundAmount,
    required String receiptNotes,
    required String receiptFileName,
  }) async {
    try {
      final url = Uri.parse('$baseUrl${AppConstants.accountabilityEndpoint}/close');
      await _client.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'requestId': requestId,
          'actualSpentMinor': (actualSpent * 100).toInt(),
          'refundAmountMinor': (refundAmount * 100).toInt(),
          'notes': receiptNotes,
          'receiptFileName': receiptFileName,
        }),
      ).timeout(const Duration(seconds: 4));
    } catch (_) {}

    // Update local state
    final index = _localRequests.indexWhere((r) => r.id == requestId || r.requestNumber == requestId);
    if (index != -1) {
      final current = _localRequests[index];
      _localRequests[index] = FundRequestItem(
        id: current.id,
        requestNumber: current.requestNumber,
        title: current.title,
        category: current.category,
        amount: current.amount,
        status: 'CLOSED',
        statusLabel: 'Retirement Verified & Closed',
        stepIndex: 4,
        submittedDate: current.submittedDate,
        subsidiaryName: current.subsidiaryName,
        departmentName: current.departmentName,
        needsRetirement: false,
        channelComments: [
          ...current.channelComments,
          'Retirement receipts submitted by staff: ₦${actualSpent.toInt()} accounted for. Verifier approved closure.'
        ],
      );
    }
    return true;
  }

  // Fetch Payslips
  Future<List<PayslipPayment>> getMyPayslips() async {
    try {
      final url = Uri.parse('$baseUrl${AppConstants.myPaymentsEndpoint}');
      final response = await _client.get(url).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['payments'] is List) {
          final list = (data['payments'] as List).map((p) => PayslipPayment.fromJson(p)).toList();
          if (list.isNotEmpty) return list;
        }
      }
    } catch (_) {}

    // Return official demo payslips
    return [
      PayslipPayment(
        id: 'pay-001',
        periodName: 'October 2026 Salary',
        amountFormatted: '₦680,000',
        grossAmount: 750000.0,
        netAmount: 680000.0,
        taxPaye: 45000.0,
        pensionDeduction: 25000.0,
        bankName: 'Access Bank Plc',
        reference: 'PAY/BEMS/2026/10-0982',
        paidAt: '2026-10-15',
        status: 'VERIFIED',
        receiptFileName: 'bems_october_payroll_batch.pdf',
        isConfirmedByStaff: false,
      ),
      PayslipPayment(
        id: 'pay-002',
        periodName: 'September 2026 Salary',
        amountFormatted: '₦680,000',
        grossAmount: 750000.0,
        netAmount: 680000.0,
        taxPaye: 45000.0,
        pensionDeduction: 25000.0,
        bankName: 'Access Bank Plc',
        reference: 'PAY/BEMS/2026/09-0411',
        paidAt: '2026-09-28',
        status: 'VERIFIED',
        receiptFileName: 'bems_september_payroll_batch.pdf',
        isConfirmedByStaff: true,
        confirmationDate: '2026-09-29',
      ),
    ];
  }

  // Confirm receipt of salary
  Future<bool> confirmPayslipReceived(String payslipId) async {
    try {
      final url = Uri.parse('$baseUrl${AppConstants.myPaymentsEndpoint}');
      await _client.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'paymentId': payslipId, 'decision': 'CONFIRMED'}),
      ).timeout(const Duration(seconds: 4));
    } catch (_) {}
    return true;
  }
}
