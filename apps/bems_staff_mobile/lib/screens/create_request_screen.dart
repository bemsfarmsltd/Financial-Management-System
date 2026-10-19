import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/api_service.dart';
import '../models/fund_request.dart';

class CreateRequestScreen extends StatefulWidget {
  final Function(FundRequestItem) onSubmitted;

  const CreateRequestScreen({super.key, required this.onSubmitted});

  @override
  State<CreateRequestScreen> createState() => _CreateRequestScreenState();
}

class _CreateRequestScreenState extends State<CreateRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _apiService = ApiService();

  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _rationaleController = TextEditingController();

  String _selectedCategory = 'Software & Infrastructure';
  String _selectedDepartment = 'Technology & DevOps';
  String _beneficiaryType = 'STAFF_ACCOUNT';
  bool _isSubmitting = false;

  final List<String> _categories = [
    'Software & Infrastructure',
    'Petty Cash & Field Advance',
    'Travel & Accommodation',
    'Power & Operational Facilities',
    'Hardware & Office Equipment',
    'Vendor & Supplier Payment',
  ];

  final List<String> _departments = [
    'Technology & DevOps',
    'Operations & Facilities',
    'Finance & Treasury',
    'Media & Logistics',
    'General Administration',
  ];

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final amount = double.tryParse(_amountController.text.replaceAll(',', '')) ?? 0.0;

    final newReq = await _apiService.createFundRequest(
      title: _titleController.text.trim(),
      category: _selectedCategory,
      amount: amount,
      department: _selectedDepartment,
      rationale: _rationaleController.text.trim(),
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      widget.onSubmitted(newReq);
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _rationaleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Fund Request'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            // Subsidiary indicator banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: BemsTheme.surfaceLight.withOpacity(0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: BemsTheme.cardBorder),
              ),
              child: Row(
                children: [
                  const Icon(Icons.business_rounded, size: 18, color: BemsTheme.primaryBlueLight),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'BEMS GROUP CLOUD & TECHNOLOGIES LTD',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BemsTheme.primaryBlueLight),
                        ),
                        Text(
                          'Requester: Temitope Bakare (Lead DevOps Engineer)',
                          style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Request Title
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Request Title *',
                hintText: 'e.g., Annual SSL Wildcard Certificate Renewal',
              ),
              validator: (val) => val == null || val.trim().isEmpty ? 'Please enter a request title' : null,
            ),
            const SizedBox(height: 14),

            // Category Dropdown
            DropdownButtonFormField<String>(
              value: _selectedCategory,
              decoration: const InputDecoration(labelText: 'Expense Category *'),
              dropdownColor: BemsTheme.surface,
              items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c, style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedCategory = val);
              },
            ),
            const SizedBox(height: 14),

            // Department Dropdown
            DropdownButtonFormField<String>(
              value: _selectedDepartment,
              decoration: const InputDecoration(labelText: 'Chargeable Department *'),
              dropdownColor: BemsTheme.surface,
              items: _departments.map((d) => DropdownMenuItem(value: d, child: Text(d, style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedDepartment = val);
              },
            ),
            const SizedBox(height: 14),

            // Amount Field
            TextFormField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Amount (NGN) *',
                hintText: 'e.g., 350000',
                prefixText: '₦ ',
                prefixStyle: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
              ),
              validator: (val) {
                if (val == null || val.trim().isEmpty) return 'Enter the requested amount';
                final n = double.tryParse(val.replaceAll(',', ''));
                if (n == null || n <= 0) return 'Enter a valid amount';
                return null;
              },
            ),
            const SizedBox(height: 14),

            // Beneficiary Option
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: BemsTheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: BemsTheme.cardBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Disbursement Beneficiary', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: BemsTheme.textSecondary)),
                  const SizedBox(height: 8),
                  RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: const Text('My Designated Salary Bank Account', style: TextStyle(fontSize: 13, color: Colors.white)),
                    subtitle: const Text('Access Bank · 0123456789 (Verified)', style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary)),
                    value: 'STAFF_ACCOUNT',
                    groupValue: _beneficiaryType,
                    activeColor: BemsTheme.primaryBlue,
                    onChanged: (v) => setState(() => _beneficiaryType = v!),
                  ),
                  RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: const Text('Registered Third-Party Vendor Account', style: TextStyle(fontSize: 13, color: Colors.white)),
                    subtitle: const Text('Paid directly to vendor per approved invoice', style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary)),
                    value: 'VENDOR_ACCOUNT',
                    groupValue: _beneficiaryType,
                    activeColor: BemsTheme.primaryBlue,
                    onChanged: (v) => setState(() => _beneficiaryType = v!),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Rationale
            TextFormField(
              controller: _rationaleController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Business Rationale / Need *',
                hintText: 'Detail why this expenditure is necessary for current project milestones...',
              ),
              validator: (val) => val == null || val.trim().isEmpty ? 'Please describe the rationale' : null,
            ),
            const SizedBox(height: 24),

            // Submit Button
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _handleSubmit,
                child: _isSubmitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Submit Request for Approval'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
