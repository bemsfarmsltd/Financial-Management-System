import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/staff_models.dart';
import '../services/staff_storage_service.dart';
import 'staff_main_screen.dart';
import 'staff_onboarding_carousel_screen.dart';
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

                    // Interactive App Journey Guide Pill
                    InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const StaffOnboardingCarouselScreen(isReplay: true),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFFFF7ED), Color(0xFFFEF3C7)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFED7AA)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.view_carousel_rounded, color: Color(0xFFEA580C), size: 18),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'View Interactive 4-Slide Feature Guide',
                                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF9A3412)),
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded, color: Color(0xFFEA580C), size: 18),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 18),

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
        eyebrow: 'FINANCIAL MANAGEMENT',
        title: 'Finance & Fund Hub',
        description: 'Requisitions, 72h cash advance retirement, and spend analytics.',
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
        eyebrow: 'PEOPLE & CULTURE',
        title: 'HR & People Hub',
        description: 'Geofence clock-in, daily shift roster, payslips, and helpdesk chat.',
        badgeText: 'HR ACTIVE',
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

      // 3. Operations & Logistics Hub
      _ModuleItem(
        id: 'operations',
        eyebrow: 'SUPPLY CHAIN & FLEET',
        title: 'Operations & Fleet',
        description: 'Fleet transport dispatches, vehicle fuel logs, and warehouse manifests.',
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
                  title: 'Operations & Fleet Logistics',
                  subtitle: 'Transport, Fleet & Warehouse Management',
                  description: 'Track fleet vehicle dispatches, logistics waybills, and warehouse goods receipts across BEMS Group facilities.',
                  icon: Icons.local_shipping_rounded,
                  gradientColors: [Color(0xFF059669), Color(0xFF047857)],
                  statusText: 'Fleet Ready',
                  quickActions: [
                    {'title': 'Log Vehicle Dispatch', 'desc': 'Record vehicle departure and trip odometer', 'icon': Icons.directions_car_rounded, 'color': Color(0xFF059669)},
                    {'title': 'Warehouse Waybill Receipt', 'desc': 'Confirm incoming delivery manifest', 'icon': Icons.inventory_2_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Equipment Maintenance Request', 'desc': 'Report faulty plant machinery or vehicle', 'icon': Icons.build_rounded, 'color': Color(0xFFD97706)},
                  ],
                  metricCards: [
                    {'label': 'ACTIVE FLEET', 'value': '14 Units', 'sub': '100% Operational'},
                    {'label': 'DISPATCHES TODAY', 'value': '6 Trips', 'sub': 'On Schedule'},
                  ],
                  sampleTasks: [
                    {'task': 'Waybill WB-2026-081 Verified', 'details': 'Delivered to BEMS Central Warehouse', 'time': '09:45 AM'},
                    {'task': 'Vehicle Truck-04 Fuel Logged', 'details': 'Diesel top-up approved', 'time': '08:20 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 4. Agribusiness & Farm Hub
      _ModuleItem(
        id: 'agri',
        eyebrow: 'FARM ENTERPRISE',
        title: 'Agribusiness & Farm',
        description: 'Cultivation plots, crop harvests, feed stock, and livestock tracking.',
        badgeText: 'HARVEST SEASON',
        badgeColor: const Color(0xFF16A34A),
        icon: Icons.agriculture_rounded,
        gradient: [const Color(0xFF16A34A), const Color(0xFF15803D)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'agribusiness',
                  eyebrow: 'AGRIBUSINESS & PLANTATIONS',
                  title: 'Agribusiness & Farm Operations',
                  subtitle: 'Cultivation, Feeds, Irrigation & Livestock',
                  description: 'Manage crop growth cycles, daily feed allocations, irrigation pumps, and harvest weighbridge tallies.',
                  icon: Icons.agriculture_rounded,
                  gradientColors: [Color(0xFF16A34A), Color(0xFF15803D)],
                  statusText: 'Farm Online',
                  quickActions: [
                    {'title': 'Log Daily Feed Consumption', 'desc': 'Record bags distributed per livestock unit', 'icon': Icons.egg_rounded, 'color': Color(0xFF16A34A)},
                    {'title': 'Weighbridge Harvest Intake', 'desc': 'Record fresh crop metric tons logged', 'icon': Icons.scale_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Irrigation & Pump Status', 'desc': 'Report pump maintenance or fuel hours', 'icon': Icons.water_drop_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'ACTIVE ACRES', 'value': '250 Ha', 'sub': 'Cultivated'},
                    {'label': 'TODAYS YIELD', 'value': '4.8 Tons', 'sub': 'Processed'},
                  ],
                  sampleTasks: [
                    {'task': 'Block C Maize Inspection Done', 'details': 'Soil moisture within target threshold', 'time': '10:15 AM'},
                    {'task': 'Poultry Section 2 Feed Dispatched', 'details': '40 bags distributed', 'time': '07:30 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 5. Projects & Production Hub
      _ModuleItem(
        id: 'production',
        eyebrow: 'MANUFACTURING',
        title: 'Projects & Plant',
        description: 'Factory lines, batch processing, packaging logs, and work orders.',
        badgeText: 'PLANT ACTIVE',
        badgeColor: const Color(0xFF7C3AED),
        icon: Icons.precision_manufacturing_rounded,
        gradient: [const Color(0xFF7C3AED), const Color(0xFF6D28D9)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'production',
                  eyebrow: 'PRODUCTION & INDUSTRIAL PLANT',
                  title: 'Projects & Production Hub',
                  subtitle: 'Processing Lines, Batches & Quality Assurance',
                  description: 'Monitor factory batch production, material input conversion ratios, and final packaging quality assurance.',
                  icon: Icons.precision_manufacturing_rounded,
                  gradientColors: [Color(0xFF7C3AED), Color(0xFF6D28D9)],
                  statusText: 'Line 1 Running',
                  quickActions: [
                    {'title': 'Log Batch Production', 'desc': 'Submit batch code, start time & output units', 'icon': Icons.factory_rounded, 'color': Color(0xFF7C3AED)},
                    {'title': 'Quality Assurance Pass', 'desc': 'Inspect finished goods for standards', 'icon': Icons.fact_check_rounded, 'color': Color(0xFF10B981)},
                    {'title': 'Report Machine Downtime', 'desc': 'Alert maintenance technicians immediately', 'icon': Icons.warning_amber_rounded, 'color': Color(0xFFDC2626)},
                  ],
                  metricCards: [
                    {'label': 'OUTPUT TODAY', 'value': '1,240 Pks', 'sub': '98.5% Efficiency'},
                    {'label': 'ACTIVE LINES', 'value': '2 of 2', 'sub': 'Full Capacity'},
                  ],
                  sampleTasks: [
                    {'task': 'Batch BATCH-2026-44 Completed', 'details': 'QA inspection passed', 'time': '11:00 AM'},
                    {'task': 'Packaging Conveyor Sanitized', 'details': 'Shift cleaning sign-off', 'time': '06:45 AM'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 6. Innovation & Systems Hub
      _ModuleItem(
        id: 'innovation',
        eyebrow: 'TECH & AUTOMATION',
        title: 'Innovation & Systems',
        description: 'BEMS AI automation, ERP workflows, digital tools, and IT support.',
        badgeText: 'AI POWERED',
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
                  subtitle: 'AI Tools, ERP Integrations & Tech Helpdesk',
                  description: 'Access BEMS Group digital tools, automated n8n workflows, system logs, and corporate IT support channels.',
                  icon: Icons.auto_awesome_rounded,
                  gradientColors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                  statusText: 'All Systems Up',
                  quickActions: [
                    {'title': 'Log IT Support Ticket', 'desc': 'Report hardware, network or ERP issues', 'icon': Icons.support_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'AI Assistant Diagnostics', 'desc': 'Check bot notifications & SLA status', 'icon': Icons.psychology_rounded, 'color': Color(0xFF7C3AED)},
                    {'title': 'Digital Systems Directory', 'desc': 'View single sign-on app endpoints', 'icon': Icons.apps_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'UPTIME', 'value': '99.98%', 'sub': 'Hosting Normal'},
                    {'label': 'AI AUTOMATIONS', 'value': '12 Flows', 'sub': 'Active n8n'},
                  ],
                  sampleTasks: [
                    {'task': 'Database Backup Completed', 'details': 'Automated Supabase sync', 'time': '04:00 AM'},
                    {'task': 'Mobile Version Gate 1.3.0 Live', 'details': 'Enforced for all staff', 'time': 'Yesterday'},
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
        eyebrow: 'COMMERCIAL DESK',
        title: 'Sales & Commercial',
        description: 'Wholesale clients, order dispatches, sales proformas, and receipts.',
        badgeText: 'COMMERCIAL',
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
                  subtitle: 'Distributor Orders, Invoicing & Field Receipts',
                  description: 'Record customer purchases, issue official sales waybills, and track wholesale distributor payment reconciliations.',
                  icon: Icons.point_of_sale_rounded,
                  gradientColors: [Color(0xFFE11D48), Color(0xFFBE123C)],
                  statusText: 'Desk Open',
                  quickActions: [
                    {'title': 'Create Sales Order', 'desc': 'Book wholesale farm produce or products', 'icon': Icons.receipt_rounded, 'color': Color(0xFFE11D48)},
                    {'title': 'Customer Account Lookup', 'desc': 'Verify distributor credit limits & history', 'icon': Icons.badge_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Issue Sales Delivery Receipt', 'desc': 'Generate dispatch clearance for customer truck', 'icon': Icons.check_circle_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'TODAYS SALES', 'value': '₦1.45M', 'sub': '+12% vs Target'},
                    {'label': 'ORDERS BOOKED', 'value': '8 Invoices', 'sub': 'Dispatched'},
                  ],
                  sampleTasks: [
                    {'task': 'Distributor Order INV-984 Cleared', 'details': '₦850,000 confirmed paid', 'time': '11:45 AM'},
                    {'task': 'Waybill Signed by Driver', 'details': 'Customer: Sunrise Mart Ltd', 'time': '09:10 AM'},
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
        eyebrow: 'GOVERNANCE & AUDIT',
        title: 'Risk & Audit Hub',
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
                  subtitle: '72h SLA Tracking, Compliance & Integrity',
                  description: 'Review corporate spending accountability compliance, 3-way matching verifications, and audit log histories.',
                  icon: Icons.gavel_rounded,
                  gradientColors: [Color(0xFF475569), Color(0xFF334155)],
                  statusText: '100% Compliant',
                  quickActions: [
                    {'title': 'View 72h SLA Scorecard', 'desc': 'Review your retirement compliance rate', 'icon': Icons.timer_rounded, 'color': Color(0xFF059669)},
                    {'title': '3-Way Match Verification Logs', 'desc': 'Audit PO vs GRN vs Vendor Invoices', 'icon': Icons.rule_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Report Compliance Irregularity', 'desc': 'Confidential whistleblowing channel', 'icon': Icons.shield_rounded, 'color': Color(0xFFDC2626)},
                  ],
                  metricCards: [
                    {'label': 'SLA GRADE', 'value': 'Tier 1', 'sub': '100% On-Time'},
                    {'label': 'OPEN RETIREMENTS', 'value': '0 Cases', 'sub': 'All Retired'},
                  ],
                  sampleTasks: [
                    {'task': 'Quarterly Audit Check Passed', 'details': 'Zero unretired advances logged', 'time': 'Nov 1'},
                    {'task': 'Dual-Key Payment Verification Clean', 'details': 'All payouts matched to GMD approval', 'time': 'Nov 3'},
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
