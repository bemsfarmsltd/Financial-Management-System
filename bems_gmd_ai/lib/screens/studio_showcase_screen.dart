import 'package:flutter/material.dart';
import '../widgets/iphone_device_frame.dart';
import 'executive_home_screen.dart';
import 'voice_orb_screen.dart';
import 'executive_chat_screen.dart';

class StudioShowcaseScreen extends StatefulWidget {
  const StudioShowcaseScreen({super.key});

  @override
  State<StudioShowcaseScreen> createState() => _StudioShowcaseScreenState();
}

class _StudioShowcaseScreenState extends State<StudioShowcaseScreen> {
  int _activeViewIndex = 0; // 0: All 3 Studio Showcase, 1: Home, 2: Voice Orb, 3: Chat

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth > 950;

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          body: SafeArea(
            child: Column(
              children: [
                // Studio Header Navigation Bar
                _buildStudioTopBar(isDesktop),

                // Studio Canvas
                Expanded(
                  child: Center(
                    child: isDesktop && _activeViewIndex == 0
                        ? _buildThreePhoneStudio(constraints)
                        : _buildSinglePhoneFocus(constraints),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStudioTopBar(bool isDesktop) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [Color(0xFFEA580C), Color(0xFFC2410C)],
                  ),
                ),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 16),
              ),
              const SizedBox(width: 10),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BEMS GMD EXECUTIVE SUITE',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                  Text(
                    'BEMi Copilot · Unified Staff App Design System',
                    style: TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
          ),

          // View Selector Pills
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isDesktop)
                  _buildTabPill(0, '3-Phone Studio', Icons.view_carousel_rounded),
                _buildTabPill(1, '1. Home Hub', Icons.dashboard_rounded),
                _buildTabPill(2, '2. Voice Orb', Icons.graphic_eq_rounded),
                _buildTabPill(3, '3. Chat Stream', Icons.chat_bubble_outline_rounded),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabPill(int index, String label, IconData icon) {
    final isSelected = _activeViewIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _activeViewIndex = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEA580C) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color(0x20EA580C),
                    blurRadius: 8,
                    offset: Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 13,
              color: isSelected ? Colors.white : const Color(0xFF64748B),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 3-Phone Studio Showcase
  Widget _buildThreePhoneStudio(BoxConstraints constraints) {
    final double scale = (constraints.maxHeight / 850).clamp(0.72, 0.98);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Left Phone: Executive Home Screen
            _buildInteractivePhoneCard(
              title: '1. Executive Home',
              subtitle: 'Prompt bento cards & model selector',
              scale: scale,
              child: const ExecutiveHomeScreen(),
              onTap: () => setState(() => _activeViewIndex = 1),
            ),

            const SizedBox(width: 28),

            // Center Phone: 3D Kinetic Molten Orb Voice Mode
            _buildInteractivePhoneCard(
              title: '2. 3D Kinetic Voice Orb',
              subtitle: 'Real-time rotating plasma & dynamic words',
              scale: scale,
              child: const VoiceOrbScreen(),
              onTap: () => setState(() => _activeViewIndex = 2),
            ),

            const SizedBox(width: 28),

            // Right Phone: Executive Chat Stream
            _buildInteractivePhoneCard(
              title: '3. Executive Chat Desk',
              subtitle: 'Light stream with live DB action cards',
              scale: scale,
              child: const ExecutiveChatScreen(),
              onTap: () => setState(() => _activeViewIndex = 3),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInteractivePhoneCard({
    required String title,
    required String subtitle,
    required Widget child,
    required double scale,
    required VoidCallback onTap,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IPhoneDeviceFrame(
          scale: scale,
          child: child,
        ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(color: Color(0x060F172A), blurRadius: 6, offset: Offset(0, 2)),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.fullscreen_rounded, size: 14, color: Color(0xFFEA580C)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // Single Phone Focused Interaction
  Widget _buildSinglePhoneFocus(BoxConstraints constraints) {
    Widget activeScreen;
    switch (_activeViewIndex) {
      case 2:
        activeScreen = const VoiceOrbScreen();
        break;
      case 3:
        activeScreen = const ExecutiveChatScreen();
        break;
      case 1:
      default:
        activeScreen = const ExecutiveHomeScreen();
        break;
    }

    final double scale = (constraints.maxHeight / 830).clamp(0.75, 1.0);

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: IPhoneDeviceFrame(
          scale: scale,
          child: activeScreen,
        ),
      ),
    );
  }
}
