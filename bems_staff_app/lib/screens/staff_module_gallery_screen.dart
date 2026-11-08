import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/staff_models.dart';
import 'staff_main_screen.dart';
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
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.04),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: Image.asset(
                                  'assets/images/bems-mark.png',
                                  width: 24,
                                  height: 24,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, __, ___) => const Icon(Icons.business_rounded, color: Color(0xFFEA580C), size: 20),
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
      // 1. Finance & Fund Hub
      _ModuleItem(
        id: 'finance',
        eyebrow: 'GROUP FINANCIAL MANAGEMENT',
        title: 'Finance & Fund Hub',
        description: 'Requisitions, 72h advance retirements, expenditure approvals, and spend analytics.',
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

      // 2. HR & People Hub
      _ModuleItem(
        id: 'hr',
        eyebrow: 'HUMAN CAPITAL & TALENT',
        title: 'HR & People Hub',
        description: 'Attendance clock-in, leave administration, monthly payroll payslips, and HR helpdesk.',
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

      // 3. Operations Hub
      _ModuleItem(
        id: 'operations',
        eyebrow: 'ENTERPRISE OPERATIONS',
        title: 'Operations Hub',
        description: 'Daily operational workflows, asset management, facility oversight, and logistics.',
        badgeText: 'ONLINE',
        badgeColor: const Color(0xFF059669),
        icon: Icons.hub_rounded,
        gradient: [const Color(0xFF059669), const Color(0xFF047857)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'operations',
                  eyebrow: 'ENTERPRISE OPERATIONS WORKSTATION',
                  title: 'Enterprise Operations Hub',
                  subtitle: 'Daily Operational Workflows, Assets & Facilities',
                  description: 'Coordinate daily operational activity, oversee physical and technical assets, manage facility work orders, and log operational shift handovers across BEMS Group businesses.',
                  icon: Icons.hub_rounded,
                  gradientColors: [Color(0xFF059669), Color(0xFF047857)],
                  statusText: 'Operations Normal',
                  quickActions: [
                    {'title': 'Log Operational Activity', 'desc': 'Record daily departmental tasks and shift execution', 'icon': Icons.assignment_rounded, 'color': Color(0xFF059669)},
                    {'title': 'Facility & Asset Maintenance', 'desc': 'Submit repair and maintenance service requests', 'icon': Icons.build_circle_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Operational Shift Handover', 'desc': 'File routine activity reports and shift status updates', 'icon': Icons.sync_alt_rounded, 'color': Color(0xFFD97706)},
                  ],
                  metricCards: [
                    {'label': 'OPERATIONAL STATUS', 'value': '100% Ready', 'sub': 'All Facilities Online'},
                    {'label': 'WORK ORDERS', 'value': 'Active', 'sub': 'Standard Cadence'},
                  ],
                  sampleTasks: [
                    {'task': 'Operational Shift Handover Logged', 'details': 'Verified and countersigned', 'time': '09:45 AM'},
                    {'task': 'Facility Asset Inspection Completed', 'details': 'Quarterly infrastructure review', 'time': '08:20 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 4. Procurement Desk
      _ModuleItem(
        id: 'procurement',
        eyebrow: 'PROCUREMENT & VENDORS',
        title: 'Procurement Desk',
        description: 'Vendor registry, purchase orders, material & service intake, and 3-way matching.',
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
                  eyebrow: 'GROUP PROCUREMENT & SUPPLY',
                  title: 'Procurement Desk',
                  subtitle: 'Vendor Registry, Purchase Orders & 3-Way Matching',
                  description: 'Administer corporate vendor directories, issue approved purchase orders, confirm goods and services intake (GRN), and ensure 3-way matching before financial disbursements.',
                  icon: Icons.shopping_bag_rounded,
                  gradientColors: [Color(0xFF0D9488), Color(0xFF0F766E)],
                  statusText: 'Registry Verified',
                  quickActions: [
                    {'title': 'Create Purchase Order (PO)', 'desc': 'Issue procurement requisitions to accredited suppliers', 'icon': Icons.receipt_long_rounded, 'color': Color(0xFF0D9488)},
                    {'title': 'Goods & Services Intake (GRN)', 'desc': 'Inspect and confirm incoming vendor deliveries or services', 'icon': Icons.fact_check_rounded, 'color': Color(0xFF0284C7)},
                    {'title': '3-Way Match Verification', 'desc': 'Audit PO against delivery note and vendor invoice', 'icon': Icons.rule_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'VETTED VENDORS', 'value': 'Accredited', 'sub': 'Compliance Cleared'},
                    {'label': 'MATCHING ACCURACY', 'value': '100%', 'sub': 'Zero Discrepancies'},
                  ],
                  sampleTasks: [
                    {'task': 'Corporate PO-2026-114 Approved', 'details': 'Issued to verified vendor', 'time': '10:15 AM'},
                    {'task': 'Service Acceptance Signed Off', 'details': 'Deliverables verified against contract', 'time': '07:30 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 5. Projects Hub
      _ModuleItem(
        id: 'projects',
        eyebrow: 'STRATEGY & EXECUTION',
        title: 'Projects Hub',
        description: 'Cross-functional initiatives, project milestones, deliverable sign-offs, and tasks.',
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
                  title: 'Projects Hub',
                  subtitle: 'Initiatives, Deliverables & Milestone Tracking',
                  description: 'Track strategic multi-sector initiatives, monitor project sprints and site milestones, assign work packages, and sign off deliverables against approved group timelines.',
                  icon: Icons.assignment_turned_in_rounded,
                  gradientColors: [Color(0xFF7C3AED), Color(0xFF6D28D9)],
                  statusText: 'Projects Active',
                  quickActions: [
                    {'title': 'Submit Milestone Deliverable', 'desc': 'Log completed milestone deliverables for sign-off', 'icon': Icons.task_alt_rounded, 'color': Color(0xFF7C3AED)},
                    {'title': 'Project Task Assignments', 'desc': 'Assign work packages and track deadline execution', 'icon': Icons.checklist_rounded, 'color': Color(0xFF10B981)},
                    {'title': 'Quality & Scope Sign-Off', 'desc': 'Review project deliverables against benchmark criteria', 'icon': Icons.verified_user_rounded, 'color': Color(0xFF0284C7)},
                  ],
                  metricCards: [
                    {'label': 'ACTIVE INITIATIVES', 'value': 'On Schedule', 'sub': 'Execution Phase'},
                    {'label': 'DELIVERABLE SLA', 'value': '98.5%', 'sub': 'On-Time Sign-Off'},
                  ],
                  sampleTasks: [
                    {'task': 'Strategic Milestone Deliverable Submitted', 'details': 'Pending executive sign-off', 'time': '11:00 AM'},
                    {'task': 'Work Package Assigned to Project Team', 'details': 'Timeline and scope documented', 'time': '08:30 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 6. Innovation Hub
      _ModuleItem(
        id: 'innovation',
        eyebrow: 'R&D & DIGITAL SYSTEMS',
        title: 'Innovation Hub',
        description: 'Product R&D, proprietary platforms (Smartairs & software), and digital systems.',
        badgeText: 'PLATFORMS UP',
        badgeColor: const Color(0xFF0284C7),
        icon: Icons.lightbulb_rounded,
        gradient: [const Color(0xFF0284C7), const Color(0xFF0369A1)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'innovation',
                  eyebrow: 'INNOVATION & DIGITAL PLATFORMS',
                  title: 'Innovation Hub',
                  subtitle: 'Product R&D, Smartairs & Proprietary Systems',
                  description: 'Drive new product development and engineering, oversee proprietary digital solutions like Smartairs (Revenue Management System), champion process innovation, and manage enterprise technology infrastructure.',
                  icon: Icons.lightbulb_rounded,
                  gradientColors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                  statusText: 'Systems Healthy',
                  quickActions: [
                    {'title': 'Smartairs & System Operations', 'desc': 'Access proprietary revenue & digital management systems', 'icon': Icons.analytics_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Propose Innovation / R&D Initiative', 'desc': 'Submit new product concepts, workflows & solutions', 'icon': Icons.auto_awesome_rounded, 'color': Color(0xFF7C3AED)},
                    {'title': 'Log Technology Support Request', 'desc': 'Report technical, software or platform infrastructure needs', 'icon': Icons.support_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'DIGITAL PLATFORMS', 'value': 'Online', 'sub': 'Smartairs & Core Systems'},
                    {'label': 'R&D INITIATIVES', 'value': 'Active', 'sub': 'Product Pipeline'},
                  ],
                  sampleTasks: [
                    {'task': 'Smartairs Revenue Gateway Check', 'details': 'Transaction streaming online', 'time': '04:00 AM'},
                    {'task': 'System Security & Backup Synchronized', 'details': 'Infrastructure check healthy', 'time': 'Yesterday'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 7. Sales & Commercial Hub
      _ModuleItem(
        id: 'sales',
        eyebrow: 'COMMERCIAL & REVENUE',
        title: 'Sales & Commercial Hub',
        description: 'Client billing, contracts, customer accounts, and revenue collection.',
        badgeText: 'ACTIVE',
        badgeColor: const Color(0xFFE11D48),
        icon: Icons.trending_up_rounded,
        gradient: [const Color(0xFFE11D48), const Color(0xFFBE123C)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'sales',
                  eyebrow: 'COMMERCIAL & REVENUE MANAGEMENT',
                  title: 'Sales & Commercial Hub',
                  subtitle: 'Client Contracts, Billing & Revenue Collection',
                  description: 'Manage client relationships, generate commercial invoices and service billings across subsidiaries, track contract payment terms, and reconcile revenue collections.',
                  icon: Icons.trending_up_rounded,
                  gradientColors: [Color(0xFFE11D48), Color(0xFFBE123C)],
                  statusText: 'Commercial Open',
                  quickActions: [
                    {'title': 'Create Client Invoice / Billing', 'desc': 'Generate billing vouchers across subsidiary services & products', 'icon': Icons.receipt_rounded, 'color': Color(0xFFE11D48)},
                    {'title': 'Customer Account Ledger', 'desc': 'Review client payment schedules, balances & contract terms', 'icon': Icons.badge_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Issue Service / Delivery Clearance', 'desc': 'Authorize client fulfillment, release notes or service sign-offs', 'icon': Icons.check_circle_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'REVENUE PIPELINE', 'value': 'Healthy', 'sub': 'Contract Reconciliations'},
                    {'label': 'SETTLEMENT STATUS', 'value': 'Current', 'sub': 'Ledger Verified'},
                  ],
                  sampleTasks: [
                    {'task': 'Commercial Billing Clearance Issued', 'details': 'Client settlement verified', 'time': '11:45 AM'},
                    {'task': 'Contract Fulfillment Sign-off Completed', 'details': 'Handed to operational team', 'time': '09:10 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 8. Risk & Internal Audit Hub
      _ModuleItem(
        id: 'risk',
        eyebrow: 'GOVERNANCE & CONTROLS',
        title: 'Risk & Internal Audit Hub',
        description: 'Corporate governance, 72h SLA financial compliance, internal audit, and policy controls.',
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
                  eyebrow: 'RISK MANAGEMENT & INTERNAL AUDIT',
                  title: 'Risk & Internal Audit Hub',
                  subtitle: '72h SLA Governance, Compliance & Internal Controls',
                  description: 'Enforce group financial governance, monitor 72h advance retirement SLAs, audit multi-subsidiary transaction controls, and uphold corporate compliance standards.',
                  icon: Icons.gavel_rounded,
                  gradientColors: [Color(0xFF475569), Color(0xFF334155)],
                  statusText: '100% Compliant',
                  quickActions: [
                    {'title': 'View 72h SLA Scorecard', 'desc': 'Review advance retirement compliance rate & deadlines', 'icon': Icons.timer_rounded, 'color': Color(0xFF059669)},
                    {'title': 'Audit Trail & Verification Logs', 'desc': 'Audit approvals, disbursement matches & corporate vouchers', 'icon': Icons.rule_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Report Compliance / Governance Issue', 'desc': 'Confidential internal control & whistleblowing channel', 'icon': Icons.shield_rounded, 'color': Color(0xFFDC2626)},
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
