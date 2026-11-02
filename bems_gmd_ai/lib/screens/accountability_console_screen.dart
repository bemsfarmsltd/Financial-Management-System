import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class AccountabilityConsoleScreen extends StatefulWidget {
  const AccountabilityConsoleScreen({super.key});

  @override
  State<AccountabilityConsoleScreen> createState() => _AccountabilityConsoleScreenState();
}

class _AccountabilityConsoleScreenState extends State<AccountabilityConsoleScreen> {
  bool _isLoading = true;
  String _selectedFilter = 'all'; // 'all', 'overdue', 'open', 'closed'
  List<dynamic> _cases = [];
  String? _busyCaseId;

  @override
  void initState() {
    super.initState();
    _loadCases();
  }

  Future<void> _loadCases() async {
    setState(() => _isLoading = true);
    final list = await ApiService.fetchAccountabilityList();
    if (mounted) {
      setState(() {
        _cases = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _closeCase(String caseId) async {
    final noteController = TextEditingController(text: 'Retirement receipts and deliverables inspected and verified.');
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Row(
          children: [
            Icon(Icons.verified_rounded, color: Color(0xFF059669), size: 22),
            SizedBox(width: 8),
            Text('Approve & Close Advance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Confirm that the staff member submitted valid receipts and full deliverables for this cash advance.',
              style: TextStyle(fontSize: 12.5, color: Color(0xFF475569)),
            ),
            const SizedBox(height: 12),
            const Text('Executive Closure Notes', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
            const SizedBox(height: 6),
            TextField(
              controller: noteController,
              maxLines: 2,
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                contentPadding: const EdgeInsets.all(10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Approve Closure', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _busyCaseId = caseId);
    try {
      final success = await ApiService.closeAccountabilityCase(
        caseId: caseId,
        notes: noteController.text.trim(),
      );
      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('✓ Advance accountability verified and closed.'), backgroundColor: Color(0xFF059669)),
          );
          _loadCases();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to close accountability case.'), backgroundColor: Color(0xFFDC2626)),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _busyCaseId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    int overdueCount = 0;
    int openCount = 0;
    int closedCount = 0;

    for (final c in _cases) {
      final status = (c['status'] ?? '').toString().toUpperCase();
      final dueAt = c['dueAt'] != null ? DateTime.tryParse(c['dueAt']) : null;
      final isOverdue = status == 'OVERDUE' || (status != 'CLOSED' && dueAt != null && dueAt.isBefore(now));

      if (status == 'CLOSED') {
        closedCount++;
      } else if (isOverdue) {
        overdueCount++;
      } else {
        openCount++;
      }
    }

    final filteredCases = _cases.where((c) {
      final status = (c['status'] ?? '').toString().toUpperCase();
      final dueAt = c['dueAt'] != null ? DateTime.tryParse(c['dueAt']) : null;
      final isOverdue = status == 'OVERDUE' || (status != 'CLOSED' && dueAt != null && dueAt.isBefore(now));

      if (_selectedFilter == 'overdue') return isOverdue;
      if (_selectedFilter == 'open') return !isOverdue && status != 'CLOSED';
      if (_selectedFilter == 'closed') return status == 'CLOSED';
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Accountability & 72h SLA', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B), size: 20),
            onPressed: _loadCases,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
          : RefreshIndicator(
              onRefresh: _loadCases,
              color: const Color(0xFFEA580C),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // 72h SLA Command Banner
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFFEA580C), Color(0xFFC2410C)]),
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: const [BoxShadow(color: Color(0x33EA580C), blurRadius: 10, offset: Offset(0, 4))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('72-HOUR MANDATORY RETIREMENT SLA', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5)),
                            Icon(Icons.timer_outlined, color: Colors.white, size: 18),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            _buildStatItem('Overdue', '$overdueCount', const Color(0xFFDC2626)),
                            const SizedBox(width: 12),
                            _buildStatItem('Active Advances', '$openCount', Colors.white),
                            const SizedBox(width: 12),
                            _buildStatItem('Closed & Retired', '$closedCount', const Color(0xFF86EFAC)),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('all', 'All (${_cases.length})'),
                        const SizedBox(width: 8),
                        _buildFilterChip('overdue', 'Overdue ($overdueCount)'),
                        const SizedBox(width: 8),
                        _buildFilterChip('open', 'Active SLA ($openCount)'),
                        const SizedBox(width: 8),
                        _buildFilterChip('closed', 'Closed ($closedCount)'),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // List of Cases
                  if (filteredCases.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(36),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: Column(
                        children: [
                          Icon(Icons.shield_outlined, size: 48, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          const Text('No accountability cases', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                          const SizedBox(height: 4),
                          const Text('All disbursed advances are compliant.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        ],
                      ),
                    )
                  else
                    ...filteredCases.map((c) => _buildCaseCard(c)),
                ],
              ),
            ),
    );
  }

  Widget _buildStatItem(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: Colors.black.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFFCBD5E1), fontWeight: FontWeight.w600)),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String title) {
    final isSelected = _selectedFilter == key;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEA580C) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          title,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }

  Widget _buildCaseCard(Map<String, dynamic> c) {
    final request = c['request'] is Map ? c['request'] : {};
    final owner = c['owner'] is Map ? c['owner'] : (request['requester'] is Map ? request['requester'] : {});
    final ownerName = owner['legalName'] ?? 'Staff Member';
    final ownerEmail = owner['workEmail'] ?? '';
    final title = c['title'] ?? request['title'] ?? 'Advance Requisition';
    final reqNumber = c['requestNumber'] ?? request['requestNumber'] ?? '';
    final amount = c['amountNaira'] ?? c['amount'] ?? 0;
    final amountFormatted = '₦${NumberFormat('#,##0').format(amount)}';
    final status = (c['status'] ?? '').toString().toUpperCase();
    final dueAt = c['dueAt'] != null ? DateTime.tryParse(c['dueAt']) : null;
    final now = DateTime.now();
    final isOverdue = status == 'OVERDUE' || (status != 'CLOSED' && dueAt != null && dueAt.isBefore(now));
    final isClosed = status == 'CLOSED';
    final attachments = (c['attachments'] as List<dynamic>?) ?? [];
    final isBusy = _busyCaseId == c['id'];

    Color badgeBg;
    Color badgeText;
    String statusLabel;

    if (isClosed) {
      badgeBg = const Color(0xFFDCFCE7);
      badgeText = const Color(0xFF16A34A);
      statusLabel = 'CLOSED & VERIFIED';
    } else if (isOverdue) {
      badgeBg = const Color(0xFFFEE2E2);
      badgeText = const Color(0xFFDC2626);
      statusLabel = 'SLA OVERDUE (>72H)';
    } else {
      badgeBg = const Color(0xFFFEF3C7);
      badgeText = const Color(0xFFD97706);
      statusLabel = 'ACTIVE RETIREMENT';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isOverdue ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x050F172A), blurRadius: 6, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(6)),
                child: Text(statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: badgeText)),
              ),
              Text(amountFormatted, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          Text('$reqNumber · $ownerName ($ownerEmail)', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),

          const SizedBox(height: 10),

          // Receipts / Deliverables Section
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Row(
              children: [
                const Icon(Icons.attachment_rounded, size: 14, color: Color(0xFF64748B)),
                const SizedBox(width: 6),
                Text(
                  attachments.isEmpty ? 'No receipts submitted yet' : '${attachments.length} Evidence attachment(s) uploaded',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: attachments.isEmpty ? const Color(0xFF94A3B8) : const Color(0xFF059669)),
                ),
              ],
            ),
          ),

          if (!isClosed) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 38,
              child: ElevatedButton.icon(
                icon: isBusy
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check_circle_outline_rounded, size: 15, color: Colors.white),
                label: const Text('Approve & Close Advance', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
                onPressed: isBusy ? null : () => _closeCase(c['id']),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
