import 'package:flutter/material.dart';
import '../theme/bems_theme.dart';
import '../services/api_service.dart';

class InteractiveActionCard extends StatefulWidget {
  final Map<String, dynamic> data;
  final VoidCallback? onAction;

  const InteractiveActionCard({
    super.key,
    required this.data,
    this.onAction,
  });

  @override
  State<InteractiveActionCard> createState() => _InteractiveActionCardState();
}

class _InteractiveActionCardState extends State<InteractiveActionCard> {
  final Set<String> _approvedRequestIds = {};
  final Set<String> _declinedRequestIds = {};
  final Set<String> _remindedCaseIds = {};
  final Set<String> _processingIds = {};

  Future<void> _handleApproval(String requestId, bool approve) async {
    if (_processingIds.contains(requestId)) return;
    setState(() {
      _processingIds.add(requestId);
    });

    final success = await ApiService.decideApproval(
      requestId: requestId,
      decision: approve ? 'APPROVE' : 'REJECT',
      note: approve ? 'Authorized by GMD via Executive AI Mobile' : 'Declined by GMD via Executive AI Mobile',
    );

    if (mounted) {
      setState(() {
        _processingIds.remove(requestId);
        if (success) {
          if (approve) {
            _approvedRequestIds.add(requestId);
          } else {
            _declinedRequestIds.add(requestId);
          }
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: approve ? const Color(0xFF059669) : const Color(0xFFDC2626),
          content: Text(
            approve
                ? 'Request successfully authorized by GMD.'
                : 'Request declined.',
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _handleReminder(String caseId) {
    setState(() {
      _remindedCaseIds.add(caseId);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFFEA580C),
        content: Text(
          '⚡ High-priority WhatsApp/Slack reminder dispatched to case owner.',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final type = widget.data['type'] as String? ?? '';

    switch (type) {
      case 'TREASURY':
        return _buildTreasuryCard(context);
      case 'APPROVALS':
        return _buildApprovalsCard(context);
      case 'ACCOUNTABILITY':
        return _buildAccountabilityCard(context);
      case 'BRIEFING':
        return _buildBriefingCard(context);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildTreasuryCard(BuildContext context) {
    final accounts = (widget.data['accounts'] as List?) ?? [];
    final totalCash = widget.data['totalCash'] as String? ?? '₦0';

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
                  '● Live Reconciled',
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
                        Text(acc['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
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
    final count = widget.data['count'] ?? 0;
    final total = widget.data['total'] ?? '₦0';
    final requests = (widget.data['requests'] as List?) ?? [];

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BemsTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF97316).withOpacity(0.5), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF97316).withOpacity(0.1),
            blurRadius: 16,
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
                'EXECUTIVE AUTHORIZATION QUEUE',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: const Color(0xFFF97316)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF97316).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$count Pending',
                  style: const TextStyle(color: Color(0xFFFED7AA), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            total,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white),
          ),
          const SizedBox(height: 12),
          if (requests.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                '✓ No requisitions currently pending authorization.',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            )
          else
            ...requests.map((r) {
              final reqId = r['id']?.toString() ?? r['number']?.toString() ?? '';
              final isApproved = _approvedRequestIds.contains(reqId);
              final isDeclined = _declinedRequestIds.contains(reqId);
              final isProcessing = _processingIds.contains(reqId);

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isApproved
                        ? Colors.green.withOpacity(0.5)
                        : (isDeclined ? Colors.red.withOpacity(0.5) : Colors.white.withOpacity(0.08)),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r['title'] ?? '',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                              ),
                              Text(
                                '${r['number']} · ${r['by']}',
                                style: const TextStyle(fontSize: 11, color: Colors.white54),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          r['amount'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFFF97316)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (isApproved)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle_rounded, size: 14, color: Colors.greenAccent),
                            SizedBox(width: 4),
                            Text(
                              'Authorized by GMD',
                              style: TextStyle(color: Colors.greenAccent, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    else if (isDeclined)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.cancel_rounded, size: 14, color: Colors.redAccent),
                            SizedBox(width: 4),
                            Text(
                              'Declined by GMD',
                              style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    else
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.white60,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              visualDensity: VisualDensity.compact,
                            ),
                            onPressed: isProcessing ? null : () => _handleApproval(reqId, false),
                            child: const Text('Decline', style: TextStyle(fontSize: 11)),
                          ),
                          const SizedBox(width: 6),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF97316),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              visualDensity: VisualDensity.compact,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: isProcessing ? null : () => _handleApproval(reqId, true),
                            child: isProcessing
                                ? const SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.check_rounded, size: 13),
                                      SizedBox(width: 4),
                                      Text('Approve', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                          ),
                        ],
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildAccountabilityCard(BuildContext context) {
    final count = widget.data['count'] ?? 0;
    final cases = (widget.data['cases'] as List?) ?? [];

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BemsTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber.withOpacity(0.4), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ACCOUNTABILITY SLA MONITOR',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.amberAccent),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$count Open Cases',
                  style: const TextStyle(color: Colors.amberAccent, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...cases.map((c) {
            final caseId = c['id']?.toString() ?? c['number']?.toString() ?? '';
            final isReminded = _remindedCaseIds.contains(caseId);

            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.25),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c['number'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white)),
                      Text(c['owner'] ?? '', style: const TextStyle(color: Colors.white60, fontSize: 11)),
                    ],
                  ),
                  if (isReminded)
                    const Text('⚡ Reminder Pushed', style: TextStyle(color: Colors.amberAccent, fontSize: 11, fontWeight: FontWeight.bold))
                  else
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber.withOpacity(0.2),
                        foregroundColor: Colors.amberAccent,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        visualDensity: VisualDensity.compact,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      onPressed: () => _handleReminder(caseId),
                      child: const Text('Send Alert', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildBriefingCard(BuildContext context) {
    final cash = widget.data['cash'] ?? '₦0';
    final pending = widget.data['pending'] ?? 0;
    final openCases = widget.data['openCases'] ?? 0;
    final staff = widget.data['staff'] ?? 0;

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
