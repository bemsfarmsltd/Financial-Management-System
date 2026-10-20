import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../widgets/kinetic_molten_orb.dart';
import '../widgets/dynamic_streaming_text.dart';
import 'executive_chat_screen.dart';

class VoiceOrbScreen extends StatefulWidget {
  const VoiceOrbScreen({super.key});

  @override
  State<VoiceOrbScreen> createState() => _VoiceOrbScreenState();
}

class _VoiceOrbScreenState extends State<VoiceOrbScreen> with SingleTickerProviderStateMixin {
  bool _isListening = true;
  bool _isSpeaking = false;
  int _sampleIndex = 0;
  String _selectedPersona = 'Arya';
  final List<String> _personas = ['Arya (Executive)', 'Nova (Analytical)', 'Atlas (Tactical)'];

  late AnimationController _waveformController;

  final List<String> _samplePrompts = [
    'What is our total liquid cash reserve across Access Bank and Zenith Bank right now?',
    'Give me the morning executive briefing on pending approvals and 72-hour accountability cases.',
    'Deploy an autonomous AI agent to monitor liquidity pools across our accounts.',
    'Are there any unauthorized expenditure requests awaiting my GMD sign-off?',
  ];

  @override
  void initState() {
    super.initState();
    _waveformController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _waveformController.dispose();
    super.dispose();
  }

  void _toggleVoiceState() {
    setState(() {
      if (_isListening) {
        _isListening = false;
        _isSpeaking = true;
      } else if (_isSpeaking) {
        _isSpeaking = false;
        _isListening = true;
      } else {
        _isListening = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentPrompt = _samplePrompts[_sampleIndex];

    return Scaffold(
      backgroundColor: const Color(0xFF04060C),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.15),
            radius: 1.25,
            colors: [
              Color(0xFF381404), // Warm molten fiery core glow
              Color(0xFF140803), // Mid amber obsidian
              Color(0xFF04060C), // Deep black void
            ],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Top Bar: Persona pill + Centered "✕ Close chat"
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Persona Switcher Pill
                    PopupMenuButton<String>(
                      initialValue: _selectedPersona,
                      color: const Color(0xFF140803),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: const Color(0xFFF97316).withOpacity(0.3)),
                      ),
                      onSelected: (val) {
                        setState(() {
                          _selectedPersona = val.split(' ').first;
                        });
                      },
                      itemBuilder: (context) => _personas
                          .map(
                            (p) => PopupMenuItem(
                              value: p,
                              child: Text(
                                p,
                                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            ),
                          )
                          .toList(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withOpacity(0.1)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Color(0xFFF97316),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _selectedPersona,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.arrow_drop_down, color: Colors.white60, size: 16),
                          ],
                        ),
                      ),
                    ),

                    // Close chat pill
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: Colors.white.withOpacity(0.12)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.close_rounded, size: 14, color: Colors.white70),
                            SizedBox(width: 6),
                            Text(
                              'Close chat',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Centerpiece: The 3D Radiant Molten Orb with touch response
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      KineticMoltenOrb(
                        size: 220,
                        isListening: _isListening,
                        isSpeaking: _isSpeaking,
                        onTap: _toggleVoiceState,
                      ),
                      const SizedBox(height: 18),
                      // Audio Waveform frequency bars
                      _buildAudioWaveform(),
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _isSpeaking ? const Color(0xFFFED7AA) : const Color(0xFFF97316),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFF97316).withOpacity(0.8),
                                  blurRadius: 6,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isListening
                                ? '$_selectedPersona is listening…'
                                : (_isSpeaking ? '$_selectedPersona is speaking…' : 'Tap mic to speak'),
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.7),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Dynamic Streaming Spoken Words
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 36),
                child: GestureDetector(
                  onTap: () {
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
                      color: Colors.white,
                      height: 1.4,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // Bottom Radiant Controls: Left switcher, Center Glowing Mic, Right Send
              Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Left Mode Button: Next Sample Prompt
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.06),
                      ),
                      child: IconButton(
                        icon: const Icon(Icons.refresh_rounded, color: Colors.white60, size: 20),
                        tooltip: 'Next question',
                        onPressed: () {
                          setState(() {
                            _sampleIndex = (_sampleIndex + 1) % _samplePrompts.length;
                          });
                        },
                      ),
                    ),

                    // Center Giant Radiant Glowing Mic Button
                    GestureDetector(
                      onTap: () {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ExecutiveChatScreen(initialPrompt: currentPrompt),
                          ),
                        );
                      },
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [Color(0xFFF97316), Color(0xFFEA580C)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFEA580C).withOpacity(0.8),
                              blurRadius: 28,
                              spreadRadius: 4,
                            ),
                            BoxShadow(
                              color: const Color(0xFFF97316).withOpacity(0.45),
                              blurRadius: 44,
                              spreadRadius: 8,
                            ),
                          ],
                        ),
                        child: Icon(
                          _isListening ? Icons.mic_rounded : Icons.graphic_eq_rounded,
                          color: Colors.white,
                          size: 34,
                        ),
                      ),
                    ),

                    // Right Send / Action Button: Transfer to Chat
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.06),
                      ),
                      child: IconButton(
                        icon: const Icon(Icons.near_me_rounded, color: Color(0xFFF97316), size: 20),
                        tooltip: 'Send to AI Chat',
                        onPressed: () {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ExecutiveChatScreen(initialPrompt: currentPrompt),
                            ),
                          );
                        },
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

  Widget _buildAudioWaveform() {
    return AnimatedBuilder(
      animation: _waveformController,
      builder: (context, child) {
        final animVal = _waveformController.value;
        const barCount = 19;

        return SizedBox(
          height: 24,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(barCount, (i) {
              final offset = (i / barCount) * 2 * math.pi;
              final heightFactor = (_isListening || _isSpeaking)
                  ? 0.25 + 0.75 * math.sin(animVal * 2 * math.pi + offset).abs()
                  : 0.15;
              final barHeight = 4.0 + (heightFactor * 18.0);

              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 2),
                width: 3,
                height: barHeight,
                decoration: BoxDecoration(
                  color: Color.lerp(
                    const Color(0xFFEA580C),
                    const Color(0xFFFED7AA),
                    heightFactor,
                  )!.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(2),
                ),
              );
            }),
          ),
        );
      },
    );
  }
}
