import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/fund_request.dart';
import '../widgets/hero_accountability_card.dart';
import '../widgets/stacked_advance_card.dart';
import '../widgets/stats_grid_2x2.dart';
import 'request_detail_screen.dart';
import 'attendance_scan_screen.dart';

class HomeScreen extends StatefulWidget {
  final List<FundRequestItem> requests;
  final bool isLoading;
  final Future<void> Function() onRefresh;
  final VoidCallback onRequestNew;
  final Function(int) onNavigateTab;

  const HomeScreen({
    super.key,
    required this.requests,
    required this.isLoading,
    required this.onRefresh,
    required this.onRequestNew,
    required this.onNavigateTab,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedCategory = 'All';

  final List<String> _categories = [
    'All',
    'Advances',
    'Software',
    'Travel',
    'Power & Diesel',
    'Vendors',
  ];

  @override
  Widget build(BuildContext context) {
    final activeAdvance = widget.requests.where((r) => r.needsRetirement).firstOrNull;

    return Scaffold(
      backgroundColor: BemsTheme.background,
      appBar: AppBar(
        titleSpacing: 18,
        title: Row(
          children: [
            Container(
              height: 38,
              width: 38,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.asset(
                  'assets/images/bems_logo.png',
                  height: 38,
                  width: 38,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Hello, Temitope',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: BemsTheme.textPrimary,
                    letterSpacing: -0.4,
                  ),
                ),
                Text(
                  'Bems Group Cloud & Technologies',
                  style: TextStyle(
                    fontSize: 11,
                    color: BemsTheme.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Attendance Scanner Button (Airplane Window Viewfinder)
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AttendanceScanScreen()),
              );
            },
            child: Container(
              height: 38,
              width: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: const Icon(Icons.qr_code_scanner_rounded, size: 18, color: BemsTheme.brandOrange),
            ),
          ),
          const SizedBox(width: 8),

          // Circular (+) New Request Button from Image 1 & 2
          GestureDetector(
            onTap: widget.onRequestNew,
            child: Container(
              height: 38,
              width: 38,
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A), // Black circular button
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.add_rounded, size: 20, color: Colors.white),
            ),
          ),
          const SizedBox(width: 8),

          // Circular (↗) Quick Action Button from Image 1
          GestureDetector(
            onTap: () => widget.onNavigateTab(2),
            child: Container(
              height: 38,
              width: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: BemsTheme.cardBorder),
              ),
              child: const Icon(Icons.arrow_outward_rounded, size: 18, color: BemsTheme.textPrimary),
            ),
          ),
          const SizedBox(width: 8),

          // Avatar badge from TripGlide Image 2
          GestureDetector(
            onTap: () => widget.onNavigateTab(4),
            child: Container(
              height: 38,
              width: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7), // Warm amber background
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Center(
                child: Text(
                  'TB',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: widget.onRefresh,
        color: BemsTheme.primaryCobalt,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          children: [
            // Horizontal Category Pill Bar from TripGlide (Image 2)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _categories.map((cat) {
                  final isSelected = _selectedCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedCategory = cat),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFF0F172A) : Colors.white, // Active black pill
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSelected ? const Color(0xFF0F172A) : BemsTheme.cardBorder,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.12),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  )
                                ]
                              : null,
                        ),
                        child: Text(
                          cat,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isSelected ? Colors.white : BemsTheme.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 20),

            // Hero Accountability Card (from Finance Image 1)
            HeroAccountabilityCard(
              activeAdvance: 1200000.0,
              disbursedMtd: 1650000.0,
              pendingReview: 450000.0,
              onRetireTap: () => widget.onNavigateTab(2),
            ),
            const SizedBox(height: 24),

            // Stacked Cards UI (from Image 1 Screen 3)
            StackedAdvanceCard(
              activeAdvance: activeAdvance,
              onRetire: () => widget.onNavigateTab(2),
            ),
            const SizedBox(height: 24),

            // Stats 2x2 Grid (from Image 1 Screen 4)
            const StatsGrid2x2(),
            const SizedBox(height: 24),

            // Recent Requests Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent Transactions',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: BemsTheme.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                GestureDetector(
                  onTap: () => widget.onNavigateTab(1),
                  child: const Text(
                    'See all',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: BemsTheme.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Transaction Cards (from Image 1 Screen 2)
            ...widget.requests.take(3).map((req) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: BemsTheme.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: BemsTheme.cardBorder),
                ),
                child: InkWell(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => RequestDetailScreen(request: req),
                      ),
                    );
                  },
                  child: Row(
                    children: [
                      Container(
                        height: 42,
                        width: 42,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: Text(
                            req.title.substring(0, 1).toUpperCase(),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: BemsTheme.textPrimary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              req.title,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${req.requestNumber} · ${req.category}',
                              style: const TextStyle(fontSize: 11, color: BemsTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₦${req.amount.toInt()}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            req.statusLabel,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: req.status == 'DISBURSED' ? BemsTheme.successEmerald : BemsTheme.primaryCobalt,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 80), // Padding for floating dock bar
          ],
        ),
      ),
    );
  }
}
