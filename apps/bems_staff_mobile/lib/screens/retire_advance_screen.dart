import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/constants.dart';
import '../core/api_service.dart';
import '../models/fund_request.dart';

class RetireAdvanceScreen extends StatefulWidget {
  final List<FundRequestItem> requests;
  final VoidCallback onRetirementSubmitted;

  const RetireAdvanceScreen({
    super.key,
    required this.requests,
    required this.onRetirementSubmitted,
  });

  @override
  State<RetireAdvanceScreen> createState() => _RetireAdvanceScreenState();
}

class _RetireAdvanceScreenState extends State<RetireAdvanceScreen> {
  final _apiService = ApiService();
  FundRequestItem? _selectedAdvance;
  final _spentController = TextEditingController();
  final _notesController = TextEditingController();
  String? _attachedFileName;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    // Default to first advance that needs retirement, if any
    final advances = widget.requests.where((r) => r.needsRetirement).toList();
    if (advances.isNotEmpty) {
      _selectedAdvance = advances.first;
    } else if (widget.requests.isNotEmpty) {
      _selectedAdvance = widget.requests.first;
    }
  }

  @override
  void dispose() {
    _spentController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _simulatePickFile() {
    setState(() {
      _attachedFileName = 'receipt_fiber_materials_inv_882.pdf';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Physical receipt photo/PDF attached successfully!'),
        backgroundColor: BemsTheme.successEmerald,
      ),
    );
  }

  Future<void> _submitRetirement() async {
    if (_selectedAdvance == null) return;
    final spent = double.tryParse(_spentController.text.replaceAll(',', '')) ?? 0.0;
    if (spent <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid amount spent.')),
      );
      return;
    }
    if (_attachedFileName == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please attach expenditure receipts before submitting.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final refund = (_selectedAdvance!.amount - spent).clamp(0.0, double.infinity);

    await _apiService.submitAdvanceRetirement(
      requestId: _selectedAdvance!.id,
      actualSpent: spent,
      refundAmount: refund,
      receiptNotes: _notesController.text.trim(),
      receiptFileName: _attachedFileName!,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      widget.onRetirementSubmitted();
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeAdvances = widget.requests.where((r) => r.needsRetirement).toList();
    final advanceAmount = _selectedAdvance?.amount ?? 0.0;
    final spentAmount = double.tryParse(_spentController.text.replaceAll(',', '')) ?? 0.0;
    final variance = advanceAmount - spentAmount;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Retire Cash Advance'),
      ),
      body: activeAdvances.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.check_circle_outline_rounded, size: 54, color: BemsTheme.successEmerald),
                    SizedBox(height: 14),
                    Text(
                      'All Cash Advances Retired',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'You have no outstanding advances pending receipt submission. Your compliance score is 100%.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: BemsTheme.textSecondary),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Info policy box
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: BemsTheme.warningAmber.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: BemsTheme.warningAmber.withOpacity(0.4)),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.shield_rounded, color: BemsTheme.warningAmber, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'BEMS Policy: All cash advances must be reconciled with valid receipts within 72 hours of project execution.',
                          style: TextStyle(fontSize: 11, color: Colors.white, height: 1.3),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Advance Selector
                const Text('Select Advance to Retire *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(height: 8),

                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: BemsTheme.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: BemsTheme.cardBorder),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<FundRequestItem>(
                      isExpanded: true,
                      value: _selectedAdvance,
                      dropdownColor: BemsTheme.surface,
                      items: activeAdvances.map((adv) {
                        return DropdownMenuItem(
                          value: adv,
                          child: Text(
                            '${adv.requestNumber} · ${adv.title} (${AppConstants.formatNaira(adv.amount)})',
                            style: const TextStyle(fontSize: 12, color: Colors.white),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedAdvance = val);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Original Advance Details Box
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: BemsTheme.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: BemsTheme.cardBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('DISBURSED ADVANCE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BemsTheme.textMuted)),
                          const SizedBox(height: 4),
                          Text(
                            AppConstants.formatNaira(advanceAmount),
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace'),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: BemsTheme.successEmerald.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('Access Bank Verified', style: TextStyle(fontSize: 10, color: BemsTheme.successEmerald, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Actual Amount Spent Input
                TextField(
                  controller: _spentController,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Actual Total Spent (NGN) *',
                    hintText: 'e.g., 1050000',
                    prefixText: '₦ ',
                    prefixStyle: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 14),

                // Real-time Variance Settlement Card
                if (spentAmount > 0)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: variance == 0
                          ? BemsTheme.successEmerald.withOpacity(0.15)
                          : variance > 0
                              ? BemsTheme.brandOrange.withOpacity(0.15)
                              : BemsTheme.warningAmber.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: variance == 0
                            ? BemsTheme.successEmerald.withOpacity(0.4)
                            : variance > 0
                                ? BemsTheme.brandOrange.withOpacity(0.4)
                                : BemsTheme.warningAmber.withOpacity(0.4),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              variance == 0
                                  ? 'EXACT MATCH — 100% ACCOUNTED'
                                  : variance > 0
                                      ? 'UNSPENT REFUND TO BEMS GROUP'
                                      : 'REIMBURSEMENT CLAIM DUE TO YOU',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: variance == 0
                                    ? BemsTheme.successEmerald
                                    : variance > 0
                                        ? BemsTheme.primaryBlueLight
                                        : BemsTheme.warningAmber,
                              ),
                            ),
                            Text(
                              AppConstants.formatNaira(variance.abs()),
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          variance == 0
                            ? 'The actual spending exactly equals the disbursed amount. Zero balance due.'
                            : variance > 0
                                ? 'Please transfer ${AppConstants.formatNaira(variance)} back to BEMS Group Treasury (Access Bank #0029182736).'
                                : 'You spent more than authorized advance. Reimbursement of ${AppConstants.formatNaira(variance.abs())} will be reviewed by Finance.',
                          style: const TextStyle(fontSize: 11, color: BemsTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 16),

                // Manual Receipt File Attachment
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: BemsTheme.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: BemsTheme.cardBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Upload Invoices / Physical Receipts *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                      const SizedBox(height: 4),
                      const Text('Manual verification per BEMS Group financial controls (No AI OCR).', style: TextStyle(fontSize: 11, color: BemsTheme.textMuted)),
                      const SizedBox(height: 12),
                      if (_attachedFileName != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          margin: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                            color: BemsTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: BemsTheme.successEmerald.withOpacity(0.5)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.picture_as_pdf_rounded, size: 16, color: BemsTheme.successEmerald),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(_attachedFileName!, style: const TextStyle(fontSize: 11, color: Colors.white), overflow: TextOverflow.ellipsis),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close_rounded, size: 16, color: BemsTheme.textMuted),
                                onPressed: () => setState(() => _attachedFileName = null),
                              ),
                            ],
                          ),
                        ),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _simulatePickFile,
                          icon: const Icon(Icons.camera_alt_outlined, size: 18),
                          label: Text(_attachedFileName == null ? 'Attach Receipt Photo / PDF' : 'Replace Receipt Attachment'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: BemsTheme.primaryBlueLight,
                            side: const BorderSide(color: BemsTheme.primaryBlue),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Notes for Verifier
                TextField(
                  controller: _notesController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Notes / Explanation for Internal Verifier',
                    hintText: 'e.g., Fiber cable purchased from Oregun merchant, vendor receipt stamped.',
                  ),
                ),
                const SizedBox(height: 24),

                // Submit Button
                SizedBox(
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitRetirement,
                    child: _isSubmitting
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Submit Retirement for Verifier Closure'),
                  ),
                ),
              ],
            ),
    );
  }
}
