import 'package:flutter/material.dart';
import '../models/staff_models.dart';
import '../services/staff_api_service.dart';

class AttendanceMonthlyScreen extends StatefulWidget {
  final StaffUser currentUser;

  const AttendanceMonthlyScreen({super.key, required this.currentUser});

  @override
  State<AttendanceMonthlyScreen> createState() => _AttendanceMonthlyScreenState();
}

class _AttendanceMonthlyScreenState extends State<AttendanceMonthlyScreen> {
  static const Color brandOrange = Color(0xFFEA580C);
  static const Color cobaltDark = Color(0xFF0F172A);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);

  late int _currentMonth;
  late int _currentYear;
  bool _isLoading = true;
  String? _errorMessage;

  List<dynamic> _calendarDays = [];
  Map<String, dynamic> _summary = {};

  final List<String> _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _currentMonth = now.month;
    _currentYear = now.year;
    _loadTimesheet();
  }

  Future<void> _loadTimesheet() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await StaffApiService.fetchMonthlyTimesheet(
        employeeId: widget.currentUser.id,
        month: _currentMonth,
        year: _currentYear,
        token: widget.currentUser.token,
      );

      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _calendarDays = res['days'] as List<dynamic>? ?? [];
        _summary = res['summary'] as Map<String, dynamic>? ?? {};
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  void _previousMonth() {
    setState(() {
      if (_currentMonth == 1) {
        _currentMonth = 12;
        _currentYear--;
      } else {
        _currentMonth--;
      }
    });
    _loadTimesheet();
  }

  void _nextMonth() {
    setState(() {
      if (_currentMonth == 12) {
        _currentMonth = 1;
        _currentYear++;
      } else {
        _currentMonth++;
      }
    });
    _loadTimesheet();
  }

  void _showDayDetailSheet(Map<String, dynamic> day) {
    final status = day['status']?.toString() ?? 'UPCOMING';
    final checkIn = day['checkInTime']?.toString() ?? '—';
    final checkOut = day['checkOutTime']?.toString() ?? '—';
    final station = day['stationName']?.toString() ?? '—';
    final deduction = day['deductionPercent'] ?? 0;

    Color badgeColor = const Color(0xFF64748B);
    Color badgeBg = const Color(0xFFF1F5F9);
    String statusTitle = status;

    if (status == 'PRESENT') {
      badgeColor = const Color(0xFF059669);
      badgeBg = const Color(0xFFECFDF5);
      statusTitle = 'PRESENT (ON-TIME)';
    } else if (status == 'LATE') {
      badgeColor = const Color(0xFFEA580C);
      badgeBg = const Color(0xFFFFF7ED);
      statusTitle = 'LATE ARRIVAL';
    } else if (status == 'ABSENT') {
      badgeColor = const Color(0xFFDC2626);
      badgeBg = const Color(0xFFFEF2F2);
      statusTitle = 'UNEXCUSED ABSENCE';
    } else if (status == 'OFF_DAY') {
      badgeColor = const Color(0xFF475569);
      badgeBg = const Color(0xFFF8FAFC);
      statusTitle = 'WEEKLY OFF-DAY';
    } else if (status == 'EXCUSED') {
      badgeColor = const Color(0xFF6366F1);
      badgeBg = const Color(0xFFEEF2FF);
      statusTitle = 'HR EXCUSED ABSENCE';
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Colors.black12,
              blurRadius: 25,
              offset: Offset(0, -8),
            ),
          ],
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${day['dayName']}, ${day['date']}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Day ${day['dayNumber']} of ${_monthNames[_currentMonth - 1]} $_currentYear',
                      style: const TextStyle(fontSize: 12, color: textSecondary),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: badgeBg,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: badgeColor.withOpacity(0.3)),
                  ),
                  child: Text(
                    statusTitle,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: badgeColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildDetailStat('Morning Resumption', checkIn, Icons.login_rounded, const Color(0xFF0284C7)),
                      _buildDetailStat('Evening Closing', checkOut, Icons.logout_rounded, const Color(0xFF059669)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Divider(height: 1, color: Color(0xFFE2E8F0)),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildDetailStat('Station Location', station, Icons.location_on_rounded, brandOrange),
                      _buildDetailStat(
                        'Lateness Penalty',
                        deduction > 0 ? '$deduction% deduction' : 'None (0%)',
                        Icons.shield_outlined,
                        deduction > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: cobaltDark,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Close Inspector', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailStat(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: textSecondary, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: textPrimary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: Container(
              height: 38,
              width: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: textPrimary),
            ),
          ),
        ),
        centerTitle: true,
        title: const Column(
          children: [
            Text(
              'Monthly Timesheet',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            Text(
              'Attendance & Punctuality Calendar',
              style: TextStyle(fontSize: 11, color: textSecondary, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: brandOrange))
            : _errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 40),
                          const SizedBox(height: 12),
                          Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFDC2626))),
                          const SizedBox(height: 16),
                          ElevatedButton(onPressed: _loadTimesheet, child: const Text('Retry')),
                        ],
                      ),
                    ),
                  )
                : SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Month Navigator Bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: const [
                              BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 1)),
                            ],
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              IconButton(
                                onPressed: _previousMonth,
                                icon: const Icon(Icons.chevron_left_rounded, size: 26, color: textPrimary),
                              ),
                              Row(
                                children: [
                                  const Icon(Icons.calendar_month_rounded, color: brandOrange, size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    '${_monthNames[_currentMonth - 1]} $_currentYear',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900,
                                      color: textPrimary,
                                      letterSpacing: -0.2,
                                    ),
                                  ),
                                ],
                              ),
                              IconButton(
                                onPressed: _nextMonth,
                                icon: const Icon(Icons.chevron_right_rounded, size: 26, color: textPrimary),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 14),

                        // Monthly Summary KPI Cards
                        Row(
                          children: [
                            _buildKpiCard('Present', '${_summary['present'] ?? 0}', const Color(0xFF059669), const Color(0xFFECFDF5)),
                            const SizedBox(width: 8),
                            _buildKpiCard('Late', '${_summary['late'] ?? 0}', const Color(0xFFEA580C), const Color(0xFFFFF7ED)),
                            const SizedBox(width: 8),
                            _buildKpiCard('Absent', '${_summary['absent'] ?? 0}', const Color(0xFFDC2626), const Color(0xFFFEF2F2)),
                            const SizedBox(width: 8),
                            _buildKpiCard('Off-Days', '${_summary['offDays'] ?? 0}', const Color(0xFF64748B), const Color(0xFFF8FAFC)),
                          ],
                        ),

                        const SizedBox(height: 16),

                        // Calendar Container
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: const [
                              BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2)),
                            ],
                          ),
                          child: Column(
                            children: [
                              // 7 Day Headers
                              const Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  _DayHeader('Mon'),
                                  _DayHeader('Tue'),
                                  _DayHeader('Wed'),
                                  _DayHeader('Thu'),
                                  _DayHeader('Fri'),
                                  _DayHeader('Sat'),
                                  _DayHeader('Sun'),
                                ],
                              ),
                              const SizedBox(height: 8),
                              const Divider(height: 1, color: Color(0xFFF1F5F9)),
                              const SizedBox(height: 8),

                              // Grid of Days
                              _buildCalendarGrid(),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Color Legend
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('COLOR LEGEND', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: textSecondary, letterSpacing: 0.5)),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 14,
                                runSpacing: 6,
                                children: [
                                  _buildLegendItem(const Color(0xFF059669), 'Present (On-Time)'),
                                  _buildLegendItem(const Color(0xFFEA580C), 'Late Arrival (+5% Ded.)'),
                                  _buildLegendItem(const Color(0xFFDC2626), 'Absent (100% Ded.)'),
                                  _buildLegendItem(const Color(0xFF64748B), 'Weekly Off-Day'),
                                  _buildLegendItem(const Color(0xFF6366F1), 'HR Excused'),
                                ],
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: textPrimary)),
      ],
    );
  }

  Widget _buildCalendarGrid() {
    if (_calendarDays.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Text('No calendar data found for this month.', style: TextStyle(fontSize: 12, color: textSecondary)),
      );
    }

    // Determine leading offset for first day of the month (Monday = 0, Sunday = 6)
    final firstDay = _calendarDays.first;
    final firstDayOfWeek = (firstDay['dayOfWeek'] as int? ?? 1); // 0 = Sun
    // Convert Sunday-indexed (0=Sun, 1=Mon, ..., 6=Sat) to Monday-indexed (0=Mon, ..., 6=Sun)
    final mondayIndexedOffset = (firstDayOfWeek + 6) % 7;

    final totalSlots = mondayIndexedOffset + _calendarDays.length;
    final rowCount = (totalSlots / 7).ceil();

    return Column(
      children: List.generate(rowCount, (rowIndex) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(7, (colIndex) {
              final slotIndex = rowIndex * 7 + colIndex;
              final dayIndex = slotIndex - mondayIndexedOffset;

              if (dayIndex < 0 || dayIndex >= _calendarDays.length) {
                return const SizedBox(width: 42, height: 48);
              }

              final dayData = _calendarDays[dayIndex] as Map<String, dynamic>;
              return _buildDayTile(dayData);
            }),
          ),
        );
      }),
    );
  }

  Widget _buildDayTile(Map<String, dynamic> day) {
    final dayNum = day['dayNumber'] ?? 0;
    final status = day['status']?.toString() ?? 'UPCOMING';
    final isOffDay = day['isOffDay'] == true;
    final checkIn = day['checkInTime']?.toString();

    Color bgColor = Colors.transparent;
    Color textColor = textPrimary;
    Color borderColor = Colors.transparent;
    String subLabel = '';

    if (status == 'PRESENT') {
      bgColor = const Color(0xFFECFDF5);
      textColor = const Color(0xFF059669);
      borderColor = const Color(0xFFA7F3D0);
      subLabel = checkIn != null ? checkIn.split(' ')[0] : '✓';
    } else if (status == 'LATE') {
      bgColor = const Color(0xFFFFF7ED);
      textColor = const Color(0xFFEA580C);
      borderColor = const Color(0xFFFED7AA);
      subLabel = checkIn != null ? checkIn.split(' ')[0] : 'Late';
    } else if (status == 'ABSENT') {
      bgColor = const Color(0xFFFEF2F2);
      textColor = const Color(0xFFDC2626);
      borderColor = const Color(0xFFFECACA);
      subLabel = 'ABS';
    } else if (status == 'OFF_DAY' || isOffDay) {
      bgColor = const Color(0xFFF8FAFC);
      textColor = const Color(0xFF94A3B8);
      borderColor = const Color(0xFFE2E8F0);
      subLabel = 'OFF';
    } else if (status == 'EXCUSED') {
      bgColor = const Color(0xFFEEF2FF);
      textColor = const Color(0xFF6366F1);
      borderColor = const Color(0xFFC7D2FE);
      subLabel = 'EXC';
    } else {
      // UPCOMING
      textColor = const Color(0xFFCBD5E1);
      subLabel = '—';
    }

    return GestureDetector(
      onTap: () => _showDayDetailSheet(day),
      child: Container(
        width: 42,
        height: 48,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$dayNum',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: textColor,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              subLabel,
              style: TextStyle(
                fontSize: 8.5,
                fontWeight: FontWeight.w800,
                color: textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayHeader extends StatelessWidget {
  final String label;
  const _DayHeader(this.label);

  @override
  Widget build(BuildContext context) {
    final isWeekend = label == 'Sat' || label == 'Sun';
    return SizedBox(
      width: 42,
      child: Center(
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: isWeekend ? const Color(0xFFEA580C) : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }
}
