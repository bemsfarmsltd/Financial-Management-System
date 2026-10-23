import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/staff_models.dart';
import '../services/staff_api_service.dart';
import '../services/staff_storage_service.dart';
import 'new_fund_request_screen.dart';
import 'staff_login_screen.dart';

class StaffMainScreen extends StatefulWidget {
  final StaffUser user;

  const StaffMainScreen({super.key, required this.user});

  @override
  State<StaffMainScreen> createState() => _StaffMainScreenState();
}

class _StaffMainScreenState extends State<StaffMainScreen> {
  late StaffUser _currentUser;
  int _currentIndex = 0;
  bool _isLoading = true;
  bool _hideBalance = false;

  List<FundRequestItem> _requests = [];
  List<DisbursementItem> _disbursementsAwaiting = [];
  List<AccountabilityCaseItem> _cases = [];

  // Search & Filter state for Requisitions
  String _searchQuery = '';
  String _selectedStatusFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _currentUser = widget.user;
    _loadData();
  }

  Future<void> _loadData() async {
    final data = await StaffApiService.fetchStaffDashboard(userEmail: _currentUser.email);
    if (mounted) {
      setState(() {
        _requests = data['requests'] as List<FundRequestItem>;
        _disbursementsAwaiting = data['disbursementsAwaiting'] as List<DisbursementItem>;
        _cases = data['accountabilityCases'] as List<AccountabilityCaseItem>;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleConfirmPayment(DisbursementItem disb) async {
    await StaffApiService.confirmDisbursement(
      disbursementId: disb.id,
      decision: 'RECEIVED',
    );
    if (!mounted) return;
    setState(() {
      _disbursementsAwaiting.removeWhere((d) => d.id == disb.id);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('✓ Payment confirmed! 72-Hour Evidence Window activated.'),
        backgroundColor: Color(0xFF059669),
      ),
    );
    _loadData();
  }

  Future<void> _handleReportIssue(DisbursementItem disb) async {
    final noteController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Report Payment Discrepancy', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Let Finance know what issue you experienced with reference ${disb.reference}:',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                maxLines: 2,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  hintText: 'e.g. Funds not reflected in bank account yet.',
                  hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await StaffApiService.confirmDisbursement(
                  disbursementId: disb.id,
                  decision: 'NOT_RECEIVED',
                  note: noteController.text.trim(),
                );
                if (!mounted) return;
                setState(() => _disbursementsAwaiting.removeWhere((d) => d.id == disb.id));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Discrepancy reported to Finance & Audit team for investigation.'),
                    backgroundColor: Color(0xFFDC2626),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Submit Report'),
            ),
          ],
        );
      },
    );
  }

  // 1. REQUISITION AUDIT INSPECTOR MODAL SHEET
  void _showRequisitionAuditSheet(FundRequestItem req, NumberFormat formatter) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (_, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(22, 12, 22, 30),
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 5,
                    decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(3)),
                  ),
                ),
                const SizedBox(height: 18),

                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          req.requestNumber,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
                        ),
                        Text(
                          '${req.subsidiary} · ${req.department}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    Text(
                      formatter.format(req.amountNaira),
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),

                const SizedBox(height: 16),
                const Divider(color: Color(0xFFE2E8F0)),
                const SizedBox(height: 14),

                // Payee Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Image.network(
                          req.avatarUrl,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('PAYEE / BENEFICIARY', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
                            const SizedBox(height: 2),
                            Text(req.payeeName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                            Text('Category: ${req.category} · Priority: ${req.urgency}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // Purpose & Justification
                _buildAuditInfoBlock('Operational Purpose', req.title),
                const SizedBox(height: 12),
                _buildAuditInfoBlock('Business Justification', req.justification),
                const SizedBox(height: 12),
                _buildAuditInfoBlock('Mandatory 72h Deliverable Proof', req.deliverable),
                const SizedBox(height: 12),
                _buildAuditInfoBlock('Disbursement Due Date', req.dueDate),
                const SizedBox(height: 12),
                if (req.isRecurring) ...[
                  _buildAuditInfoBlock('Recurrence Policy', '${req.recurringInterval ?? "MONTHLY"} (Admin & Treasury alerted 7 days prior)'),
                  const SizedBox(height: 12),
                ],
                if (req.vendorName != null) ...[
                  _buildAuditInfoBlock('Vendor Registry 3-Way Match', req.vendorName!),
                  const SizedBox(height: 12),
                ],

                const SizedBox(height: 14),

                if (req.paymentStatus == 'PAID') ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        final target = _cases.firstWhere(
                          (item) => item.requestNumber == req.requestNumber,
                          orElse: () => _cases.isNotEmpty
                              ? _cases.first
                              : AccountabilityCaseItem(
                                  id: 'case-req',
                                  requestNumber: req.requestNumber,
                                  title: req.title,
                                  amountNaira: req.amountNaira,
                                  hoursRemaining: 36,
                                  bankReference: 'BEMS-TRX-2026-9041',
                                  disbursedAt: 'Today, 08:30 AM',
                                ),
                        );
                        _showRetirementEvidenceDialog(target);
                      },
                      icon: const Icon(Icons.receipt_long_rounded, size: 18),
                      label: const Text('Upload Proof of Expenditure & Receipts', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                const SizedBox(height: 20),

                // 5-Stage Approval Hierarchy Visualizer
                const Text(
                  'CORPORATE APPROVAL TIMELINE',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8),
                ),
                const SizedBox(height: 12),

                _buildTimelineStep(
                  stepNum: '1',
                  title: 'Requisition Drafted & Submitted',
                  subtitle: '${_currentUser.fullName} · ${req.createdAt}',
                  isDone: true,
                ),
                _buildTimelineStep(
                  stepNum: '2',
                  title: 'Department Head Review & Endorsement',
                  subtitle: 'Head of Operations · Approved',
                  isDone: true,
                ),
                _buildTimelineStep(
                  stepNum: '3',
                  title: 'Internal Audit & Budget Verification',
                  subtitle: 'Finance Desk · Reconciled with Q4 Budget',
                  isDone: true,
                ),
                _buildTimelineStep(
                  stepNum: '4',
                  title: 'GMD Executive Final Sign-Off',
                  subtitle: req.approvalStatus == 'APPROVED' ? 'Executive Signed Off' : 'Currently in GMD Review Queue',
                  isDone: req.approvalStatus == 'APPROVED',
                  isCurrent: req.approvalStatus != 'APPROVED',
                ),
                _buildTimelineStep(
                  stepNum: '5',
                  title: 'Treasury Bank Disbursal Batch',
                  subtitle: req.paymentStatus == 'PAID' ? 'Transferred to Bank Account' : 'Awaiting Final Payout Batch',
                  isDone: req.paymentStatus == 'PAID',
                  isLast: true,
                ),

                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('Close Details', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildAuditInfoBlock(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  Widget _buildTimelineStep({
    required String stepNum,
    required String title,
    required String subtitle,
    required bool isDone,
    bool isCurrent = false,
    bool isLast = false,
  }) {
    Color circleColor = isDone
        ? const Color(0xFF10B981)
        : isCurrent
            ? const Color(0xFFEA580C)
            : const Color(0xFFCBD5E1);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: circleColor,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: isDone
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : Text(stepNum, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: isDone ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
                    margin: const EdgeInsets.symmetric(vertical: 4),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: isDone || isCurrent ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 11, color: isCurrent ? const Color(0xFFEA580C) : const Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 2. 72H EVIDENCE RETIREMENT MODAL SHEET (DUAL-MODE: SNAP PICTURE OR UPLOAD DOCUMENT)
  void _showRetirementEvidenceDialog(AccountabilityCaseItem c) {
    final receiptNumController = TextEditingController(text: 'GRN-2026-${(c.amountNaira ~/ 1000) % 900 + 100}');
    final spentAmountController = TextEditingController(text: c.amountNaira.toInt().toString());
    final noteController = TextEditingController(text: 'Goods received in full count and certified at weighbridge.');
    final formatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

    List<Map<String, String>> uploadedAttachments = [
      {
        'name': 'weighbridge_ticket_batch42.jpg',
        'type': 'PHOTO',
        'size': '2.1 MB',
      },
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final advance = c.amountNaira;
            final spent = double.tryParse(spentAmountController.text.replaceAll(',', '').replaceAll('₦', '').trim()) ?? advance;
            final diff = advance - spent;

            return DraggableScrollableSheet(
              initialChildSize: 0.88,
              minChildSize: 0.5,
              maxChildSize: 0.95,
              expand: false,
              builder: (_, scrollController) {
                return ListView(
                  controller: scrollController,
                  padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(3)),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Proof of Fund Utilization',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              'Requisition: ${c.requestNumber} · Disbursed: ${formatter.format(c.amountNaira)}',
                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${c.hoursRemaining}h left',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Divider(color: Color(0xFFE2E8F0)),
                    const SizedBox(height: 12),

                    // ATTACHMENT ACTION BUTTONS (Snap Picture vs Upload Document)
                    const Text(
                      'ATTACH PROOF OF EXPENDITURE',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 8),

                    Row(
                      children: [
                        // Option 1: Snap Picture
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              setModalState(() {
                                uploadedAttachments.add({
                                  'name': 'camera_receipt_${uploadedAttachments.length + 1}.jpg',
                                  'type': 'PHOTO',
                                  'size': '2.4 MB',
                                });
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('📷 Camera photo captured and attached successfully!'), duration: Duration(seconds: 2)),
                              );
                            },
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFFED7AA)),
                              ),
                              child: const Column(
                                children: [
                                  Icon(Icons.camera_alt_rounded, color: Color(0xFFEA580C), size: 26),
                                  SizedBox(height: 6),
                                  Text('Snap Picture', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF9A3412))),
                                  SizedBox(height: 2),
                                  Text('Physical receipt / invoice', style: TextStyle(fontSize: 9.5, color: Color(0xFFB45309))),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Option 2: Upload Document or Image
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              setModalState(() {
                                uploadedAttachments.add({
                                  'name': 'stamped_waybill_invoice_${uploadedAttachments.length + 1}.pdf',
                                  'type': 'DOCUMENT',
                                  'size': '1.3 MB',
                                });
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('📄 Document attached from storage!'), duration: Duration(seconds: 2)),
                              );
                            },
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: const Column(
                                children: [
                                  Icon(Icons.upload_file_rounded, color: Color(0xFF2563EB), size: 26),
                                  SizedBox(height: 6),
                                  Text('Upload Document', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF1E40AF))),
                                  SizedBox(height: 2),
                                  Text('PDF / Gallery slip', style: TextStyle(fontSize: 9.5, color: Color(0xFF1D4ED8))),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Display attached files list
                    if (uploadedAttachments.isNotEmpty) ...[
                      Column(
                        children: uploadedAttachments.asMap().entries.map((entry) {
                          final idx = entry.key;
                          final item = entry.value;
                          final isPhoto = item['type'] == 'PHOTO';
                          return Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                Icon(isPhoto ? Icons.photo_outlined : Icons.picture_as_pdf_outlined, size: 18, color: isPhoto ? const Color(0xFFEA580C) : const Color(0xFF2563EB)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item['name']!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                                      Text(item['size']!, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFFDC2626)),
                                  onPressed: () => setModalState(() => uploadedAttachments.removeAt(idx)),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Receipt Number Field
                    TextField(
                      controller: receiptNumController,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        labelText: 'RECEIPT / INVOICE / GRN NUMBER',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        hintText: 'e.g. GRN-2026-42 or INV-98104',
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Spent Amount Field with live calculation
                    TextField(
                      controller: spentAmountController,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setModalState(() {}),
                      style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), fontWeight: FontWeight.w800),
                      decoration: InputDecoration(
                        labelText: 'ACTUAL AMOUNT SPENT (NGN)',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        prefixText: '₦ ',
                        prefixStyle: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),

                    const SizedBox(height: 10),

                    // REAL-TIME REFUND / REIMBURSEMENT CALCULATOR
                    if (diff > 0)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.price_change_rounded, color: Color(0xFF059669), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Refund Due to BEMS Treasury: ${formatter.format(diff)}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF065F46)),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'Please refund unspent balance into BEMS Advance Settlement Account.',
                                    style: TextStyle(fontSize: 10.5, color: Color(0xFF047857)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    else if (diff < 0)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.account_balance_wallet_rounded, color: Color(0xFF2563EB), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Reimbursement Due to Staff: ${formatter.format(-diff)}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF1E40AF)),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'Approved excess spend will be credited directly to your bank account.',
                                    style: TextStyle(fontSize: 10.5, color: Color(0xFF1D4ED8)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle_outline_rounded, color: Color(0xFF64748B), size: 18),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Advance 100% Balanced (₦0 Difference)',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                              ),
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 12),

                    TextField(
                      controller: noteController,
                      maxLines: 2,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        labelText: 'DELIVERY & INSPECTION NOTES',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        hintText: 'Verified items received in full quantity and good condition...',
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),

                    const SizedBox(height: 20),

                    ElevatedButton(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        final messenger = ScaffoldMessenger.of(context);
                        await StaffApiService.submitRetirementEvidence(
                          caseId: c.id,
                          notes: noteController.text.trim(),
                          receiptName: receiptNumController.text.trim(),
                          actualSpentNaira: spent,
                          refundOrReimbursementNaira: diff,
                          attachments: uploadedAttachments.map((a) => a['name']!).toList(),
                        );
                        if (!mounted) return;
                        messenger.showSnackBar(
                          const SnackBar(
                            content: Text('✓ Proof of fund utilization submitted for Finance Audit clearance.'),
                            backgroundColor: Color(0xFF059669),
                          ),
                        );
                        _loadData();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.verified_outlined, size: 18),
                          SizedBox(width: 8),
                          Text('Submit Proof for Audit Clearance', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                        ],
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  // 3. CHANGE PASSWORD DIALOG
  void _showChangePasswordDialog() {
    final oldPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          title: const Text('Change Account Password', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: oldPasswordController,
                obscureText: true,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'CURRENT PASSWORD',
                  labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: newPasswordController,
                obscureText: true,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'NEW PASSWORD (MIN 10 CHARS)',
                  labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmPasswordController,
                obscureText: true,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'CONFIRM NEW PASSWORD',
                  labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final oldP = oldPasswordController.text;
                final newP = newPasswordController.text;
                final confirmP = confirmPasswordController.text;

                if (newP.length < 10) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password must be at least 10 characters long.')));
                  return;
                }
                if (newP != confirmP) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Passwords do not match.')));
                  return;
                }

                Navigator.pop(ctx);
                await StaffApiService.changePassword(employeeId: _currentUser.id, oldPassword: oldP, newPassword: newP);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('✓ Password successfully updated!'), backgroundColor: Color(0xFF059669)),
                );
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
              child: const Text('Update Password'),
            ),
          ],
        );
      },
    );
  }

  // 4. UPDATE PHONE NUMBER DIALOG
  void _showUpdatePhoneDialog() {
    final phoneController = TextEditingController(text: _currentUser.phone);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          title: const Text('Update Contact Phone', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
          content: TextField(
            controller: phoneController,
            keyboardType: TextInputType.phone,
            style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              labelText: 'MOBILE PHONE NUMBER',
              labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
              prefixIcon: const Icon(Icons.phone_outlined, color: Color(0xFFEA580C), size: 18),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final newPhone = phoneController.text.trim();
                Navigator.pop(ctx);
                await StaffApiService.updatePhoneNumber(employeeId: _currentUser.id, phone: newPhone);
                final updated = _currentUser.copyWith(phone: newPhone);
                await StaffStorageService.saveUser(updated);
                if (!mounted) return;
                setState(() => _currentUser = updated);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('✓ Phone number updated!'), backgroundColor: Color(0xFF059669)),
                );
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
              child: const Text('Save Phone'),
            ),
          ],
        );
      },
    );
  }

  // 5. UPDATE BANK ACCOUNTS DIALOG
  void _showUpdateBankAccountsDialog() {
    final bankNameController = TextEditingController(text: _currentUser.bankName);
    final accountNumberController = TextEditingController(text: _currentUser.accountNumber);
    final accountNameController = TextEditingController(text: _currentUser.accountName);

    bool useSameForSalary = _currentUser.bankName == _currentUser.salaryBankName &&
        _currentUser.accountNumber == _currentUser.salaryAccountNumber;
    final salaryBankNameController = TextEditingController(text: _currentUser.salaryBankName);
    final salaryAccountNumberController = TextEditingController(text: _currentUser.salaryAccountNumber);
    final salaryAccountNameController = TextEditingController(text: _currentUser.salaryAccountName);

    final bankOptions = [
      'Access Bank PLC',
      'Zenith Bank PLC',
      'First Bank of Nigeria',
      'Guaranty Trust Bank (GTBank)',
      'United Bank for Africa (UBA)',
      'Stanbic IBTC Bank',
      'Fidelity Bank PLC',
    ];

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
              title: const Text('Update Bank Accounts', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('PRIMARY ADVANCE SETTLEMENT BANK', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: bankOptions.contains(bankNameController.text) ? bankNameController.text : bankOptions.first,
                          isExpanded: true,
                          items: bankOptions.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))).toList(),
                          onChanged: (v) => setDialogState(() => bankNameController.text = v!),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: accountNumberController,
                      keyboardType: TextInputType.number,
                      maxLength: 10,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                      decoration: InputDecoration(
                        labelText: 'ADVANCE NUBAN (10 DIGITS)',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        counterText: '',
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: accountNameController,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                      decoration: InputDecoration(
                        labelText: 'BENEFICIARY ACCOUNT NAME',
                        labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Checkbox(
                          value: useSameForSalary,
                          activeColor: const Color(0xFFEA580C),
                          onChanged: (v) => setDialogState(() => useSameForSalary = v ?? true),
                        ),
                        const Expanded(
                          child: Text('Use exact details for monthly payroll/salary', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                        ),
                      ],
                    ),
                    if (!useSameForSalary) ...[
                      const SizedBox(height: 10),
                      const Text('SEPARATE PAYROLL / SALARY BANK', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF475569))),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: bankOptions.contains(salaryBankNameController.text) ? salaryBankNameController.text : bankOptions.first,
                            isExpanded: true,
                            items: bankOptions.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))).toList(),
                            onChanged: (v) => setDialogState(() => salaryBankNameController.text = v!),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: salaryAccountNumberController,
                        keyboardType: TextInputType.number,
                        maxLength: 10,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          labelText: 'SALARY ACCOUNT NUMBER',
                          labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                          counterText: '',
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: salaryAccountNameController,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          labelText: 'SALARY BENEFICIARY NAME',
                          labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w800),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final bName = bankNameController.text.trim();
                    final accNo = accountNumberController.text.trim();
                    final accName = accountNameController.text.trim();
                    final sBank = useSameForSalary ? bName : salaryBankNameController.text.trim();
                    final sAccNo = useSameForSalary ? accNo : salaryAccountNumberController.text.trim();
                    final sAccName = useSameForSalary ? accName : salaryAccountNameController.text.trim();

                    if (accNo.length < 10) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Advance Account number must be 10 digits.')));
                      return;
                    }

                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    await StaffApiService.updateBankAccounts(
                      employeeId: _currentUser.id,
                      bankName: bName,
                      accountNumber: accNo,
                      accountName: accName,
                      salaryBankName: sBank,
                      salaryAccountNumber: sAccNo,
                      salaryAccountName: sAccName,
                    );

                    final updated = _currentUser.copyWith(
                      bankName: bName,
                      accountNumber: accNo,
                      accountName: accName,
                      salaryBankName: sBank,
                      salaryAccountNumber: sAccNo,
                      salaryAccountName: sAccName,
                    );
                    await StaffStorageService.saveUser(updated);
                    if (!mounted) return;
                    setState(() => _currentUser = updated);
                    messenger.showSnackBar(
                      const SnackBar(content: Text('✓ Corporate banking accounts updated!'), backgroundColor: Color(0xFF059669)),
                    );
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                  child: const Text('Save Accounts'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _openNewRequestModal() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NewFundRequestScreen(
          user: _currentUser,
          onSubmitted: _loadData,
        ),
      ),
    );
  }

  void _handleLogout() async {
    await StaffStorageService.clearUser();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const StaffLoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFFEA580C), strokeWidth: 2.5),
              )
            : IndexedStack(
                index: _currentIndex,
                children: [
                  _buildHomeTab(formatter),
                  _buildRequestsTab(formatter),
                  _buildRetirementTab(formatter),
                  _buildProfileTab(),
                ],
              ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (idx) {
            if (idx == 2) {
              // Center FAB: New Request
              _openNewRequestModal();
            } else {
              setState(() => _currentIndex = idx > 2 ? idx - 1 : idx);
            }
          },
          backgroundColor: Colors.white,
          selectedItemColor: const Color(0xFFEA580C),
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                children: [
                  const Icon(Icons.receipt_long_outlined),
                  if (_requests.isNotEmpty)
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(color: Color(0xFFEA580C), shape: BoxShape.circle),
                        constraints: const BoxConstraints(minWidth: 8, minHeight: 8),
                      ),
                    ),
                ],
              ),
              activeIcon: const Icon(Icons.receipt_long_rounded),
              label: 'Requisitions',
            ),
            // Elevated Center Button
            BottomNavigationBarItem(
              icon: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEA580C), Color(0xFFFB923C)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEA580C).withOpacity(0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.add_rounded, color: Colors.white, size: 26),
              ),
              label: '',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                children: [
                  const Icon(Icons.timer_outlined),
                  if (_cases.isNotEmpty)
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
                        constraints: const BoxConstraints(minWidth: 8, minHeight: 8),
                      ),
                    ),
                ],
              ),
              activeIcon: const Icon(Icons.timer_rounded),
              label: '72h SLA',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }

  // TAB 0: HOME WORKSPACE
  Widget _buildHomeTab(NumberFormat formatter) {
    final activeAdvanceAmount = _cases.fold<double>(0, (sum, c) => sum + c.amountNaira);

    return RefreshIndicator(
      onRefresh: _loadData,
      color: const Color(0xFFEA580C),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.network(
                      _currentUser.avatarUrl,
                      width: 46,
                      height: 46,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 46,
                        height: 46,
                        color: const Color(0xFFEA580C).withOpacity(0.1),
                        child: const Icon(Icons.person, color: Color(0xFFEA580C)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            _currentUser.fullName,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.verified_rounded, size: 14, color: Color(0xFFEA580C)),
                        ],
                      ),
                      Text(
                        '${_currentUser.employeeNumber} · ${_currentUser.subsidiary}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: IconButton(
                  icon: const Icon(Icons.notifications_none_rounded, size: 20, color: Color(0xFF0F172A)),
                  onPressed: () {},
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Hero Advance Card
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF5B4DFF), Color(0xFF7F56D9), Color(0xFFEA580C)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(26),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF5B4DFF).withOpacity(0.35),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'OPERATIONAL ADVANCE HELD',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Colors.white.withOpacity(0.85),
                          ),
                        ),
                      ],
                    ),
                    GestureDetector(
                      onTap: () => setState(() => _hideBalance = !_hideBalance),
                      child: Icon(
                        _hideBalance ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                        color: Colors.white70,
                        size: 18,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  _hideBalance ? '₦ ••••••••' : formatter.format(activeAdvanceAmount > 0 ? activeAdvanceAmount : 650000),
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.8),
                ),
                const SizedBox(height: 4),
                Text(
                  'Bank: ${_currentUser.bankName} (${_currentUser.accountNumber})',
                  style: TextStyle(fontSize: 11.5, color: Colors.white.withOpacity(0.75)),
                ),
                const SizedBox(height: 20),

                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _openNewRequestModal,
                        icon: const Icon(Icons.arrow_upward_rounded, size: 16, color: Color(0xFF0F172A)),
                        label: const Text('Request Funds', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF0F172A))),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          if (_cases.isNotEmpty) {
                            _showRetirementEvidenceDialog(_cases.first);
                          } else {
                            setState(() => _currentIndex = 2);
                          }
                        },
                        icon: const Icon(Icons.arrow_downward_rounded, size: 16, color: Colors.white),
                        label: const Text('Retire 72h', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.2),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Dual-Key Maker Checker
          if (_disbursementsAwaiting.isNotEmpty) ...[
            ..._disbursementsAwaiting.map((disb) {
              return Container(
                margin: const EdgeInsets.only(bottom: 18),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Treasury Payout Received',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
                        ),
                        Text(
                          formatter.format(disb.amountNaira),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF065F46)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${disb.title} (Ref: ${disb.reference})',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF047857), fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => _handleConfirmPayment(disb),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF059669),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('Confirm Received', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () => _handleReportIssue(disb),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFDC2626),
                            side: const BorderSide(color: Color(0xFFFCA5A5)),
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Discrepancy', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],

          // Quick Action Pastel Grid
          const Text('Quick Actions', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildPastelTile(
                  title: 'New Request',
                  subtitle: 'Operational',
                  icon: Icons.add_shopping_cart_rounded,
                  bgColor: const Color(0xFFFFF7ED),
                  borderColor: const Color(0xFFFFEDD5),
                  iconColor: const Color(0xFFEA580C),
                  onTap: _openNewRequestModal,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildPastelTile(
                  title: 'Confirm Funds',
                  subtitle: 'Dual-Key Auth',
                  icon: Icons.price_check_rounded,
                  bgColor: const Color(0xFFECFDF5),
                  borderColor: const Color(0xFFA7F3D0),
                  iconColor: const Color(0xFF059669),
                  onTap: () {
                    if (_disbursementsAwaiting.isNotEmpty) {
                      _handleConfirmPayment(_disbursementsAwaiting.first);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No pending disbursements to confirm at this time.')));
                    }
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildPastelTile(
                  title: '72h Evidence',
                  subtitle: 'Retire Advance',
                  icon: Icons.receipt_long_rounded,
                  bgColor: const Color(0xFFFFF1F2),
                  borderColor: const Color(0xFFFECDD3),
                  iconColor: const Color(0xFFE11D48),
                  onTap: () => setState(() => _currentIndex = 2),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildPastelTile(
                  title: 'My Profile',
                  subtitle: 'Bank Details',
                  icon: Icons.person_rounded,
                  bgColor: const Color(0xFFEFF6FF),
                  borderColor: const Color(0xFFBFDBFE),
                  iconColor: const Color(0xFF2563EB),
                  onTap: () => setState(() => _currentIndex = 3),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // 1. DEDICATED PROOF OF UTILIZATION CARD (SNAP PICTURE / UPLOAD DOCUMENT)
          _buildUploadProofBannerCard(formatter),

          // 2. REAL INFOGRAPHICS SUITE (MONTHLY SPEND BAR CHART + CATEGORY SEGMENTS + SLA SCORECARD)
          _buildInfographicsSection(formatter),

          const SizedBox(height: 24),

          // Recent Activity
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Recent Requisitions', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
              GestureDetector(
                onTap: () => setState(() => _currentIndex = 1),
                child: const Text('See More', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
              ),
            ],
          ),

          const SizedBox(height: 12),

          ..._requests.take(3).map((req) => _buildTransactionCard(req, formatter)),
        ],
      ),
    );
  }

  Widget _buildPastelTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color bgColor,
    required Color borderColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: iconColor.withOpacity(0.12), blurRadius: 8, offset: const Offset(0, 2)),
                ],
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadProofBannerCard(NumberFormat formatter) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 16, offset: const Offset(0, 6)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEA580C).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 18),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Upload Proof of Expenditure',
                    style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEA580C),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('72H POLICY', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Photograph original physical store receipts or attach vendor invoice PDFs to retire outstanding advances and clear your SLA window.',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, height: 1.3),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    final targetCase = _cases.isNotEmpty
                        ? _cases.first
                        : const AccountabilityCaseItem(
                            id: 'case-demo',
                            requestNumber: 'REQ-2026-089',
                            title: 'Bulk procurement of maize feed ingredients',
                            amountNaira: 650000,
                            hoursRemaining: 28,
                            bankReference: 'BEMS-TRX-2026-9041',
                            disbursedAt: 'Today, 08:30 AM',
                          );
                    _showRetirementEvidenceDialog(targetCase);
                  },
                  icon: const Icon(Icons.camera_alt_rounded, size: 16),
                  label: const Text('Snap Picture', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    final targetCase = _cases.isNotEmpty
                        ? _cases.first
                        : const AccountabilityCaseItem(
                            id: 'case-demo',
                            requestNumber: 'REQ-2026-089',
                            title: 'Bulk procurement of maize feed ingredients',
                            amountNaira: 650000,
                            hoursRemaining: 28,
                            bankReference: 'BEMS-TRX-2026-9041',
                            disbursedAt: 'Today, 08:30 AM',
                          );
                    _showRetirementEvidenceDialog(targetCase);
                  },
                  icon: const Icon(Icons.upload_file_rounded, size: 16, color: Colors.white),
                  label: const Text('Upload Doc / PDF', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Colors.white)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF475569)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfographicsSection(NumberFormat formatter) {
    final months = [
      {'m': 'May', 'v': 420000.0, 'h': 42.0},
      {'m': 'Jun', 'v': 680000.0, 'h': 68.0},
      {'m': 'Jul', 'v': 540000.0, 'h': 54.0},
      {'m': 'Aug', 'v': 890000.0, 'h': 88.0},
      {'m': 'Sep', 'v': 710000.0, 'h': 72.0},
      {'m': 'Oct', 'v': 1240000.0, 'h': 118.0, 'active': true},
    ];

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 14, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Requisitions & Spend Analytics',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  SizedBox(height: 2),
                  Text('6-Month Expenditure & SLA Clearance Trend', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: const Text('INFOGRAPHIC', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // 1. Bar Chart Infographic
          SizedBox(
            height: 160,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: months.map((item) {
                final isActive = item['active'] == true;
                final barHeight = (item['h'] as double);
                final val = item['v'] as double;

                return Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (isActive)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        margin: const EdgeInsets.only(bottom: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEA580C),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '₦${(val / 1000000).toStringAsFixed(1)}M',
                          style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
                        ),
                      )
                    else
                      Text(
                        '₦${(val / 1000).toInt()}k',
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 9, fontWeight: FontWeight.w600),
                      ),
                    const SizedBox(height: 4),
                    Container(
                      width: 28,
                      height: barHeight,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isActive
                              ? [const Color(0xFFEA580C), const Color(0xFFFB923C)]
                              : [const Color(0xFFE2E8F0), const Color(0xFFCBD5E1)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item['m'] as String,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                        color: isActive ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 20),
          const Divider(color: Color(0xFFF1F5F9)),
          const SizedBox(height: 12),

          // 2. Category Allocation Segmented Infographic
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('CATEGORY DISTRIBUTION', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
              Text('Total: ₦3,540,000', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 8),

          // Segmented Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Row(
              children: [
                Expanded(flex: 52, child: Container(height: 10, color: const Color(0xFFEA580C))),
                const SizedBox(width: 2),
                Expanded(flex: 24, child: Container(height: 10, color: const Color(0xFF4F46E5))),
                const SizedBox(width: 2),
                Expanded(flex: 16, child: Container(height: 10, color: const Color(0xFF059669))),
                const SizedBox(width: 2),
                Expanded(flex: 8, child: Container(height: 10, color: const Color(0xFFD97706))),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Legend
          const Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              _LegendItem(color: Color(0xFFEA580C), label: 'Feed (52%)'),
              _LegendItem(color: Color(0xFF4F46E5), label: 'Spares (24%)'),
              _LegendItem(color: Color(0xFF059669), label: 'Haulage (16%)'),
              _LegendItem(color: Color(0xFFD97706), label: 'Ops (8%)'),
            ],
          ),

          const SizedBox(height: 18),

          // 3. 72h SLA Scorecard
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.verified_rounded, color: Color(0xFF059669), size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('100% On-Time 72h SLA Clearance', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      SizedBox(height: 2),
                      Text('Average resolution time: 48h · Zero overdue strikes', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFF059669), borderRadius: BorderRadius.circular(6)),
                  child: const Text('GRADE A', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // TAB 1: REQUISITIONS DESK (DEEP IMPLEMENTATION)
  Widget _buildRequestsTab(NumberFormat formatter) {
    var filtered = _requests.where((r) {
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchCode = r.requestNumber.toLowerCase().contains(q);
        final matchTitle = r.title.toLowerCase().contains(q);
        final matchPayee = r.payeeName.toLowerCase().contains(q);
        if (!matchCode && !matchTitle && !matchPayee) return false;
      }
      if (_selectedStatusFilter == 'PENDING') return r.approvalStatus == 'SUBMITTED';
      if (_selectedStatusFilter == 'APPROVED') return r.approvalStatus == 'APPROVED';
      if (_selectedStatusFilter == 'PAID') return r.paymentStatus == 'PAID';
      if (_selectedStatusFilter == 'REJECTED') return r.approvalStatus == 'REJECTED';
      if (_selectedStatusFilter == 'RECURRING') return r.isRecurring;
      return true;
    }).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Expenditure Requisitions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                Text('Manage & inspect your procurement requests (${_requests.length})', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
            ElevatedButton.icon(
              onPressed: _openNewRequestModal,
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text('New', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA580C),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // Search Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                  decoration: const InputDecoration(
                    hintText: 'Search by REQ code, vendor, or item...',
                    hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Status Filter Chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildFilterChip('ALL', 'All Requests (${_requests.length})'),
              _buildFilterChip('PENDING', 'In Review'),
              _buildFilterChip('APPROVED', 'Approved'),
              _buildFilterChip('PAID', 'Disbursed'),
              _buildFilterChip('RECURRING', '🔁 Recurring'),
            ],
          ),
        ),

        const SizedBox(height: 16),

        if (filtered.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Center(
              child: Text('No requisitions match your filter.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            ),
          )
        else
          ...filtered.map((req) => _buildTransactionCard(req, formatter)),
      ],
    );
  }

  Widget _buildFilterChip(String code, String label) {
    final isSelected = _selectedStatusFilter == code;
    return GestureDetector(
      onTap: () => setState(() => _selectedStatusFilter = code),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEA580C) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildTransactionCard(FundRequestItem req, NumberFormat formatter) {
    Color statusBg;
    Color statusTextColor;
    String statusLabel;

    if (req.approvalStatus == 'APPROVED') {
      statusBg = const Color(0xFFECFDF5);
      statusTextColor = const Color(0xFF059669);
      statusLabel = req.paymentStatus == 'PAID' ? 'Disbursed' : 'Approved';
    } else if (req.approvalStatus == 'REJECTED') {
      statusBg = const Color(0xFFFEF2F2);
      statusTextColor = const Color(0xFFDC2626);
      statusLabel = 'Declined';
    } else {
      statusBg = const Color(0xFFFFF7ED);
      statusTextColor = const Color(0xFFEA580C);
      statusLabel = 'In Review';
    }

    return InkWell(
      onTap: () => _showRequisitionAuditSheet(req, formatter),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.015),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    req.avatarUrl,
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 44,
                      height: 44,
                      color: const Color(0xFFEA580C).withOpacity(0.1),
                      child: const Icon(Icons.person, color: Color(0xFFEA580C)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              req.payeeName,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (req.isRecurring)
                            Container(
                              margin: const EdgeInsets.only(left: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(5),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: const Text('🔁 RECURRING', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Color(0xFF1D4ED8))),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${req.requestNumber} · Due: ${req.dueDate.split(",").first}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatter.format(req.amountNaira),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: statusTextColor),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            if (req.paymentStatus == 'PAID') ...[
              const SizedBox(height: 10),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.timer_outlined, size: 14, color: Color(0xFFD97706)),
                      SizedBox(width: 4),
                      Text('72h SLA Clock Active', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                    ],
                  ),
                  InkWell(
                    onTap: () {
                      final target = _cases.firstWhere(
                        (item) => item.requestNumber == req.requestNumber,
                        orElse: () => _cases.isNotEmpty
                            ? _cases.first
                            : AccountabilityCaseItem(
                                id: 'case-paid',
                                requestNumber: req.requestNumber,
                                title: req.title,
                                amountNaira: req.amountNaira,
                                hoursRemaining: 28,
                                bankReference: 'BEMS-TRX-2026-9041',
                                disbursedAt: 'Today',
                              ),
                      );
                      _showRetirementEvidenceDialog(target);
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEA580C),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.upload_file_rounded, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text('Upload Proof', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Colors.white)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  // TAB 2: 72H SLA EVIDENCE RETIREMENT (DEEP IMPLEMENTATION)
  Widget _buildRetirementTab(NumberFormat formatter) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
      children: [
        const Text(
          '72-Hour SLA Command Center',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 2),
        const Text(
          'Expense receipt retirement & deliverable compliance tracking',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),

        const SizedBox(height: 18),

        // Visual Countdown Radar Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ACTIVE SLA RADAR', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('POLICY COMPLIANT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF059669))),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Row(
                children: [
                  // Circular Progress Indicator
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 64,
                        height: 64,
                        child: CircularProgressIndicator(
                          value: 0.61, // 44h / 72h
                          strokeWidth: 6,
                          backgroundColor: Color(0xFFF1F5F9),
                          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFEA580C)),
                        ),
                      ),
                      Text('28h', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
                    ],
                  ),
                  SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('44 Hours Elapsed · 28 Hours Left', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                        SizedBox(height: 4),
                        Text('All physical receipts must be photographed and submitted before deadline to clear advance accountability.', style: TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.3)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        const Text('Active Advances Requiring Proof', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
        const SizedBox(height: 12),

        if (_cases.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.verified_user_rounded, color: Color(0xFF10B981), size: 48),
                  SizedBox(height: 12),
                  Text('Zero Advance Liabilities', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                  SizedBox(height: 4),
                  Text('All your past cash advances are 100% reconciled and cleared by Finance.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ],
              ),
            ),
          )
        else
          ..._cases.map((c) {
            return Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: c.isOverdue ? const Color(0xFFFCA5A5) : const Color(0xFFFDE68A)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(c.avatarUrl, width: 32, height: 32, fit: BoxFit.cover),
                          ),
                          const SizedBox(width: 8),
                          Text(c.requestNumber, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: c.isOverdue ? const Color(0xFFFEF2F2) : const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          c.isOverdue ? '24h Overdue' : '${c.hoursRemaining}h Left',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: c.isOverdue ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(c.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 4),
                  Text('Disbursed Amount: ${formatter.format(c.amountNaira)} · Ref: ${c.bankReference}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Required Proof: ${c.requiredDeliverables}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    onPressed: () => _showRetirementEvidenceDialog(c),
                    icon: const Icon(Icons.camera_alt_rounded, size: 16),
                    label: const Text('Upload Physical Receipts & GRN', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                  ),
                ],
              ),
            );
          }),

        const SizedBox(height: 16),

        // History Archive Section
        const Text('Cleared Retirement Archive', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
        const SizedBox(height: 10),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(color: Color(0xFFECFDF5), shape: BoxShape.circle),
                child: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('REQ-2026-061 · Depot Fueling', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                    Text('₦320,000 · Cleared 18 Oct 2026', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(8)),
                child: const Text('AUDITED', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF059669))),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // TAB 3: COMPLETE STAFF PROFILE & REGISTRATION DETAILS
  Widget _buildProfileTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        const Text(
          'Staff Identity & Credentials',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 2),
        const Text(
          'Personal details, corporate placement & authorized disbursal accounts',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),

        const SizedBox(height: 20),

        // 1. Employee Identity Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
            ],
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.network(_currentUser.avatarUrl, width: 64, height: 64, fit: BoxFit.cover),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_currentUser.fullName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                    const SizedBox(height: 2),
                    Text(_currentUser.jobTitle, style: const TextStyle(fontSize: 11.5, color: Color(0xFFEA580C), fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('${_currentUser.subsidiary} · ${_currentUser.department}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                      child: Text('EMP CODE: ${_currentUser.employeeNumber}', style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF475569))),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 2. Personal Information Section
        _buildProfileSectionHeader('PERSONAL IDENTITY & CONTACT'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              _buildDataRow(
                label: 'Corporate Email',
                value: _currentUser.email,
                icon: Icons.email_outlined,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Phone Number',
                value: _currentUser.phone,
                icon: Icons.phone_outlined,
                actionLabel: 'Edit',
                onAction: _showUpdatePhoneDialog,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Gender & Date of Birth',
                value: '${_currentUser.gender} · ${_currentUser.dateOfBirth}',
                icon: Icons.cake_outlined,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Residential Address',
                value: '${_currentUser.residentialAddress}, ${_currentUser.cityState}',
                icon: Icons.home_outlined,
              ),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(
                label: 'Origin & Statutory',
                value: '${_currentUser.lga}, ${_currentUser.stateOfOrigin} · Marital: ${_currentUser.maritalStatus}',
                icon: Icons.location_city_outlined,
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 3. Corporate Placement Section
        _buildProfileSectionHeader('CORPORATE & EMPLOYMENT DETAILS'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              _buildDataRow(label: 'Subsidiary Entity', value: _currentUser.subsidiary, icon: Icons.business_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Department Unit', value: _currentUser.department, icon: Icons.work_outline_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Employment Type & Grade', value: '${_currentUser.employmentType} (${_currentUser.staffGrade})', icon: Icons.badge_outlined),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Work Location & Resumption', value: '${_currentUser.workLocation} · Resumed: ${_currentUser.resumptionDate}', icon: Icons.pin_drop_outlined),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 4. Dual Banking Section
        _buildProfileSectionHeader('DISBURSEMENT & SALARY BANK ACCOUNTS'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Operational Advance Bank
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('PRIMARY DISBURSAL ACCOUNT (ADVANCES)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(6)),
                    child: const Text('VERIFIED', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF059669))),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(_currentUser.bankName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
              Text('Account: ${_currentUser.accountNumber} · ${_currentUser.accountName}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontFamily: 'monospace')),

              const Divider(color: Color(0xFFE2E8F0), height: 24),

              // Salary Bank
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('PAYROLL / SALARY ACCOUNT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF475569), letterSpacing: 0.8)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                    child: const Text('ACTIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF475569))),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(_currentUser.salaryBankName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
              Text('Account: ${_currentUser.salaryAccountNumber} · ${_currentUser.salaryAccountName}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontFamily: 'monospace')),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _showUpdateBankAccountsDialog,
                  icon: const Icon(Icons.account_balance_wallet_outlined, size: 16, color: Color(0xFFEA580C)),
                  label: const Text('Change / Update Bank Accounts', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFFED7AA)),
                    backgroundColor: const Color(0xFFFFF7ED),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 5. Emergency & Next of Kin
        _buildProfileSectionHeader('EMERGENCY CONTACT & NEXT OF KIN'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              _buildDataRow(label: 'Next of Kin Name', value: _currentUser.nextOfKinName, icon: Icons.person_outline_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Relationship', value: _currentUser.nextOfKinRelationship, icon: Icons.family_restroom_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Contact Phone', value: _currentUser.nextOfKinPhone, icon: Icons.phone_android_rounded),
              const Divider(color: Color(0xFFF1F5F9), height: 16),
              _buildDataRow(label: 'Address', value: _currentUser.nextOfKinAddress, icon: Icons.map_outlined),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 6. Security & Credentials
        _buildProfileSectionHeader('SECURITY & CREDENTIALS'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFFFF7ED), shape: BoxShape.circle),
                  child: const Icon(Icons.lock_reset_rounded, color: Color(0xFFEA580C), size: 20),
                ),
                title: const Text('Change Password', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: const Text('Update your corporate login credentials', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: _showChangePasswordDialog,
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
                  child: const Icon(Icons.phone_iphone_rounded, color: Color(0xFF2563EB), size: 20),
                ),
                title: const Text('Update Contact Phone Number', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: Text('Current: ${_currentUser.phone}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: _showUpdatePhoneDialog,
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: Color(0xFFF0FDF4), shape: BoxShape.circle),
                  child: const Icon(Icons.account_balance_rounded, color: Color(0xFF16A34A), size: 20),
                ),
                title: const Text('Change Bank Account Details', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                subtitle: Text('Advance: ${_currentUser.bankName} · ${_currentUser.accountNumber}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: _showUpdateBankAccountsDialog,
              ),
            ],
          ),
        ),

        const SizedBox(height: 28),

        // Logout
        OutlinedButton.icon(
          onPressed: _handleLogout,
          icon: const Icon(Icons.logout_rounded, size: 16, color: Color(0xFFDC2626)),
          label: const Text('Sign Out of Staff Workspace', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFFDC2626))),
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Color(0xFFFCA5A5)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileSectionHeader(String text) {
    return Text(
      text,
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8),
    );
  }

  Widget _buildDataRow({
    required String label,
    required String value,
    required IconData icon,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFF94A3B8)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
            ],
          ),
        ),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFFEDD5)),
              ),
              child: Text(actionLabel, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
            ),
          ),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
      ],
    );
  }
}
