import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/staff_models.dart';
import '../theme/subsidiary_theme.dart';
import 'staff_main_screen.dart';
import 'staff_admin_chat_screen.dart';
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
                            const SubsidiaryLogoBadge(size: 40, borderRadius: 12),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  (widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'Staff Workspace').toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.6,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                Text(
                                  widget.user.department.isNotEmpty ? widget.user.department : 'Staff Portal',
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
                          StaffAvatar(
                            avatarUrl: widget.user.avatarUrl,
                            fullName: widget.user.fullName,
                            radius: 24,
                            accentColor: SubsidiaryTheme.current.color,
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
                                    Icon(Icons.verified_rounded, size: 14, color: SubsidiaryTheme.current.color),
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
                              color: SubsidiaryTheme.current.color.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFFED7AA)),
                            ),
                            child: Text('STAFF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: SubsidiaryTheme.current.color)),
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
                        hintText: 'Search enterprise management systems...',
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
                          borderSide: BorderSide(color: SubsidiaryTheme.current.color, width: 1.5),
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Section Eyebrow
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Enterprise Management Systems',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          '${filtered.length} Systems',
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
      // 1. Financial Management System
      _ModuleItem(
        id: 'finance',
        eyebrow: 'FINANCIAL MANAGEMENT',
        title: 'Financial Management System',
        description: 'Budgeting, fund requisitions, approvals, treasury, disbursements, and expenditure retirement.',
        badgeText: 'ACTIVE',
        badgeColor: const Color(0xFF059669),
        icon: Icons.account_balance_wallet_rounded,
        gradient: [SubsidiaryTheme.current.color, const Color(0xFFC2410C)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(builder: (_) => StaffMainScreen(user: user, fromGallery: true)),
          );
        },
      ),

      // 2. Project Management System
      _ModuleItem(
        id: 'projects',
        eyebrow: 'PROJECT EXECUTION',
        title: 'Project Management System',
        description: 'Project tracking, milestone execution, deliverables, and capital expenditure oversight.',
        badgeText: 'PIPELINE',
        badgeColor: const Color(0xFF64748B),
        icon: Icons.assignment_turned_in_rounded,
        gradient: [const Color(0xFF0284C7), const Color(0xFF0369A1)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: ModuleConfig(
                  id: 'projects',
                  eyebrow: 'PROJECT EXECUTION',
                  title: 'Project Management System',
                  subtitle: 'Milestones, Deliverables & Capital Oversight',
                  description: 'Project tracking, milestone execution, deliverables, and capital expenditure oversight across ${widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'your organization'}.',
                  icon: Icons.assignment_turned_in_rounded,
                  gradientColors: const [Color(0xFF0284C7), Color(0xFF0369A1)],
                  statusText: 'Pipeline (Phase 2)',
                  quickActions: const [
                    {'title': 'Milestone Deliverables', 'desc': 'Track milestone progress and deliverables', 'icon': Icons.task_alt_rounded, 'color': Color(0xFF0284C7)},
                    {'title': 'Task Execution', 'desc': 'Monitor team work packages and deadlines', 'icon': Icons.checklist_rounded, 'color': Color(0xFF10B981)},
                  ],
                  metricCards: [
                    {'label': 'STATUS', 'value': 'Pipeline', 'sub': 'Phase 2 Development'},
                    {'label': 'SCOPE', 'value': 'Group-wide', 'sub': 'Capital Projects'},
                  ],
                  sampleTasks: [
                    {'task': 'Project Milestone Framework', 'details': 'In active design', 'time': 'Phase 2'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 3. Human Resource Management System
      _ModuleItem(
        id: 'hr',
        eyebrow: 'HUMAN CAPITAL',
        title: 'Human Resource Management System',
        description: 'Staff directory, employee records, attendance monitoring, and workplace administration.',
        badgeText: 'PIPELINE',
        badgeColor: const Color(0xFF64748B),
        icon: Icons.people_alt_rounded,
        gradient: [const Color(0xFF6366F1), const Color(0xFF4F46E5)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: ModuleConfig(
                  id: 'hr',
                  eyebrow: 'HUMAN CAPITAL',
                  title: 'Human Resource Management System',
                  subtitle: 'Staff Directory, Records & Administration',
                  description: 'Staff directory, employee records, attendance monitoring, and workplace administration for ${widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'your organization'}.',
                  icon: Icons.people_alt_rounded,
                  gradientColors: const [Color(0xFF6366F1), Color(0xFF4F46E5)],
                  statusText: 'Pipeline (Phase 2)',
                  quickActions: const [
                    {'title': 'Staff Directory', 'desc': 'View corporate personnel across subsidiaries', 'icon': Icons.badge_rounded, 'color': Color(0xFF6366F1)},
                    {'title': 'Leave Administration', 'desc': 'Submit and track leave requests', 'icon': Icons.event_available_rounded, 'color': Color(0xFF059669)},
                  ],
                  metricCards: [
                    {'label': 'STATUS', 'value': 'Pipeline', 'sub': 'Phase 2 Development'},
                    {'label': 'EMPLOYEES', 'value': 'Synchronized', 'sub': 'Active Directory'},
                  ],
                  sampleTasks: [
                    {'task': 'HR Self-Service Architecture', 'details': 'In active design', 'time': 'Phase 2'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 4. Operations Management System
      _ModuleItem(
        id: 'operations',
        eyebrow: 'FIELD OPERATIONS',
        title: 'Operations Management System',
        description: 'Field operations coordination, fleet management, logistics tracking, and facility oversight.',
        badgeText: 'PIPELINE',
        badgeColor: const Color(0xFF64748B),
        icon: Icons.local_shipping_rounded,
        gradient: [const Color(0xFF059669), const Color(0xFF047857)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: ModuleConfig(
                  id: 'operations',
                  eyebrow: 'FIELD OPERATIONS',
                  title: 'Operations Management System',
                  subtitle: 'Fleet, Logistics & Field Oversight',
                  description: 'Field operations coordination, fleet management, logistics tracking, and facility oversight for ${widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'your organization'}.',
                  icon: Icons.local_shipping_rounded,
                  gradientColors: const [Color(0xFF059669), Color(0xFF047857)],
                  statusText: 'Pipeline (Phase 2)',
                  quickActions: const [
                    {'title': 'Daily Operations Log', 'desc': 'Record field activities and shift handovers', 'icon': Icons.assignment_rounded, 'color': Color(0xFF059669)},
                    {'title': 'Fleet & Logistics', 'desc': 'Track vehicle transit and facility maintenance', 'icon': Icons.local_shipping_rounded, 'color': Color(0xFF0284C7)},
                  ],
                  metricCards: [
                    {'label': 'STATUS', 'value': 'Pipeline', 'sub': 'Phase 2 Development'},
                    {'label': 'FACILITIES', 'value': 'Multi-site', 'sub': 'Field Hubs'},
                  ],
                  sampleTasks: [
                    {'task': 'Fleet Operations Protocol', 'details': 'In active design', 'time': 'Phase 2'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 5. Media Management System
      _ModuleItem(
        id: 'media',
        eyebrow: 'MEDIA & CREATIVE',
        title: 'Media Management System',
        description: 'Media production workflows, studio scheduling, creative deliverables, and digital media archives.',
        badgeText: 'PIPELINE',
        badgeColor: const Color(0xFF64748B),
        icon: Icons.videocam_rounded,
        gradient: [const Color(0xFFDB2777), const Color(0xFFBE185D)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'media',
                  eyebrow: 'MEDIA & CREATIVE',
                  title: 'Media Management System',
                  subtitle: 'Studio Arella Media Production & Archives',
                  description: 'Media production workflows, studio scheduling, creative deliverables, and digital media archives.',
                  icon: Icons.videocam_rounded,
                  gradientColors: [Color(0xFFDB2777), Color(0xFFBE185D)],
                  statusText: 'Pipeline (Phase 2)',
                  quickActions: [
                    {'title': 'Studio Production Schedule', 'desc': 'Manage studio shoot calendar and bookings', 'icon': Icons.video_library_rounded, 'color': Color(0xFFDB2777)},
                    {'title': 'Digital Creative Assets', 'desc': 'Access photography and broadcast archives', 'icon': Icons.perm_media_rounded, 'color': Color(0xFF7C3AED)},
                  ],
                  metricCards: [
                    {'label': 'STATUS', 'value': 'Pipeline', 'sub': 'Phase 2 Development'},
                    {'label': 'SUBSIDIARY', 'value': 'Studio Arella', 'sub': 'Creative Agency'},
                  ],
                  sampleTasks: [
                    {'task': 'Studio Shoot Pipeline', 'details': 'In active design', 'time': 'Phase 2'},
                  ],
                ),
              ),
            ),
          );
        },
      ),

      // 6. Innovation Management System
      _ModuleItem(
        id: 'innovation',
        eyebrow: 'TECHNOLOGY & R&D',
        title: 'Innovation Management System',
        description: 'Proprietary software technologies, digital platforms, system architecture, and technology R&D.',
        badgeText: 'PIPELINE',
        badgeColor: const Color(0xFF64748B),
        icon: Icons.code_rounded,
        gradient: [const Color(0xFF0891B2), const Color(0xFF0E7490)],
        onTap: (ctx) {
          Navigator.push(
            ctx,
            MaterialPageRoute(
              builder: (_) => StaffModuleWorkstationScreen(
                user: user,
                config: const ModuleConfig(
                  id: 'innovation',
                  eyebrow: 'TECHNOLOGY & R&D',
                  title: 'Innovation Management System',
                  subtitle: 'Proprietary Platforms & Digital Systems',
                  description: 'Proprietary software technologies, digital platforms, system architecture, and technology R&D.',
                  icon: Icons.code_rounded,
                  gradientColors: [Color(0xFF0891B2), Color(0xFF0E7490)],
                  statusText: 'Pipeline (Phase 2)',
                  quickActions: [
                    {'title': 'SmartAIRS Platform', 'desc': 'State revenue automation and field terminals', 'icon': Icons.terminal_rounded, 'color': Color(0xFF0891B2)},
                    {'title': 'Software Architecture', 'desc': 'Cloud services and core ERP infrastructure', 'icon': Icons.code_rounded, 'color': Color(0xFF7C3AED)},
                  ],
                  metricCards: [
                    {'label': 'STATUS', 'value': 'Pipeline', 'sub': 'Phase 2 Development'},
                    {'label': 'TECH SUBSIDIARY', 'value': 'BemsSoft Hub', 'sub': 'Enterprise Systems'},
                  ],
                  sampleTasks: [
                    {'task': 'Cloud Infrastructure Framework', 'details': 'In active design', 'time': 'Phase 2'},
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
