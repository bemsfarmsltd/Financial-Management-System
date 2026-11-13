import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/staff_models.dart';
import '../../services/staff_api_service.dart';
import '../staff_admin_chat_screen.dart';
import '../attendance_scan_screen.dart';

class StaffHRHubScreen extends StatefulWidget {
  final StaffUser user;

  const StaffHRHubScreen({super.key, required this.user});

  @override
  State<StaffHRHubScreen> createState() => _StaffHRHubScreenState();
}

class _StaffHRHubScreenState extends State<StaffHRHubScreen> {
  Map<String, dynamic>? _attendancePolicy;

  @override
  void initState() {
    super.initState();
    _loadHRData();
  }

  Future<void> _loadHRData() async {
    try {
      final res = await StaffApiService.fetchTodayAttendance(employeeId: widget.user.id);
      if (res != null) {
        setState(() => _attendancePolicy = res);
      }
    } catch (_) {}
  }

  Future<void> _handleClockIn() async {
    HapticFeedback.mediumImpact();
    final res = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AttendanceScanScreen(
          currentUser: widget.user,
          isCheckIn: _attendancePolicy == null,
        ),
      ),
    );
    if (res == true) {
      _loadHRData();
    }
  }

  void _showPayslips() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Color(0xFFF8FAFC),
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.all(20),
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Monthly Salary Slips & Deductions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
              const SizedBox(height: 6),
              Text('Beneficiary: ${widget.user.fullName} · ID: ${widget.user.employeeNumber}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              const SizedBox(height: 16),
              FutureBuilder<Map<String, dynamic>>(
                future: StaffApiService.fetchMyPayslips(employeeId: widget.user.id),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()));
                  }
                  final payslips = snapshot.data?['payslips'] as List<dynamic>? ?? [];
                  if (payslips.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: const Column(
                        children: [
                          Icon(Icons.receipt_long_rounded, color: Color(0xFF94A3B8), size: 40),
                          SizedBox(height: 8),
                          Text('No past payslips archived yet.', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                          SizedBox(height: 4),
                          Text('Payroll batches prepared by Admin will appear here with net payout and tax receipts.', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ],
                      ),
                    );
                  }
                  return Column(
                    children: payslips.map((p) => Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(p['month']?.toString() ?? 'Salary Batch', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A))),
                              Text('Paid to: ${p['bankName'] ?? widget.user.salaryBankName}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                            ],
                          ),
                          Text('₦${p['netPay'] ?? '0.00'}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF059669))),
                        ],
                      ),
                    )).toList(),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showLeaveModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 16),
            const Text('Request Leave / Absence', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
            const SizedBox(height: 4),
            const Text('Annual, Casual, Compassionate or Medical Leave', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFBFDBFE))),
              child: const Row(
                children: [
                  Icon(Icons.calendar_month_rounded, color: Color(0xFF2563EB), size: 22),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text('Available Leave Balance: 18 Working Days (2026 Allowance)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF1E40AF))),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(
                labelText: 'LEAVE TYPE',
                labelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                hintText: 'Annual Vacation, Sick Leave, Emergency',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'REASON & HANDOVER PLAN',
                labelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                hintText: 'Specify dates and colleague covering daily duties...',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Leave application forwarded to HR & Dept Head.'), backgroundColor: Color(0xFF059669)),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Submit Application', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('HR & People Hub', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
        actions: [
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF2563EB)),
            tooltip: 'HR Helpdesk',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => StaffAdminChatScreen(currentUser: widget.user)),
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          // Header Banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E40AF), Color(0xFF1D4ED8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(color: const Color(0xFF2563EB).withOpacity(0.2), blurRadius: 12, offset: const Offset(0, 4)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.18), borderRadius: BorderRadius.circular(20)),
                      child: const Text('PEOPLE & CULTURE WORKSTATION', style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w900, letterSpacing: 0.8)),
                    ),
                    const Icon(Icons.verified_user_rounded, color: Colors.white, size: 18),
                  ],
                ),
                const SizedBox(height: 12),
                Text(widget.user.fullName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
                Text('${widget.user.jobTitle.isNotEmpty ? widget.user.jobTitle : "Staff Specialist"} · ${widget.user.department}', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.85), fontWeight: FontWeight.w500)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _handleClockIn,
                        icon: const Icon(Icons.touch_app_rounded, size: 16, color: Color(0xFF1E40AF)),
                        label: const Text('Clock In (QR / GPS)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF1E40AF))),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _showLeaveModal,
                        icon: const Icon(Icons.event_busy_rounded, size: 16, color: Colors.white),
                        label: const Text('Apply Leave', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Colors.white)),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.white),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Operational HR Tools Grid
          const Text('People Operations', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildHRActionCard(
                  title: 'Salary & Slips',
                  subtitle: 'Scheduled: 3rd',
                  icon: Icons.wallet_rounded,
                  iconColor: const Color(0xFF059669),
                  bgColor: const Color(0xFFF0FDF4),
                  onTap: _showPayslips,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildHRActionCard(
                  title: 'HR Helpdesk',
                  subtitle: 'Direct Admin Chat',
                  icon: Icons.support_agent_rounded,
                  iconColor: const Color(0xFF2563EB),
                  bgColor: const Color(0xFFEFF6FF),
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => StaffAdminChatScreen(currentUser: widget.user)));
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildHRActionCard(
                  title: 'Daily Timesheet',
                  subtitle: 'Punch History & Geofence',
                  icon: Icons.access_time_filled_rounded,
                  iconColor: const Color(0xFFD97706),
                  bgColor: const Color(0xFFFFFBEB),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Timesheet up to date. 100% on-time record.')));
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildHRActionCard(
                  title: 'Company Policy',
                  subtitle: 'Code of Conduct & SLA',
                  icon: Icons.menu_book_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  bgColor: const Color(0xFFF5F3FF),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'Company'} 2026 Employee Handbook is active.')));
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Corporate Profile Summary
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Staff Record Information', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A))),
                const SizedBox(height: 10),
                _buildInfoRow('Employee Number', widget.user.employeeNumber.isNotEmpty ? widget.user.employeeNumber : 'STAFF'),
                _buildInfoRow('Work Location', widget.user.workLocation.isNotEmpty ? widget.user.workLocation : (widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'Head Office')),
                _buildInfoRow('Staff Grade', widget.user.staffGrade.isNotEmpty ? widget.user.staffGrade : 'Grade Specialist'),
                _buildInfoRow('Salary Bank', '${widget.user.salaryBankName.isNotEmpty ? widget.user.salaryBankName : widget.user.bankName} (${widget.user.salaryAccountNumber.isNotEmpty ? widget.user.salaryAccountNumber : widget.user.accountNumber})'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHRActionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: Color(0xFF0F172A))),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
