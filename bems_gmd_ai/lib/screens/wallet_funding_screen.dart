import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

String _money(String value) {
  final n = BigInt.parse(value), a = BigInt.parse(value).abs();
  final w = (a ~/ BigInt.from(100))
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  return '${n.isNegative ? '-' : ''}₦$w.${(a % BigInt.from(100)).toString().padLeft(2, '0')}';
}

class WalletFundingScreen extends StatefulWidget {
  final String? proposalId;
  const WalletFundingScreen({super.key, this.proposalId});
  @override
  State<WalletFundingScreen> createState() => _WalletFundingScreenState();
}

class _WalletFundingScreenState extends State<WalletFundingScreen> {
  late Future<Map<String, dynamic>> _funding;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _funding = ApiService.getWalletFunding();
  }

  void _reload() {
    setState(() => _funding = ApiService.getWalletFunding());
  }

  Future<String?> _password(String title, String detail) async {
    final c = TextEditingController();
    final result = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
                title: Text(title),
                content: SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(detail),
                  TextField(
                      controller: c,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      decoration:
                          const InputDecoration(labelText: 'Current password'))
                ])),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () => Navigator.pop(ctx, c.text),
                      child: const Text('Confirm exact transaction'))
                ]));
    await Future<void>.delayed(const Duration(milliseconds: 250));
    c.dispose();
    return result;
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) _reload();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _approve(Map<String, dynamic> p) async {
    final detail = (p['items'] as List<dynamic>)
        .map((i) =>
            '${i['employeeName']} (${i['employeeNumber']}) · ${i['organizationName']} · ${_money(i['amountMinor'] as String)}')
        .join('\n');
    final password = await _password(
        'Approve ${_money(p['amountMinor'] as String)}',
        '${p['title']}\n${p['purpose']}\n$detail\n\n${p['category'] == 'VENDOR' ? 'Reserve and pay the verified vendor directly through Monnify. No staff wallet credit.' : 'Credit these staff wallets. This does not make bank transfers.'}');
    if (password == null || !mounted) return;
    await _run(() async {
      await ApiService.approveWalletRelease(
          p['id'] as String, p['confirmationHash'] as String, password);
    });
  }

  String _bankLine(dynamic item) {
    final b =
        jsonDecode(item['bankSnapshot'] as String) as Map<String, dynamic>;
    return '${b['accountName']} · bank ${b['bankCode']} · account ${b['accountNumber']}';
  }

  Future<void> _verifyVendor(Map<String, dynamic> data) async {
    final account = TextEditingController();
    String? vendorId, bankCode;
    try {
      final banks = await ApiService.walletBanks();
      if (!mounted) return;
      final ok = await showDialog<bool>(
          context: context,
          builder: (c) => StatefulBuilder(
              builder: (c, set) => AlertDialog(
                      title: const Text('Verify supplier bank'),
                      content:
                          Column(mainAxisSize: MainAxisSize.min, children: [
                        DropdownButtonFormField<String>(
                            value: vendorId,
                            isExpanded: true,
                            hint: const Text('Choose vendor'),
                            items: (data['vendors'] as List<dynamic>)
                                .map((v) => DropdownMenuItem<String>(
                                    value: v['id'] as String,
                                    child: Text(v['name'] as String,
                                        overflow: TextOverflow.ellipsis)))
                                .toList(),
                            onChanged: (v) => set(() => vendorId = v)),
                        DropdownButtonFormField<String>(
                            value: bankCode,
                            isExpanded: true,
                            hint: const Text('Choose bank'),
                            items: banks
                                .map((b) => DropdownMenuItem<String>(
                                    value: b['code'] as String,
                                    child: Text(b['name'] as String,
                                        overflow: TextOverflow.ellipsis)))
                                .toList(),
                            onChanged: (v) => set(() => bankCode = v)),
                        TextField(
                            controller: account,
                            keyboardType: TextInputType.number,
                            maxLength: 10,
                            decoration: const InputDecoration(
                                labelText: 'Vendor account number'))
                      ]),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(c, false),
                            child: const Text('Cancel')),
                        FilledButton(
                            onPressed: () => Navigator.pop(c, true),
                            child: const Text('Continue'))
                      ])));
      if (ok != true || vendorId == null || bankCode == null || !mounted) {
        return;
      }
      final password = await _password('Verify vendor account',
          'Verify this supplier account before preparing a payment. Verification does not approve payment.');
      if (password == null || !mounted) return;
      await _run(() async {
        await ApiService.walletRequest('vendors/$vendorId/verify-bank', {
          'accountNumber': account.text,
          'bankCode': bankCode,
          'password': password
        });
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      account.dispose();
    }
  }

  Future<void> _control(String operation) async {
    final password = await _password(operation,
        '$operation wallet commitments and new withdrawal submissions. Existing transfers remain tracked.');
    if (password == null || !mounted) return;
    await _run(() async {
      final proof = await ApiService.walletRequest('challenges', {
        'purpose': 'POOL_CONTROL',
        'payload': {'operation': operation},
        'password': password
      });
      await ApiService.walletRequest('pool-control', {
        'operation': operation,
        'challengeId': proof['id'],
        'challengeToken': proof['token']
      });
    });
  }

  Future<void> _reconcile() async {
    await _run(() async {
      final result = await ApiService.walletRequest('reconcile', {});
      if (mounted) {
        await showDialog<void>(
            context: context,
            builder: (c) =>
                AlertDialog(
                    title: const Text('Reconciliation result'),
                    content:
                        SingleChildScrollView(child: Text('Scanned ${result['scanned']} transfers.\nHistory complete: ${result['historyComplete']==true?'Yes':'No — more history must be checked'}.\nUnresolved issues: ${result['unresolvedIssues']}.\n${result['message']}')),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(c),
                          child: const Text('Close'))
                    ]));
      }
    });
  }

  Future<void> _acknowledge(Map<String, dynamic> issue) async {
    final note = TextEditingController();
    try {
      final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
                  title: const Text('Record verified correction'),
                  content: TextField(
                      controller: note,
                      maxLength: 1000,
                      decoration: const InputDecoration(
                          labelText: 'Explain the verified correction')),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(c, false),
                        child: const Text('Cancel')),
                    FilledButton(
                        onPressed: () => Navigator.pop(c, true),
                        child: const Text('Continue'))
                  ]));
      if (ok != true || !mounted) return;
      if (note.text.trim().length < 10) {
        throw Exception(
            'Explain the verified correction in at least 10 characters.');
      }
      final payload = {
        'operation': 'ACKNOWLEDGE_ISSUE',
        'issueId': issue['id'],
        'note': note.text.trim()
      };
      final password = await _password('Acknowledge corrected setup',
          '${issue['code']}\n${note.text.trim()}\nThis does not activate payments.');
      if (password == null || !mounted) return;
      await _run(() async {
        final proof = await ApiService.walletRequest('challenges', {
          'purpose': 'POOL_CONTROL',
          'payload': payload,
          'password': password
        });
        await ApiService.walletRequest('issues/${issue['id']}/ack', {
          'note': note.text.trim(),
          'challengeId': proof['id'],
          'challengeToken': proof['token']
        });
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      note.dispose();
    }
  }

  Future<void> _prepare(Map<String, dynamic> data, String type,
      Map<String, dynamic> source) async {
    final ids = <String>{};
    if (type == 'REQUEST') {
      ids.add(source['subsidiaryId'] as String);
    } else {
      for (final i in source['items'] as List<dynamic>) {
        for (final a in i['allocations'] as List<dynamic>) {
          ids.add(a['subsidiaryId'] as String);
        }
      }
    }
    final mapping = <String, String>{};
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => StatefulBuilder(
            builder: (c, set) => AlertDialog(
                    title: const Text('Choose funded budgets'),
                    content: SingleChildScrollView(
                        child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                          for (final org in ids)
                            DropdownButtonFormField<String>(
                                isExpanded: true,
                                hint: Text(
                                    (data['organizations'] as List<dynamic>)
                                        .firstWhere((o) => o['id'] == org,
                                            orElse: () => {
                                                  'legalName': 'Subsidiary'
                                                })['legalName'] as String),
                                value: mapping[org],
                                items: (data['envelopes'] as List<dynamic>)
                                    .where((e) =>
                                        e['organizationId'] == org &&
                                        e['status'] == 'ACTIVE')
                                    .map((e) => DropdownMenuItem<String>(value: e['id'] as String, child: Text('${e['label']} · ${_money(e['remainingMinor'] as String)}', overflow: TextOverflow.ellipsis)))
                                    .toList(),
                                onChanged: (v) => set(() => mapping[org] = v!))
                        ])),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(c, false),
                          child: const Text('Cancel')),
                      FilledButton(
                          onPressed: ids.any((id) => !mapping.containsKey(id))
                              ? null
                              : () => Navigator.pop(c, true),
                          child: const Text('Prepare preview'))
                    ])));
    if (ok != true || !mounted) return;
    await _run(() async {
      await ApiService.walletRequest('releases', {
        'sourceType': type,
        'sourceId': source['id'],
        'envelopesByOrganization': mapping
      });
    });
  }

  Future<void> _allocate(Map<String, dynamic> data) async {
    final label = TextEditingController(), amount = TextEditingController();
    String? org, parent;
    try {
      final ok = await showDialog<bool>(
          context: context,
          builder: (c) => StatefulBuilder(
              builder: (c, set) => AlertDialog(
                      title: const Text('Allocate funded budget'),
                      content:
                          Column(mainAxisSize: MainAxisSize.min, children: [
                        DropdownButtonFormField<String>(
                            value: org,
                            isExpanded: true,
                            hint: const Text('Choose subsidiary'),
                            items: (data['organizations'] as List<dynamic>)
                                .map((o) => DropdownMenuItem<String>(
                                    value: o['id'] as String,
                                    child: Text(o['legalName'] as String,
                                        overflow: TextOverflow.ellipsis)))
                                .toList(),
                            onChanged: (v) => set(() => org = v)),
                        DropdownButtonFormField<String>(
                            value: parent,
                            isExpanded: true,
                            hint:
                                const Text('Unallocated pool or parent budget'),
                            items: [
                              const DropdownMenuItem<String>(
                                  value: null,
                                  child: Text('Unallocated company pool')),
                              for (final e
                                  in data['envelopes'] as List<dynamic>)
                                if (e['status'] == 'ACTIVE')
                                  DropdownMenuItem<String>(
                                      value: e['id'] as String,
                                      child: Text(
                                          '${e['label']} · ${_money(e['remainingMinor'] as String)}',
                                          overflow: TextOverflow.ellipsis))
                            ],
                            onChanged: (v) => set(() => parent = v)),
                        TextField(
                            controller: label,
                            decoration: const InputDecoration(
                                labelText: 'Budget name')),
                        TextField(
                            controller: amount,
                            keyboardType: const TextInputType.numberWithOptions(
                                decimal: true),
                            decoration:
                                const InputDecoration(labelText: 'Amount (₦)'))
                      ]),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(c, false),
                            child: const Text('Cancel')),
                        FilledButton(
                            onPressed: () => Navigator.pop(c, true),
                            child: const Text('Allocate'))
                      ])));
      if (ok != true || !mounted) return;
      if (!RegExp(r'^[1-9]\d*(\.\d{1,2})?$').hasMatch(amount.text)) {
        throw Exception('Enter a valid naira amount.');
      }
      final p = amount.text.split('.');
      final minor = (BigInt.parse(p[0]) * BigInt.from(100) +
              BigInt.parse(p.length > 1 ? p[1].padRight(2, '0') : '0'))
          .toString();
      await _run(() async {
        await ApiService.walletRequest('envelopes', {
          'organizationId': org,
          'parentId': parent,
          'label': label.text,
          'amountMinor': minor,
          'idempotencyKey': 'budget-${DateTime.now().microsecondsSinceEpoch}'
        });
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      label.dispose();
      amount.dispose();
    }
  }

  Future<void> _adjust(
      Map<String, dynamic> data, Map<String, dynamic> envelope) async {
    final amount = TextEditingController();
    String operation = 'INCREASE';
    String? target;
    try {
      final ok = await showDialog<bool>(
          context: context,
          builder: (c) => StatefulBuilder(
              builder: (c, set) => AlertDialog(
                      title: Text(envelope['label'] as String),
                      content: SingleChildScrollView(
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                        DropdownButtonFormField<String>(
                            value: operation,
                            items: const [
                              DropdownMenuItem(
                                  value: 'INCREASE',
                                  child: Text('Increase funded budget')),
                              DropdownMenuItem(
                                  value: 'REDUCE',
                                  child: Text('Return unused budget')),
                              DropdownMenuItem(
                                  value: 'REALLOCATE',
                                  child: Text('Reallocate unused budget')),
                              DropdownMenuItem(
                                  value: 'CLOSE',
                                  child: Text('Close unused budget'))
                            ],
                            onChanged: (v) => set(() => operation = v!)),
                        if (operation != 'CLOSE')
                          TextField(
                              controller: amount,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                      decimal: true),
                              decoration: const InputDecoration(
                                  labelText: 'Amount (₦)')),
                        if (operation == 'REALLOCATE')
                          DropdownButtonFormField<String>(
                              value: target,
                              isExpanded: true,
                              hint: const Text('Choose target budget'),
                              items: (data['envelopes'] as List<dynamic>)
                                  .where((e) =>
                                      e['id'] != envelope['id'] &&
                                      e['status'] == 'ACTIVE')
                                  .map((e) => DropdownMenuItem<String>(
                                      value: e['id'] as String,
                                      child: Text(e['label'] as String,
                                          overflow: TextOverflow.ellipsis)))
                                  .toList(),
                              onChanged: (v) => set(() => target = v))
                      ])),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(c, false),
                            child: const Text('Cancel')),
                        FilledButton(
                            onPressed: () => Navigator.pop(c, true),
                            child: const Text('Apply budget change'))
                      ])));
      if (ok != true || !mounted) return;
      String? minor;
      if (operation != 'CLOSE') {
        if (!RegExp(r'^[1-9]\d*(\.\d{1,2})?$').hasMatch(amount.text)) {
          throw Exception('Enter a valid naira amount.');
        }
        final p = amount.text.split('.');
        minor = (BigInt.parse(p[0]) * BigInt.from(100) +
                BigInt.parse(p.length > 1 ? p[1].padRight(2, '0') : '0'))
            .toString();
      }
      await _run(() async {
        await ApiService.walletRequest(
            'envelopes/${envelope['id']}',
            {
              'operation': operation,
              'amountMinor': minor,
              'targetEnvelopeId': target,
              'expectedVersion': envelope['version']
            },
            method: 'PATCH');
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      amount.dispose();
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Wallet funding'), actions: [
        IconButton(
            onPressed: _busy ? null : _reload,
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh))
      ]),
      body: FutureBuilder<Map<String, dynamic>>(
          future: _funding,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                  child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Text(snapshot.error.toString()),
                        TextButton(
                            onPressed: _reload, child: const Text('Retry'))
                      ])));
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final data = snapshot.data!,
                funding = data['funding'] as Map<String, dynamic>?;
            return ListView(padding: const EdgeInsets.all(20), children: [
              const Text(
                  'Only designated GMD releases funds. Wallet credits and actual bank transfers have separate records.'),
              OutlinedButton(
                  onPressed: _busy ? null : _reconcile,
                  child: const Text('Reconcile provider history')),
              OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() async {
                            await ApiService.walletRequest(
                                'funding/refresh', {});
                          }),
                  child: const Text('Refresh verified Monnify balance')),
              if (funding == null)
                const Text('No funding balance is assumed until configured.')
              else ...[
                for (final m in [
                  ('Monnify available', 'availableMinor'),
                  ('Remaining funded budgets', 'envelopeMinor'),
                  ('Unsettled staff funds', 'liabilityMinor'),
                  ('Company fee reserve', 'feeReserveMinor'),
                  ('Conservative unallocated capacity', 'freeMinor')
                ])
                  Card(
                      child: ListTile(
                          title: Text(m.$1),
                          subtitle: Text(_money(funding[m.$2] as String)))),
                Text(
                    '${funding['environment']} · source ending ${funding['sourceLastFour']} · observed ${funding['observedAt']} · ${funding['paused'] == true ? 'Paused' : 'Active'}'),
                Wrap(spacing: 8, children: [
                  OutlinedButton(
                      onPressed: _busy ? null : () => _control('PAUSE'),
                      child: const Text('Pause')),
                  if (data['canApprove'] == true)
                    OutlinedButton(
                        onPressed: _busy ? null : () => _control('ACTIVATE'),
                        child: const Text('Review activation'))
                ])
              ],
              OutlinedButton(
                  onPressed: _busy ? null : () => _allocate(data),
                  child: const Text('Allocate funded subsidiary budget')),
              for (final e in data['envelopes'] as List<dynamic>)
                Card(
                    child: ListTile(
                        title: Text('${e['organizationName']} · ${e['label']}'),
                        subtitle: Text(
                            '${_money(e['remainingMinor'] as String)} remaining · ${e['status']}'),
                        trailing: e['status'] == 'ACTIVE'
                            ? TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _adjust(data,
                                        Map<String, dynamic>.from(e as Map)),
                                child: const Text('Adjust'))
                            : null)),
              OutlinedButton(
                  onPressed: _busy ? null : () => _verifyVendor(data),
                  child: const Text('Verify supplier payment account')),
              const Text('Prepare staff and supplier payments',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
              for (final r in data['requests'] as List<dynamic>)
                Card(
                    child: ListTile(
                        title: Text(
                            '${r['vendor']?['name'] ?? r['requester']['legalName']} · ${r['title']}'),
                        subtitle: Text(_money(r['amountMinor'] as String)),
                        trailing: TextButton(
                            onPressed: _busy
                                ? null
                                : () => _prepare(data, 'REQUEST',
                                    Map<String, dynamic>.from(r as Map)),
                            child: const Text('Preview')))),
              const Text('Prepare whole salary batches',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
              for (final b in data['payrollBatches'] as List<dynamic>)
                Card(
                    child: ListTile(
                        title: Text(
                            'Salary ${b['period']['year']}-${b['period']['month']}'),
                        subtitle: Text(_money(b['totalNetMinor'] as String)),
                        trailing: TextButton(
                            onPressed: _busy
                                ? null
                                : () => _prepare(data, 'PAYROLL_BATCH',
                                    Map<String, dynamic>.from(b as Map)),
                            child: const Text('Preview')))),
              const Text('Pending GMD releases',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              for (final p in data['proposals'] as List<dynamic>)
                Card(
                    color: p['id'] == widget.proposalId
                        ? Colors.orange.shade50
                        : null,
                    child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                  '${p['category']} · ${_money(p['amountMinor'] as String)}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold)),
                              for (final i in p['items'] as List<dynamic>)
                                Text(
                                    '${i['employeeName']} (${i['employeeNumber']}) · ${i['organizationName']} · ${_money(i['amountMinor'] as String)}'),
                              Text('${p['title']} · ${p['purpose']}'),
                              for (final i in p['items'] as List<dynamic>)
                                if (i['bankSnapshot'] != null)
                                  Text(_bankLine(i)),
                              Text('Expires ${p['expiresAt']}'),
                              FilledButton(
                                  onPressed: _busy || data['canApprove'] != true
                                      ? null
                                      : () => _approve(
                                          Map<String, dynamic>.from(p as Map)),
                                  child:
                                      const Text('Review and securely approve'))
                            ]))),
              const Text('Recent Monnify transfers (latest 100)',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              for (final t in data['transfers'] as List<dynamic>)
                Card(
                    child: ListTile(
                        title: Text(
                            '${t['beneficiaryName']} · ${_money(t['amountMinor'] as String)} · ${t['status']}'),
                        subtitle: Text(
                            '${t['targetType']} · ${t['reference']}\nAccount ending ${t['lastFour']} · Company fee ${_money(t['feeMinor'] as String)}\n${t['providerStatus'] ?? 'Awaiting provider processing'}'))),
              for (final issue in data['issues'] as List<dynamic>)
                Card(
                    color: Colors.red.shade50,
                    child: ListTile(
                        title: Text(issue['code'] as String),
                        subtitle: Text(issue['detail'] as String),
                        trailing: data['canApprove'] == true &&
                                [
                                  'PROVIDER_SETUP_D04',
                                  'PROVIDER_SETUP_D06',
                                  'FEE_LIMIT_EXCEEDED'
                                ].contains(issue['code'])
                            ? TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _acknowledge(
                                        Map<String, dynamic>.from(
                                            issue as Map)),
                                child: const Text('Record correction'))
                            : null))
            ]);
          }));
}
