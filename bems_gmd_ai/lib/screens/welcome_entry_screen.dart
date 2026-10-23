import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
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
  int _pendingCount = 1;
  num _pendingSum = 650000;
  bool _isLoadingBriefing = true;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    try {
      final stats = await ApiService.fetchBriefingStats();
      if (mounted) {
        setState(() {
          _pendingCount = stats['pendingCount'] ?? 1;
          _pendingSum = stats['pendingSum'] ?? 650000;
          _isLoadingBriefing = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingBriefing = false);
      }
    }
  }

  void _proceedToDashboard() async {
    await ChatStorageService.setSeenWelcome(true);
    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 600),
        pageBuilder: (context, animation, secondaryAnimation) => ExecutiveHomeScreen(
          userName: widget.userName,
          businessName: widget.businessName,
          initialMode: 'dashboard',
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);
    final formattedSum = currencyFormatter.format(_pendingSum);

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F5), // Warm ivory matching screenshot
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
                size: MediaQuery.of(context).size.width * 0.68,
              ),
            ),

            const SizedBox(height: 28),

            // Welcome Heading
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                'Welcome, ${widget.userName}',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.8,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Executive Approval Queue Badge Pill
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
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
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'EXECUTIVE APPROVAL QUEUE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                            color: Color(0xFFEA580C),
                          ),
                        ),
                        SizedBox(width: 6),
                        Text(
                          '· Live Update',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _isLoadingBriefing
                          ? 'Synchronizing pending group requisitions...'
                          : _pendingCount > 0
                              ? '$_pendingCount pending requisition${_pendingCount > 1 ? 's' : ''} awaiting executive review ($formattedSum)'
                              : 'All requisition queues cleared — zero pending reviews',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Continue to Dashboard Pill Button
            ElevatedButton(
              onPressed: _proceedToDashboard,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF18181B),
                foregroundColor: Colors.white,
                elevation: 4,
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
                      fontSize: 13,
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
              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'BEMS Group · Executive Governance',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  Text(
                    'Enterprise Command Cockpit',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF94A3B8),
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
