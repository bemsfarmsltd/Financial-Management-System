import 'package:flutter/material.dart';

class MonthlyBurnData {
  final String month;
  final double actualSpent;
  final double budgetCeiling;
  final bool isCurrentMonth;

  const MonthlyBurnData({
    required this.month,
    required this.actualSpent,
    required this.budgetCeiling,
    this.isCurrentMonth = false,
  });
}

class ExpenditureHistogram extends StatefulWidget {
  final List<MonthlyBurnData> monthlyData;

  const ExpenditureHistogram({
    super.key,
    required this.monthlyData,
  });

  @override
  State<ExpenditureHistogram> createState() => _ExpenditureHistogramState();
}

class _ExpenditureHistogramState extends State<ExpenditureHistogram> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _animation;
  int? _hoveredIndex;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );
    _animation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    double maxVal = 0;
    for (final m in widget.monthlyData) {
      if (m.actualSpent > maxVal) maxVal = m.actualSpent;
      if (m.budgetCeiling > maxVal) maxVal = m.budgetCeiling;
    }
    if (maxVal == 0) maxVal = 30000000;
    // Round maxVal up to nearest 10M for clean ceiling
    final roundedMax = ((maxVal / 10000000).ceil() * 10000000).toDouble();

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
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: const Icon(Icons.bar_chart_rounded, color: Color(0xFF2563EB), size: 20),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MONTHLY SPENDING',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        '6-Month spending vs budget limit',
                        style: TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
              Row(
                children: [
                  _buildLegendItem('Money Spent', const Color(0xFFEA580C)),
                  const SizedBox(width: 12),
                  _buildLegendItem('Budget Limit', const Color(0xFFCBD5E1)),
                ],
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Histogram Canvas
          SizedBox(
            height: 170,
            child: AnimatedBuilder(
              animation: _animation,
              builder: (context, _) {
                return LayoutBuilder(
                  builder: (context, constraints) {
                    final chartHeight = constraints.maxHeight - 24; // room for month labels
                    final stepVal = roundedMax / 3;

                    return Stack(
                      children: [
                        // Horizontal background grid lines
                        Positioned.fill(
                          bottom: 24,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: List.generate(4, (index) {
                              final val = roundedMax - (index * stepVal);
                              return Row(
                                children: [
                                  SizedBox(
                                    width: 38,
                                    child: Text(
                                      '₦${(val / 1000000).toStringAsFixed(0)}M',
                                      style: const TextStyle(
                                        fontSize: 9,
                                        color: Color(0xFF94A3B8),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: Container(
                                      height: 1,
                                      color: const Color(0xFFF1F5F9),
                                    ),
                                  ),
                                ],
                              );
                            }),
                          ),
                        ),

                        // Vertical Bars
                        Positioned(
                          left: 42,
                          right: 0,
                          top: 0,
                          bottom: 0,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: widget.monthlyData.asMap().entries.map((entry) {
                              final idx = entry.key;
                              final data = entry.value;
                              final isHovered = _hoveredIndex == idx;

                              final actualHeight = (data.actualSpent / roundedMax) * chartHeight * _animation.value;
                              final ceilingHeight = (data.budgetCeiling / roundedMax) * chartHeight * _animation.value;

                              return MouseRegion(
                                onEnter: (_) => setState(() => _hoveredIndex = idx),
                                onExit: (_) => setState(() => _hoveredIndex = null),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    // Tooltip on Hover
                                    SizedBox(
                                      height: 20,
                                      child: isHovered
                                          ? Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF0F172A),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                '₦${(data.actualSpent / 1000000).toStringAsFixed(1)}M',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 8.5,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            )
                                          : null,
                                    ),
                                    const SizedBox(height: 4),

                                    // Bar Stack
                                    SizedBox(
                                      width: 28,
                                      height: chartHeight,
                                      child: Stack(
                                        alignment: Alignment.bottomCenter,
                                        children: [
                                          // Background Ceiling Bar
                                          Container(
                                            width: 28,
                                            height: ceilingHeight,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF1F5F9),
                                              borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                                              border: Border.all(color: const Color(0xFFE2E8F0)),
                                            ),
                                          ),

                                          // Actual Spend Solid Bar
                                          Container(
                                            width: isHovered ? 24 : 20,
                                            height: actualHeight,
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                colors: data.isCurrentMonth
                                                    ? [const Color(0xFFEA580C), const Color(0xFFF97316)]
                                                    : [const Color(0xFF475569), const Color(0xFF64748B)],
                                                begin: Alignment.bottomCenter,
                                                end: Alignment.topCenter,
                                              ),
                                              borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                                              boxShadow: data.isCurrentMonth
                                                  ? [
                                                      BoxShadow(
                                                        color: const Color(0xFFEA580C).withOpacity(0.3),
                                                        blurRadius: 6,
                                                        offset: const Offset(0, 2),
                                                      ),
                                                    ]
                                                  : null,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),

                                    const SizedBox(height: 6),

                                    // Month Label
                                    Text(
                                      data.month,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: data.isCurrentMonth ? FontWeight.w800 : FontWeight.w600,
                                        color: data.isCurrentMonth ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
