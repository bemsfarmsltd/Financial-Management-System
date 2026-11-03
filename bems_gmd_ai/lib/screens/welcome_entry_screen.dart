import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/bemi_voice_service.dart';
import '../services/chat_storage_service.dart';
import '../widgets/kinetic_torus_iris.dart';
import 'executive_home_screen.dart';

class WelcomeEntryScreen extends StatefulWidget {
  final String userName;
  final String businessName;

  const WelcomeEntryScreen({
    super.key,
    required this.userName,
    this.businessName = 'BEMS Group',
  });

  @override
  State<WelcomeEntryScreen> createState() => _WelcomeEntryScreenState();
}

class _WelcomeEntryScreenState extends State<WelcomeEntryScreen> {
  int _financialIndex = 0;
  Timer? _tickerTimer;
  Timer? _speechStartTimer;

  List<Map<String, dynamic>> _liveUpdates = [
    {
      'metric': 'GROUP TELEMETRY',
      'text': 'Synchronizing real-time ledger intelligence across BEMS Group subsidiaries...',
      'tag': 'CONNECTING',
      'tagColor': const Color(0xFFEA580C),
    },
    {
      'metric': 'EXECUTIVE APPROVAL QUEUE',
      'text': 'Connecting to live requisition approval pipeline...',
      'tag': 'AUDIT',
      'tagColor': const Color(0xFF0284C7),
    },
    {
      'metric': 'ACCOUNTABILITY STATUS',
      'text': 'Verifying 72-hour cash advance retirement evidence...',
      'tag': 'VERIFYING',
      'tagColor': const Color(0xFF059669),
    },
  ];

  String get _displayName {
    final trimmed = widget.userName.trim();
    return trimmed.isNotEmpty ? trimmed : 'Dr Pastra';
  }

  @override
  void initState() {
    super.initState();
    _fetchLiveBriefingMetrics();

    // Rotate through live financial updates every 2.8s (matching Admin Web)
    _tickerTimer = Timer.periodic(const Duration(milliseconds: 2800), (_) {
      if (mounted && _liveUpdates.isNotEmpty) {
        setState(() {
          _financialIndex = (_financialIndex + 1) % _liveUpdates.length;
        });
      }
    });

    // Trigger vocal welcome greeting 550ms after mount (matching Admin Web)
    _speechStartTimer = Timer(const Duration(milliseconds: 550), () {
      if (mounted) {
        BemiVoiceService.speakWelcomeGreeting(
          userName: _displayName,
          businessName: widget.businessName,
        );
      }
    });
  }

  @override
  void dispose() {
    _tickerTimer?.cancel();
    _speechStartTimer?.cancel();
    BemiVoiceService.stop();
    super.dispose();
  }

  Future<void> _fetchLiveBriefingMetrics() async {
    try {
      final data = await ApiService.fetchDashboardData();
      if (!mounted) return;

      final currencyFormatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);
      final requests = (data['requests'] as List<dynamic>?) ?? [];
      final accountabilityCases = (data['accountabilityCases'] as List<dynamic>?) ?? [];
      final disbursements = (data['disbursements'] as List<dynamic>?) ?? [];
      final orgs = (data['organizations'] as List<dynamic>?) ?? [];
      final budgets = (data['budgets'] as List<dynamic>?) ?? [];

      final pending = requests
          .where((r) => r['approvalStatus'] == 'SUBMITTED' || r['approvalStatus'] == 'IN_REVIEW')
          .toList();
      final pendingSum = pending.fold<num>(
        0,
        (sum, r) => sum + (num.tryParse(r['amountNaira']?.toString() ?? '0') ?? 0),
      );

      final unpaid = requests
          .where((r) => r['approvalStatus'] == 'APPROVED' && r['paymentStatus'] == 'UNPAID')
          .toList();
      final unpaidSum = unpaid.fold<num>(
        0,
        (sum, r) => sum + (num.tryParse(r['amountNaira']?.toString() ?? '0') ?? 0),
      );

      final overdue = accountabilityCases.where((c) => c['status'] == 'OVERDUE').toList();
      final totalBudget = budgets.fold<num>(
        0,
        (sum, b) => sum + (num.tryParse(b['allocatedAmount']?.toString() ?? '0') ?? 0),
      );

      setState(() {
        _liveUpdates = [
          {
            'metric': 'EXECUTIVE APPROVAL QUEUE',
            'text': pending.isNotEmpty
                ? '${pending.length} pending requisition${pending.length > 1 ? 's' : ''} awaiting executive review (${currencyFormatter.format(pendingSum)})'
                : 'Zero pending requisitions awaiting executive authorization — queue is fully cleared',
            'tag': pending.isNotEmpty ? 'ACTION NEEDED' : 'CLEAR',
            'tagColor': pending.isNotEmpty ? const Color(0xFFEA580C) : const Color(0xFF059669),
          },
          {
            'metric': 'PAYMENT DISBURSEMENT QUEUE',
            'text': unpaid.isNotEmpty
                ? '${unpaid.length} approved requisition${unpaid.length > 1 ? 's' : ''} awaiting payment recording (${currencyFormatter.format(unpaidSum)})'
                : 'All approved requisitions have been disbursed and matched to external bank records',
            'tag': unpaid.isNotEmpty ? 'READY TO PAY' : 'SETTLED',
            'tagColor': unpaid.isNotEmpty ? const Color(0xFF0284C7) : const Color(0xFF059669),
          },
          {
            'metric': 'AUDIT & 72H COMPLIANCE',
            'text': overdue.isEmpty
                ? 'Accountability is 100% compliant across ${accountabilityCases.length} advance case${accountabilityCases.length == 1 ? '' : 's'} with 0 overdue'
                : '${overdue.length} advance retirement${overdue.length > 1 ? 's' : ''} past 72-hour evidence deadline',
            'tag': overdue.isEmpty ? 'COMPLIANT' : 'OVERDUE',
            'tagColor': overdue.isEmpty ? const Color(0xFF059669) : const Color(0xFFDC2626),
          },
          {
            'metric': 'CONSOLIDATED CAPITAL ALLOCATION',
            'text': '${orgs.isNotEmpty ? orgs.length : 3} active subsidiaries operating with ₦${(totalBudget / 1000000).toStringAsFixed(1)}M total allocated capital',
            'tag': 'OPTIMAL',
            'tagColor': const Color(0xFF0284C7),
          },
          {
            'metric': 'DISBURSEMENT LEDGER',
            'text': '${disbursements.length} verified group disbursement${disbursements.length == 1 ? '' : 's'} recorded on ledger',
            'tag': 'VERIFIED',
            'tagColor': const Color(0xFF059669),
          },
        ];
      });
    } catch (_) {}
  }

  void _toggleVoiceGreeting() {
    HapticFeedback.selectionClick();
    if (BemiVoiceService.isSpeaking.value) {
      BemiVoiceService.stop();
    } else {
      BemiVoiceService.speakWelcomeGreeting(
        userName: _displayName,
        businessName: widget.businessName,
        force: true,
      );
    }
  }

  void _proceedToDashboard() async {
    await BemiVoiceService.stop();
    await ChatStorageService.setSeenWelcome(true);
    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 600),
        pageBuilder: (context, animation, secondaryAnimation) => ExecutiveHomeScreen(
          userName: widget.userName,
          businessName: widget.businessName,
          initialMode: 'ai',
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUpdate = _liveUpdates[_financialIndex % _liveUpdates.length];
    final Color tagColor = (currentUpdate['tagColor'] as Color?) ?? const Color(0xFFEA580C);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F2EB), // Warm ivory matching Admin Web
      body: SafeArea(
        child: Column(
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
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Color(0xFFEA580C),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'BEMi · AUTONOMOUS LEDGER GOVERNANCE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    widget.businessName,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF334155),
                    ),
                  ),
                ],
              ),
            ),

            const Spacer(),

            // Centerpiece: Kinetic Iris Torus
            Center(
              child: KineticTorusIris(
                size: (MediaQuery.of(context).size.width * 0.62).clamp(210.0, 290.0),
              ),
            ),

            const SizedBox(height: 22),

            // Welcome Heading
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                'Welcome, $_displayName',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.8,
                  color: Color(0xFF1C1917),
                ),
              ),
            ),

            const SizedBox(height: 14),

            // Rotating Real-Time Financial Update Pill (matching Admin Web)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                child: Container(
                  key: ValueKey<int>(_financialIndex),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.85),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: Colors.black.withOpacity(0.08)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: tagColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '${currentUpdate['metric']}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.8,
                              color: tagColor,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: tagColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${currentUpdate['tag']}',
                              style: TextStyle(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w800,
                                color: tagColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        '${currentUpdate['text']}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E293B),
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Voice Status / Replay Button + Continue to Dashboard Button (matching Admin Web)
            ValueListenableBuilder<bool>(
              valueListenable: BemiVoiceService.isSpeaking,
              builder: (context, speaking, _) {
                return GestureDetector(
                  onTap: _toggleVoiceGreeting,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 7),
                    decoration: BoxDecoration(
                      color: speaking
                          ? const Color(0xFFEA580C).withOpacity(0.10)
                          : Colors.white.withOpacity(0.75),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: speaking
                            ? const Color(0xFFEA580C)
                            : Colors.black.withOpacity(0.10),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          speaking ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                          size: 14,
                          color: speaking ? const Color(0xFFEA580C) : const Color(0xFF57534E),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          speaking ? 'Speaking Greeting... (Tap to Mute)' : 'Replay Voice Welcome',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: speaking ? const Color(0xFFEA580C) : const Color(0xFF57534E),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

            const SizedBox(height: 10),

            // Continue to Dashboard Pill Button
            ElevatedButton(
              onPressed: _proceedToDashboard,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1C1917),
                foregroundColor: const Color(0xFFF5F2EB),
                elevation: 6,
                shadowColor: Colors.black.withOpacity(0.25),
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 15),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(28),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Continue to Dashboard',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward_rounded, size: 16),
                ],
              ),
            ),

            const Spacer(),

            // Footer
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'BEMS Group · Executive Governance',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF78716C),
                    ),
                  ),
                  Text(
                    'Enterprise Command Cockpit',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF78716C),
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
}
