import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/constants.dart';
import '../models/fund_request.dart';

class StackedAdvanceCard extends StatelessWidget {
  final FundRequestItem? activeAdvance;
  final VoidCallback onRetire;

  const StackedAdvanceCard({
    super.key,
    required this.activeAdvance,
    required this.onRetire,
  });

  @override
  Widget build(BuildContext context) {
    final title = activeAdvance?.title ?? 'On-site Fiber Infrastructure Advance';
    final amount = activeAdvance?.amount ?? 1200000.0;
    final reqNumber = activeAdvance?.requestNumber ?? 'REQ-2026-0003';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            Text(
              'Active Commitment Stack',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: BemsTheme.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            Text(
              'See all',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: BemsTheme.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Stacked Card container (Image 1 Screen 3)
        Stack(
          clipBehavior: Clip.none,
          children: [
            // Top faux card 1: Light Grey
            Container(
              height: 220,
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Text('Cloud VPS Hosting', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                  Text('Approved', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
            ),

            // Middle faux card 2: Warm Amber / Cream
            Positioned(
              top: 36,
              left: 0,
              right: 0,
              child: Container(
                height: 190,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEDD5),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text('Generator Diesel Supply', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF9A3412))),
                    Text('Disbursed', style: TextStyle(fontSize: 11, color: Color(0xFFC2410C))),
                  ],
                ),
              ),
            ),

            // Bottom Hero Card: Vibrant BEMS Brand Orange Gradient
            Positioned(
              top: 72,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFFF97316), // Vibrant BEMS brand orange
                      Color(0xFFEA580C),
                      Color(0xFFC2410C),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFF97316).withOpacity(0.35),
                      blurRadius: 18,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            reqNumber,
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Big Amount
                    Text(
                      AppConstants.formatNaira(amount),
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Pending Retirement · 72h Policy Window',
                      style: TextStyle(fontSize: 11, color: Color(0xFFFFEDD5)),
                    ),
                    const SizedBox(height: 16),

                    // Bottom strip inside card: Payout account & action button
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: const [
                            Icon(Icons.credit_card_rounded, size: 14, color: Colors.white70),
                            SizedBox(width: 6),
                            Text(
                              'Disbursed ········ 6789',
                              style: TextStyle(fontSize: 11, color: Colors.white, fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                        ElevatedButton(
                          onPressed: onRetire,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFFEA580C),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                          child: const Text('Retire Now →'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Spacer height so stack doesn't collapse
            const SizedBox(height: 290, width: double.infinity),
          ],
        ),
      ],
    );
  }
}
