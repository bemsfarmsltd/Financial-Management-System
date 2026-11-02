import 'package:flutter/material.dart';
import '../services/api_service.dart';

class VendorsRegistryScreen extends StatefulWidget {
  const VendorsRegistryScreen({super.key});

  @override
  State<VendorsRegistryScreen> createState() => _VendorsRegistryScreenState();
}

class _VendorsRegistryScreenState extends State<VendorsRegistryScreen> {
  bool _isLoading = true;
  List<dynamic> _vendors = [];
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadVendors();
  }

  Future<void> _loadVendors() async {
    setState(() => _isLoading = true);
    final list = await ApiService.fetchVendorsList(search: _searchQuery);
    if (mounted) {
      setState(() {
        _vendors = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _showAddVendorSheet() async {
    final nameController = TextEditingController();
    final catController = TextEditingController(text: 'Logistics & Haulage');
    final taxController = TextEditingController();
    final emailController = TextEditingController();
    final phoneController = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            const Text('Register Approved Supplier', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
            const SizedBox(height: 14),
            TextField(
              controller: nameController,
              decoration: InputDecoration(
                labelText: 'Company / Business Legal Name',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: catController,
              decoration: InputDecoration(
                labelText: 'Procurement Category',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: taxController,
              decoration: InputDecoration(
                labelText: 'CAC / Tax Identification Number (TIN)',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: phoneController,
              decoration: InputDecoration(
                labelText: 'Contact Phone Number',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                onPressed: () async {
                  if (nameController.text.trim().isEmpty) return;
                  Navigator.pop(ctx);
                  final success = await ApiService.registerVendor({
                    'name': nameController.text.trim(),
                    'category': catController.text.trim(),
                    'taxId': taxController.text.trim(),
                    'contactPhone': phoneController.text.trim(),
                    'contactEmail': emailController.text.trim(),
                  });
                  if (mounted) {
                    if (success) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✓ Vendor registered successfully.'), backgroundColor: Color(0xFF059669)));
                      _loadVendors();
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to register vendor.'), backgroundColor: Color(0xFFDC2626)));
                    }
                  }
                },
                child: const Text('Add to Approved Registry', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Vendors & Benchmark Rates', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFFEA580C), size: 22),
            onPressed: _showAddVendorSheet,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search vendors by name, TIN or category...',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF64748B)),
                filled: true,
                fillColor: const Color(0xFFF1F5F9),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              onChanged: (val) {
                _searchQuery = val;
                _loadVendors();
              },
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
                : RefreshIndicator(
                    onRefresh: _loadVendors,
                    color: const Color(0xFFEA580C),
                    child: _vendors.isEmpty
                        ? ListView(
                            padding: const EdgeInsets.all(36),
                            children: [
                              Center(
                                child: Column(
                                  children: [
                                    Icon(Icons.storefront_outlined, size: 48, color: Colors.grey.shade400),
                                    const SizedBox(height: 12),
                                    const Text('No approved vendors found', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                                  ],
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _vendors.length,
                            itemBuilder: (context, idx) {
                              final v = _vendors[idx];
                              final name = v['name'] ?? 'Vendor';
                              final cat = v['category'] ?? 'General Procurement';
                              final taxId = v['taxId'] ?? 'No TIN specified';
                              final phone = v['contactPhone'] ?? 'No phone';

                              return Container(
                                margin: const EdgeInsets.only(bottom: 10),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 38,
                                      height: 38,
                                      decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(10)),
                                      child: const Icon(Icons.storefront_rounded, color: Color(0xFFEA580C), size: 20),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                                          const SizedBox(height: 2),
                                          Text(cat, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFEA580C))),
                                          const SizedBox(height: 4),
                                          Text('TIN: $taxId · Phone: $phone', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
