import 'package:flutter/material.dart';
import '../theme/bems_theme.dart';
import '../widgets/kinetic_molten_orb.dart';
import '../widgets/dynamic_streaming_text.dart';
import 'executive_chat_screen.dart';

class VoiceOrbScreen extends StatefulWidget {
  const VoiceOrbScreen({super.key});

  @override
  State<VoiceOrbScreen> createState() => _VoiceOrbScreenState();
}

class _VoiceOrbScreenState extends State<VoiceOrbScreen> {
  final bool _isListening = true;
  int _sampleIndex = 0;

  final List<String> _samplePrompts = [
    'What is our total liquid cash reserve across Access Bank and Zenith Bank right now?',
    'Give me the morning executive briefing on pending approvals and 72-hour accountability cases.',
    'Are there any unauthorized expenditure requests awaiting my GMD sign-off?',
    'Summarize this month\'s expenditure run-rate across BEMS Group subsidiaries.',
  ];

  @override
  Widget build(BuildContext context) {
    final currentPrompt = _samplePrompts[_sampleIndex];

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.2),
            radius: 1.2,
            colors: [
              Color(0xFF2E1005), // Warm molten ambient center
              Color(0xFF0B1220), // Deep obsidian void
              Color(0xFF050811), // Edge black
            ],
            stops: [0.0, 0.65, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Top Close Bar (Matching reference Screen 2)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withOpacity(0.12)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.close_rounded, size: 14, color: BemsTheme.textSecondary),
                            SizedBox(width: 6),
                            Text(
                              'Close voice session',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BemsTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Centerpiece: The 3D Radiant Molten Orb
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      KineticMoltenOrb(
                        size: 200,
                        isListening: _isListening,
                        isSpeaking: !_isListening,
                      ),
                      const SizedBox(height: 24),
                      Text(
                        _isListening ? 'BEMS AI is listening…' : 'Processing neural ledger query…',
                        style: const TextStyle(
                          color: BemsTheme.primaryLight,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Dynamic Streaming Spoken Words (Matching reference Screen 2)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: GestureDetector(
                  onTap: () {
                    // Tap to cycle through executive voice queries
                    setState(() {
                      _sampleIndex = (_sampleIndex + 1) % _samplePrompts.length;
                    });
                  },
                  child: DynamicStreamingText(
                    key: ValueKey(currentPrompt),
                    text: currentPrompt,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: BemsTheme.textPrimary,
                      height: 1.4,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 36),

              // Bottom Radiant Glowing Mic & Controls (Matching reference)
              Padding(
                padding: const EdgeInsets.only(bottom: 28),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Switch Query button
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded, color: BemsTheme.textSecondary),
                      onPressed: () {
                        setState(() {
                          _sampleIndex = (_sampleIndex + 1) % _samplePrompts.length;
                        });
                      },
                    ),

                    const SizedBox(width: 24),

                    // Center Glowing Mic with Radiant Aura
                    GestureDetector(
                      onTap: () {
                        // Send query to Executive Chat Screen
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ExecutiveChatScreen(initialPrompt: currentPrompt),
                          ),
                        );
                      },
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: BemsTheme.amberGradient,
                          boxShadow: [
                            BoxShadow(
                              color: BemsTheme.primary.withOpacity(0.7),
                              blurRadius: 30,
                              spreadRadius: 6,
                            ),
                            BoxShadow(
                              color: BemsTheme.primaryLight.withOpacity(0.4),
                              blurRadius: 50,
                              spreadRadius: 12,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.mic_rounded, color: Colors.white, size: 36),
                      ),
                    ),

                    const SizedBox(width: 24),

                    // Send Directly to Chat Button
                    IconButton(
                      icon: const Icon(Icons.arrow_forward_rounded, color: BemsTheme.primaryLight),
                      onPressed: () {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ExecutiveChatScreen(initialPrompt: currentPrompt),
                          ),
                        );
                      },
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
}
