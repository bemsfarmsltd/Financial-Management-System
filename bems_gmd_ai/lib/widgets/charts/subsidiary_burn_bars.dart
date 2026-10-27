import 'package:flutter/material.dart';

class SubsidiaryBudgetItem {
  final String entityName;
  final String code;
  final double budgetCeiling;
  final double spentAmount;
  final Color themeColor;

  const SubsidiaryBudgetItem({
    required this.entityName,
    required this.code,
    required this.budgetCeiling,
    required this.spentAmount,
    required this.themeColor,
  });

  double get burnPercentage => budgetCeiling > 0 ? (spentAmount / budgetCeiling) * 100 : 0.0;
}

class SubsidiaryBurnBars extends StatelessWidget {
  final List<SubsidiaryBudgetItem> items;

  const SubsidiaryBurnBars({
    super.key,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: const Icon(Icons.align_horizontal_left_rounded, color: Color(0xFF16A34A), size: 18),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SPENDING BY BUSINESS DIVISION',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'How much each business unit has spent this quarter',
                        style: TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Q4 2026',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),

          ...items.map((item) {
            final burnPct = item.burnPercentage;
            Color statusColor;
            String statusLabel;

            if (burnPct > 90) {
              statusColor = const Color(0xFFDC2626);
              statusLabel = 'NEAR LIMIT';
            } else if (burnPct >= 75) {
              statusColor = const Color(0xFFD97706);
              statusLabel = 'WATCH CLOSELY';
            } else {
              statusColor = const Color(0xFF059669);
              statusLabel = 'ON TRACK';
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: item.themeColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              item.code,
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: item.themeColor,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            item.entityName,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          Text(
                            '₦${(item.spentAmount / 1000000).toStringAsFixed(1)}M / ₦${(item.budgetCeiling / 1000000).toStringAsFixed(1)}M',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${burnPct.toStringAsFixed(0)}% · $statusLabel',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: statusColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 7),

                  // Progress Bar Track
                  Container(
                    height: 8,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final fillWidth = (burnPct / 100).clamp(0.0, 1.0) * constraints.maxWidth;
                        return Row(
                          children: [
                            Container(
                              width: fillWidth,
                              height: 8,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    item.themeColor,
                                    item.themeColor.withOpacity(0.85),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
