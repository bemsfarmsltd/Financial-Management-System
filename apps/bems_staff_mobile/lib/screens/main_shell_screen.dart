import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/api_service.dart';
import '../models/fund_request.dart';
import '../widgets/floating_dock_bar.dart';
import 'home_screen.dart';
import 'requests_screen.dart';
import 'retire_advance_screen.dart';
import 'payslips_screen.dart';
import 'profile_screen.dart';
import 'create_request_screen.dart';

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _currentIndex = 0;
  final ApiService _apiService = ApiService();
  List<FundRequestItem> _requests = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final list = await _apiService.getMyRequests();
    if (mounted) {
      setState(() {
        _requests = list;
        _isLoading = false;
      });
    }
  }

  void _openCreateRequestModal() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CreateRequestScreen(
          onSubmitted: (newReq) {
            setState(() {
              _requests.insert(0, newReq);
              _currentIndex = 1;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Request ${newReq.requestNumber} submitted!'),
                backgroundColor: BemsTheme.successEmerald,
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pendingRetirements = _requests.where((r) => r.needsRetirement).length;

    final screens = [
      HomeScreen(
        requests: _requests,
        isLoading: _isLoading,
        onRefresh: _loadData,
        onRequestNew: _openCreateRequestModal,
        onNavigateTab: (idx) => setState(() => _currentIndex = idx),
      ),
      RequestsScreen(
        requests: _requests,
        isLoading: _isLoading,
        onRefresh: _loadData,
        onRequestNew: _openCreateRequestModal,
      ),
      RetireAdvanceScreen(
        requests: _requests,
        onRetirementSubmitted: () {
          _loadData();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Advance retirement submitted to internal verifier!'),
              backgroundColor: BemsTheme.successEmerald,
            ),
          );
        },
      ),
      const PayslipsScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: BemsTheme.background,
      extendBody: true, // Allows content to scroll seamlessly behind the floating dock
      body: screens[_currentIndex],
      bottomNavigationBar: FloatingDockBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        pendingRetirements: pendingRetirements,
      ),
    );
  }
}
