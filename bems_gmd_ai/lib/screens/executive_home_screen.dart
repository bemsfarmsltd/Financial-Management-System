import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/auth_models.dart';
import '../services/chat_storage_service.dart';
import '../widgets/chat_history_drawer.dart';
import 'voice_orb_screen.dart';
import 'executive_chat_screen.dart';

class ExecutiveHomeScreen extends StatefulWidget {
  final String userName;
  final String businessName;

  const ExecutiveHomeScreen({
    super.key,
    this.userName = 'Executive',
    this.businessName = 'BEMS Group',
  });

  @override
  State<ExecutiveHomeScreen> createState() => _ExecutiveHomeScreenState();
}

class _ExecutiveHomeScreenState extends State<ExecutiveHomeScreen> {
  final GlobalKey<ScaffoldState> _homeScaffoldKey = GlobalKey<ScaffoldState>();
  AuthUser? _authUser;
  String _selectedModel = 'BEMS 2.5';
  final List<String> _models = ['BEMS 2.5', 'Opus 4.8', 'Claude 3.7', 'GPT-4o'];

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final u = await ChatStorageService.getUser();
    if (mounted && u != null) {
      setState(() => _authUser = u);
    }
  }

  final List<Map<String, String>> _suggestionCards = [
    {
      'title': 'Deploy autonomous AI agent',
      'subtitle': 'Monitor group bank liquidity & cash reserves',
      'prompt': 'Deploy an autonomous AI agent to monitor liquidity pools across Access & Zenith banks.',
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
      backgroundColor: const Color(0xFF04060C),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.4),
            radius: 1.3,
            colors: [
              Color(0xFF381404), // Warm molten fiery backlight
              Color(0xFF140803), // Deep burnt amber transition
              Color(0xFF04060C), // Edge pitch obsidian void
            ],
            stops: [0.0, 0.45, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Bar with Monogram, Welcome, Search & Menu (Matching Screenshot 1)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFF97316).withOpacity(0.6), width: 1.5),
                            gradient: const LinearGradient(
                              colors: [Color(0xFFEA580C), Color(0xFF9A3412)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFEA580C).withOpacity(0.4),
                                blurRadius: 10,
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Text(
                              'BG',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Colors.white),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.businessName,
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.white),
                            ),
                            Text(
                              'Welcome back, $effectiveUserName',
                              style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.6)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        // Search button
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withOpacity(0.06),
                          ),
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            icon: const Icon(Icons.search_rounded, color: Colors.white70, size: 18),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const ExecutiveChatScreen()),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Menu / History button (Opens Chat History Drawer)
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withOpacity(0.06),
                          ),
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            icon: const Icon(Icons.segment_rounded, color: Colors.white70, size: 20),
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

              const SizedBox(height: 24),

              // Giant Hero Typography (Matching user's reference exactly)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'What are we\nbuilding today?',
                      style: Theme.of(context).textTheme.displayLarge?.copyWith(
                            fontSize: 34,
                            height: 1.12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.6,
                            color: Colors.white,
                          ),
                    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.08, end: 0),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Suggestion Cards Row (Horizontal swipe matching reference)
              SizedBox(
                height: 120,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
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

              const SizedBox(height: 18),

              // Large Rounded Input Card (Matching Screenshot 1)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ExecutiveChatScreen()),
                    );
                  },
                  child: Container(
                    height: 160,
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF101726).withOpacity(0.65),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.25), width: 1.2),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFEA580C).withOpacity(0.12),
                          blurRadius: 24,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Ask AI a question or describe your idea…',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.45),
                            fontSize: 15,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.06),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.auto_awesome_rounded, size: 12, color: Color(0xFFF97316)),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Grounded in Live DB',
                                    style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.6)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const Spacer(),

              // Floating Bottom Bar with Model Pill & Radiant Glowing Mic (Matching Screenshot 1)
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Model Selector Pill (e.g., "Opus 4.8 ▾" / "BEMS 2.5 ▾")
                    PopupMenuButton<String>(
                      initialValue: _selectedModel,
                      onSelected: (model) {
                        setState(() => _selectedModel = model);
                      },
                      color: const Color(0xFF141F33),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      itemBuilder: (context) => _models.map((m) => PopupMenuItem(
                        value: m,
                        child: Text(m, style: const TextStyle(color: Colors.white, fontSize: 13)),
                      )).toList(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.white.withOpacity(0.12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.graphic_eq_rounded, size: 16, color: Color(0xFFF97316)),
                            const SizedBox(width: 8),
                            Text(
                              _selectedModel,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Colors.white60),
                          ],
                        ),
                      ),
                    ),

                    // Radiant Glowing Circular Orange Mic Button (Opens Voice Orb Screen 2)
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
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [Color(0xFFF97316), Color(0xFFEA580C)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFEA580C).withOpacity(0.7),
                              blurRadius: 20,
                              spreadRadius: 3,
                              offset: const Offset(0, 4),
                            ),
                            BoxShadow(
                              color: const Color(0xFFF97316).withOpacity(0.4),
                              blurRadius: 36,
                              spreadRadius: 6,
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
        ),
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
        width: 170,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF101726).withOpacity(0.75),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.3), width: 1.1),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFEA580C).withOpacity(0.08),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Icon(Icons.star_rounded, color: Color(0xFFF97316), size: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Colors.white, height: 1.2),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.5)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
