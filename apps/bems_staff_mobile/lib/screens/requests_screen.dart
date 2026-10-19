import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/constants.dart';
import '../models/fund_request.dart';
import 'request_detail_screen.dart';

class RequestsScreen extends StatefulWidget {
  final List<FundRequestItem> requests;
  final bool isLoading;
  final Future<void> Function() onRefresh;
  final VoidCallback onRequestNew;

  const RequestsScreen({
    super.key,
    required this.requests,
    required this.isLoading,
    required this.onRefresh,
    required this.onRequestNew,
  });

  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  String _selectedFilter = 'ALL';
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.requests.where((r) {
      final matchesSearch = r.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          r.requestNumber.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          r.category.toLowerCase().contains(_searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (_selectedFilter == 'ALL') return true;
      if (_selectedFilter == 'PENDING') return r.status != 'DISBURSED' && r.status != 'CLOSED';
      if (_selectedFilter == 'DISBURSED') return r.status == 'DISBURSED';
      if (_selectedFilter == 'CLOSED') return r.status == 'CLOSED';
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Fund Requests'),
        actions: [
          IconButton(
            onPressed: widget.onRequestNew,
            icon: const Icon(Icons.add_circle_rounded, color: BemsTheme.primaryBlueLight),
            tooltip: 'New Request',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: widget.onRequestNew,
        backgroundColor: BemsTheme.primaryBlue,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Request', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: widget.onRefresh,
        color: BemsTheme.primaryBlue,
        child: Column(
          children: [
            // Search & Filter Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                children: [
                  TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search request #, title or category...',
                      prefixIcon: const Icon(Icons.search_rounded, size: 20, color: BemsTheme.textMuted),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: ['ALL', 'PENDING', 'DISBURSED', 'CLOSED'].map((filter) {
                        final isSelected = _selectedFilter == filter;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(
                              filter,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? Colors.white : BemsTheme.textSecondary,
                              ),
                            ),
                            selected: isSelected,
                            selectedColor: BemsTheme.primaryBlue,
                            backgroundColor: BemsTheme.surface,
                            side: BorderSide(
                              color: isSelected ? BemsTheme.primaryBlue : BemsTheme.cardBorder,
                            ),
                            onSelected: (_) => setState(() => _selectedFilter = filter),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),

            // Request Cards List
            Expanded(
              child: widget.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.inbox_rounded, size: 48, color: BemsTheme.textMuted),
                              const SizedBox(height: 12),
                              const Text('No fund requests found', style: TextStyle(color: BemsTheme.textSecondary)),
                              const SizedBox(height: 8),
                              ElevatedButton(
                                onPressed: widget.onRequestNew,
                                child: const Text('Create New Request'),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final req = filtered[index];
                            return _buildCard(context, req);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(BuildContext context, FundRequestItem req) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: BemsTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BemsTheme.cardBorder),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => RequestDetailScreen(request: req),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: BemsTheme.surfaceLight,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: BemsTheme.cardBorder),
                    ),
                    child: Text(
                      req.requestNumber,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                        color: BemsTheme.primaryBlueLight,
                      ),
                    ),
                  ),
                  Text(
                    AppConstants.formatNaira(req.amount),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                req.title,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                '${req.departmentName} · ${req.category}',
                style: const TextStyle(fontSize: 11, color: BemsTheme.textSecondary),
              ),
              const SizedBox(height: 12),

              // Stage progress visual
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: BemsTheme.surfaceLight.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          req.status == 'CLOSED'
                              ? Icons.check_circle_rounded
                              : req.status == 'DISBURSED'
                                  ? Icons.monetization_on_rounded
                                  : Icons.access_time_rounded,
                          size: 14,
                          color: req.status == 'DISBURSED' || req.status == 'CLOSED'
                              ? BemsTheme.successEmerald
                              : BemsTheme.warningAmber,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          req.statusLabel,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: req.status == 'DISBURSED' || req.status == 'CLOSED'
                                ? BemsTheme.successEmerald
                                : BemsTheme.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const Text('Channel →', style: TextStyle(fontSize: 10, color: BemsTheme.primaryBlueLight)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
