import 'package:flutter/material.dart';
import '../theme/bems_theme.dart';

class InteractiveActionCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final VoidCallback? onAction;

  const InteractiveActionCard({
    super.key,
    required this.data,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final type = data['type'] as String? ?? '';

    switch (type) {
      case 'TREASURY':
        return _buildTreasuryCard(context);
      case 'APPROVALS':
        return _buildApprovalsCard(context);
      case 'BRIEFING':
        return _buildBriefingCard(context);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildTreasuryCard(BuildContext context) {
    final accounts = (data['accounts'] as List?) ?? [];
    final totalCash = data['totalCash'] as String? ?? '₦0';

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BemsTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BemsTheme.borderAmber, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: BemsTheme.primary.withOpacity(0.12),
            blurRadius: 18,
            offset: const Offset(0, 4),
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
                'LIVE TREASURY LIQUIDITY',
                style: Theme.of(context).textTheme.labelSmall,
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  '● Reconciled',
                  style: TextStyle(color: Colors.greenAccent, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            totalCash,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  color: BemsTheme.textPrimary,
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 12),
          ...accounts.map((acc) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.25),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: BemsTheme.borderSubtle),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(acc['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('Acc: ${acc['account']}', style: const TextStyle(color: BemsTheme.textMuted, fontSize: 11)),
                      ],
                    ),
                    Text(
                      acc['balance'] ?? '',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: BemsTheme.primaryLight,
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildApprovalsCard(BuildContext context) {
    final count = data['count'] ?? 0;
    final total = data['total'] ?? '₦0';
    final requests = (data['requests'] as List?) ?? [];

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BemsTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.4), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('EXECUTIVE APPROVAL REQUIRED', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.blueAccent)),
          const SizedBox(height: 4),
          Text('$count Requests · $total', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          ...requests.map((r) => Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(r['title'] ?? '', style: const TextStyle(fontSize: 12)),
                    Text(r['amount'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.blueAccent)),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildBriefingCard(BuildContext context) {
    final cash = data['cash'] ?? '₦0';
    final pending = data['pending'] ?? 0;
    final openCases = data['openCases'] ?? 0;
    final staff = data['staff'] ?? 0;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BemsTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('EXECUTIVE DAILY SCORECARD', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: const Color(0xFF10B981))),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile('LIQUID RESERVES', cash, const Color(0xFF10B981)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile('PENDING REVIEWS', '$pending', Colors.orangeAccent),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile('OPEN ADVANCES', '$openCases', Colors.lightBlueAccent),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile('GROUP STAFF', '$staff', Colors.white),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.3),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 9, color: BemsTheme.textMuted, fontWeight: FontWeight.bold)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
