import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

class DisbursementTransferModal extends StatefulWidget {
  final Map<String, dynamic> accountDetails;

  const DisbursementTransferModal({
    super.key,
    required this.accountDetails,
  });

  static Future<void> show(BuildContext context, Map<String, dynamic> accountDetails) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DisbursementTransferModal(accountDetails: accountDetails),
    );
  }

  @override
  State<DisbursementTransferModal> createState() => _DisbursementTransferModalState();
}

class _DisbursementTransferModalState extends State<DisbursementTransferModal> {
  bool _accountCopied = false;
  bool _amountCopied = false;
  bool _showBankPicker = false;

  final List<Map<String, String>> _nigerianBanks = [
    {'name': 'GTWorld / GTBank', 'scheme': 'gtworld://', 'package': 'com.gtbank.gtworldv2'},
    {'name': 'Access More', 'scheme': 'accessmore://', 'package': 'com.accessbank.accessmore'},
    {'name': 'Zenith Bank', 'scheme': 'zenith://', 'package': 'com.zenithBank.mPlus'},
    {'name': 'Kuda Bank', 'scheme': 'kuda://', 'package': 'com.kudabank.app'},
    {'name': 'OPay', 'scheme': 'opay://', 'package': 'team.opay.pay'},
    {'name': 'Moniepoint', 'scheme': 'moniepoint://', 'package': 'com.moniepoint.business'},
    {'name': 'PalmPay', 'scheme': 'palmpay://', 'package': 'com.transsnet.palmpay'},
    {'name': 'FirstBank', 'scheme': 'firstmobile://', 'package': 'com.firstbank.firstmobile'},
    {'name': 'UBA Mobile', 'scheme': 'uba://', 'package': 'com.uba.vermillion'},
    {'name': 'Stanbic IBTC', 'scheme': 'stanbic://', 'package': 'com.stanbicibtc.mobile'},
  ];

  Future<void> _copyToClipboard(String text, bool isAccount) async {
    await Clipboard.setData(ClipboardData(text: text));
    HapticFeedback.mediumImpact();

    if (mounted) {
      setState(() {
        if (isAccount) {
          _accountCopied = true;
        } else {
          _amountCopied = true;
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isAccount ? '✓ Account number copied to clipboard' : '✓ Amount copied to clipboard',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          backgroundColor: const Color(0xFF059669),
          duration: const Duration(seconds: 2),
        ),
      );

      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) {
          setState(() {
            if (isAccount) {
              _accountCopied = false;
            } else {
              _amountCopied = false;
            }
          });
        }
      });
    }
  }

  Future<void> _launchBankApp(Map<String, String>? bank) async {
    final accountNumber = widget.accountDetails['accountNumber']?.toString() ?? '';
    if (accountNumber.isNotEmpty) {
      await Clipboard.setData(ClipboardData(text: accountNumber));
    }

    if (bank != null) {
      final scheme = bank['scheme']!;
      final package = bank['package']!;
      try {
        final uri = Uri.parse(scheme);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          return;
        }
        final intentUri = Uri.parse('android-app://$package');
        if (await canLaunchUrl(intentUri)) {
          await launchUrl(intentUri, mode: LaunchMode.externalApplication);
          return;
        }
      } catch (_) {}

      // Fallback to store
      try {
        final storeUri = Uri.parse('https://play.google.com/store/apps/details?id=$package');
        await launchUrl(storeUri, mode: LaunchMode.externalApplication);
      } catch (_) {}
    } else {
      setState(() => _showBankPicker = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final details = widget.accountDetails;
    final bankName = details['bankName']?.toString() ?? 'Default Bank';
    final accountNumber = details['accountNumber']?.toString() ?? 'Not Set';
    final accountName = details['accountName']?.toString() ?? details['requesterName']?.toString() ?? 'Beneficiary';
    final requestNumber = details['requestNumber']?.toString() ?? '';
    final title = details['title']?.toString() ?? '';

    num rawAmount = 0;
    if (details['amountNaira'] != null) {
      rawAmount = num.tryParse(details['amountNaira'].toString()) ?? 0;
    } else if (details['amountMinor'] != null) {
      rawAmount = (num.tryParse(details['amountMinor'].toString()) ?? 0) / 100;
    }

    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
    final formattedAmount = currencyFormat.format(rawAmount);

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF059669).withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 26),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Request Approved!',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'Ready for immediate bank transfer',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.6),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close, color: Colors.white54),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Requisition Identifier
          if (requestNumber.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(
                children: [
                  const Text('Requisition: ', style: TextStyle(color: Colors.white54, fontSize: 11)),
                  Text(
                    requestNumber,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                  if (title.isNotEmpty) ...[
                    const Text(' • ', style: TextStyle(color: Colors.white30, fontSize: 11)),
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                    ),
                  ],
                ],
              ),
            ),

          const SizedBox(height: 12),

          // Amount to Transfer Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF064E3B), Color(0xFF065F46)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'AMOUNT TO TRANSFER',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.7),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formattedAmount,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                ElevatedButton.icon(
                  onPressed: () => _copyToClipboard(rawAmount.toString(), false),
                  icon: Icon(
                    _amountCopied ? Icons.check : Icons.copy_rounded,
                    size: 14,
                    color: Colors.white,
                  ),
                  label: Text(
                    _amountCopied ? 'Copied' : 'Copy',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white.withOpacity(0.2),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Disbursement Banking Card
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(
              children: [
                // Bank Name
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.account_balance_rounded, color: Color(0xFF10B981), size: 18),
                      const SizedBox(width: 10),
                      Text(
                        'Destination Bank',
                        style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
                      ),
                      const Spacer(),
                      Text(
                        bankName,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Colors.white10),

                // Account Number Highlight Row
                Container(
                  color: const Color(0xFF0F172A).withOpacity(0.6),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      const Icon(Icons.credit_card_rounded, color: Color(0xFF10B981), size: 18),
                      const SizedBox(width: 10),
                      Text(
                        'Account Number',
                        style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
                      ),
                      const Spacer(),
                      Text(
                        accountNumber,
                        style: const TextStyle(
                          color: Color(0xFF34D399),
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton(
                        onPressed: accountNumber.isNotEmpty && accountNumber != 'Not Set'
                            ? () => _copyToClipboard(accountNumber, true)
                            : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          minimumSize: Size.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: Row(
                          children: [
                            Icon(_accountCopied ? Icons.check : Icons.copy_rounded, size: 13),
                            const SizedBox(width: 4),
                            Text(
                              _accountCopied ? 'Copied' : 'Copy',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Colors.white10),

                // Beneficiary Account Name
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.person_rounded, color: Color(0xFF10B981), size: 18),
                      const SizedBox(width: 10),
                      Text(
                        'Account Name',
                        style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
                      ),
                      const Spacer(),
                      Flexible(
                        child: Text(
                          accountName,
                          textAlign: TextAlign.right,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Security Badge / Advisory
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFD97706).withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFD97706).withOpacity(0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.security_rounded, color: Color(0xFFF59E0B), size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Set disbursement account for requester. Double-check recipient name in bank app before transfer.',
                    style: TextStyle(color: const Color(0xFFFDE68A).withOpacity(0.9), fontSize: 10),
                  ),
                ),
              ],
            ),
          ),

          // Bank App Quick Selector if requested
          if (_showBankPicker) ...[
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Select Your Bank App to Open:',
                  style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                GestureDetector(
                  onTap: () => setState(() => _showBankPicker = false),
                  child: const Text('Hide', style: TextStyle(color: Color(0xFF10B981), fontSize: 11)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 140),
              child: GridView.builder(
                shrinkWrap: true,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 3.2,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: _nigerianBanks.length,
                itemBuilder: (context, index) {
                  final b = _nigerianBanks[index];
                  return InkWell(
                    onTap: () => _launchBankApp(b),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white12),
                      ),
                      alignment: Alignment.centerLeft,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              b['name']!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                          const Icon(Icons.open_in_new_rounded, size: 12, color: Colors.white38),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],

          const SizedBox(height: 16),

          // Main CTAs
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: accountNumber.isNotEmpty && accountNumber != 'Not Set'
                      ? () => _copyToClipboard(accountNumber, true)
                      : null,
                  icon: Icon(_accountCopied ? Icons.check : Icons.copy_rounded, size: 16),
                  label: Text(_accountCopied ? 'Account Copied!' : 'Copy Account'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    side: const BorderSide(color: Colors.white24),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _launchBankApp(null),
                  icon: const Icon(Icons.launch_rounded, size: 16),
                  label: const Text('Open Bank App'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 3,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Done / Dismiss', style: TextStyle(color: Colors.white38, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
