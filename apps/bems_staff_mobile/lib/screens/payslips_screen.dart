import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/constants.dart';
import '../core/api_service.dart';
import '../models/payslip.dart';

class PayslipsScreen extends StatefulWidget {
  const PayslipsScreen({super.key});

  @override
  State<PayslipsScreen> createState() => _PayslipsScreenState();
}

class _PayslipsScreenState extends State<PayslipsScreen> {
  final ApiService _apiService = ApiService();
  List<PayslipPayment> _payslips = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPayslips();
  }

  Future<void> _loadPayslips() async {
    setState(() => _isLoading = true);
    final list = await _apiService.getMyPayslips();
    if (mounted) {
      setState(() {
        _payslips = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleConfirm(PayslipPayment pay) async {
    await _apiService.confirmPayslipReceived(pay.id);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Payment acknowledged for ${pay.periodName}. Thank you!'),
        backgroundColor: BemsTheme.successEmerald,
      ),
    );
    _loadPayslips();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Payslips & Income'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadPayslips,
        color: BemsTheme.primaryBlue,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Privacy PR-14 Notice
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: BemsTheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: BemsTheme.cardBorder),
              ),
              child: Row(
                children: const [
                  Icon(Icons.lock_outline_rounded, color: BemsTheme.primaryBlueLight, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'PR-14 Privacy Guard: You are viewing only your own verified compensation statements and statutory deductions.',
                      style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary, height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_payslips.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: Text('No payslips recorded yet.', style: TextStyle(color: BemsTheme.textMuted)),
                ),
              )
            else
              ..._payslips.map((pay) => _buildPayslipCard(pay)),
          ],
        ),
      ),
    );
  }

  Widget _buildPayslipCard(PayslipPayment pay) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: BemsTheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: BemsTheme.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pay.periodName,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    Text(
                      'Paid: ${pay.paidAt}',
                      style: const TextStyle(fontSize: 11, color: BemsTheme.textMuted),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: BemsTheme.successEmerald.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: BemsTheme.successEmerald.withOpacity(0.4)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.check_circle_rounded, size: 12, color: BemsTheme.successEmerald),
                      SizedBox(width: 4),
                      Text(
                        'SETTLED',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: BemsTheme.successEmerald),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Salary Breakdown Breakdown Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: BemsTheme.surfaceLight.withOpacity(0.4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  _buildLineItem('Gross Base Salary', AppConstants.formatNaira(pay.grossAmount)),
                  const SizedBox(height: 6),
                  _buildLineItem('PAYE State Tax', '- ${AppConstants.formatNaira(pay.taxPaye)}', isDeduction: true),
                  const SizedBox(height: 6),
                  _buildLineItem('RSA Pension Deduction', '- ${AppConstants.formatNaira(pay.pensionDeduction)}', isDeduction: true),
                  const Divider(color: BemsTheme.cardBorder, height: 16),
                  _buildLineItem('Net Paid to Account', pay.amountFormatted, isBold: true),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Bank reference
            Row(
              children: [
                const Icon(Icons.account_balance_rounded, size: 14, color: BemsTheme.textSecondary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${pay.bankName} · Ref: ${pay.reference}',
                    style: const TextStyle(fontSize: 11, color: BemsTheme.textSecondary, fontFamily: 'monospace'),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Confirmation / Receipt acknowledgment
            if (pay.isConfirmedByStaff)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: BemsTheme.successEmerald.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.done_all_rounded, size: 16, color: BemsTheme.successEmerald),
                    SizedBox(width: 8),
                    Text(
                      'You confirmed receipt of this salary transfer.',
                      style: TextStyle(fontSize: 11, color: BemsTheme.successEmerald, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              )
            else
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _handleConfirm(pay),
                  icon: const Icon(Icons.thumb_up_alt_outlined, size: 16),
                  label: const Text('Confirm Transfer Received in My Account'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: BemsTheme.primaryBlueLight,
                    side: const BorderSide(color: BemsTheme.primaryBlue),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildLineItem(String label, String value, {bool isDeduction = false, bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            color: isBold ? Colors.white : BemsTheme.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isBold ? 14 : 12,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: isDeduction
                ? Colors.redAccent
                : isBold
                    ? BemsTheme.successEmerald
                    : Colors.white,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }
}
