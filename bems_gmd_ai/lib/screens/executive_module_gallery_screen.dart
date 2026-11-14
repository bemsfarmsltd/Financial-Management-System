import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'executive_home_screen.dart';
import 'executive_chat_screen.dart';
import 'wallet_funding_screen.dart';
import 'disbursements_console_screen.dart';
import 'payroll_signoff_screen.dart';
import 'attendance_radar_screen.dart';
import 'accountability_console_screen.dart';
import 'vendors_registry_screen.dart';
import 'intercompany_notes_screen.dart';
import 'staff_management_screen.dart';
import 'gmd_profile_screen.dart';

class ExecutiveModuleGalleryScreen extends StatefulWidget {
  final String userName;
  final String businessName;

  const ExecutiveModuleGalleryScreen({
    super.key,
    required this.userName,
    this.businessName = 'BEMS Group',
  });

  @override
  State<ExecutiveModuleGalleryScreen> createState() =>
      _ExecutiveModuleGalleryScreenState();
}

class _ExecutiveModuleGalleryScreenState
    extends State<ExecutiveModuleGalleryScreen> {
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String get _displayName {
    final trimmed = widget.userName.trim();
    return trimmed.isNotEmpty ? trimmed : 'Dr. Pastra';
  }

  String get _initials {
    final parts = _displayName.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty) return parts[0][0].toUpperCase();
    return 'G';
  }

  @override
  Widget build(BuildContext context) {
    final modules = _getExecutiveModules();
    final filtered = _searchQuery.isEmpty
        ? modules
        : modules.where((m) {
            final q = _searchQuery.toLowerCase();
            return m.title.toLowerCase().contains(q) ||
                m.description.toLowerCase().contains(q) ||
                m.eyebrow.toLowerCase().contains(q);
          }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Bar: BEMS Group Logo + AI Copilot Quick Action
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Image.asset(
                                'assets/images/bems_group_logo.png',
                                fit: BoxFit.contain,
                                errorBuilder: (_, __, ___) => const Center(
                                  child: Text(
                                    'BG',
                                    style: TextStyle(
                                      color: Color(0xFFEA580C),
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.businessName.toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.6,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const Text(
                                  'Executive Governance Hub',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(
                                Icons.auto_awesome_rounded,
                                color: Color(0xFFEA580C),
                                size: 22,
                              ),
                              tooltip: 'BEMi AI Copilot',
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const ExecutiveChatScreen(),
                                  ),
                                );
                              },
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.person_outline_rounded,
                                color: Color(0xFF334155),
                                size: 22,
                              ),
                              tooltip: 'Executive Profile',
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const GmdProfileScreen(),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // Executive Welcome Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.02),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEA580C).withOpacity(0.12),
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              _initials,
                              style: const TextStyle(
                                color: Color(0xFFEA580C),
                                fontWeight: FontWeight.w900,
                                fontSize: 17,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        _displayName,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFF0F172A),
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(
                                      Icons.verified_rounded,
                                      size: 15,
                                      color: Color(0xFFEA580C),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Group Managing Director · Full Portfolio Access',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF7ED),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: const Color(0xFFEA580C).withOpacity(0.35),
                              ),
                            ),
                            child: const Text(
                              'GMD',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFFEA580C),
                                letterSpacing: 0.6,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Search Bar
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (v) => setState(() => _searchQuery = v.trim()),
                        decoration: InputDecoration(
                          hintText: 'Search executive management systems...',
                          hintStyle: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF94A3B8),
                          ),
                          prefixIcon: const Icon(
                            Icons.search_rounded,
                            color: Color(0xFF94A3B8),
                            size: 20,
                          ),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(
                                    Icons.clear_rounded,
                                    size: 18,
                                    color: Color(0xFF94A3B8),
                                  ),
                                  onPressed: () {
                                    _searchController.clear();
                                    setState(() => _searchQuery = '');
                                  },
                                )
                              : null,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Executive Management Systems',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.3,
                          ),
                        ),
                        Text(
                          '${filtered.length} Modules',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              sliver: SliverGrid(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: MediaQuery.of(context).size.width > 640 ? 2 : 1,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  mainAxisExtent: 172,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) => _ExecutiveModuleCard(
                    module: filtered[index],
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => filtered[index].builder()),
                      );
                    },
                  ),
                  childCount: filtered.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<_ExecutiveModuleItem> _getExecutiveModules() {
    return [
      _ExecutiveModuleItem(
        eyebrow: 'PRIMARY WORKSPACE',
        title: 'Executive Financial Cockpit',
        description:
            'Group treasury balances, pending requisition approvals, subsidiary budgets, and live portfolio telemetry.',
        badge: 'LIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.dashboard_customize_rounded,
        gradient: const [Color(0xFFEA580C), Color(0xFFC2410C)],
        builder: () => ExecutiveHomeScreen(
          userName: widget.userName,
          businessName: widget.businessName,
          initialMode: 'dashboard',
        ),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'ARTIFICIAL INTELLIGENCE',
        title: 'BEMi AI Executive Copilot',
        description:
            'Natural-language Finance, Treasury & HR Operations assistant with staged executive confirmations.',
        badge: 'GMD AI',
        badgeBg: const Color(0xFFFFF7ED),
        badgeColor: const Color(0xFFEA580C),
        icon: Icons.auto_awesome_rounded,
        gradient: const [Color(0xFFEA580C), Color(0xFFF97316)],
        builder: () => const ExecutiveChatScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'TREASURY & MONNIFY',
        title: 'Wallet & Treasury Funding',
        description:
            'Authorize Monnify wallet releases, subsidiary funded allocations, and bank payout approvals.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.account_balance_wallet_rounded,
        gradient: const [Color(0xFF0D9488), Color(0xFF0F766E)],
        builder: () => const WalletFundingScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'PAYOUTS & LEDGER',
        title: 'Disbursements Console',
        description:
            'Review cleared requisitions, bank transfer references, and direct vendor/staff disbursements.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.payments_rounded,
        gradient: const [Color(0xFF2563EB), Color(0xFF1D4ED8)],
        builder: () => const DisbursementsConsoleScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'COMPENSATION',
        title: 'Payroll & Executive Sign-Off',
        description:
            'Inspect subsidiary monthly payroll registers, attendance deductions, and authorize salary payouts.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.receipt_long_rounded,
        gradient: const [Color(0xFF7C3AED), Color(0xFF6D28D9)],
        builder: () => const PayrollSignOffScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'TIMEKEEPING',
        title: 'Attendance Radar',
        description:
            'Live group clock-ins, lateness monitoring, shift policy controls, and biometric/kiosk logs.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.radar_rounded,
        gradient: const [Color(0xFF0284C7), Color(0xFF0369A1)],
        builder: () => const AttendanceRadarScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: '72-HOUR SLA',
        title: 'Accountability & Retirements',
        description:
            'Track cash advances awaiting evidence, overdue 72-hour retirements, and follow-up tasks.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.verified_user_rounded,
        gradient: const [Color(0xFFD97706), Color(0xFFB45309)],
        builder: () => const AccountabilityConsoleScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'HUMAN CAPITAL',
        title: 'Staff & Governance Directory',
        description:
            'Review staff dossiers, subsidiary assignments, banking status, and approval governance.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.groups_rounded,
        gradient: const [Color(0xFF059669), Color(0xFF047857)],
        builder: () => const StaffManagementScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'SUPPLIERS',
        title: 'Vendor & Supplier Registry',
        description:
            'Verified vendor profiles, 3-way matching records, and procurement settlements.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.storefront_rounded,
        gradient: const [Color(0xFF475569), Color(0xFF334155)],
        builder: () => const VendorsRegistryScreen(),
      ),
      _ExecutiveModuleItem(
        eyebrow: 'GROUP LEDGER',
        title: 'Intercompany Debit/Credit Notes',
        description:
            'Automated bilateral intercompany notes, cross-charges, and group netting settlements.',
        badge: 'ACTIVE',
        badgeBg: const Color(0xFFECFDF5),
        badgeColor: const Color(0xFF059669),
        icon: Icons.swap_horiz_rounded,
        gradient: const [Color(0xFF0F172A), Color(0xFF334155)],
        builder: () => const IntercompanyNotesScreen(),
      ),
    ];
  }
}

class _ExecutiveModuleItem {
  final String eyebrow;
  final String title;
  final String description;
  final String badge;
  final Color badgeBg;
  final Color badgeColor;
  final IconData icon;
  final List<Color> gradient;
  final Widget Function() builder;

  const _ExecutiveModuleItem({
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.badge,
    required this.badgeBg,
    required this.badgeColor,
    required this.icon,
    required this.gradient,
    required this.builder,
  });
}

class _ExecutiveModuleCard extends StatelessWidget {
  final _ExecutiveModuleItem module;
  final VoidCallback onTap;

  const _ExecutiveModuleCard({
    required this.module,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 3),
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
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: module.gradient),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(module.icon, color: Colors.white, size: 20),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: module.badgeBg,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      module.badge,
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: module.badgeColor,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                module.eyebrow,
                style: const TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF94A3B8),
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                module.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: Text(
                  module.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
