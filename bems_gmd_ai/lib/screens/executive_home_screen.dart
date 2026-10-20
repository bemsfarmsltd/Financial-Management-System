import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme/bems_theme.dart';
import 'voice_orb_screen.dart';
import 'executive_chat_screen.dart';

class ExecutiveHomeScreen extends StatelessWidget {
  final String userName;
  final String businessName;

  const ExecutiveHomeScreen({
    super.key,
    this.userName = 'Dr Pastra',
    this.businessName = 'BEMS Group',
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: BemsTheme.backgroundRadial,
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
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
                            border: Border.all(color: BemsTheme.primaryLight, width: 1.5),
                            gradient: BemsTheme.amberGradient,
                            boxShadow: [
                              BoxShadow(
                                color: BemsTheme.primary.withOpacity(0.4),
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
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              businessName,
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: BemsTheme.textPrimary),
                            ),
                            Text(
                              'Welcome back, $userName',
                              style: const TextStyle(fontSize: 11, color: BemsTheme.textMuted),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.history_rounded, color: BemsTheme.textSecondary),
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const ExecutiveChatScreen()),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // Main Hero Typography (Matching user's reference)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'What financial insight\ndo you need today?',
                      style: Theme.of(context).textTheme.displayLarge?.copyWith(
                            height: 1.15,
                            fontWeight: FontWeight.w800,
                          ),
                    ).animate().fadeIn(duration: 500.ms).slideY(begin: 0.1, end: 0),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // 4 Glowing Glassmorphic Feature Cards (Reference screen 1)
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _buildGlowingCard(
                            context,
                            icon: Icons.account_balance_rounded,
                            title: 'Treasury & Cash',
                            subtitle: '₦84.2M across Access & Zenith',
                            badge: '2 Accounts Live',
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const ExecutiveChatScreen(initialPrompt: 'What is our total cash balance across bank accounts?'),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: _buildGlowingCard(
                            context,
                            icon: Icons.verified_user_rounded,
                            title: 'Pending Approvals',
                            subtitle: '0 items awaiting GMD review',
                            badge: 'Queue Clear',
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const ExecutiveChatScreen(initialPrompt: 'Are there any fund requests pending my approval?'),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: _buildGlowingCard(
                            context,
                            icon: Icons.assignment_turned_in_rounded,
                            title: 'Audit & Advances',
                            subtitle: '72h accountability closure',
                            badge: '100% Compliant',
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const ExecutiveChatScreen(initialPrompt: 'Who has open accountability advances?'),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: _buildGlowingCard(
                            context,
                            icon: Icons.dashboard_customize_rounded,
                            title: 'Morning Briefing',
                            subtitle: 'Executive Group Scorecard',
                            badge: 'Grounded Live',
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const ExecutiveChatScreen(initialPrompt: 'Give me the morning executive briefing'),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Floating Bottom Prompt Bar (Matching reference)
              Container(
                margin: const EdgeInsets.all(20),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: BemsTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: BemsTheme.borderAmber, width: 1.2),
                  boxShadow: [
                    BoxShadow(
                      color: BemsTheme.primary.withOpacity(0.25),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Model Selector Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.auto_awesome_rounded, size: 13, color: BemsTheme.primaryLight),
                          SizedBox(width: 4),
                          Text(
                            'BEMS 2.5',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(width: 10),

                    // Tap to Ask text
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ExecutiveChatScreen()),
                          );
                        },
                        child: const Text(
                          'Ask AI a question or describe…',
                          style: TextStyle(color: BemsTheme.textMuted, fontSize: 13),
                        ),
                      ),
                    ),

                    // Glowing Amber Voice Mic Button (Opens Screen 2: Kinetic Orb)
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          PageRouteBuilder(
                            pageBuilder: (_, __, ___) => const VoiceOrbScreen(),
                            transitionsBuilder: (_, animation, __, child) => FadeTransition(opacity: animation, child: child),
                          ),
                        );
                      },
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: BemsTheme.amberGradient,
                          boxShadow: [
                            BoxShadow(
                              color: BemsTheme.primary.withOpacity(0.6),
                              blurRadius: 16,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.mic_rounded, color: Colors.white, size: 22),
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

  Widget _buildGlowingCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required String badge,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 145,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: BemsTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: BemsTheme.borderAmber, width: 1.1),
          boxShadow: [
            BoxShadow(
              color: BemsTheme.primary.withOpacity(0.08),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: BemsTheme.primaryLight, size: 22),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: BemsTheme.primary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    badge,
                    style: const TextStyle(color: BemsTheme.primaryLight, fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: BemsTheme.textPrimary),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: BemsTheme.textMuted, height: 1.25),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
