import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/constants.dart';
import '../models/fund_request.dart';
import '../widgets/itinerary_stepper_accordion.dart';
import 'retire_advance_screen.dart';

class RequestDetailScreen extends StatelessWidget {
  final FundRequestItem request;

  const RequestDetailScreen({super.key, required this.request});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BemsTheme.background,
      appBar: AppBar(
        title: Text(request.requestNumber),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.share_outlined, size: 20),
          ),
          const SizedBox(width: 8),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: request.needsRetirement
                  ? () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => RetireAdvanceScreen(requests: [request], onRetirementSubmitted: () {}),
                        ),
                      );
                    }
                  : () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A), // Full width black button matching TripGlide
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(
                request.needsRetirement ? 'Retire This Advance Now' : 'Back to Dashboard',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        children: [
          // Header Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: BemsTheme.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: BemsTheme.cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        request.category.toUpperCase(),
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BemsTheme.primaryCobalt),
                      ),
                    ),
                    Text(
                      AppConstants.formatNaira(request.amount),
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  request.title,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  '${request.subsidiaryName} · ${request.departmentName}',
                  style: const TextStyle(fontSize: 12, color: BemsTheme.textSecondary),
                ),
                const SizedBox(height: 14),

                // Access Bank badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        request.status == 'DISBURSED' ? Icons.check_circle_rounded : Icons.schedule_rounded,
                        size: 14,
                        color: request.status == 'DISBURSED' ? BemsTheme.successEmerald : BemsTheme.warningAmber,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        request.statusLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: request.status == 'DISBURSED' ? BemsTheme.successEmerald : BemsTheme.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Itinerary Stepper Accordion from TripGlide (Image 2 Screen 3)
          ItineraryStepperAccordion(request: request),
          const SizedBox(height: 20),

          // Channel Comments
          const Text(
            'Channel Communications',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
          ),
          const SizedBox(height: 10),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: BemsTheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: BemsTheme.cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: request.channelComments.isEmpty
                  ? [const Text('No discussion logged.', style: TextStyle(color: BemsTheme.textMuted, fontSize: 12))]
                  : request.channelComments.map((c) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.chat_bubble_outline_rounded, size: 14, color: BemsTheme.primaryCobalt),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                c,
                                style: const TextStyle(fontSize: 12, color: BemsTheme.textPrimary, height: 1.3),
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
  }
}
