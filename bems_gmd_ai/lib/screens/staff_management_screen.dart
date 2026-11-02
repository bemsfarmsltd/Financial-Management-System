import 'package:flutter/material.dart';
import '../services/api_service.dart';

class StaffManagementScreen extends StatefulWidget {
  const StaffManagementScreen({super.key});

  @override
  State<StaffManagementScreen> createState() => _StaffManagementScreenState();
}

class _StaffManagementScreenState extends State<StaffManagementScreen> {
  bool _isLoading = true;
  String _activeTab = 'pending'; // 'pending' | 'directory'
  List<dynamic> _pendingStaff = [];
  List<dynamic> _directoryStaff = [];
  String _searchQuery = '';
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _isLoading = true);
    final approvalData = await ApiService.fetchStaffApprovals();
    final dirData = await ApiService.fetchStaffDirectory();

    if (mounted) {
      setState(() {
        _pendingStaff = (approvalData['employees'] as List<dynamic>?) ?? [];
        _directoryStaff = dirData;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleDecision(String employeeId, String decision) async {
    setState(() => _busyId = employeeId);
    try {
      await ApiService.decideStaffApproval(
        employeeId: employeeId,
        decision: decision,
        role: 'STAFF',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(decision == 'APPROVE' ? '✓ Staff account approved & access granted.' : 'Staff signup declined.'),
            backgroundColor: decision == 'APPROVE' ? const Color(0xFF059669) : const Color(0xFFDC2626),
          ),
        );
        _loadAll();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: const Color(0xFFDC2626)),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _toggleStatus(String employeeId, String currentStatus) async {
    final newStatus = currentStatus == 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setState(() => _busyId = employeeId);
    try {
      final success = await ApiService.updateStaffStatus(employeeId: employeeId, status: newStatus);
      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✓ Staff account ${newStatus == 'ACTIVE' ? 'reactivated' : 'suspended'}.'),
              backgroundColor: newStatus == 'ACTIVE' ? const Color(0xFF059669) : const Color(0xFFD97706),
            ),
          );
          _loadAll();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to update status'), backgroundColor: Color(0xFFDC2626)),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Staff Onboarding & Directory', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
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
            onPressed: _loadAll,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
          : Column(
              children: [
                // Top Segmented Control
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  color: Colors.white,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
                    child: Row(
                      children: [
                        _buildTabButton('pending', 'Pending Approvals (${_pendingStaff.length})'),
                        _buildTabButton('directory', 'All Staff Directory (${_directoryStaff.length})'),
                      ],
                    ),
                  ),
                ),

                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadAll,
                    color: const Color(0xFFEA580C),
                    child: _activeTab == 'pending' ? _buildPendingView() : _buildDirectoryView(),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildTabButton(String key, String title) {
    final isSelected = _activeTab == key;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = key),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: isSelected ? const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 4, offset: Offset(0, 2))] : null,
          ),
          child: Center(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? const Color(0xFFEA580C) : const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPendingView() {
    if (_pendingStaff.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(36),
        children: [
          Center(
            child: Column(
              children: [
                Icon(Icons.check_circle_outline_rounded, size: 48, color: Colors.grey.shade400),
                const SizedBox(height: 12),
                const Text('No pending staff registrations', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                const SizedBox(height: 4),
                const Text('All self-service signups have been reviewed.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _pendingStaff.length,
      itemBuilder: (context, idx) {
        final staff = _pendingStaff[idx];
        return _buildPendingStaffCard(staff);
      },
    );
  }

  Widget _buildPendingStaffCard(Map<String, dynamic> staff) {
    final id = staff['id']?.toString() ?? '';
    final name = staff['legalName'] ?? 'Staff Applicant';
    final email = staff['workEmail'] ?? '';
    final phone = staff['phone'] ?? 'No phone';
    final jobTitle = staff['jobTitle'] ?? 'Staff';
    final cityState = staff['cityState'] ?? 'N/A';
    final bankName = staff['bankName'] ?? 'Bank Not Specified';
    final accountNumber = staff['accountNumber'] ?? 'N/A';
    final accountName = staff['accountName'] ?? name;
    final assignments = (staff['assignments'] as List<dynamic>?) ?? [];
    final firstAssignment = assignments.isNotEmpty && assignments[0] is Map ? assignments[0] : null;
    final subName = firstAssignment != null && firstAssignment['subsidiary'] is Map
        ? (firstAssignment['subsidiary']['legalName'] ?? firstAssignment['subsidiary']['code'])
        : 'BEMS Subsidiary';
    final deptName = firstAssignment != null && firstAssignment['department'] is Map
        ? firstAssignment['department']['name']
        : 'Operations';
    final isBusy = _busyId == id;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
                decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(6)),
                child: const Text('PENDING APPROVAL', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
              ),
              Text(jobTitle, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
            ],
          ),
          const SizedBox(height: 8),
          Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          const SizedBox(height: 2),
          Text('$email · $phone', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),

          const SizedBox(height: 10),

          // Department & Location Card
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Subsidiary & Dept', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                      Text('$subName · $deptName', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Operating Hub', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                      Text(cityState, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFFEA580C))),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),

          // Monnify-Verified Payout Account Card
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.account_balance_rounded, size: 13, color: Color(0xFFEA580C)),
                        const SizedBox(width: 5),
                        Text(bankName, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(4)),
                      child: const Text('✓ Monnify Verified', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('$accountNumber · $accountName', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Actions
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isBusy ? null : () => _handleDecision(id, 'REJECT'),
                  child: const Text('Decline', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  icon: isBusy
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.check_rounded, size: 16, color: Colors.white),
                  label: const Text('Approve Access', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  onPressed: isBusy ? null : () => _handleDecision(id, 'APPROVE'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDirectoryView() {
    final filtered = _directoryStaff.where((s) {
      final name = (s['legalName'] ?? '').toString().toLowerCase();
      final email = (s['workEmail'] ?? '').toString().toLowerCase();
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || email.contains(query);
    }).toList();

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Colors.white,
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search staff by name or email...',
              hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
              prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFFF1F5F9),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
            onChanged: (val) => setState(() => _searchQuery = val),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(36),
                  children: const [
                    Center(child: Text('No staff records match your query.', style: TextStyle(color: Color(0xFF64748B), fontSize: 12))),
                  ],
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final staff = filtered[idx];
                    final id = staff['id']?.toString() ?? '';
                    final name = staff['legalName'] ?? 'Staff Member';
                    final email = staff['workEmail'] ?? '';
                    final phone = staff['phone'] ?? 'No phone';
                    final status = (staff['status'] ?? 'ACTIVE').toString().toUpperCase();
                    final isActive = status == 'ACTIVE';
                    final isBusy = _busyId == id;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              isActive ? Icons.person_outline_rounded : Icons.person_off_outlined,
                              color: isActive ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                const SizedBox(height: 2),
                                Text('$email · $phone', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: isBusy
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                : Icon(
                                    isActive ? Icons.block_rounded : Icons.check_circle_outline_rounded,
                                    color: isActive ? const Color(0xFFDC2626) : const Color(0xFF059669),
                                    size: 20,
                                  ),
                            tooltip: isActive ? 'Suspend Account' : 'Reactivate Account',
                            onPressed: isBusy ? null : () => _toggleStatus(id, status),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
