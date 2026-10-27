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
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
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
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: Color(0xFFE2E8F0)),
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
                              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ),
                        )
                        .toList(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x060F172A),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFFEA580C),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _selectedPersona,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.arrow_drop_down, color: Color(0xFF64748B), size: 16),
                        ],
                      ),
                    ),
                  ),

                  // Close chat pill
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x060F172A),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.close_rounded, size: 14, color: Color(0xFF64748B)),
                          SizedBox(width: 6),
                          Text(
                            'Close',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
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
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x060F172A),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _isSpeaking ? const Color(0xFF059669) : const Color(0xFFEA580C),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isListening
                                ? '$_selectedPersona is listening…'
                                : (_isSpeaking ? '$_selectedPersona is speaking…' : 'Tap orb to activate'),
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Dynamic Streaming Spoken Words
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x060F172A),
                      blurRadius: 14,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
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
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                      height: 1.4,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Bottom Controls
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Next prompt button
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x060F172A), blurRadius: 8, offset: Offset(0, 2)),
                      ],
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569), size: 22),
                      tooltip: 'Next question',
                      onPressed: () {
                        setState(() {
                          _sampleIndex = (_sampleIndex + 1) % _samplePrompts.length;
                        });
                      },
                    ),
                  ),

                  // Giant Mic Button
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
                      width: 70,
                      height: 70,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Color(0xFFFB923C), Color(0xFFEA580C)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x35EA580C),
                            blurRadius: 20,
                            offset: Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Icon(
                        _isListening ? Icons.mic_rounded : Icons.graphic_eq_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                  ),

                  // Send to AI chat
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x060F172A), blurRadius: 8, offset: Offset(0, 2)),
                      ],
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.near_me_rounded, color: Color(0xFFEA580C), size: 20),
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
                    const Color(0xFFF97316),
                    heightFactor,
                  )!.withOpacity(0.9),
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
