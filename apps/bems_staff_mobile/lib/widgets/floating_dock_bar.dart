import 'package:flutter/material.dart';

class FloatingDockBar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;
  final int pendingRetirements;

  const FloatingDockBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.pendingRetirements = 0,
  });

  @override
  Widget build(BuildContext context) {
    final navItems = [
      {'icon': Icons.home_rounded, 'label': 'Home'},
      {'icon': Icons.receipt_long_rounded, 'label': 'Requests'},
      {'icon': Icons.assignment_turned_in_rounded, 'label': 'Retirements', 'badge': pendingRetirements},
      {'icon': Icons.account_balance_wallet_rounded, 'label': 'Payslips'},
      {'icon': Icons.person_rounded, 'label': 'Profile'},
    ];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.only(left: 20, right: 20, bottom: 12),
        child: Container(
          height: 66,
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A), // Dark charcoal black dock from TripGlide
            borderRadius: BorderRadius.circular(36),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.25),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(navItems.length, (index) {
              final item = navItems[index];
              final isSelected = currentIndex == index;
              final icon = item['icon'] as IconData;
              final badge = item['badge'] as int? ?? 0;

              return GestureDetector(
                onTap: () => onTap(index),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: 48,
                  width: isSelected ? 48 : 42,
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.white : Colors.transparent, // Active white circle pill from TripGlide
                    shape: BoxShape.circle,
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Icon(
                        icon,
                        size: isSelected ? 22 : 20,
                        color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                      ),
                      if (badge > 0 && !isSelected)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            height: 7,
                            width: 7,
                            decoration: const BoxDecoration(
                              color: Color(0xFFF59E0B),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
