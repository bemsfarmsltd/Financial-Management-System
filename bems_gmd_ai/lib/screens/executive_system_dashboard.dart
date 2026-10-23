import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'executive_chat_screen.dart';

class ExecutiveSystemDashboard extends StatefulWidget {
  final VoidCallback onOpenDrawer;
  final VoidCallback onSwitchToAi;

  const ExecutiveSystemDashboard({
    super.key,
    required this.onOpenDrawer,
    required this.onSwitchToAi,
  });

  @override
  State<ExecutiveSystemDashboard> createState() => _ExecutiveSystemDashboardState();
}

class _ExecutiveSystemDashboardState extends State<ExecutiveSystemDashboard> {
  Map<String, dynamic>? _dashboardData;
  bool _isLoading = true;
  final Set<String> _processedIds = {};
  final Set<String> _loadingActionIds = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final data = await ApiService.fetchDashboardData();
    if (mounted) {
      setState(() {
        _dashboardData = data;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleDecision(String id, String decision) async {
    setState(() => _loadingActionIds.add(id));
    await ApiService.decideApproval(requestId: id, decision: decision);

    if (mounted) {
      setState(() {
        _loadingActionIds.remove(id);
        _processedIds.add(id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            decision == 'APPROVE'
                ? 'Requisition approved and queued for treasury disbursement.'
                : 'Requisition declined.',
          ),
          backgroundColor: decision == 'APPROVE' ? const Color(0xFF059669) : const Color(0xFFDC2626),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

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
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Color(0xFFEA580C),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  color: const Color(0xFFEA580C),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 100),
                    children: [
                      // Mode Selector Pill
                      _buildModeSelector(),

                      const SizedBox(height: 20),

                      // Section 1: Group Treasury Reserves
                      _buildTreasuryCard(currencyFormatter),

                      const SizedBox(height: 18),

                      // Section 2: Executive Approval Queue
                      _buildApprovalsQueue(currencyFormatter),

                      const SizedBox(height: 18),

                      // Section 3: 72h Cash Advance Accountability
                      _buildAccountabilityCard(),

                      const SizedBox(height: 18),

                      // Section 4: Subsidiary Budget Run-Rates
                      _buildBudgetsCard(currencyFormatter),
                    ],
                  ),
                ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: _buildFloatingCopilotPill(),
    );
  }

  Widget _buildModeSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withOpacity(0.12)),
      ),
      child: Row(
        children: [
          // AI Copilot Option
          Expanded(
            child: GestureDetector(
              onTap: widget.onSwitchToAi,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.auto_awesome_rounded, size: 14, color: Colors.white70),
                    const SizedBox(width: 6),
                    Text(
                      'BEMi Copilot',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Colors.white.withOpacity(0.7),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // System Dashboard Option (Active)
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFEA580C),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFEA580C).withOpacity(0.4),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.dashboard_customize_rounded, size: 14, color: Colors.white),
                  SizedBox(width: 6),
                  Text(
                    'System Dashboard',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTreasuryCard(NumberFormat formatter) {
    final treasury = _dashboardData?['treasury'] ?? {};

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.3)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEA580C).withOpacity(0.08),
            blurRadius: 20,
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
              const Row(
                children: [
                  Icon(Icons.account_balance_rounded, color: Color(0xFFFB923C), size: 16),
                  SizedBox(width: 8),
                  Text(
                    'GROUP TREASURY RESERVES',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.1,
                      color: Color(0xFFFB923C),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF059669).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF059669).withOpacity(0.4)),
                ),
                child: const Text(
                  '100% RECONCILED',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF34D399),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            treasury['total'] ?? '₦84,200,000',
            style: const TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: -0.8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Liquid reserve balances across authorized deposit institutions',
            style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.55)),
          ),
          const SizedBox(height: 16),
          const Divider(color: Colors.white12, height: 1),
          const SizedBox(height: 14),

          // Bank Account 1
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Access Bank PLC',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                  Text(
                    '0123456789 · BEMS Group Holdings',
                    style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4)),
                  ),
                ],
              ),
              Text(
                treasury['accessBank'] ?? '₦52,800,000',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Bank Account 2
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Zenith Bank PLC',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                  Text(
                    '1012345678 · Operations Account',
                    style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4)),
                  ),
                ],
              ),
              Text(
                treasury['zenithBank'] ?? '₦31,400,000',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildApprovalsQueue(NumberFormat formatter) {
    final rawRequests = (_dashboardData?['pendingRequests'] as List<dynamic>?) ?? [];
    final activeRequests = rawRequests.where((r) => !_processedIds.contains(r['id'])).toList();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.verified_user_rounded, color: Color(0xFFF97316), size: 16),
                  SizedBox(width: 8),
                  Text(
                    'PENDING EXECUTIVE APPROVALS',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.1,
                      color: Color(0xFFF97316),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: activeRequests.isNotEmpty
                      ? const Color(0xFFEA580C).withOpacity(0.2)
                      : const Color(0xFF059669).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${activeRequests.length} PENDING',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: activeRequests.isNotEmpty ? const Color(0xFFFB923C) : const Color(0xFF34D399),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (activeRequests.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 36),
                    const SizedBox(height: 8),
                    const Text(
                      'All Clear',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    Text(
                      'Zero requisitions awaiting executive authorization',
                      style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                    ),
                  ],
                ),
              ),
            )
          else
            ...activeRequests.map((req) {
              final id = req['id']?.toString() ?? '';
              final code = req['code'] ?? 'REQ-2026';
              final dept = req['department'] ?? 'Operations';
              final purpose = req['purpose'] ?? 'General procurement';
              final beneficiary = req['beneficiary'] ?? 'Supplier';
              final amountNaira = num.tryParse(req['amountNaira']?.toString() ?? '0') ?? 0;
              final formattedAmount = formatter.format(amountNaira);
              final isProcessing = _loadingActionIds.contains(id);

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
                          code,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFFB923C),
                          ),
                        ),
                        Text(
                          formattedAmount,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      purpose,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$dept · Beneficiary: $beneficiary',
                      style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.45)),
                    ),
                    const SizedBox(height: 14),

                    // 1-Tap Action Buttons
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isProcessing ? null : () => _handleDecision(id, 'APPROVE'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF059669),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                            child: isProcessing
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Approve', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: isProcessing ? null : () => _handleDecision(id, 'REJECT'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFF87171),
                              side: BorderSide(color: const Color(0xFFDC2626).withOpacity(0.6)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text('Decline', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
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
    );
  }

  Widget _buildAccountabilityCard() {
    final overdueCount = _dashboardData?['overdueCount'] ?? 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: overdueCount == 0
                  ? const Color(0xFF059669).withOpacity(0.18)
                  : const Color(0xFFDC2626).withOpacity(0.18),
              shape: BoxShape.circle,
            ),
            child: Icon(
              overdueCount == 0 ? Icons.fact_check_rounded : Icons.warning_amber_rounded,
              color: overdueCount == 0 ? const Color(0xFF34D399) : const Color(0xFFF87171),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '72-HOUR RETIREMENT SLA',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                    color: Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  overdueCount == 0
                      ? '100% Compliant — 0 Overdue'
                      : '$overdueCount Cash Advance(s) Past 72h SLA',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                Text(
                  'All cash advances require receipt retirement within 72h',
                  style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBudgetsCard(NumberFormat formatter) {
    final budgets = (_dashboardData?['budgets'] as List<dynamic>?) ?? [];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'DEPARTMENTAL BUDGET UTILIZATION',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
              color: Color(0xFF94A3B8),
            ),
          ),
          const SizedBox(height: 14),
          ...budgets.map((b) {
            final dept = b['department'] ?? 'Department';
            final allocated = num.tryParse(b['allocatedAmount']?.toString() ?? '1') ?? 1;
            final spent = num.tryParse(b['spentAmount']?.toString() ?? '0') ?? 0;
            final percent = (spent / allocated).clamp(0.0, 1.0);

            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        dept,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
                      Text(
                        '${formatter.format(spent)} / ${formatter.format(allocated)}',
                        style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.55)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: percent,
                      minHeight: 6,
                      backgroundColor: Colors.white.withOpacity(0.1),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        percent > 0.85 ? const Color(0xFFDC2626) : const Color(0xFFEA580C),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildFloatingCopilotPill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      margin: const EdgeInsets.symmetric(horizontal: 24),
      height: 50,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withOpacity(0.95),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.5)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEA580C).withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const ExecutiveChatScreen(
                initialPrompt: 'Give me a complete executive audit of group cash reserves, pending approvals, and 72h advances.',
              ),
            ),
          );
        },
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [Color(0xFFEA580C), Color(0xFF9A3412)]),
              ),
              child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 14),
            ),
            const SizedBox(width: 10),
            const Text(
              'Ask BEMi to analyze dashboard...',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
