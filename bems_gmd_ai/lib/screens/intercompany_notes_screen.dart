import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class IntercompanyNotesScreen extends StatefulWidget {
  const IntercompanyNotesScreen({super.key});

  @override
  State<IntercompanyNotesScreen> createState() => _IntercompanyNotesScreenState();
}

class _IntercompanyNotesScreenState extends State<IntercompanyNotesScreen> {
  bool _isLoading = true;
  List<dynamic> _notes = [];
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'en_NG', symbol: '₦', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  Future<void> _loadNotes() async {
    setState(() => _isLoading = true);
    final list = await ApiService.fetchIntercompanyNotes();
    if (mounted) {
      setState(() {
        _notes = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Intercompany Notes', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
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
            onPressed: _loadNotes,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
          : RefreshIndicator(
              onRefresh: _loadNotes,
              color: const Color(0xFFEA580C),
              child: _notes.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(36),
                      children: [
                        Center(
                          child: Column(
                            children: [
                              Icon(Icons.swap_horizontal_circle_outlined, size: 48, color: Colors.grey.shade400),
                              const SizedBox(height: 12),
                              const Text('No intercompany notes', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                              const SizedBox(height: 4),
                              const Text('Intercompany cross-charges and transfer notes will appear here.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _notes.length,
                      itemBuilder: (context, idx) {
                        final n = _notes[idx];
                        final noteNumber = n['noteNumber'] ?? 'NOTE-${n['id']}';
                        final source = n['sourceEntity'] is Map ? (n['sourceEntity']['legalName'] ?? n['sourceEntity']['code']) : 'Source Entity';
                        final target = n['targetEntity'] is Map ? (n['targetEntity']['legalName'] ?? n['targetEntity']['code']) : 'Target Entity';
                        final amount = (n['amountMinor'] ?? 0) / 100;
                        final purpose = n['purpose'] ?? 'Intercompany cross-settlement';
                        final type = n['type'] ?? 'TRANSFER';

                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(6)),
                                    child: Text(type, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                                  ),
                                  Text(_currencyFormat.format(amount), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(child: Text(source, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)))),
                                  const Icon(Icons.arrow_forward_rounded, size: 14, color: Color(0xFF94A3B8)),
                                  const SizedBox(width: 4),
                                  Expanded(child: Text(target, textAlign: TextAlign.end, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)))),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(purpose, style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569))),
                              const SizedBox(height: 4),
                              Text(noteNumber, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
