import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/staff_storage_service.dart';
import 'staff_login_screen.dart';

class _StaffOnboardingSlide {
  final String eyebrow;
  final String title;
  final String subtitle;
  final List<String> highlights;
  final IconData icon;
  final Color accentColor;
  final String localAsset;
  final String networkFallback;

  const _StaffOnboardingSlide({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.highlights,
    required this.icon,
    required this.accentColor,
    required this.localAsset,
    required this.networkFallback,
  });
}

class StaffOnboardingCarouselScreen extends StatefulWidget {
  final bool isReplay;
  final Widget? nextScreen;

  const StaffOnboardingCarouselScreen({
    super.key,
    this.isReplay = false,
    this.nextScreen,
  });

  @override
  State<StaffOnboardingCarouselScreen> createState() => _StaffOnboardingCarouselScreenState();
}

class _StaffOnboardingCarouselScreenState extends State<StaffOnboardingCarouselScreen> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;

  static const List<_StaffOnboardingSlide> _slides = [
    _StaffOnboardingSlide(
      eyebrow: 'SLIDE 01 · UNIFIED STAFF WORKSPACE',
      title: 'Welcome to the BEMS Staff Portal',
      subtitle:
          'Your all-in-one corporate mobile workspace across BEMS Group subsidiaries for fund requisitions, attendance, and salary confirmations.',
      highlights: [
        'Self-service staff onboarding & profile management',
        'Instant biometric fingerprint & PIN sign-in',
        'Direct real-time chat channel with Executive Admin & HR',
      ],
      icon: Icons.badge_rounded,
      accentColor: Color(0xFFEA580C),
      localAsset: 'assets/images/onboarding/staff_slide_1.jpg',
      networkFallback:
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=85',
    ),
    _StaffOnboardingSlide(
      eyebrow: 'SLIDE 02 · SMART FUND REQUISITIONS',
      title: 'Submit & Track Fund Requests in Real Time',
      subtitle:
          'Raise operational, capital, or cash advance requests with proforma quotes and follow GMD approval & bank disbursement live.',
      highlights: [
        'Attach vendor quotations & proforma invoices from your phone',
        'Real-time push status updates from submission to payout',
        'Reply directly to GMD clarification notes on any request',
      ],
      icon: Icons.request_quote_rounded,
      accentColor: Color(0xFF0284C7),
      localAsset: 'assets/images/onboarding/staff_slide_2.jpg',
      networkFallback:
          'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1600&q=85',
    ),
    _StaffOnboardingSlide(
      eyebrow: 'SLIDE 03 · 72-HOUR ACCOUNTABILITY CLOSURE',
      title: 'Retire Cash Advances with Camera Receipts',
      subtitle:
          'Snap physical store receipts, invoices, or delivery waybills within the 72-hour SLA window to keep your accountability 100% compliant.',
      highlights: [
        'Live 72-hour countdown timer on disbursed advances',
        '1-tap camera capture or PDF upload for proof of expenditure',
        'Instant clearance confirmation once verified',
      ],
      icon: Icons.receipt_long_rounded,
      accentColor: Color(0xFF059669),
      localAsset: 'assets/images/onboarding/staff_slide_3.jpg',
      networkFallback:
          'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=85',
    ),
    _StaffOnboardingSlide(
      eyebrow: 'SLIDE 04 · QR ATTENDANCE & SALARY RECEIPTS',
      title: 'Clock In on Time & Confirm Monthly Pay',
      subtitle:
          'Scan the dynamic office kiosk QR code to record daily attendance and confirm your monthly salary transfer receipts with one tap.',
      highlights: [
        'GPS-verified dynamic QR code check-in & check-out',
        'Transparent monthly attendance & punctuality ledger',
        'View bank transfer receipts & confirm salary arrival',
      ],
      icon: Icons.qr_code_scanner_rounded,
      accentColor: Color(0xFF8B5CF6),
      localAsset: 'assets/images/onboarding/staff_slide_4.jpg',
      networkFallback:
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1600&q=85',
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _completeJourney() async {
    HapticFeedback.mediumImpact();
    await StaffStorageService.setSeenOnboardingCarousel(true);
    if (!mounted) return;

    if (widget.isReplay) {
      Navigator.pop(context);
      return;
    }

    final destination = widget.nextScreen ?? const StaffLoginScreen();
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 500),
        pageBuilder: (context, animation, secondaryAnimation) => destination,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  void _nextSlide() {
    HapticFeedback.selectionClick();
    if (_currentIndex < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    } else {
      _completeJourney();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _currentIndex == _slides.length - 1;
    final currentSlide = _slides[_currentIndex];

    return Scaffold(
      backgroundColor: const Color(0xFF040711),
      extendBodyBehindAppBar: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Edge-to-Edge Full-Screen Photo PageView
          PageView.builder(
            controller: _pageController,
            itemCount: _slides.length,
            onPageChanged: (idx) {
              HapticFeedback.selectionClick();
              setState(() => _currentIndex = idx);
            },
            itemBuilder: (context, index) {
              final slide = _slides[index];

              return Stack(
                fit: StackFit.expand,
                children: [
                  // Full Bleed Photographic Background
                  Image.asset(
                    slide.localAsset,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: double.infinity,
                    errorBuilder: (ctx, err, stack) => Image.network(
                      slide.networkFallback,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: double.infinity,
                      errorBuilder: (ctx2, err2, stack2) => Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFF0F172A), Color(0xFF040711)],
                          ),
                        ),
                        child: Center(
                          child: Icon(slide.icon, size: 90, color: slide.accentColor.withOpacity(0.35)),
                        ),
                      ),
                    ),
                  ),

                  // Subtle Dark Ambient Wash
                  Container(
                    color: const Color(0xFF040711).withOpacity(0.28),
                  ),

                  // Top Cinematic Vignette (For Status Bar & Navigation readability)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 220,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withOpacity(0.85),
                            Colors.black.withOpacity(0.35),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Deep Bottom Atmospheric Gradient (Guarantees 100% Text Legibility)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: MediaQuery.of(context).size.height * 0.76,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          stops: const [0.0, 0.25, 0.55, 0.85, 1.0],
                          colors: [
                            Colors.transparent,
                            const Color(0xFF040711).withOpacity(0.40),
                            const Color(0xFF040711).withOpacity(0.85),
                            const Color(0xFF040711).withOpacity(0.97),
                            const Color(0xFF040711),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Ambient Radial Glow for Accent Lighting
                  Positioned(
                    left: -60,
                    bottom: 160,
                    child: Container(
                      width: 280,
                      height: 280,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: slide.accentColor.withOpacity(0.18),
                      ),
                    ),
                  ),

                  // Foreground Content Area
                  Positioned.fill(
                    child: SafeArea(
                      top: false,
                      bottom: true,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Glassmorphic Category Eyebrow Pill
                            ClipRRect(
                              borderRadius: BorderRadius.circular(30),
                              child: BackdropFilter(
                                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(30),
                                    border: Border.all(color: Colors.white.withOpacity(0.20)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: slide.accentColor,
                                          shape: BoxShape.circle,
                                          boxShadow: [
                                            BoxShadow(
                                              color: slide.accentColor,
                                              blurRadius: 8,
                                              spreadRadius: 1,
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        slide.eyebrow,
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 1.1,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),

                            const SizedBox(height: 14),

                            // Hero Headline
                            Text(
                              slide.title,
                              style: const TextStyle(
                                fontSize: 29,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.8,
                                height: 1.16,
                                color: Colors.white,
                              ),
                            ),

                            const SizedBox(height: 10),

                            // Subtitle Narrative
                            Text(
                              slide.subtitle,
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w400,
                                height: 1.48,
                                color: Colors.white.withOpacity(0.85),
                              ),
                            ),

                            const SizedBox(height: 18),

                            // Key Capability Chips (Frosted Glass)
                            ...slide.highlights.map(
                              (point) => Padding(
                                padding: const EdgeInsets.only(bottom: 7),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(14),
                                  child: BackdropFilter(
                                    filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withOpacity(0.08),
                                        borderRadius: BorderRadius.circular(14),
                                        border: Border.all(color: Colors.white.withOpacity(0.12)),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(
                                            Icons.check_circle_rounded,
                                            size: 16,
                                            color: slide.accentColor,
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              point,
                                              style: TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w600,
                                                color: Colors.white.withOpacity(0.95),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),

                            // Space for bottom navigation controls
                            const SizedBox(height: 96),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),

          // 2. Floating Top Header: Brand Pill + Skip Action
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Brand Badge
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.35),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white.withOpacity(0.15)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF10B981),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 7),
                              const Text(
                                'BEMS STAFF PORTAL',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.1,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    // Skip / Close Tour Button
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                        child: TextButton(
                          onPressed: _completeJourney,
                          style: TextButton.styleFrom(
                            backgroundColor: Colors.white.withOpacity(0.12),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(color: Colors.white.withOpacity(0.20)),
                            ),
                          ),
                          child: Text(
                            widget.isReplay ? 'Close Tour' : 'Skip',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 3. Floating Bottom Controls: Dynamic Dot Indicators & Primary Action Button
          Positioned(
            left: 20,
            right: 20,
            bottom: 22,
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  // Animated Dot Indicators
                  Row(
                    children: List.generate(_slides.length, (index) {
                      final isActive = index == _currentIndex;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 320),
                        margin: const EdgeInsets.only(right: 6),
                        width: isActive ? 26 : 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: isActive ? currentSlide.accentColor : Colors.white.withOpacity(0.28),
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: isActive
                              ? [
                                  BoxShadow(
                                    color: currentSlide.accentColor.withOpacity(0.5),
                                    blurRadius: 8,
                                    spreadRadius: 1,
                                  ),
                                ]
                              : null,
                        ),
                      );
                    }),
                  ),

                  const Spacer(),

                  // Primary Action CTA Button
                  DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      gradient: LinearGradient(
                        colors: [
                          currentSlide.accentColor,
                          currentSlide.accentColor.withOpacity(0.85),
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: currentSlide.accentColor.withOpacity(0.42),
                          blurRadius: 20,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: ElevatedButton(
                      onPressed: _nextSlide,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            isLast ? (widget.isReplay ? 'Exit Tour' : 'Enter Portal') : 'Continue',
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            isLast ? Icons.login_rounded : Icons.arrow_forward_rounded,
                            size: 16,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
