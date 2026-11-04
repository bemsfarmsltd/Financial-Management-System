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
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadPayroll();
  }

  Future<void> _loadPayroll() async {
    setState(() => _isLoading = true);
    final res = await ApiService.fetchPayrollFull();
    if (mounted) {
      setState(() {
        _data = res;
        _isLoading = false;
      });
    }
  }

  Future<void> _signOffPayroll() async {
    final batch = _data['batch'] as Map<String, dynamic>?;
    if (batch == null || batch['id'] == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No active batch found to sign off.'), backgroundColor: Color(0xFFDC2626)),
      );
      return;
    }

    final batchId = batch['id'].toString();
    final batchStatus = (batch['status'] ?? '').toString().toUpperCase();

    if (batchStatus == 'APPROVED') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This payroll batch has already been certified and signed off by the GMD.'), backgroundColor: Color(0xFF059669)),
      );
      return;
    }

    // Load assignees for payment recording
    List<dynamic> assignees = [];
    try {
      assignees = await ApiService.fetchPayrollAssignees();
    } catch (_) {}

    if (!mounted) return;

    String selectedAssigneeId = assignees.isNotEmpty ? assignees[0]['id'].toString() : '';
    String comments = '';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Row(
            children: [
              Icon(Icons.draw_rounded, color: Color(0xFFEA580C), size: 22),
              SizedBox(width: 8),
              Text('GMD Executive Sign-off', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Confirm and authorize net payout of ${batch['totalNetFormatted'] ?? '₦0'} across ${batch['employeeCount'] ?? 0} staff members.',
                  style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)),
                ),
                const SizedBox(height: 14),
                const Text('Assign payment recording to:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                const SizedBox(height: 6),
                if (assignees.isNotEmpty)
                  DropdownButtonFormField<String>(
                    value: selectedAssigneeId.isNotEmpty ? selectedAssigneeId : null,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    items: assignees.map((a) {
                      final name = a['legalName'] ?? 'Executive';
                      final role = (a['role'] ?? '').toString().replaceAll('_', ' ');
                      return DropdownMenuItem<String>(
                        value: a['id'].toString(),
                        child: Text('$name · $role', style: const TextStyle(fontSize: 12)),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setDialogState(() => selectedAssigneeId = val);
                    },
                  )
                else
                  const Text('No assignees found. Default executive assignee will be used.', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                const SizedBox(height: 12),
                const Text('Approval Notes (Optional):', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                const SizedBox(height: 6),
                TextField(
                  onChanged: (val) => comments = val,
                  decoration: InputDecoration(
                    hintText: 'e.g. Approved for bulk bank transfer.',
                    hintStyle: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ),
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
      ),
    );

    if (confirm != true || !mounted) return;

    setState(() => _isSigning = true);
    try {
      final res = await ApiService.approvePayrollBatch(
        batchId: batchId,
        disbursementAssigneeId: selectedAssigneeId,
        comments: comments,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('✓ ${res['message'] ?? 'GMD Sign-off completed.'}'), backgroundColor: const Color(0xFF059669)),
        );
        await _loadPayroll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: const Color(0xFFDC2626)),
        );
      }
    } finally {
      if (mounted) setState(() => _isSigning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final period = _data['period'] as Map<String, dynamic>?;
    final batch = _data['batch'] as Map<String, dynamic>?;
    final items = (_data['items'] as List<dynamic>?) ?? [];

    final periodName = period?['periodName'] ?? DateFormat('MMMM yyyy').format(DateTime.now());
    final status = (batch?['status'] ?? 'NOT_PREPARED').toString().toUpperCase();
    final isApproved = status == 'APPROVED' || status == 'DISBURSED';
    final version = batch?['version'] ?? 1;

    final totalGross = batch?['totalGrossFormatted'] ?? '₦0';
    final totalNet = batch?['totalNetFormatted'] ?? '₦0';
    final totalDeductions = batch?['totalDeductionsFormatted'] ?? '₦0';
    final staffCount = batch?['employeeCount'] ?? items.length;

    // Cost allocations breakdown
    final costAllocation = batch?['costAllocation'] as Map<String, dynamic>?;
    final allocations = (costAllocation?['allocations'] as List<dynamic>?) ?? [];

    // Filter items
    final filteredItems = items.where((it) {
      if (_searchQuery.trim().isEmpty) return true;
      final q = _searchQuery.trim().toLowerCase();
      final name = (it['employeeName'] ?? '').toString().toLowerCase();
      final role = (it['role'] ?? '').toString().toLowerCase();
      final org = (it['primarySubsidiary'] ?? '').toString().toLowerCase();
      return name.contains(q) || role.contains(q) || org.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Hybrid Payroll Cockpit', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
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
                  // Period & Total Cash Outflow Banner
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFF1E293B)]),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(color: const Color(0xFF0F172A).withOpacity(0.12), blurRadius: 16, offset: const Offset(0, 6)),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(periodName.toUpperCase(), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFFFB923C), letterSpacing: 0.6)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isApproved ? const Color(0xFF059669) : const Color(0xFFD97706),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text('VERSION $version · $status', style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Colors.white)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text('TOTAL MONTHLY NET CASH OUTFLOW', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8), letterSpacing: 0.5)),
                        const SizedBox(height: 4),
                        Text(
                          totalNet,
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Total Gross Payroll', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                Text(totalGross, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFE2E8F0))),
                              ],
                            ),
                            const SizedBox(width: 20),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Attendance Deductions', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                Text('-$totalDeductions', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFFDBA74))),
                              ],
                            ),
                            const SizedBox(width: 20),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Staff Headcount', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                Text('$staffCount Staff', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white)),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Executive Sign-Off CTA (or Sign-off Completed Badge)
                  if (!isApproved)
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton.icon(
                        icon: _isSigning
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.draw_rounded, size: 18, color: Colors.white),
                        label: const Text('Execute GMD Payroll Sign-Off ✍️', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA580C),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        onPressed: _isSigning ? null : _signOffPayroll,
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Certified & Approved by GMD', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF065F46))),
                                Text(
                                  'Assigned to ${batch?['disbursementAssignee']?['legalName'] ?? 'Finance'} for external bank disbursements.',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF047857)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                  const SizedBox(height: 18),

                  // Subsidiary Cost Allocation Card
                  if (allocations.isNotEmpty) ...[
                    const Text('SUBSIDIARY COST ALLOCATIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: allocations.map((alloc) {
                          final subName = alloc['subsidiaryName'] ?? 'Subsidiary';
                          final amt = alloc['amountFormatted'] ?? '₦0';
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 5),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(color: Color(0xFFEA580C), shape: BoxShape.circle),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(subName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                                  ],
                                ),
                                Text(amt, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],

                  // Staff Register Table
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('STAFF PAYROLL REGISTER (${filteredItems.length})', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                      if (items.isNotEmpty)
                        const Text('Gross → Deductions → Net', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Search Field
                  TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search staff name, role, or subsidiary…',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF94A3B8)),
                      contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    style: const TextStyle(fontSize: 12),
                  ),

                  const SizedBox(height: 10),

                  if (filteredItems.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: const Center(
                        child: Text('No staff records found in this batch.', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                      ),
                    )
                  else
                    ...filteredItems.map((it) {
                      final name = it['employeeName'] ?? 'Staff Member';
                      final role = it['role'] ?? 'STAFF';
                      final org = it['primarySubsidiary'] ?? 'BEMS Group';
                      final gross = it['grossFormatted'] ?? '₦0';
                      final net = it['netFormatted'] ?? '₦0';
                      final ded = it['deductionsFormatted'] ?? '₦0';
                      final payStatus = it['paymentStatus'] ?? 'UNPAID';
                      final isPaid = payStatus == 'RECIPIENT_CONFIRMED' || payStatus == 'PAID';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text(
                                  name.isNotEmpty ? name[0] : 'S',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                  Text('$org · $role', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                                  const SizedBox(height: 2),
                                  Text('Gross: $gross · Deductions: -$ded', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(net, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF059669))),
                                const SizedBox(height: 2),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    isPaid ? 'PAID' : 'PENDING',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: isPaid ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
