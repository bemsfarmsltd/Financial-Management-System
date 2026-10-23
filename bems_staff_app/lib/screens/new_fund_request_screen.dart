import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
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
  List<Map<String, dynamic>> _organizations = [];
  final List<Map<String, dynamic>> _attachments = [];
  bool _isUploadingAttachment = false;

  Future<void> _pickAttachmentCamera() async {
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (photo == null) return;

      setState(() => _isUploadingAttachment = true);
      final bytes = await photo.readAsBytes();
      final url = await StaffApiService.uploadAvatar(
        bytes: bytes,
        filename: photo.name,
      );

      final sizeKb = (bytes.length / 1024).round();
      final sizeStr = sizeKb > 1024 ? '${(sizeKb / 1024).toStringAsFixed(1)} MB' : '$sizeKb KB';

      setState(() {
        _attachments.add({
          'fileName': photo.name,
          'fileUrl': url,
          'contentType': 'image/jpeg',
          'size': sizeStr,
        });
      });
    } catch (e) {
      _showError('Camera upload failed: $e');
    } finally {
      if (mounted) setState(() => _isUploadingAttachment = false);
    }
  }

  Future<void> _pickAttachmentFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      final bytes = file.bytes;
      if (bytes == null) return;

      setState(() => _isUploadingAttachment = true);
      final ext = (file.extension ?? 'pdf').toLowerCase();
      final isPdf = ext == 'pdf';
      final contentType = isPdf ? 'application/pdf' : 'image/$ext';

      final url = await StaffApiService.uploadAvatar(
        bytes: bytes,
        filename: file.name,
      );

      final sizeKb = (bytes.length / 1024).round();
      final sizeStr = sizeKb > 1024 ? '${(sizeKb / 1024).toStringAsFixed(1)} MB' : '$sizeKb KB';

      setState(() {
        _attachments.add({
          'fileName': file.name,
          'fileUrl': url,
          'contentType': contentType,
          'size': sizeStr,
        });
      });
    } catch (e) {
      _showError('File upload failed: $e');
    } finally {
      if (mounted) setState(() => _isUploadingAttachment = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _selectedSubsidiary = widget.user.subsidiary.isNotEmpty ? widget.user.subsidiary : 'Bems Logistics & Farms Ltd';
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    try {
      final results = await Future.wait([
        StaffApiService.fetchVendors(employeeId: widget.user.id),
        StaffApiService.fetchOrganizationStructure(employeeId: widget.user.id),
      ]);
      final vendors = results[0];
      final orgs = results[1];

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

          if (orgs.isNotEmpty) {
            _organizations = orgs;
            final hasMatch = _organizations.any((o) =>
                (o['legalName'] ?? '') == _selectedSubsidiary ||
                (o['code'] ?? '') == _selectedSubsidiary);
            if (!hasMatch && _organizations.isNotEmpty) {
              _selectedSubsidiary = (_organizations.first['legalName'] ?? '').toString();
            }
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
        employeeId: widget.user.id,
        dueDate: formattedDue,
        isRecurring: _isRecurring,
        recurringInterval: _isRecurring ? _recurringInterval : null,
        vendorName: _payeeType == 'VENDOR' ? (_selectedVendor ?? 'External Vendor') : widget.user.fullName,
        isIntercompany: _selectedSubsidiary != widget.user.subsidiary,
        attachments: _attachments,
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
                      child: Builder(
                        builder: (context) {
                          final availableSubsidiaries = _organizations.isNotEmpty
                              ? _organizations
                                  .map((o) => (o['legalName'] ?? '').toString())
                                  .where((s) => s.isNotEmpty)
                                  .toList()
                              : {
                                  if (widget.user.subsidiary.isNotEmpty) widget.user.subsidiary,
                                  'Bems Logistics & Farms Ltd',
                                  'BemsSoft Hub Ltd',
                                  'BEMS Group Holdings Ltd (HQ)',
                                }.toList();

                          final currentVal = availableSubsidiaries.contains(_selectedSubsidiary)
                              ? _selectedSubsidiary
                              : (availableSubsidiaries.isNotEmpty ? availableSubsidiaries.first : _selectedSubsidiary);

                          return DropdownButton<String>(
                            value: currentVal,
                            isExpanded: true,
                            dropdownColor: Colors.white,
                            items: availableSubsidiaries.map((subName) {
                              return DropdownMenuItem<String>(
                                value: subName,
                                child: Text(
                                  subName,
                                  style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedSubsidiary = val);
                            },
                          );
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

                  const SizedBox(height: 18),

                  // Supporting Proforma / Quote Uploads
                  _buildSectionLabel('SUPPORTING QUOTATION / INVOICE PROOFS (OPTIONAL)'),
                  const SizedBox(height: 6),
                  const Text(
                    'Attach vendor quotation, proforma invoice or physical quotation photo for 3-way matching.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isUploadingAttachment ? null : _pickAttachmentCamera,
                          icon: const Icon(Icons.camera_alt_rounded, size: 16, color: Color(0xFFEA580C)),
                          label: const Text('Snap Quote', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFEA580C))),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFFED7AA)),
                            backgroundColor: const Color(0xFFFFF7ED),
                            padding: const EdgeInsets.symmetric(vertical: 11),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isUploadingAttachment ? null : _pickAttachmentFile,
                          icon: const Icon(Icons.attach_file_rounded, size: 16, color: Color(0xFF0F172A)),
                          label: const Text('Attach File', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                            backgroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 11),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),

                  if (_isUploadingAttachment)
                    Container(
                      margin: const EdgeInsets.only(top: 10),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFEA580C))),
                          SizedBox(width: 10),
                          Text('Uploading quotation...', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                        ],
                      ),
                    ),

                  if (_attachments.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    ..._attachments.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final att = entry.value;
                      final isPdf = att['contentType']?.toString().contains('pdf') ?? false;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Icon(isPdf ? Icons.picture_as_pdf_rounded : Icons.image_rounded, size: 18, color: isPdf ? Colors.red.shade600 : const Color(0xFF059669)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${att['fileName']} (${att['size'] ?? ''})',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF94A3B8)),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () => setState(() => _attachments.removeAt(idx)),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
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
