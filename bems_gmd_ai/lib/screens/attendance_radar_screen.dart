import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class AttendanceRadarScreen extends StatefulWidget {
  const AttendanceRadarScreen({super.key});

  @override
  State<AttendanceRadarScreen> createState() => _AttendanceRadarScreenState();
}

class _AttendanceRadarScreenState extends State<AttendanceRadarScreen> {
  bool _isLoading = true;
  String _targetDate = '';
  Map<String, dynamic> _counts = {};
  Map<String, dynamic> _policy = {};
  List<dynamic> _employees = [];
  String _filter = 'ALL'; // ALL | PRESENT | LATE | ABSENT | OFF_DAY

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  Future<void> _loadAttendance() async {
    setState(() => _isLoading = true);
    final res = await ApiService.fetchAttendanceTimesheet();
    if (mounted) {
      setState(() {
        _targetDate = res['date']?.toString() ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
        _counts = (res['counts'] as Map<String, dynamic>?) ?? {};
        _policy = (res['policy'] as Map<String, dynamic>?) ?? {};
        _employees = (res['employees'] as List<dynamic>?) ?? [];
        _isLoading = false;
      });
    }
  }

  List<dynamic> get _filteredEmployees {
    if (_filter == 'ALL') return _employees;
    return _employees.where((e) => (e['status']?.toString().toUpperCase() ?? '') == _filter).toList();
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
        return const Color(0xFF16A34A);
      case 'LATE':
        return const Color(0xFFEA580C);
      case 'HALF_DAY':
        return const Color(0xFFD97706);
      case 'EXCUSED':
        return const Color(0xFF2563EB);
      case 'OFF_DAY':
        return const Color(0xFF64748B);
      case 'ABSENT':
      default:
        return const Color(0xFFDC2626);
    }
  }

  Color _getStatusBg(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
        return const Color(0xFFDCFCE7);
      case 'LATE':
        return const Color(0xFFFFF7ED);
      case 'HALF_DAY':
        return const Color(0xFFFEF3C7);
      case 'EXCUSED':
        return const Color(0xFFEFF6FF);
      case 'OFF_DAY':
        return const Color(0xFFF1F5F9);
      case 'ABSENT':
      default:
        return const Color(0xFFFEE2E2);
    }
  }

  String _formatTime(String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return '—';
    try {
      final dt = DateTime.parse(timeStr).toLocal();
      return DateFormat('hh:mm a').format(dt);
    } catch (_) {
      return timeStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    final todayFormatted = DateFormat('EEEE, d MMMM yyyy').format(DateTime.now());

    final total = _counts['total'] ?? _employees.length;
    final present = _counts['present'] ?? 0;
    final late = _counts['late'] ?? 0;
    final absent = _counts['absent'] ?? 0;
    final offDay = _counts['offDay'] ?? 0;
    final excused = _counts['excused'] ?? 0;

    final resumption = _policy['resumptionTime'] ?? '08:00';
    final grace = _policy['gracePeriodMinutes'] ?? 15;
    final deductionPct = _policy['latenessDeductionPercent'] ?? 5.0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Live Attendance Radar', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
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
            onPressed: _loadAttendance,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
          : RefreshIndicator(
              onRefresh: _loadAttendance,
              color: const Color(0xFFEA580C),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // KPI Live Radar Card
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFF1E293B)]),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(color: const Color(0xFF0F172A).withOpacity(0.12), blurRadius: 16, offset: const Offset(0, 6)),
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
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                                ),
                                const SizedBox(width: 6),
                                const Text('CONGLOMERATE LIVE RADAR', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFFFB923C), letterSpacing: 0.8)),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                              decoration: BoxDecoration(color: const Color(0xFF059669), borderRadius: BorderRadius.circular(6)),
                              child: Text('DATE: $_targetDate', style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Colors.white)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(todayFormatted, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
                        const SizedBox(height: 14),

                        // Counts Grid
                        Row(
                          children: [
                            Expanded(child: _buildMetricTile('ENROLLED', '$total', Colors.white, const Color(0xFF334155))),
                            const SizedBox(width: 8),
                            Expanded(child: _buildMetricTile('PRESENT', '$present', const Color(0xFF4ADE80), const Color(0xFF14532D))),
                            const SizedBox(width: 8),
                            Expanded(child: _buildMetricTile('LATE', '$late', const Color(0xFFFDBA74), const Color(0xFF7C2D12))),
                            const SizedBox(width: 8),
                            Expanded(child: _buildMetricTile('ABSENT', '$absent', const Color(0xFFFCA5A5), const Color(0xFF7F1D1D))),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Off-Day: $offDay · Excused: $excused', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                            Text('Shift: $resumption (Grace: $grace m, -$deductionPct%)', style: const TextStyle(fontSize: 10.5, color: Color(0xFFCBD5E1))),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 18),

                  // Filter Pills
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterPill('ALL', 'All Staff ($total)'),
                        const SizedBox(width: 6),
                        _buildFilterPill('PRESENT', 'Present ($present)'),
                        const SizedBox(width: 6),
                        _buildFilterPill('LATE', 'Late ($late)'),
                        const SizedBox(width: 6),
                        _buildFilterPill('ABSENT', 'Absent ($absent)'),
                        const SizedBox(width: 6),
                        _buildFilterPill('OFF_DAY', 'Off-Day ($offDay)'),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('STAFF ROSTER & PUNCH STATUS (${_filteredEmployees.length})', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                      if (_filteredEmployees.isNotEmpty)
                        const Text('Sorted A-Z', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ],
                  ),
                  const SizedBox(height: 10),

                  if (_filteredEmployees.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(36),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: const Center(
                        child: Column(
                          children: [
                            Icon(Icons.schedule_rounded, size: 44, color: Color(0xFF94A3B8)),
                            SizedBox(height: 12),
                            Text('No records matching active filter', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                            SizedBox(height: 4),
                            Text('Change your filter or pull down to refresh roster.', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                    )
                  else
                    ..._filteredEmployees.map((emp) {
                      final name = emp['legalName'] ?? 'Staff Member';
                      final num = emp['employeeNumber'] ?? '';
                      final role = emp['role'] ?? 'STAFF';
                      final org = emp['organizationName'] ?? 'BEMS Group';
                      final loc = emp['workLocation'] ?? 'HQ';
                      final status = emp['status']?.toString() ?? 'ABSENT';
                      final checkIn = _formatTime(emp['checkInTime']?.toString());
                      final checkOut = _formatTime(emp['checkOutTime']?.toString());
                      final station = emp['stationName']?.toString();
                      final isOffline = emp['isOfflineStaff'] == true;
                      final isOverride = emp['isManualOverride'] == true;

                      final statusColor = _getStatusColor(status);
                      final statusBg = _getStatusBg(status);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Center(
                                child: Text(
                                  name.isNotEmpty ? name[0] : 'S',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          name,
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (isOffline)
                                        Container(
                                          margin: const EdgeInsets.only(left: 4),
                                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                          decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(4)),
                                          child: const Text('OFFLINE', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '$org · $loc · $role${num.isNotEmpty ? ' · $num' : ''}',
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Icon(Icons.login_rounded, size: 12, color: status == 'PRESENT' ? const Color(0xFF16A34A) : const Color(0xFF94A3B8)),
                                      const SizedBox(width: 3),
                                      Text('In: $checkIn', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                                      const SizedBox(width: 10),
                                      Icon(Icons.logout_rounded, size: 12, color: checkOut != '—' ? const Color(0xFF059669) : const Color(0xFF94A3B8)),
                                      const SizedBox(width: 3),
                                      Text('Out: $checkOut', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                                      if (station != null && station.isNotEmpty) ...[
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            '· $station',
                                            style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  if (isOverride) ...[
                                    const SizedBox(height: 3),
                                    Text('Manual HR/Admin Override: ${emp['overrideReason'] ?? 'Approved'}', style: const TextStyle(fontSize: 9.5, fontStyle: FontStyle.italic, color: Color(0xFFD97706))),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusBg,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: statusColor.withOpacity(0.3)),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: statusColor),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }

  Widget _buildMetricTile(String label, String value, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8))),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: textColor)),
        ],
      ),
    );
  }

  Widget _buildFilterPill(String filterKey, String label) {
    final isSelected = _filter == filterKey;
    return GestureDetector(
      onTap: () => setState(() => _filter = filterKey),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEA580C) : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}
