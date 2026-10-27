import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/auth_models.dart';
import '../services/chat_storage_service.dart';
import '../widgets/chat_history_drawer.dart';
import 'voice_orb_screen.dart';
import 'executive_chat_screen.dart';
import 'executive_system_dashboard.dart';
import 'gmd_profile_screen.dart';
import '../widgets/biometric_setup_dialog.dart';

class ExecutiveHomeScreen extends StatefulWidget {
  final String userName;
  final String businessName;
  final String initialMode;
  final bool showBiometricPrompt;

  const ExecutiveHomeScreen({
    super.key,
    this.userName = 'Group Managing Director',
    this.businessName = 'BEMS Group · GMD Cockpit',
    this.initialMode = 'ai',
    this.showBiometricPrompt = false,
  });

  @override
  State<ExecutiveHomeScreen> createState() => _ExecutiveHomeScreenState();
}

class _ExecutiveHomeScreenState extends State<ExecutiveHomeScreen> {
  final GlobalKey<ScaffoldState> _homeScaffoldKey = GlobalKey<ScaffoldState>();
  AuthUser? _authUser;
  late final PageController _pageController;
  int _currentPage = 0;
  String _selectedModel = 'BEMi 2.5';
  final List<String> _models = ['BEMi 2.5', 'Opus 4.8', 'Claude 3.7', 'GPT-4o'];

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialMode == 'dashboard' ? 1 : 0;
    _pageController = PageController(initialPage: _currentPage);
    _loadUser();

    if (widget.showBiometricPrompt) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        final configured = await ChatStorageService.isBiometricConfigured();
        if (!configured && mounted) {
          BiometricSetupPromptDialog.show(context);
        }
      });
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _navigateToPage(int page) {
    if (_currentPage == page) return;
    _pageController.animateToPage(
      page,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOutCubic,
    );
  }

  Future<void> _loadUser() async {
    final u = await ChatStorageService.getUser();
    if (mounted && u != null) {
      setState(() => _authUser = u);
    }
  }

  final List<Map<String, String>> _suggestionCards = [
    {
      'title': 'Deploy autonomous BEMi agent',
      'subtitle': 'Monitor group bank liquidity & cash reserves',
      'prompt': 'Deploy an autonomous BEMi agent to monitor liquidity pools across Access & Zenith banks.',
    },
    {
      'title': 'Optimize cash reserves',
      'subtitle': '₦84.2M treasury balance across subsidiaries',
      'prompt': 'Optimize treasury cash reserves and show breakdown across Access and Zenith Bank.',
    },
    {
      'title': 'Audit approvals & 72h advances',
      'subtitle': 'Requisitions and mandatory retirement SLA',
      'prompt': 'Audit all pending approvals and check if any 72-hour cash advance retirements are overdue.',
    },
    {
      'title': 'Morning executive briefing',
      'subtitle': 'Group financial health & budget scorecard',
      'prompt': 'Give me the full morning executive briefing on group cash flow and department expenditures.',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final effectiveUserName = _authUser?.fullName ?? widget.userName;

    return Scaffold(
      key: _homeScaffoldKey,
      drawer: ChatHistoryDrawer(user: _authUser),
      backgroundColor: const Color(0xFFF8FAFC),
      body: PageView(
        controller: _pageController,
        physics: const BouncingScrollPhysics(),
        onPageChanged: (page) {
          setState(() => _currentPage = page);
        },
        children: [
          _buildAiCockpit(context, effectiveUserName),
          ExecutiveSystemDashboard(
            onOpenDrawer: () => _homeScaffoldKey.currentState?.openDrawer(),
            onSwitchToAi: () => _navigateToPage(0),
          ),
        ],
      ),
    );
  }

  Widget _buildAiCockpit(BuildContext context, String effectiveUserName) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Bar with Monogram, Welcome, Search & Menu
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                GestureDetector(
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const GmdProfileScreen()),
                    );
                    _loadUser();
                  },
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFFFED7AA), width: 1.5),
                          gradient: const LinearGradient(
                            colors: [Color(0xFFEA580C), Color(0xFFC2410C)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x1AEA580C),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Text(
                            'GMD',
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.white),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                widget.businessName,
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.arrow_forward_ios_rounded, size: 10, color: Color(0xFF94A3B8)),
                            ],
                          ),
                          Text(
                            'Welcome back, $effectiveUserName',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Row(
                  children: [
                    // Search button
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFF1F5F9),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: IconButton(
                        padding: EdgeInsets.zero,
                        icon: const Icon(Icons.search_rounded, color: Color(0xFF475569), size: 18),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ExecutiveChatScreen()),
                          );
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Menu / History button
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFF1F5F9),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: IconButton(
                        padding: EdgeInsets.zero,
                        icon: const Icon(Icons.segment_rounded, color: Color(0xFF475569), size: 20),
                        onPressed: () {
                          _homeScaffoldKey.currentState?.openDrawer();
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Mode Switcher Pill with Swipe & Click Transition
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Column(
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
                      // AI Copilot Option
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _navigateToPage(0),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            decoration: BoxDecoration(
                              color: _currentPage == 0 ? const Color(0xFFEA580C) : Colors.transparent,
                              borderRadius: BorderRadius.circular(24),
                              boxShadow: _currentPage == 0
                                  ? const [
                                      BoxShadow(
                                        color: Color(0x28EA580C),
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
                                  Icons.auto_awesome_rounded,
                                  size: 14,
                                  color: _currentPage == 0 ? Colors.white : const Color(0xFF64748B),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'BEMi Copilot',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: _currentPage == 0 ? FontWeight.w800 : FontWeight.w700,
                                    color: _currentPage == 0 ? Colors.white : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      // System Dashboard Option
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _navigateToPage(1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            decoration: BoxDecoration(
                              color: _currentPage == 1 ? const Color(0xFFEA580C) : Colors.transparent,
                              borderRadius: BorderRadius.circular(24),
                              boxShadow: _currentPage == 1
                                  ? const [
                                      BoxShadow(
                                        color: Color(0x28EA580C),
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
                                  Icons.dashboard_customize_rounded,
                                  size: 14,
                                  color: _currentPage == 1 ? Colors.white : const Color(0xFF64748B),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'System Dashboard',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: _currentPage == 1 ? FontWeight.w800 : FontWeight.w700,
                                    color: _currentPage == 1 ? Colors.white : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
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
            ),
          ),

          const Spacer(),

          // Hero Typography
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFED7AA)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.shield_outlined, size: 13, color: Color(0xFFEA580C)),
                            SizedBox(width: 5),
                            Text(
                              'GMD EXECUTIVE INTELLIGENCE',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'What are we\nstrategizing today?',
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(
                          fontSize: 32,
                          height: 1.15,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.6,
                          color: const Color(0xFF0F172A),
                        ),
                  ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.08, end: 0),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Suggestion Cards Row (Horizontal swipe)
            SizedBox(
              height: 124,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: _suggestionCards.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final card = _suggestionCards[index];
                  return _buildSuggestionBentoCard(
                    context,
                    title: card['title']!,
                    subtitle: card['subtitle']!,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ExecutiveChatScreen(initialPrompt: card['prompt']),
                        ),
                      );
                    },
                  );
                },
              ),
            ),

            const SizedBox(height: 16),

            // Large Rounded Input Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ExecutiveChatScreen()),
                  );
                },
                child: Container(
                  height: 140,
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x080F172A),
                        blurRadius: 18,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Ask BEMi a strategic question or instruct…',
                        style: TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.attach_file_rounded, size: 16, color: Color(0xFF64748B)),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.analytics_outlined, size: 16, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const Spacer(),

            // Floating Bottom Bar with Model Pill & Radiant Glowing Mic
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Model Selector Pill
                  PopupMenuButton<String>(
                    initialValue: _selectedModel,
                    onSelected: (model) {
                      setState(() => _selectedModel = model);
                    },
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    itemBuilder: (context) => _models.map((m) => PopupMenuItem(
                      value: m,
                      child: Text(m, style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600)),
                    )).toList(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x060F172A),
                            blurRadius: 10,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.graphic_eq_rounded, size: 16, color: Color(0xFFEA580C)),
                          const SizedBox(width: 8),
                          Text(
                            _selectedModel,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF64748B)),
                        ],
                      ),
                    ),
                  ),

                  // Circular Orange Mic Button
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        PageRouteBuilder(
                          pageBuilder: (_, __, ___) => const VoiceOrbScreen(),
                          transitionsBuilder: (_, animation, __, child) =>
                              FadeTransition(opacity: animation, child: child),
                        ),
                      );
                    },
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Color(0xFFFB923C), Color(0xFFEA580C)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x40EA580C),
                            blurRadius: 16,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.mic_rounded, color: Colors.white, size: 28),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
  }

  Widget _buildSuggestionBentoCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 175,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
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
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: const BoxDecoration(
                color: Color(0xFFFFF7ED),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.auto_awesome_rounded, color: Color(0xFFEA580C), size: 14),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF0F172A), height: 1.25),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
