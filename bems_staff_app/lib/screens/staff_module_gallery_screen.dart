import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/staff_models.dart';
import '../services/staff_storage_service.dart';
import 'staff_main_screen.dart';
import 'staff_login_screen.dart';
import 'staff_admin_chat_screen.dart';
import 'modules/staff_hr_hub_screen.dart';
import 'modules/staff_module_workstation_screen.dart';

class StaffModuleGalleryScreen extends StatefulWidget {
  final StaffUser user;

  const StaffModuleGalleryScreen({super.key, required this.user});

  @override
  State<StaffModuleGalleryScreen> createState() => _StaffModuleGalleryScreenState();
}

class _StaffModuleGalleryScreenState extends State<StaffModuleGalleryScreen> {
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out of BEMS', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('Are you sure you want to log out of your corporate session?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await StaffStorageService.clearUser();
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const StaffLoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final modules = _getEnterpriseModules(widget.user);
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
            // Corporate Executive Header
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Bar: Brand + Avatar + Logout
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEA580C),
                                borderRadius: BorderRadius.circular(12),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFEA580C).withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: Image.asset(
                                  'assets/images/bems-mark.png',
                                  width: 22,
                                  height: 22,
                                  errorBuilder: (_, __, ___) => const Icon(Icons.business_rounded, color: Colors.white, size: 20),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'BEMS GROUP',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.1,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                Text(
                                  widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'Conglomerate Portal',
                                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF2563EB), size: 22),
                              tooltip: 'Admin Helpdesk',
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => StaffAdminChatScreen(currentUser: widget.user)),
                                );
                              },
                            ),
                            IconButton(
                              icon: const Icon(Icons.logout_rounded, color: Color(0xFF64748B), size: 22),
                              tooltip: 'Sign Out',
                              onPressed: _handleLogout,
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // User Welcome Card
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
                          CircleAvatar(
                            radius: 24,
                            backgroundColor: const Color(0xFFEA580C).withOpacity(0.12),
                            backgroundImage: widget.user.avatarUrl.isNotEmpty ? NetworkImage(widget.user.avatarUrl) : null,
                            child: widget.user.avatarUrl.isEmpty
                                ? Text(
                                    widget.user.fullName.isNotEmpty ? widget.user.fullName[0].toUpperCase() : 'S',
                                    style: const TextStyle(color: Color(0xFFEA580C), fontWeight: FontWeight.w900, fontSize: 18),
                                  )
                                : null,
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
                                        widget.user.fullName,
                                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(Icons.verified_rounded, size: 14, color: Color(0xFFEA580C)),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${widget.user.employeeNumber} · ${widget.user.department}',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEA580C).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFFED7AA)),
                            ),
                            child: const Text('STAFF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Search input
                    TextField(
                      controller: _searchController,
                      onChanged: (v) => setState(() => _searchQuery = v),
                      style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        hintText: 'Search enterprise workstations & modules...',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF94A3B8)),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Color(0xFFEA580C), width: 1.5),
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Section Eyebrow
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Corporate Workstations',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          '${filtered.length} Modules',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Enterprise Modules Grid (2 Columns)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  childAspectRatio: 0.86,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final m = filtered[index];
                    return _buildModuleCard(m);
                  },
                  childCount: filtered.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModuleCard(_ModuleItem item) {
    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        item.onTap(context);
      },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(14),
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon + Status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: item.gradient, begin: Alignment.topLeft, end: Alignment.bottomRight),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(color: item.gradient.first.withOpacity(0.3), blurRadius: 6, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Icon(item.icon, color: Colors.white, size: 20),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: item.badgeColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    item.badgeText,
                    style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: item.badgeColor),
                  ),
                ),
              ],
            ),

            const Spacer(),

            // Eyebrow
            Text(
              item.eyebrow,
              style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: item.gradient.first, letterSpacing: 0.6),
            ),
            const SizedBox(height: 3),

            // Title
            Text(
              item.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 4),

            // Description
            Text(
              item.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), height: 1.3),
            ),

            const SizedBox(height: 8),

            // Enter CTA
            Row(
              children: [
                Text(
                  'Enter Hub',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: item.gradient.first),
                ),
                const SizedBox(width: 3),
                Icon(Icons.arrow_forward_rounded, size: 12, color: item.gradient.first),
              ],
            ),
          ],
        ),
      ),
    );
  }

  List<_ModuleItem> _getEnterpriseModules(StaffUser user) {
    return [
      // 1. Finance & Fund Hub (Universal Core Workstation)
      _ModuleItem(
        id: 'finance',
        eyebrow: 'FINANCIAL MANAGEMENT',
        title: 'Finance & Fund Hub',
        description: 'Requisitions, 72h cash advance retirement, proformas, and spend analytics.',
        badgeText: 'CORE HUB',
        badgeColor: const Color(0xFFEA580C),
        icon: Icons.account_balance_wallet_rounded,
        gradient: [const Color(0xFFEA580C), const Color(0xFFC2410C)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(builder: (_) => StaffMainScreen(user: user, fromGallery: true)),
          );
        },
      ),

      // 2. HR & People Hub (Universal Attendance & Personnel)
      _ModuleItem(
        id: 'hr',
        eyebrow: 'PEOPLE & CULTURE',
        title: 'HR & People Hub',
        description: 'Geofence clock-in, daily shift rosters, payslips, and HR helpdesk.',
        badgeText: 'ACTIVE',
        badgeColor: const Color(0xFF2563EB),
        icon: Icons.people_alt_rounded,
        gradient: [const Color(0xFF2563EB), const Color(0xFF1D4ED8)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(builder: (_) => StaffHRHubScreen(user: user)),
          );
        },
      ),

      // 3. Operations & Logistics Hub (Universal Supply & Assets)
      _ModuleItem(
        id: 'operations',
        eyebrow: 'OPERATIONS & ASSETS',
        title: 'Operations & Logistics',
        description: 'Operational task flows, fleet transport, inventory, and facility maintenance.',
        badgeText: 'ONLINE',
        badgeColor: const Color(0xFF059669),
        icon: Icons.local_shipping_rounded,
        gradient: [const Color(0xFF059669), const Color(0xFF047857)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'operations',
                  eyebrow: 'OPERATIONS & LOGISTICS WORKSTATION',
                  title: 'Operations & Logistics Hub',
                  subtitle: 'Operational Task Flows, Fleet & Asset Logistics',
                  description: 'Track operations workflows, vehicle dispatches, logistics manifests, and facility asset maintenance across all corporate units.',
                  icon: Icons.local_shipping_rounded,
                  gradientColors: [Color(0xFF059669), Color(0xFF047857)],
                  statusText: 'Operations Normal',
                  quickActions: [
                    {'title': 'Log Operational Dispatch', 'desc': 'Record transport departure and trip logs', 'icon': Icons.directions_car_rounded, 'color': Color(0xFF059669)},
                    {'title': 'Waybill & Manifest Receipt', 'desc': 'Confirm incoming delivery manifests and materials', 'icon': Icons.inventory_2_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Facility Maintenance Request', 'desc': 'Report plant, equipment, or office repairs', 'icon': Icons.build_rounded, 'color': Color(0xFFD97706)},
                  ],
                  metricCards: [
                    {'label': 'OPERATIONAL UNITS', 'value': '100% Active', 'sub': 'All Systems Ready'},
                    {'label': 'DISPATCHES TODAY', 'value': 'On Schedule', 'sub': 'Routine Routes'},
                  ],
                  sampleTasks: [
                    {'task': 'Logistics Manifest WB-2026-081 Cleared', 'details': 'Delivered to corporate facility', 'time': '09:45 AM'},
                    {'task': 'Operational Fleet Inspection Completed', 'details': 'Vehicle safety check sign-off', 'time': '08:20 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 4. Procurement & Vendor Desk (Universal 3-Way Matching & PO)
      _ModuleItem(
        id: 'procurement',
        eyebrow: 'PROCUREMENT & SUPPLY',
        title: 'Procurement & Vendors',
        description: 'Purchase orders, goods receipt notes (GRN), and 3-way matching clearance.',
        badgeText: 'DESK OPEN',
        badgeColor: const Color(0xFF0D9488),
        icon: Icons.shopping_bag_rounded,
        gradient: [const Color(0xFF0D9488), const Color(0xFF0F766E)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'procurement',
                  eyebrow: 'PROCUREMENT & VENDOR DESK',
                  title: 'Procurement & Vendor Desk',
                  subtitle: 'Purchase Orders, GRN & 3-Way Matching',
                  description: 'Manage vetted vendor directories, generate purchase orders, log goods received notes (GRN), and clear automated 3-way matching.',
                  icon: Icons.shopping_bag_rounded,
                  gradientColors: [Color(0xFF0D9488), Color(0xFF0F766E)],
                  statusText: 'Vendors Verified',
                  quickActions: [
                    {'title': 'Create Purchase Order', 'desc': 'Issue official procurement orders to vetted suppliers', 'icon': Icons.receipt_long_rounded, 'color': Color(0xFF0D9488)},
                    {'title': 'Log Goods Received (GRN)', 'desc': 'Inspect and confirm incoming supplier shipments', 'icon': Icons.fact_check_rounded, 'color': Color(0xFF0284C7)},
                    {'title': '3-Way Match Verification', 'desc': 'Match purchase order vs delivery note vs invoice', 'icon': Icons.rule_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'VETTED VENDORS', 'value': 'Active Registry', 'sub': 'Compliance Verified'},
                    {'label': 'MATCHING ACCURACY', 'value': '100%', 'sub': 'Audit Cleared'},
                  ],
                  sampleTasks: [
                    {'task': 'Purchase Order PO-2026-114 Approved', 'details': 'Dispatched to verified supplier', 'time': '10:15 AM'},
                    {'task': 'Goods Received Note GRN-882 Signed', 'details': 'Items inspected against PO specs', 'time': '07:30 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 5. Projects & Deliverables Hub (Universal Cross-Subsidiary Milestones)
      _ModuleItem(
        id: 'projects',
        eyebrow: 'PROJECTS & DELIVERY',
        title: 'Projects & Deliverables',
        description: 'Cross-subsidiary project milestones, deliverables, and work orders.',
        badgeText: 'ON TRACK',
        badgeColor: const Color(0xFF7C3AED),
        icon: Icons.assignment_turned_in_rounded,
        gradient: [const Color(0xFF7C3AED), const Color(0xFF6D28D9)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'projects',
                  eyebrow: 'STRATEGIC PROJECTS & EXECUTION',
                  title: 'Projects & Deliverables Hub',
                  subtitle: 'Milestones, Work Orders & Performance Deliverables',
                  description: 'Track strategic cross-subsidiary initiatives, assign operational work orders, and log milestone deliverables against approved budgets.',
                  icon: Icons.assignment_turned_in_rounded,
                  gradientColors: [Color(0xFF7C3AED), Color(0xFF6D28D9)],
                  statusText: 'Deliverables Active',
                  quickActions: [
                    {'title': 'Log Milestone Deliverable', 'desc': 'Submit completed milestone deliverable for sign-off', 'icon': Icons.task_alt_rounded, 'color': Color(0xFF7C3AED)},
                    {'title': 'Work Order Tracker', 'desc': 'Monitor team operational task assignments & deadlines', 'icon': Icons.checklist_rounded, 'color': Color(0xFF10B981)},
                    {'title': 'Quality Standards Check', 'desc': 'Inspect work order outputs against corporate benchmarks', 'icon': Icons.verified_user_rounded, 'color': Color(0xFF0284C7)},
                  ],
                  metricCards: [
                    {'label': 'ACTIVE MILESTONES', 'value': '8 Milestones', 'sub': 'Execution Phase'},
                    {'label': 'ON-TIME RATE', 'value': '98.5%', 'sub': 'Within Schedule'},
                  ],
                  sampleTasks: [
                    {'task': 'Phase 2 Milestone Deliverable Signed Off', 'details': 'Executive verification completed', 'time': '11:00 AM'},
                    {'task': 'Operational Work Order Assigned', 'details': 'Allocated to subsidiary task team', 'time': '08:30 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 6. Innovation & Digital Systems Hub (Universal AI & IT Systems)
      _ModuleItem(
        id: 'innovation',
        eyebrow: 'TECH & AUTOMATION',
        title: 'Innovation & Systems',
        description: 'BEMS AI automations, ERP workflows, digital tools, and IT support.',
        badgeText: 'AI CONNECTED',
        badgeColor: const Color(0xFF0284C7),
        icon: Icons.auto_awesome_rounded,
        gradient: [const Color(0xFF0284C7), const Color(0xFF0369A1)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'innovation',
                  eyebrow: 'INNOVATION & DIGITAL WORKSPACE',
                  title: 'Innovation & Systems Hub',
                  subtitle: 'AI Tools, ERP Workflows & Tech Helpdesk',
                  description: 'Access BEMS Group digital workflows, automated notification bridges, system health logs, and corporate IT support channels.',
                  icon: Icons.auto_awesome_rounded,
                  gradientColors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                  statusText: 'All Systems Up',
                  quickActions: [
                    {'title': 'Log IT Support Ticket', 'desc': 'Report hardware, network or ERP issues', 'icon': Icons.support_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'AI Automation Diagnostics', 'desc': 'Check notification bot bridges and workflow SLAs', 'icon': Icons.psychology_rounded, 'color': Color(0xFF7C3AED)},
                    {'title': 'Digital Systems Directory', 'desc': 'Single sign-on corporate tools & dashboards', 'icon': Icons.apps_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'SYSTEM UPTIME', 'value': '99.98%', 'sub': 'All Services Healthy'},
                    {'label': 'AI AUTOMATIONS', 'value': '12 Flows', 'sub': 'Active Automated Bridges'},
                  ],
                  sampleTasks: [
                    {'task': 'Database Backup Synchronized', 'details': 'Automated backup snapshot healthy', 'time': '04:00 AM'},
                    {'task': 'Mobile App Version Gate Verified', 'details': 'Enforced across all subsidiaries', 'time': 'Yesterday'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 7. Sales & Commercial Hub (Universal Revenue & Billing)
      _ModuleItem(
        id: 'sales',
        eyebrow: 'COMMERCIAL DESK',
        title: 'Sales & Commercial',
        description: 'Client invoicing, order fulfillment, customer accounts, and receipts.',
        badgeText: 'ACTIVE',
        badgeColor: const Color(0xFFE11D48),
        icon: Icons.point_of_sale_rounded,
        gradient: [const Color(0xFFE11D48), const Color(0xFFBE123C)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'sales',
                  eyebrow: 'SALES & COMMERCIAL DESK',
                  title: 'Sales & Commercial Hub',
                  subtitle: 'Client Invoicing, Order Dispatch & Account Settlement',
                  description: 'Record customer sales, issue commercial delivery notes, manage wholesale customer credit terms, and reconcile settlements.',
                  icon: Icons.point_of_sale_rounded,
                  gradientColors: [Color(0xFFE11D48), Color(0xFFBE123C)],
                  statusText: 'Commercial Open',
                  quickActions: [
                    {'title': 'Create Commercial Invoice', 'desc': 'Issue sales orders across subsidiary product lines', 'icon': Icons.receipt_rounded, 'color': Color(0xFFE11D48)},
                    {'title': 'Customer Account Lookup', 'desc': 'Verify customer credit limits & payment terms', 'icon': Icons.badge_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Issue Delivery Clearance', 'desc': 'Generate official sales dispatch and gate pass', 'icon': Icons.check_circle_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'ORDER FULFILLMENT', 'value': 'Active', 'sub': 'Processing Orders'},
                    {'label': 'INVOICES BOOKED', 'value': 'Up to Date', 'sub': 'Reconciled Ledger'},
                  ],
                  sampleTasks: [
                    {'task': 'Commercial Invoice INV-2026-984 Cleared', 'details': 'Customer payment verified', 'time': '11:45 AM'},
                    {'task': 'Delivery Clearance Handed to Dispatch', 'details': 'Approved for fulfillment', 'time': '09:10 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 8. Risk & Internal Audit Hub (Universal Governance & 72h SLA)
      _ModuleItem(
        id: 'risk',
        eyebrow: 'GOVERNANCE & AUDIT',
        title: 'Risk & Internal Audit',
        description: '72h SLA compliance scorecard, internal controls, and audit trails.',
        badgeText: '100% SLA',
        badgeColor: const Color(0xFF475569),
        icon: Icons.gavel_rounded,
        gradient: [const Color(0xFF475569), const Color(0xFF334155)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'risk',
                  eyebrow: 'RISK MANAGEMENT & AUDIT CONTROL',
                  title: 'Risk & Internal Audit Hub',
                  subtitle: '72h SLA Tracking, Compliance & Integrity Governance',
                  description: 'Review corporate spending accountability compliance, 3-way matching audit trails, and multi-subsidiary governance logs.',
                  icon: Icons.gavel_rounded,
                  gradientColors: [Color(0xFF475569), Color(0xFF334155)],
                  statusText: '100% Compliant',
                  quickActions: [
                    {'title': 'View 72h SLA Scorecard', 'desc': 'Review your advance retirement compliance rate', 'icon': Icons.timer_rounded, 'color': Color(0xFF059669)},
                    {'title': 'Audit Trail Verification', 'desc': 'Audit transaction approvals and disbursement matching', 'icon': Icons.rule_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Report Compliance Issue', 'desc': 'Confidential internal control communication', 'icon': Icons.shield_rounded, 'color': Color(0xFFDC2626)},
                  ],
                  metricCards: [
                    {'label': 'SLA GRADE', 'value': 'Tier 1', 'sub': '100% On-Time Retirement'},
                    {'label': 'AUDIT STATUS', 'value': 'Compliant', 'sub': 'Zero Flagged Exceptions'},
                  ],
                  sampleTasks: [
                    {'task': 'Corporate Audit Review Completed', 'details': 'Zero unretired advances logged', 'time': 'Nov 1'},
                    {'task': 'Dual-Key Payment Match Confirmed', 'details': 'Matched to GMD executive approval', 'time': 'Nov 3'},
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ];
  }
}

class _ModuleItem {
  final String id;
  final String eyebrow;
  final String title;
  final String description;
  final String badgeText;
  final Color badgeColor;
  final IconData icon;
  final List<Color> gradient;
  final void Function(BuildContext) onTap;

  const _ModuleItem({
    required this.id,
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.badgeText,
    required this.badgeColor,
    required this.icon,
    required this.gradient,
    required this.onTap,
  });
}
