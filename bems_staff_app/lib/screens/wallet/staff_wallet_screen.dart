import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/staff_models.dart';
import '../../services/staff_api_service.dart';
import '../../services/staff_storage_service.dart';

String walletMoney(String value) {
  final amount = BigInt.tryParse(value) ?? BigInt.zero;
  final abs = amount.abs();
  final whole = (abs ~/ BigInt.from(100)).toString().replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );
  return '${amount.isNegative ? '-' : ''}₦$whole.${(abs % BigInt.from(100)).toString().padLeft(2, '0')}';
}

String _minor(String value) {
  final clean = value.replaceAll(',', '').trim();
  if (!RegExp(r'^(0|[1-9]\d*)(\.\d{1,2})?$').hasMatch(clean)) {
    throw Exception('Enter a valid naira amount with at most two decimal places.');
  }
  final p = clean.split('.');
  return (BigInt.parse(p[0]) * BigInt.from(100) +
          BigInt.parse(p.length == 1 ? '0' : p[1].padRight(2, '0')))
      .toString();
}

class StaffWalletScreen extends StatefulWidget {
  final StaffUser user;
  final bool isEmbedded;

  const StaffWalletScreen({
    super.key,
    required this.user,
    this.isEmbedded = false,
  });

  @override
  State<StaffWalletScreen> createState() => _StaffWalletScreenState();
}

class _StaffWalletScreenState extends State<StaffWalletScreen> {
  late Future<Map<String, dynamic>> _wallet;
  bool _busy = false;
  bool _hideBalance = false;

  // Filter state
  String _activeTab = 'ALL'; // ALL | INFLOWS | OUTFLOWS | PENDING
  String _timeRange = 'ALL'; // ALL | THIS_MONTH | LAST_30_DAYS
  String _searchQuery = '';
  bool _isExpanded = false;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _wallet = StaffApiService.getOwnWallet(widget.user);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _reload() {
    setState(() => _wallet = StaffApiService.getOwnWallet(widget.user));
  }

  Future<String?> _password(String title, String details) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(details, style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              decoration: InputDecoration(
                labelText: 'Account Password or PIN',
                labelStyle: const TextStyle(fontSize: 12),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, controller.text),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFEA580C),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Authorize'),
          ),
        ],
      ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 200));
    controller.dispose();
    return result;
  }

  // --- BANK BENEFICIARIES MODAL ---
  Future<void> _showBeneficiariesModal(Map<String, dynamic> wallet) async {
    final banks = wallet['banks'] as List<dynamic>? ?? [];
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetCtx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Saved Beneficiaries',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.pop(sheetCtx),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Funds are disbursed directly to your verified bank accounts backed by Monnify.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              if (banks.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Text(
                    'No beneficiaries linked. Add a verified account to begin receiving withdrawals.',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                  ),
                )
              else
                ...banks.map((b) {
                  final isReg = b['isRegistrationDefault'] == true;
                  final accountName = b['accountName']?.toString() ?? 'Staff Account';
                  final bankName = b['bankName']?.toString() ?? 'Bank Account';
                  final lastFour = b['lastFour']?.toString() ?? '••••';
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isReg ? const Color(0xFFFFF7ED) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: isReg ? const Color(0xFFFDBA74) : const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: isReg ? const Color(0xFFEA580C) : const Color(0xFF2563EB),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.account_balance_rounded, size: 20, color: Colors.white),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      accountName,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (isReg) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEA580C),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        'Registration Default',
                                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$bankName · •••• $lastFour',
                                style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.verified_rounded, size: 18, color: Color(0xFF16A34A)),
                      ],
                    ),
                  );
                }),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(sheetCtx);
                    _addNewAccountModal();
                  },
                  icon: const Icon(Icons.add_rounded, size: 18, color: Color(0xFFEA580C)),
                  label: const Text('Add & Verify New Account', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFEA580C)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- ADD & VERIFY NEW ACCOUNT MODAL ---
  Future<void> _addNewAccountModal() async {
    final numberController = TextEditingController();
    String? selectedBankCode;
    String? resolvedAccountName;
    bool isResolving = false;
    bool saveAsBeneficiary = true;

    try {
      final banks = await StaffApiService.walletBanks(widget.user);
      if (!mounted) return;

      final verified = await showDialog<bool>(
        context: context,
        builder: (dialogCtx) => StatefulBuilder(
          builder: (dialogCtx, setModalState) {
            void tryAutoResolve() async {
              final num = numberController.text.trim();
              if (selectedBankCode != null && num.length == 10 && RegExp(r'^\d{10}$').hasMatch(num)) {
                setModalState(() {
                  isResolving = true;
                  resolvedAccountName = null;
                });
                try {
                  final res = await StaffApiService.resolveBankAccount(
                    widget.user,
                    accountNumber: num,
                    bankCode: selectedBankCode!,
                  );
                  if (dialogCtx.mounted) {
                    setModalState(() {
                      resolvedAccountName = res['accountName']?.toString();
                      isResolving = false;
                    });
                  }
                } catch (e) {
                  if (dialogCtx.mounted) {
                    setModalState(() {
                      resolvedAccountName = null;
                      isResolving = false;
                    });
                  }
                }
              }
            }

            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
              title: const Row(
                children: [
                  Icon(Icons.verified_user_rounded, color: Color(0xFFEA580C), size: 22),
                  SizedBox(width: 8),
                  Text('Verify Bank Account', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
                ],
              ),
              content: SizedBox(
                width: 400,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Monnify automatically verifies the destination NUBAN account in real time.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 14),
                    // Destination Bank Dropdown
                    DropdownButtonFormField<String>(
                      value: selectedBankCode,
                      isExpanded: true,
                      hint: const Text('Select Destination Bank', style: TextStyle(fontSize: 12.5)),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                      ),
                      items: banks
                          .map((b) => DropdownMenuItem<String>(
                                value: b['code'] as String,
                                child: Text(b['name'] as String, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
                              ))
                          .toList(),
                      onChanged: (v) {
                        setModalState(() => selectedBankCode = v);
                        tryAutoResolve();
                      },
                    ),
                    const SizedBox(height: 12),
                    // 10-Digit NUBAN Account Number
                    TextField(
                      controller: numberController,
                      keyboardType: TextInputType.number,
                      maxLength: 10,
                      decoration: InputDecoration(
                        labelText: '10-Digit NUBAN Account Number',
                        labelStyle: const TextStyle(fontSize: 12),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        counterText: '',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                      ),
                      onChanged: (_) => tryAutoResolve(),
                    ),
                    const SizedBox(height: 10),

                    // Auto-Resolve Outcome / Spinner
                    if (isResolving)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(8)),
                        child: const Row(
                          children: [
                            SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB))),
                            SizedBox(width: 10),
                            Text('Verifying with Monnify API...', style: TextStyle(fontSize: 11.5, color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600)),
                          ],
                        ),
                      )
                    else if (resolvedAccountName != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF16A34A)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                resolvedAccountName!,
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF15803D)),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 10),
                    // Save as beneficiary checkbox
                    CheckboxListTile(
                      value: saveAsBeneficiary,
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      activeColor: const Color(0xFFEA580C),
                      title: const Text('Save as beneficiary for future withdrawals', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                      onChanged: (v) => setModalState(() => saveAsBeneficiary = v ?? true),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx, false),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                ),
                FilledButton(
                  onPressed: resolvedAccountName != null
                      ? () => Navigator.pop(dialogCtx, true)
                      : null,
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                  child: const Text('Verify & Save'),
                ),
              ],
            );
          },
        ),
      );

      if (verified != true || !mounted) return;
      final password = await _password(
        'Authorize Account Link',
        'Confirm linking bank account $resolvedAccountName (${numberController.text}).',
      );
      if (password == null || !mounted) return;

      setState(() => _busy = true);
      await StaffApiService.walletRequest(
        widget.user,
        'bank',
        {
          'accountNumber': numberController.text.trim(),
          'bankCode': selectedBankCode,
          'password': password,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Disbursement bank verified & saved successfully.'), backgroundColor: Color(0xFF16A34A)),
        );
        _reload();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: const Color(0xFFDC2626)));
    } finally {
      numberController.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  // --- BANK-GRADE WITHDRAWAL MODAL ---
  Future<void> _withdraw(Map<String, dynamic> wallet) async {
    final availableMinor = wallet['availableMinor']?.toString() ?? '0';
    final availableInt = BigInt.tryParse(availableMinor) ?? BigInt.zero;

    if (availableInt <= BigInt.zero) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No available approved funds to withdraw at this time.')),
      );
      return;
    }

    final banks = wallet['banks'] as List<dynamic>? ?? [];
    dynamic selectedBank = banks.isNotEmpty ? banks[0] : null;

    final amountController = TextEditingController();
    final narrationController = TextEditingController();
    String? selectedCreditLot = 'ALL';

    final submitted = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (modalCtx) => StatefulBuilder(
        builder: (modalCtx, setModal) {
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 16,
              bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.arrow_upward_rounded, color: Color(0xFFEA580C), size: 22),
                          SizedBox(width: 8),
                          Text('Withdraw Approved Funds', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: Color(0xFF0F172A))),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                        onPressed: () => Navigator.pop(modalCtx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Available Balance: ${walletMoney(availableMinor)} · Company pays Monnify transfer fees',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 16),

                  // STEP 1: DESTINATION BENEFICIARY SELECTION
                  const Text('DESTINATION BENEFICIARY', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                  const SizedBox(height: 8),

                  if (banks.isEmpty)
                    InkWell(
                      onTap: () {
                        Navigator.pop(modalCtx);
                        _addNewAccountModal();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFDBA74)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.add_circle_outline_rounded, color: Color(0xFFEA580C), size: 20),
                            SizedBox(width: 10),
                            Text('Verify & Add Destination Account', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                          ],
                        ),
                      ),
                    )
                  else ...[
                    ...banks.map((b) {
                      final isSelected = selectedBank?['id'] == b['id'];
                      final isReg = b['isRegistrationDefault'] == true;
                      return InkWell(
                        onTap: () => setModal(() => selectedBank = b),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFFFF7ED) : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0),
                              width: isSelected ? 1.5 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                                color: isSelected ? const Color(0xFFEA580C) : const Color(0xFF94A3B8),
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Flexible(
                                          child: Text(
                                            b['accountName']?.toString() ?? 'Enrolled Account',
                                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (isReg) ...[
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                            decoration: BoxDecoration(color: const Color(0xFFEA580C), borderRadius: BorderRadius.circular(4)),
                                            child: const Text('Default', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Colors.white)),
                                          ),
                                        ],
                                      ],
                                    ),
                                    Text(
                                      '${b['bankName'] ?? 'Bank'} · •••• ${b['lastFour']}',
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                    InkWell(
                      onTap: () {
                        Navigator.pop(modalCtx);
                        _addNewAccountModal();
                      },
                      child: const Padding(
                        padding: EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Icon(Icons.add_rounded, size: 16, color: Color(0xFFEA580C)),
                            SizedBox(width: 4),
                            Text('Use another verified bank account', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFFEA580C))),
                          ],
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // STEP 2: AMOUNT INPUT
                  const Text('WITHDRAWAL AMOUNT (₦)', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    decoration: InputDecoration(
                      prefixText: '₦ ',
                      prefixStyle: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
                      hintText: '0.00',
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Quick Chips
                  Wrap(
                    spacing: 8,
                    children: [
                      _buildChip('₦5,000', () => amountController.text = '5000'),
                      _buildChip('₦10,000', () => amountController.text = '10000'),
                      _buildChip('₦50,000', () => amountController.text = '50000'),
                      _buildChip('Max All', () {
                        final val = (availableInt ~/ BigInt.from(100)).toString();
                        amountController.text = val;
                      }),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Narration
                  TextField(
                    controller: narrationController,
                    decoration: InputDecoration(
                      labelText: 'Transfer Narration (Optional)',
                      labelStyle: const TextStyle(fontSize: 12),
                      hintText: 'e.g. Approved operational advance',
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Guarantee Banner
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.shield_rounded, size: 16, color: Color(0xFF16A34A)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Instant Monnify transfer. Transfer Fee: ₦0.00 (Company Pays Fees).',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF15803D)),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: selectedBank != null
                          ? () {
                              Navigator.pop(modalCtx, {
                                'bank': selectedBank,
                                'amount': amountController.text.trim(),
                                'credit': selectedCreditLot,
                                'narration': narrationController.text.trim(),
                              });
                            }
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: const Text('Proceed to Authorization', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );

    amountController.dispose();
    narrationController.dispose();

    if (submitted == null || !mounted) return;
    final bank = submitted['bank'] as Map<String, dynamic>;
    final rawAmount = submitted['amount'] as String;
    final credit = submitted['credit'] as String;

    try {
      final amountMinor = _minor(rawAmount);
      final password = await _password(
        'Confirm Monnify Payout',
        'Transfer ${walletMoney(amountMinor)} to ${bank['accountName']} (•••• ${bank['lastFour']}). Instant settlement.',
      );
      if (password == null || !mounted) return;

      setState(() => _busy = true);

      var candidate = <String, dynamic>{
        'amountMinor': amountMinor,
        'bankAccountId': bank['id'],
        'idempotencyKey': 'mobile-${DateTime.now().microsecondsSinceEpoch}-$credit',
        'creditAllocations': [
          {'creditLotId': credit, 'amountMinor': amountMinor}
        ]
      };

      if (credit == 'ALL') {
        final plan = await StaffApiService.walletRequest(widget.user, 'withdrawal-plan', candidate);
        candidate = Map<String, dynamic>.from(plan['intent'] as Map);
      }

      final intent = await StaffStorageService.walletIntent(widget.user.id, candidate);
      final proof = await StaffApiService.walletRequest(
        widget.user,
        'challenges',
        {'purpose': 'WITHDRAWAL', 'payload': intent, 'password': password},
      );

      final result = await StaffApiService.walletRequest(
        widget.user,
        'withdrawals',
        {'intent': intent, 'challengeId': proof['id'], 'challengeToken': proof['token']},
      );

      if (mounted) {
        _reload();
        _showSuccessReceipt(result, bank, amountMinor);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: const Color(0xFFDC2626)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _buildChip(String label, VoidCallback onTap) {
    return ActionChip(
      label: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
      backgroundColor: const Color(0xFFF1F5F9),
      side: const BorderSide(color: Color(0xFFE2E8F0)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      onPressed: onTap,
    );
  }

  // --- BANK-GRADE SUCCESS RECEIPT DIALOG ---
  void _showSuccessReceipt(Map<String, dynamic> result, Map<String, dynamic> bank, String amountMinor) {
    final ref = result['reference']?.toString() ?? 'BEMS-W-${DateTime.now().millisecondsSinceEpoch}';
    showDialog(
      context: context,
      builder: (c) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(
                  color: Color(0xFFF0FDF4),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 36),
              ),
              const SizedBox(height: 14),
              const Text(
                'Transfer Reserved & Queued',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Instant Monnify settlement in progress.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              Text(
                walletMoney(amountMinor),
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    _receiptRow('Recipient', bank['accountName']?.toString() ?? 'Enrolled Staff'),
                    const SizedBox(height: 8),
                    _receiptRow('Bank', '${bank['bankName'] ?? 'Bank'} (•••• ${bank['lastFour']})'),
                    const SizedBox(height: 8),
                    _receiptRow('Fee', '₦0.00 (Paid by Company)'),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Reference', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                        Row(
                          children: [
                            Text(
                              ref.length > 16 ? '${ref.substring(0, 16)}...' : ref,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                            ),
                            IconButton(
                              icon: const Icon(Icons.copy_rounded, size: 14, color: Color(0xFFEA580C)),
                              visualDensity: VisualDensity.compact,
                              padding: EdgeInsets.zero,
                              onPressed: () {
                                Clipboard.setData(ClipboardData(text: ref));
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reference copied to clipboard.')));
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(c),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _receiptRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
        Text(value, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
      ],
    );
  }

  // --- RETURN FUNDS ---
  Future<void> _returnFunds(Map<String, dynamic> wallet) async {
    final credits = (wallet['credits'] as List<dynamic>? ?? [])
        .where((c) => (BigInt.tryParse(c['availableMinor']?.toString() ?? '0') ?? BigInt.zero) > BigInt.zero)
        .toList();
    if (credits.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No active fund allocations available to return.')),
      );
      return;
    }

    final amount = TextEditingController();
    final reason = TextEditingController();
    String? credit = credits.first['id'] as String;

    try {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            backgroundColor: Colors.white,
            title: const Text('Return Surplus Advance', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Return unused project advance back to BEMS Group Treasury.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: credit,
                  isExpanded: true,
                  decoration: InputDecoration(filled: true, fillColor: const Color(0xFFF8FAFC), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  items: credits
                      .map((x) => DropdownMenuItem<String>(
                            value: x['id'] as String,
                            child: Text('${x['category']} · ${walletMoney(x['availableMinor'] as String)}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                          ))
                      .toList(),
                  onChanged: (v) => set(() => credit = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: 'Amount (₦)', prefixText: '₦ ', filled: true, fillColor: const Color(0xFFF8FAFC), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reason,
                  decoration: InputDecoration(labelText: 'Reason for return', filled: true, fillColor: const Color(0xFFF8FAFC), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
              FilledButton(
                onPressed: () => Navigator.pop(c, true),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                child: const Text('Submit Return'),
              ),
            ],
          ),
        ),
      );
      if (ok != true || credit == null || !mounted) return;
      final value = _minor(amount.text);
      final password = await _password(
        'Authorize Project Return',
        'Return ${walletMoney(value)} surplus back to BEMS Group Treasury.',
      );
      if (password == null || !mounted) return;
      setState(() => _busy = true);
      final intent = {
        'creditLotId': credit,
        'amountMinor': value,
        'reason': reason.text,
        'idempotencyKey': 'return-${DateTime.now().microsecondsSinceEpoch}',
      };
      final proof = await StaffApiService.walletRequest(
        widget.user,
        'challenges',
        {'purpose': 'RETURN_PROJECT', 'payload': intent, 'password': password},
      );
      await StaffApiService.walletRequest(
        widget.user,
        'project-returns',
        {'intent': intent, 'challengeId': proof['id'], 'challengeToken': proof['token']},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unused funds returned to Treasury successfully.')));
        _reload();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      amount.dispose();
      reason.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(String id) async {
    setState(() => _busy = true);
    try {
      await StaffApiService.walletRequest(widget.user, 'withdrawals/$id/cancel', {});
      if (mounted) _reload();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // --- TRANSACTION DETAIL BOTTOM SHEET ---
  void _showTransactionDetails(dynamic txItem, bool isCredit) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isCredit ? 'Credit Allocation Receipt' : 'Disbursement Receipt',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
                IconButton(icon: const Icon(Icons.close_rounded, size: 20), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 12),
            Center(
              child: Column(
                children: [
                  Text(
                    '${isCredit ? "+" : "-"}${walletMoney(txItem['amountMinor']?.toString() ?? txItem['availableMinor']?.toString() ?? '0')}',
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: isCredit ? const Color(0xFF16A34A) : const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isCredit ? const Color(0xFFDCFCE7) : const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isCredit ? 'GMD APPROVED LOT' : (txItem['status']?.toString() ?? 'COMPLETED'),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: isCredit ? const Color(0xFF166534) : const Color(0xFF1D4ED8),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _receiptRow('Category / Purpose', txItem['category']?.toString() ?? 'Operational Advance'),
                  const SizedBox(height: 8),
                  _receiptRow('Date / Timestamp', txItem['createdAt']?.toString().split('T').first ?? 'Today'),
                  const SizedBox(height: 8),
                  _receiptRow('Beneficiary / Source', isCredit ? 'BEMS Central Treasury' : (txItem['accountName']?.toString() ?? widget.user.fullName)),
                  const SizedBox(height: 8),
                  _receiptRow('Monnify Transfer Fee', '₦0.00 (Zero Fee Guarantee)'),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Reference Code', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                      Row(
                        children: [
                          Text(
                            (txItem['reference']?.toString() ?? txItem['id']?.toString() ?? 'N/A'),
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy_rounded, size: 14, color: Color(0xFFEA580C)),
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                            onPressed: () {
                              Clipboard.setData(ClipboardData(text: txItem['reference']?.toString() ?? txItem['id']?.toString() ?? ''));
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reference copied.')));
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final content = FutureBuilder<Map<String, dynamic>>(
      future: _wallet,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 40),
                  const SizedBox(height: 12),
                  Text(
                    snapshot.error.toString(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _reload,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Retry Connection'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEA580C),
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        if (!snapshot.hasData) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFFEA580C), strokeWidth: 2.5),
          );
        }

        final wallet = snapshot.data!;
        final credits = wallet['credits'] as List<dynamic>? ?? [];
        final withdrawals = wallet['withdrawals'] as List<dynamic>? ?? [];
        final banks = wallet['banks'] as List<dynamic>? ?? [];
        final primaryBank = banks.isNotEmpty ? banks[0] as Map<String, dynamic> : null;

        return RefreshIndicator(
          onRefresh: () async => _reload(),
          color: const Color(0xFFEA580C),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 40),
            children: [
              // 1. HERO BANKING CARD (Enterprise Light Theme - BEMS Orange Gradient)
              _buildHeroBankingCard(wallet, primaryBank),

              const SizedBox(height: 16),

              // 2. QUICK ACTIONS ROW (Withdraw, Beneficiaries, Return Surplus)
              _buildQuickActionsBar(wallet, primaryBank),

              const SizedBox(height: 18),

              // 3. STATISTICAL METRICS ROW
              _buildMetricsRow(wallet),

              const SizedBox(height: 20),

              // 4. ADVANCED TRANSACTION LEDGER WITH MULTI-FILTERS
              _buildTransactionLedger(credits, withdrawals),
            ],
          ),
        );
      },
    );

    if (widget.isEmbedded) {
      return content;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Staff Digital Wallet',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            onPressed: _busy ? null : _reload,
            tooltip: 'Refresh Ledger',
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF0F172A)),
          ),
        ],
      ),
      body: SafeArea(child: content),
    );
  }

  // 1. HERO VIRTUAL BANKING CARD (Enterprise Light Theme)
  Widget _buildHeroBankingCard(Map<String, dynamic> wallet, Map<String, dynamic>? primaryBank) {
    final availableMinor = wallet['availableMinor']?.toString() ?? '0';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFEA580C), Color(0xFFC2410C), Color(0xFF9A3412)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEA580C).withOpacity(0.32),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header Row: Chip & Brand
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 24,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.22),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: const Icon(Icons.credit_card_rounded, size: 15, color: Colors.white),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'BEMS DIGITAL WALLET',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => _hideBalance = !_hideBalance),
                    icon: Icon(
                      _hideBalance ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                      color: Colors.white.withOpacity(0.85),
                      size: 20,
                    ),
                    tooltip: 'Toggle balance visibility',
                    visualDensity: VisualDensity.compact,
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircleAvatar(radius: 3, backgroundColor: Color(0xFF4ADE80)),
                        SizedBox(width: 4),
                        Text(
                          'Active',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 18),

          // Balance Display
          Text(
            'AVAILABLE APPROVED FUNDS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Colors.white.withOpacity(0.85),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _hideBalance ? '₦ ••••••••••' : walletMoney(availableMinor),
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: -0.5,
              height: 1.1,
            ),
          ),

          const SizedBox(height: 18),

          // Divider Line
          Container(
            height: 1,
            color: Colors.white.withOpacity(0.2),
          ),

          const SizedBox(height: 14),

          // Card Footer Row: Payout Bank & Fee Protection
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.account_balance_rounded, size: 14, color: Colors.white),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        primaryBank != null
                            ? '${primaryBank['accountName']} · ${primaryBank['bankName'] ?? 'Bank'} (•••• ${primaryBank['lastFour']})'
                            : 'No verified bank account linked',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.shield_outlined, size: 12, color: Colors.white),
                    SizedBox(width: 4),
                    Text(
                      'Company Pays Fees',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // 2. QUICK ACTIONS BAR
  Widget _buildQuickActionsBar(Map<String, dynamic> wallet, Map<String, dynamic>? primaryBank) {
    return Row(
      children: [
        // Action 1: Withdraw
        Expanded(
          child: _buildActionButton(
            label: 'Withdraw',
            icon: Icons.arrow_upward_rounded,
            backgroundColor: const Color(0xFFEA580C),
            iconColor: Colors.white,
            textColor: const Color(0xFF0F172A),
            isPrimary: true,
            onTap: _busy ? null : () => _withdraw(wallet),
          ),
        ),
        const SizedBox(width: 10),
        // Action 2: Beneficiaries
        Expanded(
          child: _buildActionButton(
            label: 'Beneficiaries',
            icon: Icons.account_balance_rounded,
            backgroundColor: Colors.white,
            iconColor: const Color(0xFF2563EB),
            textColor: const Color(0xFF0F172A),
            onTap: _busy ? null : () => _showBeneficiariesModal(wallet),
          ),
        ),
        const SizedBox(width: 10),
        // Action 3: Return Surplus
        Expanded(
          child: _buildActionButton(
            label: 'Return Surplus',
            icon: Icons.assignment_return_rounded,
            backgroundColor: Colors.white,
            iconColor: const Color(0xFF059669),
            textColor: const Color(0xFF0F172A),
            onTap: _busy ? null : () => _returnFunds(wallet),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required String label,
    required IconData icon,
    required Color backgroundColor,
    required Color iconColor,
    required Color textColor,
    required VoidCallback? onTap,
    bool isPrimary = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isPrimary ? const Color(0xFFEA580C) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isPrimary ? null : Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: isPrimary ? const Color(0xFFEA580C).withOpacity(0.25) : Colors.black.withOpacity(0.02),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isPrimary ? Colors.white.withOpacity(0.18) : iconColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: isPrimary ? Colors.white : iconColor),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: isPrimary ? Colors.white : textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 3. STATISTICAL METRICS ROW
  Widget _buildMetricsRow(Map<String, dynamic> wallet) {
    return Row(
      children: [
        // Card A: Held in Transit
        Expanded(
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
                const Row(
                  children: [
                    CircleAvatar(radius: 3, backgroundColor: Color(0xFFF59E0B)),
                    SizedBox(width: 5),
                    Text(
                      'HELD IN TRANSIT',
                      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  walletMoney(wallet['heldMinor']?.toString() ?? '0'),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        // Card B: Bank Settled
        Expanded(
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
                const Row(
                  children: [
                    CircleAvatar(radius: 3, backgroundColor: Color(0xFF10B981)),
                    SizedBox(width: 5),
                    Text(
                      'BANK SETTLED',
                      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  walletMoney(wallet['settledMinor']?.toString() ?? '0'),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // 4. ADVANCED TRANSACTION LEDGER WITH MULTI-FILTERS & SEE MORE
  Widget _buildTransactionLedger(List<dynamic> credits, List<dynamic> withdrawals) {
    final now = DateTime.now();
    bool matchesPeriod(String? dateStr) {
      if (_timeRange == 'ALL' || dateStr == null || dateStr.isEmpty) return true;
      final dt = DateTime.tryParse(dateStr);
      if (dt == null) return true;
      if (_timeRange == 'THIS_MONTH') {
        return dt.year == now.year && dt.month == now.month;
      } else if (_timeRange == 'LAST_30_DAYS') {
        return now.difference(dt).inDays <= 30;
      }
      return true;
    }

    // 1. Filter withdrawals by query & period
    final filteredWithdrawals = withdrawals.where((w) {
      if (!matchesPeriod(w['createdAt']?.toString())) return false;
      if (_searchQuery.isNotEmpty) {
        final ref = (w['reference']?.toString() ?? '').toLowerCase();
        final acc = (w['accountName']?.toString() ?? '').toLowerCase();
        if (!ref.contains(_searchQuery.toLowerCase()) && !acc.contains(_searchQuery.toLowerCase())) {
          return false;
        }
      }
      return true;
    }).toList();

    // 2. Filter credits by query & period
    final filteredCredits = credits.where((c) {
      if (!matchesPeriod(c['createdAt']?.toString())) return false;
      if (_searchQuery.isNotEmpty) {
        final cat = (c['category']?.toString() ?? '').toLowerCase();
        final src = (c['sourceType']?.toString() ?? '').toLowerCase();
        if (!cat.contains(_searchQuery.toLowerCase()) && !src.contains(_searchQuery.toLowerCase())) {
          return false;
        }
      }
      return true;
    }).toList();

    // Combine for display
    final List<Map<String, dynamic>> combined = [];
    if (_activeTab == 'ALL' || _activeTab == 'OUTFLOWS' || _activeTab == 'PENDING') {
      for (final w in filteredWithdrawals) {
        final status = w['status']?.toString().toUpperCase() ?? '';
        if (_activeTab == 'PENDING' && status != 'HELD' && status != 'SUBMITTING' && status != 'PENDING') {
          continue;
        }
        combined.add({'type': 'OUTFLOW', 'item': w, 'date': w['createdAt']?.toString() ?? ''});
      }
    }
    if (_activeTab == 'ALL' || _activeTab == 'INFLOWS') {
      for (final c in filteredCredits) {
        combined.add({'type': 'INFLOW', 'item': c, 'date': c['createdAt']?.toString() ?? ''});
      }
    }

    combined.sort((a, b) => (b['date'] as String).compareTo(a['date'] as String));

    final totalCount = combined.length;
    final displayItems = _isExpanded ? combined : combined.take(8).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header Row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Activity & Ledger',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
            Text(
              '$totalCount Records',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // Search Bar
        Container(
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: TextField(
            controller: _searchController,
            style: const TextStyle(fontSize: 12),
            decoration: InputDecoration(
              hintText: 'Search by reference or category...',
              hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
              prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF94A3B8)),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 16),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 9),
            ),
            onChanged: (v) => setState(() => _searchQuery = v.trim()),
          ),
        ),

        const SizedBox(height: 10),

        // Type Filter Pills
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildSegmentPill('ALL', 'All Transactions'),
              const SizedBox(width: 6),
              _buildSegmentPill('INFLOWS', 'Inflows (Credits)'),
              const SizedBox(width: 6),
              _buildSegmentPill('OUTFLOWS', 'Outflows (Payouts)'),
              const SizedBox(width: 6),
              _buildSegmentPill('PENDING', 'Pending'),
            ],
          ),
        ),

        const SizedBox(height: 8),

        // Period Filter Pills
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildPeriodPill('ALL', 'All Time'),
              const SizedBox(width: 6),
              _buildPeriodPill('THIS_MONTH', 'This Month'),
              const SizedBox(width: 6),
              _buildPeriodPill('LAST_30_DAYS', 'Last 30 Days'),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // List
        if (displayItems.isEmpty)
          _buildEmptyState('No transactions found matching criteria.')
        else
          ...displayItems.map((entry) {
            final isCredit = entry['type'] == 'INFLOW';
            final item = entry['item'];
            return InkWell(
              onTap: () => _showTransactionDetails(item, isCredit),
              borderRadius: BorderRadius.circular(16),
              child: isCredit ? _buildCreditTile(item) : _buildWithdrawalTile(item),
            );
          }),

        // "See More" Button
        if (totalCount > 8) ...[
          const SizedBox(height: 6),
          Center(
            child: TextButton.icon(
              onPressed: () => setState(() => _isExpanded = !_isExpanded),
              icon: Icon(_isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded, size: 18, color: const Color(0xFFEA580C)),
              label: Text(
                _isExpanded ? 'Show Less' : 'See More (${totalCount - 8} more)',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSegmentPill(String tabKey, String label) {
    final isSelected = _activeTab == tabKey;
    return InkWell(
      onTap: () => setState(() => _activeTab = tabKey),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEA580C) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildPeriodPill(String periodKey, String label) {
    final isSelected = _timeRange == periodKey;
    return InkWell(
      onTap: () => setState(() => _timeRange = periodKey),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildWithdrawalTile(dynamic w) {
    final status = w['status']?.toString() ?? 'PENDING';
    final isSettled = status == 'SETTLED' || status == 'SUCCESS';
    final isHeld = status == 'HELD';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isSettled ? const Color(0xFFF0FDF4) : const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.arrow_upward_rounded,
              size: 18,
              color: isSettled ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Bank Disbursement',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    Text(
                      '-${walletMoney(w['amountMinor']?.toString() ?? '0')}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Ref: ${w['reference']?.toString().split('-').first ?? 'DISB'}',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isSettled
                            ? const Color(0xFFDCFCE7)
                            : (isHeld ? const Color(0xFFFEF3C7) : const Color(0xFFFEE2E2)),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          color: isSettled
                              ? const Color(0xFF166534)
                              : (isHeld ? const Color(0xFF92400E) : const Color(0xFF991B1B)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (isHeld) ...[
            const SizedBox(width: 8),
            IconButton(
              onPressed: _busy ? null : () => _cancel(w['id'] as String),
              icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFFEF4444)),
              tooltip: 'Cancel pending',
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCreditTile(dynamic c) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.arrow_downward_rounded,
              size: 18,
              color: Color(0xFF16A34A),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      c['category']?.toString() ?? 'Approved Credit',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    Text(
                      '+${walletMoney(c['availableMinor']?.toString() ?? '0')}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF16A34A)),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Source: ${c['sourceType']?.toString() ?? 'GMD Approved'}',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'AVAILABLE',
                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF166534)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24),
      alignment: Alignment.center,
      child: Text(
        message,
        style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
      ),
    );
  }
}
