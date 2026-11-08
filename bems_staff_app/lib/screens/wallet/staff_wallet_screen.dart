import 'package:flutter/material.dart';
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
  if (!RegExp(r'^(0|[1-9]\d*)(\.\d{1,2})?$').hasMatch(value)) {
    throw Exception('Enter a naira amount with at most two decimal places.');
  }
  final p = value.split('.');
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
  String _activeTab = 'ALL'; // ALL | INFLOWS | OUTFLOWS

  @override
  void initState() {
    super.initState();
    _wallet = StaffApiService.getOwnWallet(widget.user);
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
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
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
                labelText: 'Account Password',
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
            child: const Text('Confirm Transaction'),
          ),
        ],
      ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 250));
    controller.dispose();
    return result;
  }

  Future<void> _bank() async {
    final number = TextEditingController();
    String? code;
    try {
      final banks = await StaffApiService.walletBanks(widget.user);
      if (!mounted) return;
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Disbursement Bank Account', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Your approved funds disburse directly to this bank account via Monnify.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: code,
                  isExpanded: true,
                  hint: const Text('Choose Destination Bank', style: TextStyle(fontSize: 13)),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  items: banks
                      .map((b) => DropdownMenuItem<String>(
                            value: b['code'] as String,
                            child: Text(b['name'] as String, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                          ))
                      .toList(),
                  onChanged: (v) => set(() => code = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: number,
                  keyboardType: TextInputType.number,
                  maxLength: 10,
                  decoration: InputDecoration(
                    labelText: '10-Digit NUBAN Account Number',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const Text(
                  'Account name must strictly match your enrolled staff identity.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
              FilledButton(
                onPressed: () => Navigator.pop(c, true),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                child: const Text('Verify & Save'),
              ),
            ],
          ),
        ),
      );
      if (ok != true || !mounted) return;
      final password = await _password(
        'Authorize Bank Link',
        'Verify your account ending in ${number.text.length >= 4 ? number.text.substring(number.text.length - 4) : number.text}.',
      );
      if (password == null || !mounted) return;
      setState(() => _busy = true);
      await StaffApiService.walletRequest(
        widget.user,
        'bank',
        {'accountNumber': number.text, 'bankCode': code, 'password': password},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Disbursement bank verified successfully.')));
        _reload();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      number.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _withdraw(Map<String, dynamic> wallet) async {
    final banks = wallet['banks'] as List<dynamic>;
    final credits = (wallet['credits'] as List<dynamic>)
        .where((c) => (BigInt.tryParse(c['availableMinor']?.toString() ?? '0') ?? BigInt.zero) > BigInt.zero)
        .toList();
    if (banks.isEmpty || credits.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verify your disbursement bank and ensure you have approved wallet funds.')),
      );
      return;
    }
    final amount = TextEditingController();
    String? credit = 'ALL';
    try {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Withdraw Approved Funds', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Destination: ${banks[0]['accountName']} · •••• ${banks[0]['lastFour']}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: credit,
                  isExpanded: true,
                  hint: const Text('Select Source Envelope'),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  items: [
                    const DropdownMenuItem<String>(
                      value: 'ALL',
                      child: Text('Combined approved funds (FIFO)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    ),
                    ...credits.map((x) => DropdownMenuItem<String>(
                          value: x['id'] as String,
                          child: Text(
                            '${x['category']} · ${walletMoney(x['availableMinor'] as String)}',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12),
                          ),
                        )),
                  ],
                  onChanged: (v) => set(() => credit = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Withdrawal Amount (₦)',
                    prefixText: '₦ ',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '✓ Monnify direct transfer. Company pays 100% of transfer fees.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
              FilledButton(
                onPressed: () => Navigator.pop(c, true),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                child: const Text('Authorize Withdrawal'),
              ),
            ],
          ),
        ),
      );
      if (ok != true || credit == null || !mounted) return;
      final amountMinor = _minor(amount.text);
      final password = await _password(
        'Confirm Monnify Payout',
        'Transfer ${walletMoney(amountMinor)} to your verified account ending in ${banks[0]['lastFour']}. No second approval required.',
      );
      if (password == null || !mounted) return;
      setState(() => _busy = true);
      var candidate = <String, dynamic>{
        'amountMinor': amountMinor,
        'bankAccountId': banks[0]['id'],
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
      await StaffStorageService.clearWalletIntent(widget.user.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Disbursement queued: Ref ${result['reference']}. Status: ${result['status']}')),
        );
        _reload();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
        _reload();
      }
    } finally {
      amount.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _returnFunds(Map<String, dynamic> wallet) async {
    final credits = (wallet['credits'] as List<dynamic>)
        .where((c) =>
            ['PROJECT', 'REQUEST'].contains(c['category']) &&
            (BigInt.tryParse(c['availableMinor']?.toString() ?? '0') ?? BigInt.zero) > BigInt.zero)
        .toList();
    if (credits.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No unspent project advances available to return.')),
      );
      return;
    }
    final amount = TextEditingController();
    final reason = TextEditingController();
    String? credit = credits[0]['id'] as String;
    try {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Return Unused Project Funds', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<String>(
                  value: credit,
                  isExpanded: true,
                  hint: const Text('Select Project Envelope'),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  items: credits
                      .map((x) => DropdownMenuItem<String>(
                            value: x['id'] as String,
                            child: Text(
                              '${x['category']} · ${walletMoney(x['availableMinor'] as String)}',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ))
                      .toList(),
                  onChanged: (v) => set(() => credit = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amount,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Amount to Return (₦)',
                    prefixText: '₦ ',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reason,
                  decoration: InputDecoration(
                    labelText: 'Reason for Surplus Return',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
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
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unused project funds returned successfully.')));
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
              // 1. HERO BANKING CARD (Modern Obsidian & Gold Look)
              _buildHeroBankingCard(wallet, primaryBank),

              const SizedBox(height: 16),

              // 2. QUICK ACTIONS ROW (Withdraw, Bank Details, Return Surplus, Sync)
              _buildQuickActionsBar(wallet, primaryBank),

              const SizedBox(height: 18),

              // 3. STATISTICAL METRICS ROW
              _buildMetricsRow(wallet),

              const SizedBox(height: 20),

              // 4. SEGMENTED ACTIVITY LEDGER
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

  // 1. HERO VIRTUAL BANKING CARD
  Widget _buildHeroBankingCard(Map<String, dynamic> wallet, Map<String, dynamic>? primaryBank) {
    final availableMinor = wallet['availableMinor']?.toString() ?? '0';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF090D16)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFF334155).withOpacity(0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.18),
            blurRadius: 16,
            offset: const Offset(0, 6),
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
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFDE68A), Color(0xFFD97706)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: const Icon(Icons.credit_card_rounded, size: 14, color: Color(0xFF78350F)),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'BEMS CORPORATE WALLET',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFCBD5E1),
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
                      color: const Color(0xFF94A3B8),
                      size: 20,
                    ),
                    tooltip: 'Toggle balance visibility',
                    visualDensity: VisualDensity.compact,
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircleAvatar(radius: 3, backgroundColor: Color(0xFF4ADE80)),
                        SizedBox(width: 4),
                        Text(
                          'Active',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF4ADE80)),
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
          const Text(
            'AVAILABLE APPROVED FUNDS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Color(0xFF94A3B8),
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
            color: Colors.white.withOpacity(0.08),
          ),

          const SizedBox(height: 14),

          // Card Footer Row: Payout Bank & Fee Protection
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.account_balance_rounded, size: 14, color: Color(0xFFCBD5E1)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        primaryBank != null
                            ? '${primaryBank['accountName']} · •••• ${primaryBank['lastFour']}'
                            : 'No verified bank account linked',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFE2E8F0),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Row(
                children: [
                  Icon(Icons.shield_outlined, size: 12, color: Color(0xFF38BDF8)),
                  SizedBox(width: 4),
                  Text(
                    'Company Pays Fees',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF38BDF8)),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // 2. QUICK ACTIONS BAR
  Widget _buildQuickActionsBar(Map<String, dynamic> wallet, Map<String, dynamic>? primaryBank) {
    final withdrawalsEnabled = wallet['withdrawalsEnabled'] == true;

    return Row(
      children: [
        // Action 1: Withdraw (Primary Accent)
        Expanded(
          child: _buildActionButton(
            label: 'Withdraw',
            icon: Icons.arrow_upward_rounded,
            backgroundColor: const Color(0xFFEA580C),
            iconColor: Colors.white,
            textColor: const Color(0xFF0F172A),
            isPrimary: true,
            onTap: _busy || !withdrawalsEnabled ? null : () => _withdraw(wallet),
          ),
        ),
        const SizedBox(width: 10),
        // Action 2: Bank Account Details
        Expanded(
          child: _buildActionButton(
            label: 'Bank Account',
            icon: Icons.account_balance_rounded,
            backgroundColor: Colors.white,
            iconColor: const Color(0xFF2563EB),
            textColor: const Color(0xFF0F172A),
            onTap: _busy ? null : _bank,
          ),
        ),
        const SizedBox(width: 10),
        // Action 3: Return Unused Advance
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

  // 3. FINANCIAL STAT METRICS ROW
  Widget _buildMetricsRow(Map<String, dynamic> wallet) {
    return Row(
      children: [
        // Card A: Pending Releases
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

  // 4. SEGMENTED ACTIVITY / TRANSACTION LEDGER
  Widget _buildTransactionLedger(List<dynamic> credits, List<dynamic> withdrawals) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header & Tab Pills
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Activity & Ledger',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
            Row(
              children: [
                _buildSegmentPill('ALL', 'All'),
                const SizedBox(width: 4),
                _buildSegmentPill('INFLOWS', 'Credits'),
                const SizedBox(width: 4),
                _buildSegmentPill('OUTFLOWS', 'Payouts'),
              ],
            ),
          ],
        ),

        const SizedBox(height: 12),

        // Filtered List
        if (_activeTab == 'ALL' || _activeTab == 'OUTFLOWS') ...[
          if (withdrawals.isEmpty && _activeTab == 'OUTFLOWS')
            _buildEmptyState('No bank withdrawals recorded yet.')
          else
            ...withdrawals.map((w) => _buildWithdrawalTile(w)),
        ],

        if (_activeTab == 'ALL' || _activeTab == 'INFLOWS') ...[
          if (credits.isEmpty && _activeTab == 'INFLOWS')
            _buildEmptyState('No approved fund allocations yet.')
          else
            ...credits.map((c) => _buildCreditTile(c)),
        ],

        if (_activeTab == 'ALL' && withdrawals.isEmpty && credits.isEmpty)
          _buildEmptyState('No wallet activity recorded yet.'),
      ],
    );
  }

  Widget _buildSegmentPill(String tabKey, String label) {
    final isSelected = _activeTab == tabKey;
    return InkWell(
      onTap: () => setState(() => _activeTab = tabKey),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEA580C) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(12),
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
