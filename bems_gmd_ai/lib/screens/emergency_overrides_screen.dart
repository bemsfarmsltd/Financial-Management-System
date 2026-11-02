import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class EmergencyOverridesScreen extends StatefulWidget {
  const EmergencyOverridesScreen({super.key});

  @override
  State<EmergencyOverridesScreen> createState() => _EmergencyOverridesScreenState();
}

class _EmergencyOverridesScreenState extends State<EmergencyOverridesScreen> {
  bool _isLoading = true;
  List<dynamic> _incidents = [];
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _loadIncidents();
  }

  Future<void> _loadIncidents() async {
    setState(() => _isLoading = true);
    final list = await ApiService.fetchEmergencyIncidents();
    if (mounted) {
      setState(() {
        _incidents = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Emergency Overrides', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
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
            onPressed: _loadIncidents,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
          : RefreshIndicator(
              onRefresh: _loadIncidents,
              color: const Color(0xFFEA580C),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF7F1D1D), Color(0xFF991B1B)]),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.bolt_rounded, color: Color(0xFFF87171), size: 20),
                            SizedBox(width: 8),
                            Text('EXECUTIVE EMERGENCY BYPASS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5)),
                          ],
                        ),
                        SizedBox(height: 8),
                        Text(
                          'Max cap ₦1,000,000 per incident. Fast-tracks disbursements for operational emergencies with mandatory 24h post-facto reconciliation.',
                          style: TextStyle(fontSize: 12, color: Color(0xFFFEE2E2), height: 1.4),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                  const Text('INCIDENT OVERRIDE LOG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                  const SizedBox(height: 10),

                  if (_incidents.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(36),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: const Center(
                        child: Column(
                          children: [
                            Icon(Icons.shield_outlined, size: 48, color: Color(0xFF94A3B8)),
                            SizedBox(height: 12),
                            Text('No active emergency incidents', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                            SizedBox(height: 4),
                            Text('All expenditures are proceeding through standard approval tiers.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                    )
                  else
                    ..._incidents.map((inc) {
                      final code = inc['incidentCode'] ?? inc['id'] ?? '';
                      final title = inc['title'] ?? 'Emergency Requisition';
                      final sub = inc['subsidiary'] ?? 'BEMS Group';
                      final declaredBy = inc['declaredBy'] ?? 'Operations Lead';
                      final amount = inc['amountFormatted'] ?? _currencyFormat.format(inc['amount'] ?? 0);
                      final hoursRemaining = inc['hoursRemaining'] ?? 0;
                      final status = inc['status'] ?? 'ACTIVE';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(6)),
                                  child: Text('$status · ${hoursRemaining}h SLA', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFDC2626))),
                                ),
                                Text(amount, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                            const SizedBox(height: 2),
                            Text('$code · $sub · Declared by $declaredBy', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
