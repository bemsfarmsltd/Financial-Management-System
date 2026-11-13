import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../screens/wallet_funding_screen.dart';
import 'disbursement_transfer_modal.dart';

class InteractiveActionCard extends StatefulWidget {
  final Map<String, dynamic> data;
  final VoidCallback? onAction;

  const InteractiveActionCard({
    super.key,
    required this.data,
    this.onAction,
  });

  @override
  State<InteractiveActionCard> createState() => _InteractiveActionCardState();
}

class _InteractiveActionCardState extends State<InteractiveActionCard> {
  final Set<String> _approvedRequestIds = {};
  final Set<String> _declinedRequestIds = {};
  final Set<String> _remindedCaseIds = {};
  final Set<String> _processingIds = {};

  String? _stagedStatus;
  String? _stagedResultMessage;
  String? _stagedErrorMessage;
  String? _stagedAuditEventId;
  bool _isStagedProcessing = false;
  final TextEditingController _passwordController = TextEditingController();

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _stagedStatus = widget.data['status']?.toString();
    _stagedResultMessage = widget.data['resultMessage']?.toString();
    _stagedErrorMessage = widget.data['errorMessage']?.toString();
    _stagedAuditEventId = widget.data['auditEventId']?.toString();
    _hydrateStagedStatusIfNeeded();
  }

  Future<void> _hydrateStagedStatusIfNeeded() async {
    final stagedId = widget.data['staged_action_id']?.toString() ?? '';
    if (stagedId.isEmpty) return;

    final serverState = await ApiService.getStagedActionStatus(stagedActionId: stagedId);
    if (!mounted || serverState == null) return;

    final status = serverState['status']?.toString();
    if (status != null && status.isNotEmpty) {
      setState(() {
        _stagedStatus = status;
        widget.data['status'] = status;
        if (serverState['audit_event_id'] != null) {
          _stagedAuditEventId = serverState['audit_event_id'].toString();
          widget.data['auditEventId'] = _stagedAuditEventId;
        }
        final execResult = serverState['execution_result'];
        if (execResult is Map && execResult['message'] != null) {
          _stagedResultMessage = execResult['message'].toString();
          widget.data['resultMessage'] = _stagedResultMessage;
        }
      });
    }
  }

  Future<void> _handleConfirmStagedAction() async {
    final stagedId = widget.data['staged_action_id']?.toString() ?? '';
    final hash = widget.data['confirmation_hash']?.toString() ?? '';
    if (stagedId.isEmpty || hash.isEmpty || _isStagedProcessing) return;

    final rawActionType = (widget.data['actionType'] ?? widget.data['type'] ?? '').toString().toLowerCase();
    final previewMap = widget.data['preview'] is Map
        ? Map<String, dynamic>.from(widget.data['preview'] as Map)
        : <String, dynamic>{};
    final requiresPassword = rawActionType == 'payroll_batch_approval' || previewMap['requires_password'] == true;

    if (requiresPassword && _passwordController.text.trim().isEmpty) {
      setState(() {
        _stagedErrorMessage = 'Please enter your GMD Executive Password to authorize salary disbursement.';
      });
      return;
    }

    setState(() {
      _isStagedProcessing = true;
      _stagedErrorMessage = null;
    });

    final res = await ApiService.confirmStagedAction(
      stagedActionId: stagedId,
      confirmationHash: hash,
      password: _passwordController.text.trim().isNotEmpty ? _passwordController.text.trim() : null,
    );

    if (!mounted) return;

    final ok = res['ok'] == true;
    final code = res['code']?.toString() ?? '';
    final serverStatus = res['status']?.toString() ??
        (ok
            ? 'EXECUTED'
            : code == 'ALREADY_EXECUTED'
                ? 'EXECUTED'
                : code == 'CANCELLED'
                    ? 'CANCELLED'
                    : code == 'STAGED_ACTION_EXPIRED'
                        ? 'EXPIRED'
                        : 'PENDING');

    setState(() {
      _isStagedProcessing = false;
      _stagedStatus = serverStatus;
      widget.data['status'] = serverStatus;
      if (ok) {
        _stagedResultMessage = res['message']?.toString() ?? 'Operation committed to BEMS ledger.';
        _stagedAuditEventId = res['audit_event_id']?.toString();
        widget.data['resultMessage'] = _stagedResultMessage;
        widget.data['auditEventId'] = _stagedAuditEventId;
      } else {
        _stagedErrorMessage = res['error']?.toString() ?? 'Failed to execute staged action.';
        widget.data['errorMessage'] = _stagedErrorMessage;
      }
    });

    widget.onAction?.call();
  }

  Future<void> _handleCancelStagedAction() async {
    final stagedId = widget.data['staged_action_id']?.toString() ?? '';
    if (stagedId.isEmpty || _isStagedProcessing) return;

    setState(() {
      _isStagedProcessing = true;
      _stagedErrorMessage = null;
    });

    final res = await ApiService.cancelStagedAction(stagedActionId: stagedId);
    if (!mounted) return;

    final ok = res['ok'] == true;
    final code = res['code']?.toString() ?? '';
    final serverStatus = res['status']?.toString() ??
        (ok
            ? 'CANCELLED'
            : code == 'ALREADY_EXECUTED'
                ? 'EXECUTED'
                : code == 'STAGED_ACTION_EXPIRED'
                    ? 'EXPIRED'
                    : 'PENDING');

    setState(() {
      _isStagedProcessing = false;
      _stagedStatus = serverStatus;
      widget.data['status'] = serverStatus;
      if (ok) {
        _stagedResultMessage = res['message']?.toString() ?? 'Staged proposal discarded.';
      } else {
        _stagedErrorMessage = res['error']?.toString() ?? 'Could not cancel staged action.';
      }
    });

    widget.onAction?.call();
  }

  Future<void> _handleApproval(String requestId, bool approve, [Map<String, dynamic>? itemData]) async {
    if (_processingIds.contains(requestId)) return;
    setState(() {
      _processingIds.add(requestId);
    });

    final res = await ApiService.decideApprovalWithDetails(
      requestId: requestId,
      decision: approve ? 'APPROVE' : 'REJECT',
      note: approve ? 'Authorized by GMD via Executive AI Mobile' : 'Declined by GMD via Executive AI Mobile',
    );
    final success = res['success'] == true;

    if (mounted) {
      setState(() {
        _processingIds.remove(requestId);
        if (success) {
          if (approve) {
            _approvedRequestIds.add(requestId);
          } else {
            _declinedRequestIds.add(requestId);
          }
        }
      });

      if (success && approve) {
        final requester = itemData != null && itemData['requester'] is Map ? itemData['requester'] : null;
        final disbursementAccount = (res['disbursementAccount'] as Map<String, dynamic>?) ?? {
          'bankName': requester != null ? requester['bankName'] : null,
          'accountNumber': requester != null ? requester['accountNumber'] : null,
          'accountName': requester != null ? (requester['accountName'] ?? requester['legalName']) : null,
          'requesterName': requester != null ? requester['legalName'] : null,
          'amountNaira': itemData != null ? itemData['amountNaira'] : null,
          'amountMinor': itemData != null ? itemData['amountMinor'] : null,
          'currency': itemData != null ? itemData['currency'] : 'NGN',
          'title': itemData != null ? itemData['title'] : '',
          'requestNumber': itemData != null ? (itemData['requestNumber'] ?? itemData['number']) : '',
        };

        DisbursementTransferModal.show(context, disbursementAccount);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: approve ? const Color(0xFF059669) : const Color(0xFFDC2626),
            content: Text(
              approve
                  ? 'Request successfully authorized by GMD.'
                  : 'Request declined.',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  void _handleReminder(String caseId) {
    setState(() {
      _remindedCaseIds.add(caseId);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFFEA580C),
        content: Text(
          '⚡ High-priority WhatsApp/Slack reminder dispatched to case owner.',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final type = (widget.data['type'] ?? widget.data['cardType'] ?? '').toString().toUpperCase();
    final hasStagedId = (widget.data['staged_action_id']?.toString() ?? '').isNotEmpty;

    if(type=='WALLET_RELEASE') return Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('GMD wallet release',style:TextStyle(fontWeight:FontWeight.bold)),const Text('Open the server-verified proposal, review exact recipients and securely confirm. Never enter passwords in chat.'),FilledButton(onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>WalletFundingScreen(proposalId:widget.data['id']?.toString()))),child:const Text('Review exact wallet release'))])));
    if (type == 'STAGED_ACTION' || hasStagedId) {
      return _buildStagedActionCard(context);
    }

    switch (type) {
      case 'TREASURY':
        return _buildTreasuryCard(context);
      case 'APPROVALS':
        return _buildApprovalsCard(context);
      case 'ACCOUNTABILITY':
        return _buildAccountabilityCard(context);
      case 'BRIEFING':
        return _buildBriefingCard(context);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildStagedActionCard(BuildContext context) {
    final summary = widget.data['summary']?.toString() ?? 'Executive Staged Action';
    final actionType = (widget.data['actionType'] ?? widget.data['type'] ?? 'STAGED_ACTION')
        .toString()
        .replaceAll('_', ' ')
        .toUpperCase();
    final previewMap = widget.data['preview'] is Map
        ? Map<String, dynamic>.from(widget.data['preview'] as Map)
        : widget.data['data'] is Map
            ? Map<String, dynamic>.from(widget.data['data'] as Map)
            : <String, dynamic>{};
    final status = (_stagedStatus ?? widget.data['status'] ?? 'PENDING').toString().toUpperCase();
    final blockingErrors = (widget.data['blocking_errors'] as List?) ?? [];

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: status == 'EXECUTED'
              ? const Color(0xFFA7F3D0)
              : status == 'CANCELLED' || status == 'EXPIRED'
                  ? const Color(0xFFE2E8F0)
                  : const Color(0xFFFED7AA),
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 14,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                actionType,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFEA580C),
                  letterSpacing: 0.8,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: status == 'EXECUTED'
                      ? const Color(0xFFECFDF5)
                      : status == 'CANCELLED' || status == 'EXPIRED'
                          ? const Color(0xFFF1F5F9)
                          : const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: status == 'EXECUTED'
                        ? const Color(0xFF059669)
                        : status == 'CANCELLED' || status == 'EXPIRED'
                            ? const Color(0xFF64748B)
                            : const Color(0xFFEA580C),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            summary,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          if (previewMap.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: previewMap.entries
                    .where((e) => e.key != 'register' && e.key != 'requires_password')
                    .take(8)
                    .map((entry) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          entry.key.replaceAll('_', ' ').toUpperCase(),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Flexible(
                          child: Text(
                            '${entry.value ?? '—'}',
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
          if (previewMap['register'] is List && (previewMap['register'] as List).isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'MONTHLY SALARY REGISTER PREVIEW',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF475569), letterSpacing: 0.5),
            ),
            const SizedBox(height: 6),
            Container(
              constraints: const BoxConstraints(maxHeight: 180),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.all(8),
                itemCount: (previewMap['register'] as List).length,
                separatorBuilder: (_, __) => const Divider(height: 8, color: Color(0xFFE2E8F0)),
                itemBuilder: (context, idx) {
                  final row = (previewMap['register'] as List)[idx];
                  if (row is! Map) return const SizedBox.shrink();
                  final staffName = (row['name'] ?? row['legalName'] ?? 'Staff').toString();
                  final netPay = (row['net'] ?? row['netPay'] ?? '₦0').toString();
                  final deductions = (row['deductions'] ?? '₦0').toString();
                  return Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          staffName,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        'Ded: $deductions  ·  Net: $netPay',
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF059669)),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
          if (status == 'PENDING' &&
              ((widget.data['actionType'] ?? widget.data['type'] ?? '').toString().toLowerCase() == 'payroll_batch_approval' ||
                  previewMap['requires_password'] == true)) ...[
            const SizedBox(height: 10),
            TextField(
              controller: _passwordController,
              obscureText: true,
              style: const TextStyle(fontSize: 12, color: Color(0xFF0F172A)),
              decoration: InputDecoration(
                labelText: 'GMD Executive Password (Required to Disburse)',
                labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF9A3412)),
                filled: true,
                fillColor: const Color(0xFFFFF7ED),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFFDBA74)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFFDBA74)),
                ),
              ),
            ),
          ],
          if (_stagedErrorMessage != null && _stagedErrorMessage!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Text(
                _stagedErrorMessage!,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFB91C1C)),
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (status == 'EXECUTED')
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _stagedResultMessage ?? 'Operation committed to BEMS ledger.',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF065F46)),
                  ),
                  if (_stagedAuditEventId != null && _stagedAuditEventId!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'Audit ID: $_stagedAuditEventId',
                        style: const TextStyle(fontSize: 10, color: Color(0xFF047857)),
                      ),
                    ),
                ],
              ),
            )
          else if (status == 'CANCELLED' || status == 'EXPIRED')
            Text(
              status == 'CANCELLED'
                  ? (_stagedResultMessage ?? 'Staged proposal discarded.')
                  : 'Staged proposal expired. Ask the AI Copilot to stage a fresh preview.',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            )
          else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isStagedProcessing ? null : _handleCancelStagedAction,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF64748B),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Discard', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: (_isStagedProcessing || blockingErrors.isNotEmpty)
                        ? null
                        : _handleConfirmStagedAction,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: Text(
                      _isStagedProcessing ? 'Committing...' : 'Confirm & Commit',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildTreasuryCard(BuildContext context) {
    final accounts = (widget.data['accounts'] as List?) ?? [];
    final totalCash = widget.data['totalCash'] as String? ?? '₦0';

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFED7AA), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 14,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'LIVE TREASURY LIQUIDITY',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFEA580C),
                  letterSpacing: 0.8,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Text(
                  '● Live Reconciled',
                  style: TextStyle(color: Color(0xFF059669), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            totalCash,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0F172A),
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),
          ...accounts.map((acc) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(acc['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A))),
                        Text('Acc: ${acc['account']}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                      ],
                    ),
                    Text(
                      acc['balance'] ?? '',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: Color(0xFFEA580C),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildApprovalsCard(BuildContext context) {
    final count = widget.data['count'] ?? 0;
    final total = widget.data['total'] ?? '₦0';
    final requests = (widget.data['requests'] as List?) ?? [];

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFED7AA), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 14,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'EXECUTIVE AUTHORIZATION QUEUE',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFEA580C),
                  letterSpacing: 0.8,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Text(
                  '$count Pending',
                  style: const TextStyle(color: Color(0xFFEA580C), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            total,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 12),
          if (requests.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                '✓ No requisitions currently pending authorization.',
                style: TextStyle(color: Color(0xFF059669), fontSize: 12, fontWeight: FontWeight.w600),
              ),
            )
          else
            ...requests.map((r) {
              final reqId = r['id']?.toString() ?? r['number']?.toString() ?? '';
              final isApproved = _approvedRequestIds.contains(reqId);
              final isDeclined = _declinedRequestIds.contains(reqId);
              final isProcessing = _processingIds.contains(reqId);

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isApproved
                        ? const Color(0xFFA7F3D0)
                        : (isDeclined ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0)),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r['title'] ?? '',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                              ),
                              Text(
                                '${r['number']} · ${r['by']}',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          r['amount'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFFEA580C)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (isApproved)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF059669)),
                            SizedBox(width: 4),
                            Text(
                              'Authorized by GMD',
                              style: TextStyle(color: Color(0xFF059669), fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    else if (isDeclined)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.cancel_rounded, size: 14, color: Color(0xFFDC2626)),
                            SizedBox(width: 4),
                            Text(
                              'Declined by GMD',
                              style: TextStyle(color: Color(0xFFDC2626), fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    else
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFDC2626),
                              side: const BorderSide(color: Color(0xFFFECACA)),
                              backgroundColor: const Color(0xFFFEF2F2),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              visualDensity: VisualDensity.compact,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: isProcessing ? null : () => _handleApproval(reqId, false),
                            child: const Text('Decline', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF059669),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              visualDensity: VisualDensity.compact,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: isProcessing ? null : () => _handleApproval(reqId, true, r),
                            child: isProcessing
                                ? const SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.check_rounded, size: 13),
                                      SizedBox(width: 4),
                                      Text('Approve', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                          ),
                        ],
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildAccountabilityCard(BuildContext context) {
    final count = widget.data['count'] ?? 0;
    final cases = (widget.data['cases'] as List?) ?? [];

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 14,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ACCOUNTABILITY SLA MONITOR',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFD97706),
                  letterSpacing: 0.8,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Text(
                  '$count Open Cases',
                  style: const TextStyle(color: Color(0xFFB45309), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...cases.map((c) {
            final caseId = c['id']?.toString() ?? c['number']?.toString() ?? '';
            final isReminded = _remindedCaseIds.contains(caseId);

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c['number'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF0F172A))),
                      Text(c['owner'] ?? '', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                    ],
                  ),
                  if (isReminded)
                    const Text('⚡ Reminder Pushed', style: TextStyle(color: Color(0xFFD97706), fontSize: 11, fontWeight: FontWeight.bold))
                  else
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFEF3C7),
                        foregroundColor: const Color(0xFF92400E),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        visualDensity: VisualDensity.compact,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      onPressed: () => _handleReminder(caseId),
                      child: const Text('Send Alert', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildBriefingCard(BuildContext context) {
    final cash = widget.data['cash'] ?? '₦0';
    final pending = widget.data['pending'] ?? 0;
    final openCases = widget.data['openCases'] ?? 0;
    final staff = widget.data['staff'] ?? 0;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFA7F3D0), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 14,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'EXECUTIVE DAILY SCORECARD',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF059669), letterSpacing: 0.8),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile('LIQUID RESERVES', cash, const Color(0xFF059669)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile('PENDING REVIEWS', '$pending', const Color(0xFFEA580C)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile('OPEN ADVANCES', '$openCases', const Color(0xFF0284C7)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile('GROUP STAFF', '$staff', const Color(0xFF0F172A)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 9, color: Color(0xFF64748B), fontWeight: FontWeight.w800)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}
