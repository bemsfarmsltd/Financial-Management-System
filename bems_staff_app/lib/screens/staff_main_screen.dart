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
  int _currentIndex = 0;
  bool _isLoading = true;

  List<FundRequestItem> _requests = [];
  List<DisbursementItem> _disbursementsAwaiting = [];
  List<AccountabilityCaseItem> _cases = [];

  final _chatController = TextEditingController();
  final List<Map<String, String>> _chatMessages = [
    {
      'role': 'assistant',
      'content': 'Hello! I am BEMi, your BEMS Staff Expense & Policy Guide. Ask me anything about per-diems, 72h evidence requirements, or how to draft a requisition.',
    }
  ];
  bool _isChatLoading = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final data = await StaffApiService.fetchStaffDashboard(userEmail: widget.user.email);
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
    if (mounted) {
      setState(() {
        _disbursementsAwaiting.removeWhere((d) => d.id == disb.id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ Payment receipt confirmed! 72-Hour Evidence Retirement Window is now active.'),
          backgroundColor: Color(0xFF059669),
          duration: Duration(seconds: 3),
        ),
      );
      _loadData();
    }
  }

  Future<void> _handleReportIssue(DisbursementItem disb) async {
    final noteController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0F172A),
          title: const Text('Report Payment Discrepancy', style: TextStyle(color: Colors.white, fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Let Finance know what issue you experienced with reference ${disb.reference}:',
                style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'e.g. Funds not reflected in bank account yet.',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.35)),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.06),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
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
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
              child: const Text('Submit Report'),
            ),
          ],
        );
      },
    );
  }

  void _showRetirementEvidenceDialog(AccountabilityCaseItem c) {
    final receiptNumController = TextEditingController();
    final noteController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0B132B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Upload 72h Evidence for ${c.requestNumber}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                c.title,
                style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.55)),
              ),
              const SizedBox(height: 16),
              const Divider(color: Colors.white12),
              const SizedBox(height: 12),

              // Mock Camera / File Picker Box
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.04),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.3), style: BorderStyle.solid),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEA580C).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.camera_alt_rounded, color: Color(0xFFFB923C), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Attach Physical Receipt / GRN',
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white),
                          ),
                          Text(
                            'Take photo of original stamped invoice or weighbridge slip',
                            style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.45)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 18),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              TextField(
                controller: receiptNumController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'RECEIPT / INVOICE NUMBER',
                  labelStyle: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 10, fontWeight: FontWeight.w800),
                  hintText: 'e.g. INV-98104 / GRN-42',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.04),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
              ),

              const SizedBox(height: 10),

              TextField(
                controller: noteController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'DELIVERY & INSPECTION NOTES',
                  labelStyle: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 10, fontWeight: FontWeight.w800),
                  hintText: 'Describe items received, verified quantity, and vendor comments...',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.04),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
              ),

              const SizedBox(height: 20),

              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await StaffApiService.submitRetirementEvidence(
                    caseId: c.id,
                    notes: noteController.text.trim(),
                    receiptName: receiptNumController.text.trim(),
                  );
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('✓ Evidence submitted for Finance Audit clearance.'),
                      backgroundColor: Color(0xFF059669),
                    ),
                  );
                  _loadData();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.upload_file_rounded, size: 16),
                    SizedBox(width: 8),
                    Text('Submit 72h Evidence', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _sendChatMessage() async {
    final text = _chatController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _chatMessages.add({'role': 'user', 'content': text});
      _chatController.clear();
      _isChatLoading = true;
    });

    final reply = await StaffApiService.askStaffBemi(question: text);

    if (mounted) {
      setState(() {
        _chatMessages.add({'role': 'assistant', 'content': reply});
        _isChatLoading = false;
      });
    }
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
      backgroundColor: const Color(0xFF04060C),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.6),
            radius: 1.4,
            colors: [
              Color(0xFF381404),
              Color(0xFF140803),
              Color(0xFF04060C),
            ],
            stops: [0.0, 0.45, 1.0],
          ),
        ),
        child: SafeArea(
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
                    _buildBemiChatTab(),
                  ],
                ),
        ),
      ),
      floatingActionButton: _currentIndex == 0 || _currentIndex == 1
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => NewFundRequestScreen(
                      user: widget.user,
                      onSubmitted: _loadData,
                    ),
                  ),
                );
              },
              backgroundColor: const Color(0xFFEA580C),
              foregroundColor: Colors.white,
              elevation: 4,
              icon: const Icon(Icons.add_rounded, size: 20),
              label: const Text('New Request', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            )
          : null,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0A0E1A),
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.08))),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: Colors.transparent,
          selectedItemColor: const Color(0xFFFB923C),
          unselectedItemColor: Colors.white38,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 10),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 10),
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard_rounded),
              label: 'Workspace',
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
              icon: Icon(Icons.auto_awesome_outlined),
              activeIcon: Icon(Icons.auto_awesome_rounded),
              label: 'BEMi Policy',
            ),
          ],
        ),
      ),
    );
  }

  // TAB 0: WORKSPACE HOME
  Widget _buildHomeTab(NumberFormat formatter) {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: const Color(0xFFEA580C),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 90),
        children: [
          // Header Bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEA580C).withOpacity(0.2),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.4)),
                    ),
                    child: Center(
                      child: Text(
                        widget.user.fullName.isNotEmpty ? widget.user.fullName[0] : 'S',
                        style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFFB923C), fontSize: 16),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.user.fullName,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                      Text(
                        '${widget.user.role} · ${widget.user.subsidiary}',
                        style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                      ),
                    ],
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.logout_rounded, size: 20, color: Colors.white54),
                onPressed: _handleLogout,
              ),
            ],
          ),

          const SizedBox(height: 18),

          // 1. Dual-Key / Maker-Checker Confirmation Box
          if (_disbursementsAwaiting.isNotEmpty) ...[
            ..._disbursementsAwaiting.map((disb) {
              return Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF059669).withOpacity(0.35),
                      const Color(0xFF064E3B).withOpacity(0.2),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.5)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.verified_rounded, color: Color(0xFF34D399), size: 16),
                            const SizedBox(width: 6),
                            Text(
                              'FUNDS DISBURSED · CONFIRM RECEIPT',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.9,
                                color: Colors.white.withOpacity(0.9),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          formatter.format(disb.amountNaira),
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      disb.title,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Paid to: ${disb.bankName} (Ref: ${disb.reference})',
                      style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.7)),
                    ),
                    const SizedBox(height: 14),

                    // Confirmation Buttons
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => _handleConfirmPayment(disb),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF059669),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.check_rounded, size: 16),
                                SizedBox(width: 6),
                                Text('I Confirm Received', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton(
                          onPressed: () => _handleReportIssue(disb),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFFCA5A5),
                            side: BorderSide(color: const Color(0xFFDC2626).withOpacity(0.5)),
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('Report Issue', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],

          // 2. 72h SLA Alert Card
          if (_cases.isNotEmpty) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: _cases.first.isOverdue ? const Color(0xFFEF4444).withOpacity(0.4) : const Color(0xFFF59E0B).withOpacity(0.4),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: _cases.first.isOverdue ? const Color(0xFFEF4444).withOpacity(0.2) : const Color(0xFFF59E0B).withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.timer_outlined,
                      color: _cases.first.isOverdue ? const Color(0xFFF87171) : const Color(0xFFFBBF24),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _cases.first.isOverdue ? '72H SLA OVERDUE' : 'ACTIVE 72H ADVANCE (${_cases.first.hoursRemaining}h left)',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                            color: _cases.first.isOverdue ? const Color(0xFFF87171) : const Color(0xFFFBBF24),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _cases.first.title,
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Amount: ${formatter.format(_cases.first.amountNaira)} · Evidence required',
                          style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.5)),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () => _showRetirementEvidenceDialog(_cases.first),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 0,
                    ),
                    child: const Text('Retire', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
          ],

          // Quick Summary Metrics
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  title: 'TOTAL REQUISITIONS',
                  value: '${_requests.length}',
                  subtitle: 'Submitted by you',
                  icon: Icons.assignment_rounded,
                  color: const Color(0xFFFB923C),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricTile(
                  title: 'AWAITING SIGN-OFF',
                  value: '${_requests.where((r) => r.approvalStatus == 'SUBMITTED').length}',
                  subtitle: 'In review queue',
                  icon: Icons.hourglass_top_rounded,
                  color: const Color(0xFFF59E0B),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Recent Activity Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'MY RECENT REQUISITIONS',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.1,
                  color: const Color(0xFFFB923C).withOpacity(0.9),
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _currentIndex = 1),
                child: Text(
                  'View All (${_requests.length})',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFFB923C)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          ..._requests.take(3).map((req) => _buildRequestCard(req, formatter)),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: Colors.white54),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
          ),
          const SizedBox(height: 2),
          Text(subtitle, style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.4))),
        ],
      ),
    );
  }

  // TAB 1: REQUISITIONS TRACKER
  Widget _buildRequestsTab(NumberFormat formatter) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'My Expenditure Requisitions',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white),
                ),
                Text(
                  'Track approvals from Department Head to GMD Disbursement',
                  style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),

        ..._requests.map((req) => _buildRequestCard(req, formatter)),
      ],
    );
  }

  Widget _buildRequestCard(FundRequestItem req, NumberFormat formatter) {
    Color statusColor;
    String statusLabel;

    if (req.approvalStatus == 'APPROVED') {
      statusColor = const Color(0xFF10B981);
      statusLabel = req.paymentStatus == 'PAID' ? 'PAID & DISBURSED' : 'APPROVED (PENDING PAYOUT)';
    } else if (req.approvalStatus == 'REJECTED') {
      statusColor = const Color(0xFFEF4444);
      statusLabel = 'DECLINED';
    } else {
      statusColor = const Color(0xFFFB923C);
      statusLabel = 'AWAITING GMD SIGN-OFF';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                req.requestNumber,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFFB923C)),
              ),
              Text(
                formatter.format(req.amountNaira),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            req.title,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
          ),
          const SizedBox(height: 4),
          Text(
            '${req.subsidiary} · ${req.department}',
            style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.45)),
          ),
          const SizedBox(height: 10),

          // Status & Deliverable Pill
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: statusColor),
                ),
              ),
              Text(
                req.createdAt,
                style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.4)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // TAB 2: 72H RETIREMENT & EVIDENCE
  Widget _buildRetirementTab(NumberFormat formatter) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
      children: [
        const Text(
          '72-Hour Expense Accountability',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white),
        ),
        const SizedBox(height: 4),
        Text(
          'Upload receipts & deliverable proof to clear cash advance liabilities',
          style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
        ),
        const SizedBox(height: 18),

        if (_cases.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Center(
              child: Column(
                children: [
                  Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 44),
                  SizedBox(height: 10),
                  Text('All Advances Retired', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                  SizedBox(height: 4),
                  Text('You have zero outstanding cash advance liabilities.', style: TextStyle(color: Colors.white54, fontSize: 11)),
                ],
              ),
            ),
          )
        else
          ..._cases.map((c) {
            return Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: c.isOverdue ? const Color(0xFFEF4444).withOpacity(0.5) : const Color(0xFFF59E0B).withOpacity(0.4),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        c.requestNumber,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFFFB923C)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: c.isOverdue ? const Color(0xFFEF4444).withOpacity(0.2) : const Color(0xFFF59E0B).withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          c.isOverdue ? '24H OVERDUE' : '${c.hoursRemaining}H REMAINING',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: c.isOverdue ? const Color(0xFFFCA5A5) : const Color(0xFFFDE68A),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    c.title,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Advance Balance: ${formatter.format(c.amountNaira)}',
                    style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.black26,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.receipt_long_rounded, color: Color(0xFFFB923C), size: 14),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Required Proof: ${c.requiredDeliverables}',
                            style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.7)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: () => _showRetirementEvidenceDialog(c),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 0,
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.camera_alt_rounded, size: 16),
                        SizedBox(width: 8),
                        Text('Upload Physical Receipts & Notes', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  // TAB 3: BEMI STAFF CHAT
  Widget _buildBemiChatTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [Color(0xFFEA580C), Color(0xFF9A3412)]),
                ),
                child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 16),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('BEMi Staff Assistant', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                  Text('Corporate Expense Policy & Per-Diem Advisor', style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.5))),
                ],
              ),
            ],
          ),
        ),
        const Divider(color: Colors.white12, height: 1),

        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(18),
            itemCount: _chatMessages.length,
            itemBuilder: (context, index) {
              final msg = _chatMessages[index];
              final isUser = msg['role'] == 'user';

              return Align(
                alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                  decoration: BoxDecoration(
                    color: isUser ? const Color(0xFFEA580C) : Colors.white.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(16),
                    border: isUser ? null : Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Text(
                    msg['content'] ?? '',
                    style: const TextStyle(fontSize: 12.5, color: Colors.white, height: 1.4),
                  ),
                ),
              );
            },
          ),
        ),

        if (_isChatLoading)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            child: Row(
              children: [
                const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFB923C))),
                const SizedBox(width: 8),
                Text('BEMi is formulating response...', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5))),
              ],
            ),
          ),

        // Chat Input Box
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            border: Border(top: BorderSide(color: Colors.white.withOpacity(0.08))),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Ask BEMi about per-diems, 72h SLA...',
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 13),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  onSubmitted: (_) => _sendChatMessage(),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send_rounded, color: Color(0xFFEA580C)),
                onPressed: _sendChatMessage,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
