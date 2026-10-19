import 'package:flutter/material.dart';
import '../core/theme.dart';

class StatsGrid2x2 extends StatelessWidget {
  const StatsGrid2x2({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            Text(
              'Your Stats',
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

        // 2x2 Grid from Image 1 Screen 4
        Row(
          children: [
            Expanded(
              child: _buildStatTile(
                iconWidget: SizedBox(
                  height: 24,
                  width: 24,
                  child: CircularProgressIndicator(
                    value: 1.0,
                    strokeWidth: 3,
                    color: BemsTheme.primaryCobalt,
                    backgroundColor: const Color(0xFFE2E8F0),
                  ),
                ),
                title: 'Policy SLA',
                subtitle: '100% Achieved',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatTile(
                iconWidget: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: const BoxDecoration(
                    color: BemsTheme.brandOrange,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.local_fire_department_rounded, size: 14, color: Colors.white),
                ),
                title: 'Streaks',
                subtitle: '3 weeks on-time',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildStatTile(
                iconWidget: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: BemsTheme.successEmerald.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.receipt_long_rounded, size: 14, color: BemsTheme.successEmerald),
                ),
                title: 'Total Retired',
                subtitle: '₦4,850,000 logged',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatTile(
                iconWidget: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.account_balance_wallet_rounded, size: 14, color: Colors.purple),
                ),
                title: 'Latest Salary',
                subtitle: '₦680,000 settled',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatTile({
    required Widget iconWidget,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BemsTheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BemsTheme.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          iconWidget,
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: BemsTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 11,
              color: BemsTheme.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
