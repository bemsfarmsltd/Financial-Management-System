import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class PayrollSignOffScreen extends StatefulWidget {
  const PayrollSignOffScreen({super.key});

  @override
  State<PayrollSignOffScreen> createState() => _PayrollSignOffScreenState();
}

class _PayrollSignOffScreenState extends State<PayrollSignOffScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _data = {};
  bool _isSigning = false;

  @override
  void initState() {
    super.initState();
    _loadPayroll();
  }

  Future<void> _loadPayroll() async {
    setState(() => _isLoading = true);
    final res = await ApiService.fetchPayrollSummary();
    if (mounted) {
      setState(() {
        _data = res;
        _isLoading = false;
      });
    }
  }

  Future<void> _signOffPayroll() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Row(
          children: [
            Icon(Icons.draw_rounded, color: Color(0xFFEA580C), size: 22),
            SizedBox(width: 8),
            Text('GMD Executive Sign-off', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ),
        content: const Text(
          'Are you sure you want to certify and approve the monthly hybrid payroll batches across all BEMS Group subsidiaries?',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEA580C),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Certify & Sign Off', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isSigning = true);
    await Future.delayed(const Duration(seconds: 1)); // Simulating signature audit event
    if (mounted) {
      setState(() => _isSigning = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('✓ GMD Executive sign-off completed for this payroll cycle.'), backgroundColor: Color(0xFF059669)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final payrolls = (_data['subsidiaryPayrolls'] as List<dynamic>?) ?? [];
    final monthName = DateFormat('MMMM yyyy').format(DateTime.now());

    num totalGross = 0;
    num totalNet = 0;
    num totalStaff = 0;

    for (final p in payrolls) {
      totalGross += (p['gross_salary'] ?? 0);
      totalNet += (p['net_salary'] ?? 0);
      totalStaff += (p['staff_count'] ?? 0);
    }

    final currencyFormatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Hybrid Payroll & Splits', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B), size: 20),
            onPressed: _loadPayroll,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
          : RefreshIndicator(
              onRefresh: _loadPayroll,
              color: const Color(0xFFEA580C),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Month Banner
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFF1E293B)]),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(monthName.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFFB923C), letterSpacing: 0.6)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: const Color(0xFF334155), borderRadius: BorderRadius.circular(6)),
                              child: Text('$totalStaff Active Staff', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.white)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        const Text('TOTAL MONTHLY NET SALARIES', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 4),
                        Text(
                          currencyFormatter.format(totalNet),
                          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Total Gross', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                Text(currencyFormatter.format(totalGross), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFE2E8F0))),
                              ],
                            ),
                            const SizedBox(width: 24),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Statutory Withholdings', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                Text(currencyFormatter.format(totalGross - totalNet), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFCBD5E1))),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Executive Sign-Off Action Button
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton.icon(
                      icon: _isSigning
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.draw_rounded, size: 18, color: Colors.white),
                      label: const Text('Execute GMD Payroll Sign-Off', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      onPressed: _isSigning ? null : _signOffPayroll,
                    ),
                  ),

                  const SizedBox(height: 20),
                  const Text('SUBSIDIARY BATCHES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                  const SizedBox(height: 10),

                  if (payrolls.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: const Center(
                        child: Text('No active payroll batches for this period.', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                      ),
                    )
                  else
                    ...payrolls.map((p) => _buildSubsidiaryCard(p, currencyFormatter)),
                ],
              ),
            ),
    );
  }

  Widget _buildSubsidiaryCard(Map<String, dynamic> p, NumberFormat fmt) {
    final name = p['subsidiary_name'] ?? 'Subsidiary';
    final count = p['staff_count'] ?? 0;
    final net = p['net_salary'] ?? 0;
    final status = p['payment_status'] ?? 'SCHEDULED';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.business_rounded, color: Color(0xFF475569), size: 18),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 2),
                  Text('$count Employees · $status', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
            ],
          ),
          Text(fmt.format(net), style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
