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

  final List<String> _categories = [
    'Feed Ingredients & Raw Grain',
    'Machinery & Spares Repair',
    'Fuel & Logistics Haulage',
    'Farm Inputs & Agro-Chemicals',
    'Staff Welfare & Per-Diem',
    'Utility & Operations',
  ];

  @override
  void initState() {
    super.initState();
    _selectedSubsidiary = widget.user.subsidiary ?? 'BEMS Feed Mill Operations';
    _deliverableController.text = 'Goods Received Note (GRN) & Vendor Receipt';
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
      await StaffApiService.createFundRequest(
        title: title,
        justification: justification,
        deliverable: deliverable,
        category: _selectedCategory,
        subsidiary: _selectedSubsidiary,
        department: widget.user.department ?? 'Operations',
        amountNaira: amount,
        urgency: _selectedUrgency,
        neededBy: _selectedUrgency == 'CRITICAL' ? 'Immediate' : 'Within 24 Hours',
      );

      if (!mounted) return;
      widget.onSubmitted();
      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ Requisition successfully submitted for Departmental & GMD Review.'),
          backgroundColor: Color(0xFF059669),
          duration: Duration(seconds: 3),
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
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 2,
                shadowColor: const Color(0xFFEA580C).withOpacity(0.4),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.send_rounded, size: 18),
                        SizedBox(width: 8),
                        Text(
                          'Submit Fund Requisition',
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.8,
        color: Color(0xFF64748B),
      ),
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
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildUrgencyChip(String code, String label, Color color) {
    final isSelected = _selectedUrgency == code;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedUrgency = code),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.12) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? color : const Color(0xFFE2E8F0),
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? color : const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
