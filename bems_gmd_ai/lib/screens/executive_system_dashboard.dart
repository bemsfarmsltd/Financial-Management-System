import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  String _selectedScope = 'all';
  int _currentTab = 0; // 0: Overview, 1: Approvals Desk, 2: Treasury & Banks, 3: Accountability & Budgets

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

  List<dynamic> _getFilteredRequests() {
    final rawRequests = (_dashboardData?['pendingRequests'] as List<dynamic>?) ?? [];
    final activeRequests = rawRequests.where((r) => !_processedIds.contains(r['id'])).toList();
    if (_selectedScope == 'all') return activeRequests;

    return activeRequests.where((r) {
      final sub = (r['subsidiary'] ?? '').toString().toLowerCase();
      final dept = (r['department'] ?? '').toString().toLowerCase();
      if (_selectedScope == 'FARMS') return sub.contains('farm') || dept.contains('farm') || dept.contains('agronomy');
      if (_selectedScope == 'FEED') return sub.contains('feed') || dept.contains('feed');
      if (_selectedScope == 'HAUL') return sub.contains('haul') || dept.contains('fleet') || dept.contains('logistics');
      return true;
    }).toList();
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
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 100),
                    children: [
                      // Top Mode Selector (BEMi Copilot vs System Dashboard)
                      _buildModeSelector(),

                      const SizedBox(height: 16),

                      // Subsidiary Scope Switcher
                      _buildSubsidiaryScopeSelector(),

                      const SizedBox(height: 16),

                      // 4-Card Executive KPI Radar
                      _buildKpiRadar(currencyFormatter),

                      const SizedBox(height: 18),

                      // Segmented Workspace Tabs
                      _buildWorkspaceTabs(),

                      const SizedBox(height: 16),

                      // Tab Specific Content
                      if (_currentTab == 0) ..._buildOverviewTab(currencyFormatter),
                      if (_currentTab == 1) ..._buildApprovalsTab(currencyFormatter),
                      if (_currentTab == 2) ..._buildTreasuryTab(currencyFormatter),
                      if (_currentTab == 3) ..._buildAccountabilityBudgetsTab(currencyFormatter),
                    ],
                  ),
                ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: _buildFloatingCopilotPill(),
    );
  }

  // 1. Mode Selector
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

  // 2. Subsidiary Scope Selector
  Widget _buildSubsidiaryScopeSelector() {
    final scopes = [
      {'code': 'all', 'label': 'All Subsidiaries'},
      {'code': 'FARMS', 'label': 'BEMS Farms'},
      {'code': 'FEED', 'label': 'BEMS Feed Mill'},
      {'code': 'HAUL', 'label': 'Logistics & Haulage'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: scopes.map((s) {
          final isSelected = _selectedScope == s['code'];
          return GestureDetector(
            onTap: () => setState(() => _selectedScope = s['code']!),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFFEA580C).withOpacity(0.2) : Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected ? const Color(0xFFEA580C) : Colors.white.withOpacity(0.08),
                  width: isSelected ? 1.5 : 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isSelected) ...[
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFFEA580C),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    s['label']!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: isSelected ? Colors.white : Colors.white.withOpacity(0.6),
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // 3. 4-Card Executive KPI Radar
  Widget _buildKpiRadar(NumberFormat formatter) {
    final treasury = _dashboardData?['treasury'] ?? {};
    final activeRequests = _getFilteredRequests();
    final pendingSum = activeRequests.fold<num>(
      0,
      (sum, r) => sum + (num.tryParse(r['amountNaira']?.toString() ?? '0') ?? 0),
    );
    final overdueCount = _dashboardData?['overdueCount'] ?? 1;

    return Column(
      children: [
        Row(
          children: [
            // KPI 1: Liquid Reserves
            Expanded(
              child: _buildKpiCard(
                title: 'GROUP TREASURY',
                value: treasury['total'] ?? '₦84.2M',
                subtitle: '100% Reconciled',
                icon: Icons.account_balance_rounded,
                iconColor: const Color(0xFFFB923C),
                borderColor: const Color(0xFFEA580C).withOpacity(0.3),
                badgeColor: const Color(0xFF059669).withOpacity(0.2),
                badgeText: '18.4 WKS',
              ),
            ),
            const SizedBox(width: 10),
            // KPI 2: Pending Approvals
            Expanded(
              child: _buildKpiCard(
                title: 'PENDING GMD',
                value: formatter.format(pendingSum),
                subtitle: '${activeRequests.length} requisitions',
                icon: Icons.verified_user_rounded,
                iconColor: const Color(0xFFF97316),
                borderColor: activeRequests.isNotEmpty ? const Color(0xFFF97316).withOpacity(0.3) : Colors.white12,
                badgeColor: activeRequests.isNotEmpty ? const Color(0xFFEA580C).withOpacity(0.25) : const Color(0xFF059669).withOpacity(0.2),
                badgeText: activeRequests.isNotEmpty ? 'ACTION' : 'CLEAR',
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            // KPI 3: 72h Cash Advances
            Expanded(
              child: _buildKpiCard(
                title: '72H ADVANCE SLA',
                value: '$overdueCount OVERDUE',
                subtitle: '2 active staff advances',
                icon: Icons.timer_outlined,
                iconColor: const Color(0xFFEF4444),
                borderColor: const Color(0xFFEF4444).withOpacity(0.3),
                badgeColor: const Color(0xFFEF4444).withOpacity(0.2),
                badgeText: 'AUDIT',
              ),
            ),
            const SizedBox(width: 10),
            // KPI 4: Q4 Budget Run-rate
            Expanded(
              child: _buildKpiCard(
                title: 'Q4 BUDGET BURN',
                value: '67.4% BURN',
                subtitle: '₦56.6M / ₦84M consumed',
                icon: Icons.pie_chart_outline_rounded,
                iconColor: const Color(0xFF10B981),
                borderColor: Colors.white12,
                badgeColor: const Color(0xFF10B981).withOpacity(0.2),
                badgeText: 'ON TRACK',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color borderColor,
    required Color badgeColor,
    required String badgeText,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, size: 16, color: iconColor),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: iconColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: Colors.white.withOpacity(0.5),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: -0.4,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.4)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  // 4. Segmented Workspace Tabs
  Widget _buildWorkspaceTabs() {
    final activeCount = _getFilteredRequests().length;
    final tabs = [
      {'label': 'Overview', 'icon': Icons.insights_rounded, 'badge': ''},
      {'label': 'Approvals', 'icon': Icons.rule_rounded, 'badge': activeCount > 0 ? '$activeCount' : ''},
      {'label': 'Treasury', 'icon': Icons.account_balance_rounded, 'badge': '3'},
      {'label': 'Accountability', 'icon': Icons.verified_outlined, 'badge': '!'},
    ];

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        children: List.generate(tabs.length, (idx) {
          final isSelected = _currentTab == idx;
          final t = tabs[idx];
          final badge = t['badge'] as String;

          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _currentTab = idx),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFEA580C) : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: const Color(0xFFEA580C).withOpacity(0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      t['icon'] as IconData,
                      size: 13,
                      color: isSelected ? Colors.white : Colors.white54,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      t['label'] as String,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? Colors.white : Colors.white60,
                      ),
                    ),
                    if (badge.isNotEmpty) ...[
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: isSelected ? Colors.black26 : const Color(0xFFEA580C),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          badge,
                          style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  // TAB 0: OVERVIEW TAB
  List<Widget> _buildOverviewTab(NumberFormat formatter) {
    final activeRequests = _getFilteredRequests();

    return [
      // Priority Alert Banner if Approvals or Overdue exist
      if (activeRequests.isNotEmpty)
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                const Color(0xFFEA580C).withOpacity(0.25),
                const Color(0xFF7C2D12).withOpacity(0.15),
              ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.4)),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFEA580C).withOpacity(0.3),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.bolt_rounded, color: Color(0xFFFB923C), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Executive Action Required',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${activeRequests.length} requisition(s) currently awaiting your authorization.',
                      style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.65)),
                    ),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () => setState(() => _currentTab = 1),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
                child: const Text('Review', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),

      // Top Pending Requisition Card preview
      if (activeRequests.isNotEmpty) ...[
        _buildSectionHeader('HIGH PRIORITY APPROVAL', 'Direct executive sign-off queue'),
        const SizedBox(height: 10),
        _buildRequisitionCard(activeRequests.first, formatter),
        const SizedBox(height: 16),
      ],

      // Treasury Quick Health Card
      _buildSectionHeader('TREASURY PORTFOLIO SUMMARY', 'Multi-bank cash reserves'),
      const SizedBox(height: 10),
      _buildTreasuryCard(formatter),

      const SizedBox(height: 16),

      // Accountability Radar Preview
      _buildSectionHeader('72-HOUR RETIREMENT SLA', 'Staff unretired cash advances'),
      const SizedBox(height: 10),
      _buildAccountabilityPreviewCard(),
    ];
  }

  // TAB 1: APPROVALS DESK
  List<Widget> _buildApprovalsTab(NumberFormat formatter) {
    final activeRequests = _getFilteredRequests();

    return [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _buildSectionHeader('PENDING APPROVALS DESK', '${activeRequests.length} requisition(s) in review queue'),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: activeRequests.isNotEmpty
                  ? const Color(0xFFEA580C).withOpacity(0.2)
                  : const Color(0xFF059669).withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: activeRequests.isNotEmpty
                    ? const Color(0xFFEA580C).withOpacity(0.4)
                    : const Color(0xFF059669).withOpacity(0.4),
              ),
            ),
            child: Text(
              activeRequests.isNotEmpty ? '${activeRequests.length} REQUIRE SIGN-OFF' : 'ALL CLEAR',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: activeRequests.isNotEmpty ? const Color(0xFFFB923C) : const Color(0xFF34D399),
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: 12),

      if (activeRequests.isEmpty)
        Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
          ),
          child: Column(
            children: [
              const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 44),
              const SizedBox(height: 12),
              const Text(
                'Approvals Queue is Clear',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                'Zero requisitions currently awaiting executive authorization for ${_selectedScope == 'all' ? 'any subsidiary' : _selectedScope}.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.5)),
              ),
            ],
          ),
        )
      else
        ...activeRequests.map((req) => _buildRequisitionCard(req, formatter)),
    ];
  }

  // TAB 2: TREASURY & BANKS
  List<Widget> _buildTreasuryTab(NumberFormat formatter) {
    final treasury = _dashboardData?['treasury'] ?? {};
    final accounts = (treasury['accounts'] as List<dynamic>?) ?? [];
    final recentDisb = (treasury['recentDisbursements'] as List<dynamic>?) ?? [];

    return [
      _buildSectionHeader('GROUP TREASURY BALANCES', 'Consolidated multi-bank reserves'),
      const SizedBox(height: 10),
      _buildTreasuryCard(formatter),

      const SizedBox(height: 20),

      _buildSectionHeader('AUTHORIZED BANK ACCOUNTS', 'Direct liquid accounts & escrow reserves'),
      const SizedBox(height: 10),

      ...accounts.map((acc) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFFB923C).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.account_balance_rounded, color: Color(0xFFFB923C), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          acc['bank'] ?? 'Bank',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                        ),
                        Text(
                          acc['balance'] ?? '₦0',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Text(
                              acc['accountNumber'] ?? '0000000000',
                              style: TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: Colors.white.withOpacity(0.5),
                              ),
                            ),
                            const SizedBox(width: 6),
                            GestureDetector(
                              onTap: () {
                                Clipboard.setData(ClipboardData(text: acc['accountNumber'] ?? ''));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Account number copied to clipboard'),
                                    duration: Duration(seconds: 1),
                                  ),
                                );
                              },
                              child: Icon(Icons.copy_rounded, size: 12, color: Colors.white.withOpacity(0.4)),
                            ),
                          ],
                        ),
                        Text(
                          acc['accountType'] ?? 'Account',
                          style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.4)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }),

      const SizedBox(height: 20),

      _buildSectionHeader('RECENT CONFIRMED DISBURSEMENTS', 'Direct bank payout transaction logs'),
      const SizedBox(height: 10),

      ...recentDisb.map((disb) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.03),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFF059669).withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.arrow_outward_rounded, color: Color(0xFF34D399), size: 16),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        disb['beneficiary'] ?? 'Beneficiary',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${disb['subsidiary'] ?? 'Group'} · ${disb['time']}',
                        style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.45)),
                      ),
                    ],
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    disb['amount'] ?? '₦0',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    disb['reference'] ?? 'TRF',
                    style: TextStyle(fontSize: 9, fontFamily: 'monospace', color: Colors.white.withOpacity(0.4)),
                  ),
                ],
              ),
            ],
          ),
        );
      }),
    ];
  }

  // TAB 3: ACCOUNTABILITY & BUDGETS
  List<Widget> _buildAccountabilityBudgetsTab(NumberFormat formatter) {
    final accountabilityCases = (_dashboardData?['accountabilityCases'] as List<dynamic>?) ?? [];
    final budgets = (_dashboardData?['budgets'] as List<dynamic>?) ?? [];

    return [
      _buildSectionHeader('72-HOUR RETIREMENT RADAR', 'Mandatory expense retirements & receipts'),
      const SizedBox(height: 10),

      if (accountabilityCases.isEmpty)
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Center(
            child: Text(
              'Zero unretired cash advances across subsidiaries.',
              style: TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ),
        )
      else
        ...accountabilityCases.map((acc) {
          final isOverdue = acc['status'] == 'OVERDUE' || (acc['hoursRemaining'] is num && acc['hoursRemaining'] < 0);
          final staffName = acc['staffName'] ?? acc['request']?['requester']?['legalName'] ?? 'Staff Member';
          final sub = acc['subsidiary'] ?? acc['request']?['subsidiary']?['legalName'] ?? 'BEMS Farms';
          final purpose = acc['purpose'] ?? acc['request']?['title'] ?? 'Operational advance';
          final amountNaira = num.tryParse(acc['amountNaira']?.toString() ?? acc['request']?['amountNaira']?.toString() ?? '0') ?? 0;
          final expectedProof = acc['expectedProof'] ?? 'Physical vendor receipt & completion certificate';

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isOverdue ? const Color(0xFFDC2626).withOpacity(0.08) : Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isOverdue ? const Color(0xFFEF4444).withOpacity(0.4) : Colors.white.withOpacity(0.08),
              ),
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
                          decoration: BoxDecoration(
                            color: isOverdue ? const Color(0xFFEF4444) : const Color(0xFFF59E0B),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          staffName,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isOverdue ? const Color(0xFFEF4444).withOpacity(0.2) : const Color(0xFFF59E0B).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isOverdue ? '24H OVERDUE' : 'DUE IN 18H',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: isOverdue ? const Color(0xFFFCA5A5) : const Color(0xFFFDE68A),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  purpose,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  '$sub · Advance Amount: ${formatter.format(amountNaira)}',
                  style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.receipt_long_rounded, size: 14, color: Color(0xFFFB923C)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Required: $expectedProof',
                          style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.7)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }),

      const SizedBox(height: 24),

      _buildSectionHeader('SUBSIDIARY BUDGET ALLOCATIONS', 'Real-time burn-rate & variance tracking'),
      const SizedBox(height: 10),

      ...budgets.map((b) {
        final dept = b['department'] ?? b['organization']?['legalName'] ?? 'Department';
        final sub = b['subsidiary'] ?? 'BEMS Group';
        final allocated = num.tryParse(b['allocatedAmount']?.toString() ?? '1') ?? 1;
        final spent = num.tryParse(b['spentAmount']?.toString() ?? '0') ?? 0;
        final burn = (spent / (allocated > 0 ? allocated : 1)).clamp(0.0, 1.0);
        final percentFormatted = (burn * 100).toStringAsFixed(1);
        final isHighBurn = burn > 0.75;

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
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        dept,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                      Text(
                        sub,
                        style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.4)),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isHighBurn ? const Color(0xFFEF4444).withOpacity(0.2) : const Color(0xFF10B981).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$percentFormatted% UTILIZED',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: isHighBurn ? const Color(0xFFFCA5A5) : const Color(0xFF6EE7B7),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: burn,
                  minHeight: 6,
                  backgroundColor: Colors.white.withOpacity(0.08),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isHighBurn ? const Color(0xFFEF4444) : const Color(0xFFEA580C),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Spent: ${formatter.format(spent)}',
                    style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.6)),
                  ),
                  Text(
                    'Limit: ${formatter.format(allocated)}',
                    style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.4)),
                  ),
                ],
              ),
            ],
          ),
        );
      }),
    ];
  }

  // REQUISITION CARD
  Widget _buildRequisitionCard(dynamic req, NumberFormat formatter) {
    final id = req['id']?.toString() ?? '';
    final code = req['code'] ?? req['requestNumber'] ?? 'REQ-2026';
    final dept = req['department'] ?? 'Operations';
    final sub = req['subsidiary'] is Map ? req['subsidiary']['legalName'] : (req['subsidiary'] ?? 'BEMS Group');
    final purpose = req['purpose'] ?? req['title'] ?? 'Procurement';
    final justification = req['justification'] ?? 'Operational continuity requirement.';
    final deliverable = req['deliverable'] ?? 'Physical GRN note and invoice verification.';
    final beneficiary = req['beneficiary'] ?? req['requester']?['legalName'] ?? 'Vendor';
    final requester = req['requesterName'] ?? req['requester']?['legalName'] ?? 'Staff Lead';
    final amountNaira = num.tryParse(req['amountNaira']?.toString() ?? '0') ?? 0;
    final formattedAmount = formatter.format(amountNaira);
    final isProcessing = _loadingActionIds.contains(id);
    final urgency = req['urgency'] ?? 'NORMAL';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: urgency == 'CRITICAL' ? const Color(0xFFEF4444).withOpacity(0.5) : Colors.white.withOpacity(0.08),
          width: urgency == 'CRITICAL' ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    code,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFFB923C),
                      letterSpacing: 0.5,
                    ),
                  ),
                  if (urgency == 'CRITICAL') ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'CRITICAL',
                        style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFFFCA5A5)),
                      ),
                    ),
                  ],
                ],
              ),
              Text(
                formattedAmount,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            purpose,
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Colors.white),
          ),
          const SizedBox(height: 4),
          Text(
            '$sub · $dept\nRequester: $requester · Pay To: $beneficiary',
            style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black26,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Justification: $justification',
                  style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.7)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  'Required Proof: $deliverable',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFFFB923C)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Tap to Inspect Sheet Link
          GestureDetector(
            onTap: () => _showRequisitionDetailsSheet(req, formatter),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withOpacity(0.06)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFFB923C)),
                      const SizedBox(width: 6),
                      Text(
                        'Inspect Justification & Deliverable Proof',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white.withOpacity(0.85)),
                      ),
                    ],
                  ),
                  const Icon(Icons.chevron_right_rounded, size: 16, color: Colors.white54),
                ],
              ),
            ),
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
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: isProcessing
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('Approve', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          ],
                        ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: isProcessing ? null : () => _handleDecision(id, 'REJECT'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFF87171),
                    side: BorderSide(color: const Color(0xFFDC2626).withOpacity(0.6)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.close_rounded, size: 16),
                      SizedBox(width: 6),
                      Text('Decline', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // BOTTOM SHEET REQUISITION AUDIT INSPECTOR
  void _showRequisitionDetailsSheet(dynamic req, NumberFormat formatter) {
    final id = req['id']?.toString() ?? '';
    final code = req['code'] ?? req['requestNumber'] ?? 'REQ-2026';
    final amountNaira = num.tryParse(req['amountNaira']?.toString() ?? '0') ?? 0;
    final formattedAmount = formatter.format(amountNaira);
    final purpose = req['purpose'] ?? req['title'] ?? 'Procurement';
    final justification = req['justification'] ?? 'Operational continuity requirement.';
    final deliverable = req['deliverable'] ?? 'Physical GRN note and invoice verification.';
    final sub = req['subsidiary'] is Map ? req['subsidiary']['legalName'] : (req['subsidiary'] ?? 'BEMS Group');
    final dept = req['department'] ?? 'Operations';
    final requester = req['requesterName'] ?? req['requester']?['legalName'] ?? 'Staff Lead';
    final beneficiary = req['beneficiary'] ?? 'Supplier';
    final budgetStatus = req['budgetStatus'] ?? 'Within Q4 Allocation';

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B132B),
      isScrollControlled: true,
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
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        code,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFFB923C)),
                      ),
                      Text(
                        '$sub · $dept',
                        style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                      ),
                    ],
                  ),
                  Text(
                    formattedAmount,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: Colors.white12),
              const SizedBox(height: 12),

              _buildAuditRow('Purpose', purpose),
              const SizedBox(height: 10),
              _buildAuditRow('Business Justification', justification),
              const SizedBox(height: 10),
              _buildAuditRow('Expected Deliverable', deliverable),
              const SizedBox(height: 10),
              _buildAuditRow('Beneficiary & Payout Target', beneficiary),
              const SizedBox(height: 10),
              _buildAuditRow('Submitted By', requester),
              const SizedBox(height: 10),
              _buildAuditRow('Budget Alignment', budgetStatus),

              const SizedBox(height: 24),

              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _handleDecision(id, 'APPROVE');
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Approve Requisition', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _handleDecision(id, 'REJECT');
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFF87171),
                        side: BorderSide(color: const Color(0xFFDC2626).withOpacity(0.6)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Decline', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAuditRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
            color: const Color(0xFFFB923C).withOpacity(0.9),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.white),
        ),
      ],
    );
  }

  // TREASURY CARD
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

          // Bank breakdown lines
          _buildBankPreviewLine('Access Bank PLC', '₦52,800,000', 'Holding Master Reserve'),
          const SizedBox(height: 10),
          _buildBankPreviewLine('Zenith Bank PLC', '₦24,400,000', 'Operations Account'),
          const SizedBox(height: 10),
          _buildBankPreviewLine('Guaranty Trust Bank', '₦7,000,000', 'Emergency Escrow'),
        ],
      ),
    );
  }

  Widget _buildBankPreviewLine(String name, String amount, String role) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white)),
            Text(role, style: TextStyle(fontSize: 10.5, color: Colors.white.withOpacity(0.4))),
          ],
        ),
        Text(amount, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Colors.white)),
      ],
    );
  }

  // ACCOUNTABILITY PREVIEW
  Widget _buildAccountabilityPreviewCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withOpacity(0.18),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFF87171), size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '1 Overdue Staff Advance Alert',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  'Sunday Ogunleye (BEMS Farms) · ₦280,000 pending receipt clearance (24h past SLA).',
                  style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.55)),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => setState(() => _currentTab = 3),
            icon: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Colors.white54),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
            color: Color(0xFFFB923C),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
        ),
      ],
    );
  }

  // FLOATING BEMI COPILOT PILL
  Widget _buildFloatingCopilotPill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      margin: const EdgeInsets.symmetric(horizontal: 24),
      height: 50,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withOpacity(0.96),
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
              'Ask BEMi to audit system...',
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
