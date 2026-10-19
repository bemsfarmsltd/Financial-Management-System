import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/fund_request.dart';

class ItineraryStepperAccordion extends StatefulWidget {
  final FundRequestItem request;

  const ItineraryStepperAccordion({super.key, required this.request});

  @override
  State<ItineraryStepperAccordion> createState() => _ItineraryStepperAccordionState();
}

class _ItineraryStepperAccordionState extends State<ItineraryStepperAccordion> {
  int _expandedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final stages = [
      {
        'stage': 'Stage 1',
        'title': 'HOD Technical Recommendation',
        'time': 'Completed · Oct 16, 11:20 AM',
        'details': 'Line Manager validated quotes against technical requirements and approved routing to Finance.',
        'reviewer': 'Adaobi Okeke (COO / Acting HOD)',
        'isDone': widget.request.stepIndex >= 1,
      },
      {
        'stage': 'Stage 2',
        'title': 'Finance Budget Envelope Audit',
        'time': 'Completed · Oct 16, 02:45 PM',
        'details': 'Finance checked available Q4 departmental budget. Ledger code 4100-TECH assigned.',
        'reviewer': 'Ngozi Eze (Senior Finance Officer)',
        'isDone': widget.request.stepIndex >= 2,
      },
      {
        'stage': 'Stage 3',
        'title': 'GMD Executive Sign-off',
        'time': widget.request.stepIndex >= 3 ? 'Approved · Oct 16, 04:15 PM' : 'Awaiting Final Signature',
        'details': 'Final approval threshold check (> ₦250k) routed to Group Managing Director.',
        'reviewer': 'Henry Nwosu (GMD)',
        'isDone': widget.request.stepIndex >= 3,
      },
      {
        'stage': 'Stage 4',
        'title': 'Access Bank Transfer Settlement',
        'time': widget.request.stepIndex >= 4 ? 'Disbursed · Oct 16, 05:30 PM' : 'Pending Treasury Batch',
        'details': 'Disbursed to staff salary account. Dual maker-checker verification confirmed.',
        'reviewer': 'Access Bank Plc · Ref: TRF/OCT/88219',
        'isDone': widget.request.stepIndex >= 4,
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Approval Workflow Itinerary',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: BemsTheme.textPrimary,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 12),

        ...stages.asMap().entries.map((entry) {
          final index = entry.key;
          final item = entry.value;
          final isExpanded = _expandedIndex == index;
          final isDone = item['isDone'] as bool;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: BemsTheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isExpanded ? BemsTheme.primaryCobalt : BemsTheme.cardBorder,
                width: isExpanded ? 1.5 : 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                setState(() {
                  _expandedIndex = isExpanded ? -1 : index;
                });
              },
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        // Left step status circle
                        Container(
                          height: 28,
                          width: 28,
                          decoration: BoxDecoration(
                            color: isDone ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isDone ? Icons.check_rounded : Icons.schedule_rounded,
                            size: 16,
                            color: isDone ? Colors.white : BemsTheme.textMuted,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['stage'] as String,
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BemsTheme.textMuted),
                              ),
                              Text(
                                item['title'] as String,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: BemsTheme.textPrimary),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                          color: BemsTheme.textSecondary,
                        ),
                      ],
                    ),

                    if (isExpanded) ...[
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 10),
                        child: Divider(color: BemsTheme.cardBorder, height: 1),
                      ),
                      Text(
                        item['time'] as String,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isDone ? BemsTheme.successEmerald : BemsTheme.warningAmber,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item['details'] as String,
                        style: const TextStyle(fontSize: 12, color: BemsTheme.textSecondary, height: 1.4),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.person_outline_rounded, size: 14, color: BemsTheme.textSecondary),
                            const SizedBox(width: 6),
                            Text(
                              item['reviewer'] as String,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: BemsTheme.textPrimary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}
