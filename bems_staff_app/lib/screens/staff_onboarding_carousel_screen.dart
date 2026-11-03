import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/staff_storage_service.dart';
import '../widgets/kinetic_torus_iris.dart';
import 'staff_login_screen.dart';

class _StaffOnboardingSlide {
  final String eyebrow;
  final String title;
  final String subtitle;
  final List<String> highlights;
  final IconData icon;
  final Color accentColor;
  final bool showTorus;

  const _StaffOnboardingSlide({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.highlights,
    required this.icon,
    required this.accentColor,
    this.showTorus = false,
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
      showTorus: true,
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
      accentColor: Color(0xFF7C3AED),
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
        duration: const Duration(milliseconds: 380),
        curve: Curves.easeOutCubic,
      );
    } else {
      _completeJourney();
    }
  }

  @override
  Widget build(BuildContext context) {
    final slide = _slides[_currentIndex];
    final isLast = _currentIndex == _slides.length - 1;

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F5),
      body: SafeArea(
        child: Column(
          children: [
            // Top Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: slide.accentColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'BEMS STAFF PORTAL · JOURNEY',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.1,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: _completeJourney,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF64748B),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    ),
                    child: Text(
                      widget.isReplay ? 'Close Tour' : 'Skip',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Swipeable PageView
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _slides.length,
                onPageChanged: (idx) {
                  HapticFeedback.selectionClick();
                  setState(() => _currentIndex = idx);
                },
                itemBuilder: (context, index) {
                  final item = _slides[index];
                  return SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                    child: Column(
                      children: [
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(28),
                            border: Border.all(color: item.accentColor.withOpacity(0.22)),
                            boxShadow: [
                              BoxShadow(
                                color: item.accentColor.withOpacity(0.08),
                                blurRadius: 24,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              if (item.showTorus)
                                KineticTorusIris(
                                  size: (MediaQuery.of(context).size.width * 0.44).clamp(150.0, 200.0),
                                )
                              else
                                Container(
                                  width: 96,
                                  height: 96,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: LinearGradient(
                                      colors: [
                                        item.accentColor,
                                        item.accentColor.withOpacity(0.75),
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: item.accentColor.withOpacity(0.32),
                                        blurRadius: 20,
                                        offset: const Offset(0, 8),
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    item.icon,
                                    size: 44,
                                    color: Colors.white,
                                  ),
                                ),
                              const SizedBox(height: 18),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                                decoration: BoxDecoration(
                                  color: item.accentColor.withOpacity(0.10),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  item.eyebrow,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.9,
                                    color: item.accentColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),

                        Text(
                          item.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.6,
                            color: Color(0xFF0F172A),
                            height: 1.2,
                          ),
                        ),

                        const SizedBox(height: 12),

                        Text(
                          item.subtitle,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF475569),
                            height: 1.45,
                          ),
                        ),

                        const SizedBox(height: 20),

                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.90),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            children: item.highlights.map((point) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      margin: const EdgeInsets.only(top: 2),
                                      width: 18,
                                      height: 18,
                                      decoration: BoxDecoration(
                                        color: item.accentColor.withOpacity(0.14),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        Icons.check_rounded,
                                        size: 12,
                                        color: item.accentColor,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        point,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF1E293B),
                                          height: 1.35,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Bottom Controls
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_slides.length, (i) {
                      final active = i == _currentIndex;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 260),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: active ? 28 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: active ? slide.accentColor : const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      if (_currentIndex > 0) ...[
                        OutlinedButton(
                          onPressed: () {
                            HapticFeedback.selectionClick();
                            _pageController.previousPage(
                              duration: const Duration(milliseconds: 320),
                              curve: Curves.easeOutCubic,
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF334155),
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
                            ),
                          ),
                          child: const Text(
                            'Back',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _nextSlide,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isLast ? slide.accentColor : const Color(0xFF18181B),
                            foregroundColor: Colors.white,
                            elevation: 4,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isLast
                                    ? (widget.isReplay ? 'Finish Staff Tour' : 'Continue to Staff Sign-In')
                                    : 'Next (${_currentIndex + 1}/${_slides.length})',
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.2,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward_rounded, size: 17),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

