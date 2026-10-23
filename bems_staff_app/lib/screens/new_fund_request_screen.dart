import 'package:flutter/material.dart';
import '../models/staff_models.dart';
import '../services/staff_api_service.dart';

class NewFundRequestScreen extends StatefulWidget {
  final StaffUser user;
  final VoidCallback onSubmitted;

  const NewFundRequestScreen({
    super.key,
    required this.user,
    required this.onSubmitted,
  });

  @override
  State<NewFundRequestScreen> createState() => _NewFundRequestScreenState();
}

class _NewFundRequestScreenState extends State<NewFundRequestScreen> {
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _justificationController = TextEditingController();
  final _deliverableController = TextEditingController();

  late String _selectedSubsidiary;
  String _selectedCategory = 'Feed Ingredients & Raw Grain';
  String _selectedUrgency = 'HIGH';
  bool _isSubmitting = false;

  // Due Date & Time
  DateTime _selectedDueDate = DateTime.now().add(const Duration(days: 2));
  TimeOfDay _selectedDueTime = const TimeOfDay(hour: 14, minute: 0);

  // Recurring Controls (with 7-Day Admin Alert)
  bool _isRecurring = false;
  String _recurringInterval = 'MONTHLY';

  // Payee / Vendor Selector (3-Way Matching Registry)
  String _payeeType = 'STAFF_ADVANCE'; // 'STAFF_ADVANCE' or 'VENDOR'
  String? _selectedVendor;

  final List<String> _categories = [
    'Feed Ingredients & Raw Grain',
    'Machinery & Spares Repair',
    'Fuel & Logistics Haulage',
    'Farm Inputs & Agro-Chemicals',
    'Staff Welfare & Per-Diem',
    'Utility & Operations',
  ];

  final List<String> _recurringOptions = [
    'WEEKLY',
    'BI_WEEKLY',
    'MONTHLY',
    'QUARTERLY',
  ];

  List<Map<String, String>> _approvedVendors = [];

  @override
  void initState() {
    super.initState();
    _selectedSubsidiary = widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'BEMS Feed Mill Operations';
    _deliverableController.text = 'Goods Received Note (GRN) & Vendor Receipt';
    _loadVendors();
  }

  Future<void> _loadVendors() async {
    try {
      final vendors = await StaffApiService.fetchVendors(employeeId: widget.user.id);
      if (mounted) {
        setState(() {
          _approvedVendors = vendors.map((v) => {
            'name': (v['name'] ?? '').toString(),
            'category': (v['category'] ?? 'GENERAL').toString(),
            'bank': '${v['bankName'] ?? ''} (${v['accountNumber'] ?? ''})'.trim(),
          }).where((v) => v['name']!.isNotEmpty).toList();
          if (_approvedVendors.isNotEmpty && (_selectedVendor == null || !_approvedVendors.any((v) => v['name'] == _selectedVendor))) {
            _selectedVendor = _approvedVendors.first['name'];
          }
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _justificationController.dispose();
    _deliverableController.dispose();
    super.dispose();
  }

  Future<void> _pickDueDate() async {
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _selectedDueDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFEA580C),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedDate != null) {
      if (!mounted) return;
      final pickedTime = await showTimePicker(
        context: context,
        initialTime: _selectedDueTime,
        builder: (context, child) {
          return Theme(
            data: Theme.of(context).copyWith(
              colorScheme: const ColorScheme.light(
                primary: Color(0xFFEA580C),
                onPrimary: Colors.white,
                onSurface: Color(0xFF0F172A),
              ),
            ),
            child: child!,
          );
        },
      );

      if (pickedTime != null) {
        setState(() {
          _selectedDueDate = pickedDate;
          _selectedDueTime = pickedTime;
        });
      }
    }
  }

  String _formatDueDate() {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hour = _selectedDueTime.hour.toString().padLeft(2, '0');
    final minute = _selectedDueTime.minute.toString().padLeft(2, '0');
    return '${_selectedDueDate.day} ${months[_selectedDueDate.month - 1]} ${_selectedDueDate.year}, $hour:$minute';
  }

  Future<void> _submitRequest() async {
    final title = _titleController.text.trim();
    final amountText = _amountController.text.replaceAll(',', '').replaceAll('₦', '').trim();
    final amount = double.tryParse(amountText) ?? 0;
    final justification = _justificationController.text.trim();
    final deliverable = _deliverableController.text.trim();

    if (title.isEmpty) {
      _showError('Please enter a brief request title / purpose.');
      return;
    }
    if (amount <= 0) {
      _showError('Please enter a valid amount.');
      return;
    }
    if (justification.isEmpty) {
      _showError('Please provide a business justification.');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final formattedDue = _formatDueDate();

      await StaffApiService.createFundRequest(
        title: title,
        justification: justification,
        deliverable: deliverable,
        category: _selectedCategory,
        subsidiary: _selectedSubsidiary,
        department: widget.user.department.isNotEmpty ? widget.user.department : 'Operations',
        amountNaira: amount,
        urgency: _selectedUrgency,
        neededBy: _selectedUrgency == 'CRITICAL' ? 'Immediate' : 'Within 24 Hours',
        dueDate: formattedDue,
        isRecurring: _isRecurring,
        recurringInterval: _isRecurring ? _recurringInterval : null,
        vendorName: _payeeType == 'VENDOR' ? (_selectedVendor ?? 'External Vendor') : widget.user.fullName,
        isIntercompany: _selectedSubsidiary != widget.user.subsidiary,
      );

      if (!mounted) return;
      widget.onSubmitted();
      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isRecurring
                ? '✓ Recurring requisition scheduled! Admin & Treasury alerted 7 days prior.'
                : '✓ Requisition successfully submitted for Departmental & GMD Review.',
          ),
          backgroundColor: const Color(0xFF059669),
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (e) {
      _showError('Failed to submit request: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: const Color(0xFFDC2626)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'New Fund Requisition',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Amount Input Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.3)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFEA580C).withOpacity(0.06),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'REQUISITION AMOUNT (NGN)',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFEA580C), letterSpacing: 0.8),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text(
                        '₦',
                        style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _amountController,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          decoration: const InputDecoration(
                            hintText: '0',
                            hintStyle: TextStyle(color: Color(0xFFCBD5E1)),
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            // Form Fields Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  _buildSectionLabel('EXPENDITURE PURPOSE'),
                  const SizedBox(height: 6),
                  _buildTextField(
                    controller: _titleController,
                    hintText: 'e.g. Bulk procurement of yellow maize (Batch 43)',
                    icon: Icons.title_rounded,
                  ),

                  const SizedBox(height: 16),

                  // Due Date & Time Picker
                  _buildSectionLabel('WHEN FUND IS DUE (REQUIRED BY DATE)'),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: _pickDueDate,
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFFED7AA)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.event_available_rounded, color: Color(0xFFEA580C), size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Disbursement Target Due Date', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF9A3412))),
                                const SizedBox(height: 2),
                                Text(
                                  _formatDueDate(),
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEA580C),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text('Change Date', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),

                  // Recurring Fund Request Section
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.autorenew_rounded, color: Color(0xFF2563EB), size: 20),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Recurring Fund Request', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                  Text('Auto-renew request periodically', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                ],
                              ),
                            ),
                            Switch(
                              value: _isRecurring,
                              activeColor: const Color(0xFF2563EB),
                              onChanged: (val) => setState(() => _isRecurring = val),
                            ),
                          ],
                        ),
                        if (_isRecurring) ...[
                          const Divider(height: 18, color: Color(0xFFE2E8F0)),
                          const Text('RECURRENCE FREQUENCY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _recurringInterval,
                                isExpanded: true,
                                items: _recurringOptions.map((opt) {
                                  return DropdownMenuItem(
                                    value: opt,
                                    child: Text(
                                      opt == 'WEEKLY'
                                          ? 'Weekly Cycle'
                                          : opt == 'BI_WEEKLY'
                                              ? 'Bi-Weekly (Every 2 Weeks)'
                                              : opt == 'MONTHLY'
                                                  ? 'Monthly Cycle'
                                                  : 'Quarterly (Every 3 Months)',
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                    ),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) setState(() => _recurringInterval = val);
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFBFDBFE)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.notifications_active_outlined, color: Color(0xFF1D4ED8), size: 16),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Admin & Treasury will automatically receive notifications 7 days prior to each recurring cycle for budget reservation.',
                                    style: TextStyle(fontSize: 11, color: Color(0xFF1E40AF), fontWeight: FontWeight.w600, height: 1.3),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Payee / Vendor Destination
                  _buildSectionLabel('PAYEE / BENEFICIARY DESTINATION'),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _payeeType = 'STAFF_ADVANCE'),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
                            decoration: BoxDecoration(
                              color: _payeeType == 'STAFF_ADVANCE' ? const Color(0xFFFFF7ED) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: _payeeType == 'STAFF_ADVANCE' ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_pin_rounded, size: 16, color: _payeeType == 'STAFF_ADVANCE' ? const Color(0xFFEA580C) : const Color(0xFF64748B)),
                                const SizedBox(width: 6),
                                Text(
                                  'My Advance Bank',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: _payeeType == 'STAFF_ADVANCE' ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _payeeType = 'VENDOR'),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
                            decoration: BoxDecoration(
                              color: _payeeType == 'VENDOR' ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: _payeeType == 'VENDOR' ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.storefront_rounded, size: 16, color: _payeeType == 'VENDOR' ? const Color(0xFF2563EB) : const Color(0xFF64748B)),
                                const SizedBox(width: 6),
                                Text(
                                  'Registered Vendor',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: _payeeType == 'VENDOR' ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  if (_payeeType == 'VENDOR') ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _approvedVendors.any((v) => v['name'] == _selectedVendor)
                              ? _selectedVendor
                              : (_approvedVendors.isNotEmpty ? _approvedVendors.first['name'] : null),
                          isExpanded: true,
                          dropdownColor: Colors.white,
                          hint: const Text('Select approved vendor', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                          items: _approvedVendors.map((v) {
                            return DropdownMenuItem<String>(
                              value: v['name'],
                              child: Text('${v['name']} (${v['category']})', style: const TextStyle(color: Color(0xFF0F172A), fontSize: 12, fontWeight: FontWeight.w700)),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _selectedVendor = val);
                          },
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // Subsidiary
                  _buildSectionLabel('TARGET SUBSIDIARY ENTITY'),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedSubsidiary,
                        isExpanded: true,
                        dropdownColor: Colors.white,
                        items: const [
                          DropdownMenuItem(value: 'BEMS Farms Ltd', child: Text('BEMS Farms Ltd', style: TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600))),
                          DropdownMenuItem(value: 'BEMS Feed Mill Operations', child: Text('BEMS Feed Mill Operations', style: TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600))),
                          DropdownMenuItem(value: 'BEMS Logistics & Haulage', child: Text('BEMS Logistics & Haulage', style: TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600))),
                          DropdownMenuItem(value: 'BEMS Group Holdings', child: Text('BEMS Group Holdings', style: TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600))),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedSubsidiary = val);
                        },
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Category
                  _buildSectionLabel('BUDGET EXPENSE CATEGORY'),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedCategory,
                        isExpanded: true,
                        dropdownColor: Colors.white,
                        items: _categories.map((c) {
                          return DropdownMenuItem(value: c, child: Text(c, style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600)));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedCategory = val);
                        },
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Justification
                  _buildSectionLabel('BUSINESS JUSTIFICATION'),
                  const SizedBox(height: 6),
                  _buildTextField(
                    controller: _justificationController,
                    hintText: 'Explain why this expenditure is required and operational impact...',
                    maxLines: 3,
                    icon: Icons.notes_rounded,
                  ),

                  const SizedBox(height: 16),

                  // Deliverable
                  _buildSectionLabel('MANDATORY VERIFICATION PROOF (72H RETIREMENT)'),
                  const SizedBox(height: 6),
                  _buildTextField(
                    controller: _deliverableController,
                    hintText: 'e.g. Weighbridge ticket, physical GRN note, mechanic receipt',
                    icon: Icons.verified_outlined,
                  ),

                  const SizedBox(height: 16),

                  // Urgency
                  _buildSectionLabel('OPERATIONAL URGENCY'),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildUrgencyChip('NORMAL', 'Normal (48h)', const Color(0xFF10B981)),
                      const SizedBox(width: 8),
                      _buildUrgencyChip('HIGH', 'High (24h)', const Color(0xFFEA580C)),
                      const SizedBox(width: 8),
                      _buildUrgencyChip('CRITICAL', 'Emergency', const Color(0xFFEF4444)),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Submit Button
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitRequest,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA580C),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                elevation: 3,
                shadowColor: const Color(0xFFEA580C).withOpacity(0.4),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                    )
                  : Text(
                      _isRecurring ? 'Schedule Recurring Requisition' : 'Submit Requisition for Approval',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Text(
      label,
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 18),
          hintText: hintText,
          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }

  Widget _buildUrgencyChip(String value, String label, Color color) {
    final isSelected = _selectedUrgency == value;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedUrgency = value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.12) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? color : const Color(0xFFE2E8F0), width: isSelected ? 1.5 : 1),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                color: isSelected ? color : const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
