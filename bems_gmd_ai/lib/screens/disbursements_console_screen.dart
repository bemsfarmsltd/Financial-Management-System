import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';

class DisbursementsConsoleScreen extends StatefulWidget {
  const DisbursementsConsoleScreen({super.key});

  @override
  State<DisbursementsConsoleScreen> createState() => _DisbursementsConsoleScreenState();
}

class _DisbursementsConsoleScreenState extends State<DisbursementsConsoleScreen> {
  bool _isLoading = true;
  String _selectedTab = 'ready'; // 'ready', 'awaiting', 'verified'
  Map<String, dynamic> _data = {};
  String? _busyRequestId;

  @override
  void initState() {
    super.initState();
    _loadDisbursements();
  }

  Future<void> _loadDisbursements() async {
    setState(() => _isLoading = true);
    final res = await ApiService.fetchDisbursementsData();
    if (mounted) {
      setState(() {
        _data = res;
        _isLoading = false;
      });
    }
  }

  Future<void> _showRecordPaymentSheet(Map<String, dynamic> item) async {
    final refController = TextEditingController(text: 'TRF-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}');
    final bankController = TextEditingController(text: 'Access Bank PLC');
    final payerOrgId = (item['subsidiary'] is Map ? item['subsidiary']['id'] : item['subsidiaryId']) ?? '';
    final requestId = item['id']?.toString() ?? '';
    final amountMinor = (item['amountMinor'] ?? 0).toString();
    final beneficiary = item['requester'] is Map ? item['requester'] : {};
    final beneficiaryName = beneficiary['accountName'] ?? beneficiary['legalName'] ?? '';
    final beneficiaryBank = beneficiary['bankName'] ?? '';
    final beneficiaryAccount = beneficiary['accountNumber'] ?? '';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
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
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEA580C), size: 20),
                  ),
                  const SizedBox(width: 10),
                  const Text('Record Bank Transfer', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Amount to Pay', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        Text(item['amountFormatted'] ?? '₦${item['amount'] ?? 0}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                      ],
                    ),
                    const Divider(height: 16, color: Color(0xFFE2E8F0)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Beneficiary', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        Text('$beneficiaryName', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Account', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        Text('$beneficiaryAccount · $beneficiaryBank', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('Source Bank (Payer Account)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
              const SizedBox(height: 6),
              TextField(
                controller: bankController,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                  prefixIcon: const Icon(Icons.account_balance_rounded, size: 18, color: Color(0xFF64748B)),
                ),
              ),
              const SizedBox(height: 12),
              const Text('Bank Transfer Reference / Session ID', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
              const SizedBox(height: 6),
              TextField(
                controller: refController,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                  prefixIcon: const Icon(Icons.tag_rounded, size: 18, color: Color(0xFF64748B)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: () async {
                    Navigator.pop(ctx);
                    setState(() => _busyRequestId = requestId);
                    try {
                      await ApiService.recordDisbursementPayment(
                        requestId: requestId,
                        payerOrgId: payerOrgId,
                        externalReference: refController.text.trim(),
                        bankName: bankController.text.trim(),
                        amountMinor: amountMinor,
                        beneficiaryName: beneficiaryName,
                        beneficiaryBank: beneficiaryBank,
                        beneficiaryAccount: beneficiaryAccount,
                      );
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('✓ Bank payment recorded successfully.'), backgroundColor: Color(0xFF059669)),
                        );
                        _loadDisbursements();
                      }
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Failed: $e'), backgroundColor: const Color(0xFFDC2626)),
                        );
                      }
                    } finally {
                      if (mounted) setState(() => _busyRequestId = null);
                    }
                  },
                  child: const Text('Confirm Disbursement Completed', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final readyList = (_data['readyForTransfer'] as List<dynamic>?) ?? [];
    final awaitingList = (_data['awaitingChecker'] as List<dynamic>?) ?? [];
    final verifiedList = (_data['verifiedDisbursements'] as List<dynamic>?) ?? [];
    final summary = _data['summary'] as Map<String, dynamic>?;

    final displayList = _selectedTab == 'ready' ? readyList : _selectedTab == 'awaiting' ? awaitingList : verifiedList;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Disbursements Console', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
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
            onPressed: _loadDisbursements,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
          : RefreshIndicator(
              onRefresh: _loadDisbursements,
              color: const Color(0xFFEA580C),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Summary Banner
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFF1E293B)]),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('PENDING DISBURSEMENT OUTFLOW', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8), letterSpacing: 0.5)),
                        const SizedBox(height: 6),
                        Text(
                          summary?['pendingPayoutTotalFormatted'] ?? '₦0',
                          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: const Color(0xFFEA580C).withOpacity(0.2), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFEA580C).withOpacity(0.4))),
                              child: Text('${readyList.length} Awaiting Payment', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFFB923C))),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: const Color(0xFF059669).withOpacity(0.2), borderRadius: BorderRadius.circular(6)),
                              child: Text('${verifiedList.length} Completed', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF34D399))),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Segmented Tabs
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
                    child: Row(
                      children: [
                        _buildTabButton('ready', 'Ready to Pay (${readyList.length})'),
                        _buildTabButton('awaiting', 'Awaiting Check (${awaitingList.length})'),
                        _buildTabButton('verified', 'Verified (${verifiedList.length})'),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // List of Items
                  if (displayList.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(36),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: Column(
                        children: [
                          Icon(Icons.check_circle_outline_rounded, size: 48, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          const Text('No records in this queue', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                          const SizedBox(height: 4),
                          const Text('All approved payouts have been resolved.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        ],
                      ),
                    )
                  else
                    ...displayList.map((item) => _buildDisbursementCard(item)),
                ],
              ),
            ),
    );
  }

  Widget _buildTabButton(String key, String title) {
    final isSelected = _selectedTab == key;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTab = key),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: isSelected ? const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 4, offset: Offset(0, 2))] : null,
          ),
          child: Center(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? const Color(0xFFEA580C) : const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDisbursementCard(Map<String, dynamic> item) {
    final requester = item['requester'] is Map ? item['requester'] : {};
    final subsidiary = item['subsidiary'] is Map ? item['subsidiary'] : {};
    final subName = subsidiary['legalName'] ?? subsidiary['code'] ?? 'BEMS Group';
    final reqNumber = item['requestNumber'] ?? item['id'] ?? '';
    final title = item['title'] ?? 'Fund Request';
    final amountFormatted = item['amountFormatted'] ?? '₦${item['amount'] ?? 0}';
    final bankName = requester['bankName'] ?? 'No Bank Specified';
    final accountNumber = requester['accountNumber'] ?? 'N/A';
    final accountName = requester['accountName'] ?? requester['legalName'] ?? 'Beneficiary';
    final isBusy = _busyRequestId == item['id'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x050F172A), blurRadius: 6, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                child: Text(subName, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
              ),
              Text(amountFormatted, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          Text(reqNumber, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),

          const SizedBox(height: 12),

          // Monnify-Verified Payout Account Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.account_balance_rounded, size: 14, color: Color(0xFFEA580C)),
                        const SizedBox(width: 6),
                        Text(bankName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(6)),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle_rounded, size: 10, color: Color(0xFF16A34A)),
                          SizedBox(width: 3),
                          Text('Monnify Verified', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(accountNumber, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 1.2, color: Color(0xFF0F172A))),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: accountNumber));
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Account number copied: $accountNumber'), duration: const Duration(seconds: 1)),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(6)),
                        child: const Row(
                          children: [
                            Icon(Icons.copy_rounded, size: 11, color: Color(0xFF475569)),
                            SizedBox(width: 3),
                            Text('Copy', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(accountName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
              ],
            ),
          ),

          if (_selectedTab == 'ready') ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 40,
              child: ElevatedButton.icon(
                icon: isBusy
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send_rounded, size: 14, color: Colors.white),
                label: const Text('Record Bank Transfer Proof', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
                onPressed: isBusy ? null : () => _showRecordPaymentSheet(item),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
