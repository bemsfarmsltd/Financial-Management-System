import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'executive_chat_screen.dart';
import '../widgets/charts/treasury_pie_chart.dart';
import '../widgets/charts/expenditure_histogram.dart';
import '../widgets/charts/subsidiary_burn_bars.dart';
import '../widgets/charts/accountability_sla_gauge.dart';
import '../models/workstation_scope.dart';

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
                ? '✓ Request approved & queued for bank payment.'
                : 'Request declined.',
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
      final subMap = r['subsidiary'];
      final subCode = (subMap is Map ? subMap['code'] : subMap)?.toString().toLowerCase() ?? '';
      final subName = (subMap is Map ? subMap['legalName'] : subMap)?.toString().toLowerCase() ?? '';
      final dept = (r['department'] ?? '').toString().toLowerCase();
      if (_selectedScope == 'SOFT') return subCode.contains('soft') || subName.contains('soft') || dept.contains('tech');
      if (_selectedScope == 'LOG') return subCode.contains('log') || subName.contains('log') || dept.contains('supply');
      if (_selectedScope == 'HQ') return subCode.contains('group') || subName.contains('group') || dept.contains('corp');
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);
    final currentWorkstation = WorkstationRepository.compute(
      scope: _selectedScope,
      data: _dashboardData,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.segment_rounded, color: Color(0xFF0F172A), size: 22),
          onPressed: widget.onOpenDrawer,
        ),
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFEA580C), Color(0xFFC2410C)]),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Center(
                child: Text('GMD', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10)),
              ),
            ),
            const SizedBox(width: 8),
            // Workstation Switcher Dropdown in Top Bar
            PopupMenuButton<String>(
              initialValue: _selectedScope,
              tooltip: 'Switch Operating Workstation',
              onSelected: (val) => setState(() => _selectedScope = val),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              color: Colors.white,
              elevation: 8,
              itemBuilder: (context) {
                return WorkstationRepository.getWorkstations(_dashboardData).map((ws) {
                  final isCurrent = ws.code.toLowerCase() == _selectedScope.toLowerCase();
                  return PopupMenuItem<String>(
                    value: ws.code,
                    child: Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: ws.themeColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ws.shortName,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                                  color: isCurrent ? const Color(0xFFEA580C) : const Color(0xFF0F172A),
                                ),
                              ),
                              Text(
                                ws.totalTreasuryDisplay,
                                style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        if (isCurrent)
                          const Icon(Icons.check_rounded, size: 16, color: Color(0xFFEA580C)),
                      ],
                    ),
                  );
                }).toList();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      currentWorkstation.shortName,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_drop_down_rounded, size: 18, color: Color(0xFF64748B)),
                  ],
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B), size: 20),
            onPressed: () {
              setState(() => _isLoading = true);
              _loadData();
            },
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(color: Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: SafeArea(
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
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  children: [
                    // Top Mode Selector (BEMi Copilot vs System Dashboard)
                    _buildModeSelector(),

                    const SizedBox(height: 14),

                    // Subsidiary Scope Switcher
                    _buildSubsidiaryScopeSelector(currentWorkstation),

                    const SizedBox(height: 16),

                    // 4-Card Executive KPI Radar
                    _buildKpiRadar(currencyFormatter, currentWorkstation),

                    const SizedBox(height: 18),

                    // Segmented Workspace Tabs
                    _buildWorkspaceTabs(),

                    const SizedBox(height: 16),

                    // Tab Specific Content
                    if (_currentTab == 0) ..._buildOverviewTab(currencyFormatter, currentWorkstation),
                    if (_currentTab == 1) ..._buildApprovalsTab(currencyFormatter),
                    if (_currentTab == 2) ..._buildTreasuryTab(currencyFormatter, currentWorkstation),
                    if (_currentTab == 3) ..._buildAccountabilityBudgetsTab(currencyFormatter, currentWorkstation),
                  ],
                ),
              ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: _buildFloatingCopilotPill(),
    );
  }

  // 1. Mode Selector
  Widget _buildModeSelector() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: widget.onSwitchToAi,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    decoration: BoxDecoration(
                      color: Colors.transparent,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.auto_awesome_rounded, size: 14, color: Color(0xFF64748B)),
                        SizedBox(width: 6),
                        Text(
                          'BEMi Copilot',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEA580C),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x28EA580C),
                        blurRadius: 8,
                        offset: Offset(0, 2),
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
        ),
        const SizedBox(height: 4),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.swipe_rounded, size: 11, color: Color(0xFF94A3B8)),
            SizedBox(width: 4),
            Text(
              'Swipe screen or tap pill to swap view',
              style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ],
    );
  }

  // 2. Subsidiary / Workstation Scope Selector
  Widget _buildSubsidiaryScopeSelector(WorkstationProfile currentWorkstation) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: WorkstationRepository.getWorkstations(_dashboardData).map((ws) {
              final isSelected = _selectedScope.toLowerCase() == ws.code.toLowerCase();
              return GestureDetector(
                onTap: () => setState(() => _selectedScope = ws.code),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFFFF7ED) : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0),
                      width: isSelected ? 1.5 : 1,
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x060F172A),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFFEA580C) : ws.themeColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        ws.shortName,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                          color: isSelected ? const Color(0xFFEA580C) : const Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 8),
        // Active Workstation Context Strip
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Icon(Icons.business_rounded, size: 14, color: currentWorkstation.themeColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${currentWorkstation.fullName} · ${currentWorkstation.description}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: currentWorkstation.themeColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  currentWorkstation.code.toUpperCase(),
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: currentWorkstation.themeColor),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // 3. 4-Card Executive KPI Radar
  Widget _buildKpiRadar(NumberFormat formatter, WorkstationProfile currentWorkstation) {
    final activeRequests = _getFilteredRequests();
    final pendingSum = activeRequests.fold<num>(
      0,
      (sum, r) => sum + (num.tryParse(r['amountNaira']?.toString() ?? '0') ?? 0),
    );

    return Column(
      children: [
        Row(
          children: [
            // KPI 1: Liquid Reserves (Workstation Scoped)
            Expanded(
              child: _buildKpiCard(
                title: '${currentWorkstation.code == 'all' ? 'TOTAL' : currentWorkstation.code} CASH IN BANKS',
                value: currentWorkstation.totalTreasuryDisplay,
                subtitle: 'All bank accounts balanced',
                icon: Icons.account_balance_rounded,
                iconColor: currentWorkstation.themeColor,
                badgeColor: currentWorkstation.themeColor.withOpacity(0.1),
                badgeText: currentWorkstation.runwayWeeks,
              ),
            ),
            const SizedBox(width: 10),
            // KPI 2: Pending Approvals (Workstation Scoped)
            Expanded(
              child: _buildKpiCard(
                title: 'WAITING FOR YOUR APPROVAL',
                value: formatter.format(pendingSum),
                subtitle: '${activeRequests.length} request(s)',
                icon: Icons.verified_user_rounded,
                iconColor: const Color(0xFF0284C7),
                badgeColor: activeRequests.isNotEmpty ? const Color(0xFFFFF7ED) : const Color(0xFFECFDF5),
                badgeText: activeRequests.isNotEmpty ? '${activeRequests.length} WAITING' : 'ALL SIGNED',
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            // KPI 3: 72h Cash Advances (Workstation Scoped)
            Expanded(
              child: _buildKpiCard(
                title: 'MONEY GIVEN TO STAFF',
                value: currentWorkstation.overdueAdvances > 0 ? '${currentWorkstation.overdueAdvances} LATE' : 'ALL ON TIME',
                subtitle: '${currentWorkstation.inProgressAdvances} staff holding money',
                icon: Icons.timer_outlined,
                iconColor: currentWorkstation.overdueAdvances > 0 ? const Color(0xFFDC2626) : const Color(0xFF059669),
                badgeColor: currentWorkstation.overdueAdvances > 0 ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                badgeText: currentWorkstation.overdueAdvances > 0 ? 'NEEDS ATTENTION' : 'ON TIME',
              ),
            ),
            const SizedBox(width: 10),
            // KPI 4: Q4 Budget Run-rate (Workstation Scoped)
            Expanded(
              child: _buildKpiCard(
                title: 'QUARTERLY BUDGET SPENT',
                value: currentWorkstation.burnBadge,
                subtitle: '₦${(currentWorkstation.spentAmount / 1000000).toStringAsFixed(1)}M of ₦${(currentWorkstation.budgetCeiling / 1000000).toStringAsFixed(0)}M spent',
                icon: Icons.pie_chart_outline_rounded,
                iconColor: currentWorkstation.themeColor,
                badgeColor: currentWorkstation.themeColor.withOpacity(0.1),
                badgeText: currentWorkstation.burnPercentage > 75 ? 'HIGH SPEND' : 'UNDER BUDGET',
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
    required Color badgeColor,
    required String badgeText,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: iconColor),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: iconColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0F172A),
              letterSpacing: -0.4,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
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
      {'label': 'Requests to Sign', 'icon': Icons.rule_rounded, 'badge': activeCount > 0 ? '$activeCount' : ''},
      {'label': 'Bank Accounts', 'icon': Icons.account_balance_rounded, 'badge': '3'},
      {'label': 'Staff Receipts', 'icon': Icons.verified_outlined, 'badge': '!'},
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
                  color: isSelected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: isSelected
                      ? const [
                          BoxShadow(
                            color: Color(0x0A0F172A),
                            blurRadius: 8,
                            offset: Offset(0, 2),
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
                      color: isSelected ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      t['label'] as String,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                      ),
                    ),
                    if (badge.isNotEmpty) ...[
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          badge,
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                            color: isSelected ? Colors.white : const Color(0xFF334155),
                          ),
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
  List<Widget> _buildOverviewTab(NumberFormat formatter, WorkstationProfile currentWorkstation) {
    final activeRequests = _getFilteredRequests();

    return [
      // Priority Alert Banner if Approvals or Overdue exist
      if (activeRequests.isNotEmpty)
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF7ED),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFFED7AA)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x060F172A),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  color: Color(0xFFEA580C),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.bolt_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Requests Need Your Signature',
                      style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${activeRequests.length} request(s) waiting for your approval in ${currentWorkstation.shortName}.',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () => setState(() => _currentTab = 1),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
                child: const Text('View Requests', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),

      // Top Pending Requisition Card preview
      if (activeRequests.isNotEmpty) ...[
        _buildSectionHeader('URGENT REQUESTS NEEDING DECISION', 'Waiting for your final decision in ${currentWorkstation.shortName}'),
        const SizedBox(height: 10),
        _buildRequisitionCard(activeRequests.first, formatter),
        const SizedBox(height: 18),
      ],

      // 1. Solid Multi-Bank Treasury Donut / Pie Chart (Workstation Scoped)
      _buildSectionHeader(currentWorkstation.code == 'all' ? 'WHERE OUR MONEY IS KEPT' : '${currentWorkstation.code} BANK ACCOUNTS', 'Current balances in company bank accounts for ${currentWorkstation.shortName}'),
      const SizedBox(height: 10),
      TreasuryPieChart(
        key: ValueKey('pie_${currentWorkstation.code}'),
        totalBalance: currentWorkstation.totalTreasuryAmount,
        bankData: currentWorkstation.bankAccounts,
      ),

      const SizedBox(height: 20),

      // 2. Solid Monthly Expenditure Histogram (Workstation Scoped)
      _buildSectionHeader(currentWorkstation.code == 'all' ? 'MONTHLY MONEY SPENT' : '${currentWorkstation.code} MONTHLY SPENDING', 'Actual money spent each month vs approved budget limit'),
      const SizedBox(height: 10),
      ExpenditureHistogram(
        key: ValueKey('hist_${currentWorkstation.code}'),
        monthlyData: currentWorkstation.monthlyBurnHistory,
      ),

      const SizedBox(height: 20),

      // 3. Subsidiary Budget Utilization Progress Bars (Horizontal Histogram)
      _buildSectionHeader('EXPENDITURE BY SUBSIDIARY', 'Quarterly expenditure & budget utilization across subsidiaries'),
      const SizedBox(height: 10),
      SubsidiaryBurnBars(
        key: ValueKey('subs_${currentWorkstation.code}'),
        items: currentWorkstation.subsidiaries,
      ),

      const SizedBox(height: 20),

      // 4. 72-Hour SLA Accountability Compliance Gauge (Workstation Scoped)
      _buildSectionHeader(currentWorkstation.code == 'all' ? 'STAFF ADVANCE RECEIPTS STATUS' : '${currentWorkstation.code} STAFF RECEIPTS', 'Tracking receipts for money given to staff in ${currentWorkstation.shortName}'),
      const SizedBox(height: 10),
      AccountabilitySlaGauge(
        key: ValueKey('sla_${currentWorkstation.code}'),
        totalAdvances: currentWorkstation.totalAdvances,
        retiredOnTime: currentWorkstation.retiredOnTime,
        inProgress: currentWorkstation.inProgressAdvances,
        overdueCount: currentWorkstation.overdueAdvances,
      ),
    ];
  }

  // TAB 1: APPROVALS DESK
  List<Widget> _buildApprovalsTab(NumberFormat formatter) {
    final activeRequests = _getFilteredRequests();

    return [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _buildSectionHeader('REQUESTS WAITING FOR YOUR SIGNATURE', '${activeRequests.length} request(s) need your decision'),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: activeRequests.isNotEmpty ? const Color(0xFFFFF7ED) : const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: activeRequests.isNotEmpty ? const Color(0xFFFED7AA) : const Color(0xFFA7F3D0),
              ),
            ),
            child: Text(
              activeRequests.isNotEmpty ? '${activeRequests.length} NEED SIGNATURE' : 'ALL SIGNED',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: activeRequests.isNotEmpty ? const Color(0xFFEA580C) : const Color(0xFF059669),
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
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(color: Color(0x060F172A), blurRadius: 10, offset: Offset(0, 3)),
            ],
          ),
          child: Column(
            children: [
              const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF059669), size: 44),
              const SizedBox(height: 12),
              const Text(
                'No Requests Waiting',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),
              Text(
                'All requests have been signed and approved for ${_selectedScope == 'all' ? 'all divisions' : _selectedScope}.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
            ],
          ),
        )
      else
        ...activeRequests.map((req) => _buildRequisitionCard(req, formatter)),
    ];
  }

  // TAB 2: TREASURY & BANKS
  List<Widget> _buildTreasuryTab(NumberFormat formatter, WorkstationProfile currentWorkstation) {
    final recentDisb = (_dashboardData?['disbursements'] as List<dynamic>?) ??
        (_dashboardData?['treasury']?['recentDisbursements'] as List<dynamic>?) ??
        [];

    return [
      _buildSectionHeader(currentWorkstation.code == 'all' ? 'WHERE OUR MONEY IS KEPT' : '${currentWorkstation.code} BANK ACCOUNTS', 'Current balances in company bank accounts for ${currentWorkstation.shortName}'),
      const SizedBox(height: 10),
      TreasuryPieChart(
        key: ValueKey('treasury_tab_pie_${currentWorkstation.code}'),
        totalBalance: currentWorkstation.totalTreasuryAmount,
        bankData: currentWorkstation.bankAccounts,
      ),

      const SizedBox(height: 20),

      _buildSectionHeader('COMPANY BANK ACCOUNTS', 'Direct balances in company bank accounts for ${currentWorkstation.shortName}'),
      const SizedBox(height: 10),

      ...currentWorkstation.bankAccounts.map((acc) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(color: Color(0x060F172A), blurRadius: 8, offset: Offset(0, 2)),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: acc.color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: acc.color.withOpacity(0.2)),
                ),
                child: Icon(Icons.account_balance_rounded, color: acc.color, size: 20),
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
                          acc.bankName,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          formatter.format(acc.amount),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
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
                              acc.accountNumber,
                              style: const TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 6),
                            GestureDetector(
                              onTap: () {
                                Clipboard.setData(ClipboardData(text: acc.accountNumber));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Account number copied to clipboard'),
                                    duration: Duration(seconds: 1),
                                  ),
                                );
                              },
                              child: const Icon(Icons.copy_rounded, size: 12, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: acc.color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Available Cash',
                            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: acc.color),
                          ),
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

      _buildSectionHeader('RECENT PAYMENTS SENT OUT', 'Confirmed payments made from company bank accounts'),
      const SizedBox(height: 10),

      if (recentDisb.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: const Center(
            child: Text(
              'No payments sent out yet.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
            ),
          ),
        )
      else
        ...recentDisb.map((disb) {
          final amtNum = disb['amountNaira'] ?? (num.tryParse(disb['amount']?.toString().replaceAll(RegExp(r'[^\d.]'), '') ?? '0') ?? 0);
          final bank = disb['bankName'] ?? disb['beneficiary'] ?? 'Bank Disbursement';
          final payer = disb['payerOrg']?['legalName'] ?? disb['subsidiary'] ?? 'BEMS Group';
          final ref = disb['externalReference'] ?? disb['reference'] ?? 'TRF';
          String timeStr = 'Recently';
          if (disb['paidAt'] != null) {
            final dt = DateTime.tryParse(disb['paidAt'].toString());
            if (dt != null) timeStr = DateFormat('MMM d, h:mm a').format(dt);
          } else if (disb['time'] != null) {
            timeStr = disb['time'].toString();
          }

          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(color: Color(0x060F172A), blurRadius: 6, offset: Offset(0, 2)),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Color(0xFFECFDF5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.arrow_outward_rounded, color: Color(0xFF059669), size: 16),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          bank,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$payer · $timeStr',
                          style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatter.format(amtNum),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      ref,
                      style: const TextStyle(fontSize: 9, fontFamily: 'monospace', color: Color(0xFF94A3B8)),
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
  List<Widget> _buildAccountabilityBudgetsTab(NumberFormat formatter, WorkstationProfile currentWorkstation) {
    final accountabilityCases = (_dashboardData?['accountabilityCases'] as List<dynamic>?) ?? [];
    final budgets = (_dashboardData?['budgets'] as List<dynamic>?) ?? [];

    return [
      _buildSectionHeader('STAFF ADVANCES & RECEIPTS', 'Tracking receipts for money given to staff (${currentWorkstation.name})'),
      const SizedBox(height: 10),
      AccountabilitySlaGauge(
        key: ValueKey('sla_${currentWorkstation.id}'),
        totalAdvances: currentWorkstation.slaAdvances,
        retiredOnTime: currentWorkstation.slaRetiredOnTime,
        inProgress: currentWorkstation.slaInProgress,
        overdueCount: currentWorkstation.slaOverdue,
      ),
      const SizedBox(height: 18),

      if (accountabilityCases.isEmpty)
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: const Center(
            child: Text(
              'All staff have submitted their receipts on time.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
            ),
          ),
        )
      else
        ...accountabilityCases.map((acc) {
          final isOverdue = acc['status'] == 'OVERDUE' || (acc['hoursRemaining'] is num && acc['hoursRemaining'] < 0);
          final staffName = acc['staffName'] ?? acc['request']?['requester']?['legalName'] ?? 'Staff Member';
          final sub = acc['subsidiary'] ?? acc['request']?['subsidiary']?['legalName'] ?? 'BEMS Group';
          final purpose = acc['purpose'] ?? acc['request']?['title'] ?? 'Operational advance';
          final amountNaira = num.tryParse(acc['amountNaira']?.toString() ?? acc['request']?['amountNaira']?.toString() ?? '0') ?? 0;
          final expectedProof = acc['expectedProof'] ?? 'Physical vendor receipt & completion certificate';

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isOverdue ? const Color(0xFFFEF2F2) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isOverdue ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0),
              ),
              boxShadow: const [
                BoxShadow(color: Color(0x060F172A), blurRadius: 8, offset: Offset(0, 2)),
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
                          decoration: BoxDecoration(
                            color: isOverdue ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          staffName,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isOverdue ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isOverdue ? 'LATE BY 24 HOURS' : 'RECEIPT DUE IN 18 HOURS',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: isOverdue ? const Color(0xFFB91C1C) : const Color(0xFFB45309),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  purpose,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                Text(
                  '$sub · Advance Amount: ${formatter.format(amountNaira)}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.receipt_long_rounded, size: 14, color: Color(0xFFEA580C)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Proof required: $expectedProof',
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF334155), fontWeight: FontWeight.w500),
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

      _buildSectionHeader('MONTHLY MONEY SPENT', 'Monthly spending vs approved budget limit (${currentWorkstation.name})'),
      const SizedBox(height: 10),
      ExpenditureHistogram(
        key: ValueKey('hist_${currentWorkstation.id}'),
        monthlyData: currentWorkstation.monthlyBurn,
      ),

      const SizedBox(height: 20),

      _buildSectionHeader('EXPENDITURE BY SUBSIDIARY', 'Quarterly expenditure & budget utilization across subsidiaries (${currentWorkstation.name})'),
      const SizedBox(height: 10),
      SubsidiaryBurnBars(
        key: ValueKey('subs_${currentWorkstation.id}'),
        items: currentWorkstation.subsidiaries,
      ),

      const SizedBox(height: 20),

      _buildSectionHeader('DEPARTMENT BUDGETS & SPENDING', 'Approved budget vs actual money spent'),
      const SizedBox(height: 10),

      if (budgets.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: const Center(
            child: Text(
              'No department budgets found.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
            ),
          ),
        )
      else
        ...budgets.map((b) {
          final dept = b['periodName'] ?? b['department'] ?? 'Q4 Allocation';
          final sub = b['organization']?['legalName'] ?? b['subsidiary'] ?? 'BEMS Group';
          final allocated = num.tryParse(b['totalAmount']?.toString() ?? b['allocatedAmount']?.toString() ?? '1') ?? 1;
          final spent = num.tryParse(b['spentAmount']?.toString() ?? '0') ?? 0;
          final burn = (spent / (allocated > 0 ? allocated : 1)).clamp(0.0, 1.0);
          final percentFormatted = (burn * 100).toStringAsFixed(1);
          final isHighBurn = burn > 0.75;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(color: Color(0x060F172A), blurRadius: 8, offset: Offset(0, 2)),
            ],
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
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                      ),
                      Text(
                        sub,
                        style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isHighBurn ? const Color(0xFFFEE2E2) : const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$percentFormatted% SPENT',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: isHighBurn ? const Color(0xFFB91C1C) : const Color(0xFF059669),
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
                  backgroundColor: const Color(0xFFF1F5F9),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isHighBurn ? const Color(0xFFDC2626) : const Color(0xFFEA580C),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Spent: ${formatter.format(spent)}',
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                  ),
                  Text(
                    'Limit: ${formatter.format(allocated)}',
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: urgency == 'CRITICAL' ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0),
          width: urgency == 'CRITICAL' ? 1.5 : 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 12,
            offset: Offset(0, 3),
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
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFFED7AA)),
                    ),
                    child: Text(
                      code,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFEA580C),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  if (urgency == 'CRITICAL') ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'CRITICAL',
                        style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFFDC2626)),
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
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            purpose,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 4),
          Text(
            '$sub · $dept\nRequester: $requester · Payee: $beneficiary',
            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.35),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Justification: $justification',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.verified_outlined, size: 12, color: Color(0xFFEA580C)),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        'Proof: $deliverable',
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFFEA580C)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
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
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFEA580C)),
                      SizedBox(width: 6),
                      Text(
                        'View Full Details & Proof',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                      ),
                    ],
                  ),
                  Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFF64748B)),
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
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(color: Color(0xFFFECACA)),
                    backgroundColor: const Color(0xFFFEF2F2),
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
      backgroundColor: Colors.white,
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
                    color: const Color(0xFFE2E8F0),
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
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
                      ),
                      Text(
                        '$sub · $dept',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                  Text(
                    formattedAmount,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Divider(color: Color(0xFFE2E8F0)),
              const SizedBox(height: 10),

              _buildAuditRow('Purpose', purpose),
              const SizedBox(height: 10),
              _buildAuditRow('Business Justification', justification),
              const SizedBox(height: 10),
              _buildAuditRow('Expected Proof / Receipt', deliverable),
              const SizedBox(height: 10),
              _buildAuditRow('Person / Company Being Paid', beneficiary),
              const SizedBox(height: 10),
              _buildAuditRow('Submitted By', requester),
              const SizedBox(height: 10),
              _buildAuditRow('Budget Status', budgetStatus),

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
                        elevation: 0,
                      ),
                      child: const Text('Sign & Approve Request', style: TextStyle(fontWeight: FontWeight.w800)),
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
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFFECACA)),
                        backgroundColor: const Color(0xFFFEF2F2),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Decline Request', style: TextStyle(fontWeight: FontWeight.w800)),
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
          style: const TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
            color: Color(0xFFEA580C),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
        ),
      ],
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
            color: Color(0xFFEA580C),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
      ],
    );
  }

  // FLOATING BEMI COPILOT PILL
  Widget _buildFloatingCopilotPill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      margin: const EdgeInsets.symmetric(horizontal: 24),
      height: 48,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFFED7AA)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x18EA580C),
            blurRadius: 16,
            offset: Offset(0, 4),
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
                gradient: LinearGradient(colors: [Color(0xFFEA580C), Color(0xFFC2410C)]),
              ),
              child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 14),
            ),
            const SizedBox(width: 10),
            const Text(
              'Ask BEMi to audit system...',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
