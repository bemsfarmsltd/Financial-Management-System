import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/staff_api_service.dart';
import '../services/staff_storage_service.dart';
import 'staff_login_screen.dart';

class StaffRegisterScreen extends StatefulWidget {
  const StaffRegisterScreen({super.key});

  @override
  State<StaffRegisterScreen> createState() => _StaffRegisterScreenState();
}

class _StaffRegisterScreenState extends State<StaffRegisterScreen> {
  int _currentStep = 0;
  bool _isLoading = false;
  String? _errorMessage;

  // Step 1: Personal Identity, Photo & Security
  String? _avatarUrl;
  bool _isUploadingAvatar = false;

  void _showAvatarPickerSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Upload Passport Photograph *',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Corporate identity policy requires a clear front-facing photograph.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 18),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(color: Color(0xFFFFF7ED), shape: BoxShape.circle),
                    child: const Icon(Icons.camera_alt_rounded, color: Color(0xFFEA580C)),
                  ),
                  title: const Text('Take Live Photo with Camera', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  subtitle: const Text('Snap front-facing passport photograph', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _pickAvatarOption('Camera');
                  },
                ),
                const Divider(color: Color(0xFFF1F5F9)),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
                    child: const Icon(Icons.photo_library_rounded, color: Color(0xFF2563EB)),
                  ),
                  title: const Text('Choose from Photo Gallery / Files', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  subtitle: const Text('Select existing passport image (JPG, PNG)', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _pickAvatarOption('Gallery');
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickAvatarOption(String sourceName) async {
    final picker = ImagePicker();
    final source = sourceName == 'Camera' ? ImageSource.camera : ImageSource.gallery;

    try {
      final XFile? pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );

      if (pickedFile == null) {
        return; // User canceled picking
      }

      setState(() {
        _isUploadingAvatar = true;
        _errorMessage = null;
      });

      final bytes = await pickedFile.readAsBytes();
      final uploadedUrl = await StaffApiService.uploadAvatar(
        bytes: bytes,
        filename: pickedFile.name,
      );

      if (!mounted) return;
      setState(() {
        _avatarUrl = uploadedUrl;
        _isUploadingAvatar = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✓ Passport photograph uploaded ($sourceName).'),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      final raw = e.toString();
      final friendlyMsg = raw.contains('SocketException') || raw.contains('Failed host lookup') || raw.contains('ClientException')
          ? 'Network connection error. Unable to reach server. Please check your internet connectivity.'
          : raw.replaceAll('Exception: ', '');
      setState(() {
        _isUploadingAvatar = false;
        _errorMessage = 'Could not process photo: $friendlyMsg';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Upload failed: $friendlyMsg'),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  String _gender = 'MALE';
  final _dobController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  // Step 2: Corporate Placement
  String _subsidiary = 'Bems Logistics & Farms Ltd';
  String _department = 'Logistics, Supply Chain & Agritech';
  final _jobTitleController = TextEditingController();
  String _staffGrade = 'Level 06 - Operational Specialist';
  String _workLocation = 'Oyo Logistics & Farm Hub';
  final _resumptionDateController = TextEditingController();

  // Step 3: Dual Banking Accounts
  String _bankName = 'Access Bank PLC';
  final _accountNumberController = TextEditingController();
  final _accountNameController = TextEditingController();
  bool _useSameAccountForSalary = true;
  String _salaryBankName = 'Access Bank PLC';
  final _salaryAccountNumberController = TextEditingController();
  final _salaryAccountNameController = TextEditingController();

  // Step 4: Statutory & Emergency
  final _ninController = TextEditingController();
  final _bvnController = TextEditingController();
  final _stateOfOriginController = TextEditingController();
  final _lgaController = TextEditingController();
  final _residentialAddressController = TextEditingController();
  final _nokNameController = TextEditingController();
  final _nokRelationshipController = TextEditingController();
  final _nokPhoneController = TextEditingController();
  final _nokAddressController = TextEditingController();

  List<Map<String, dynamic>> _organizations = [];
  List<String> _subsidiaries = [
    'Bems Logistics & Farms Ltd',
    'BemsSoft Hub Ltd',
    'BEMS Group Holdings Ltd (HQ)',
  ];

  List<String> _departments = [
    'Logistics, Supply Chain & Agritech',
    'Engineering & Cloud Infrastructure',
    'Corporate Services & Administration',
  ];

  final List<String> _staffGrades = [
    'Level 05 - Field Assistant',
    'Level 06 - Operational Specialist',
    'Level 08 - Senior Specialist',
    'Level 10 - Manager / Lead',
    'Level 12 - Department Director',
  ];

  final List<String> _workLocations = [
    'Oyo Logistics & Farm Hub',
    'Lagos Corporate Headquarters',
    'Lagos Technology Center',
    'Ilorin Storage & Distribution Depot',
  ];

  final List<String> _bankOptions = [
    'Access Bank PLC',
    'Zenith Bank PLC',
    'First Bank of Nigeria',
    'Guaranty Trust Bank (GTBank)',
    'United Bank for Africa (UBA)',
    'Stanbic IBTC Bank',
    'Fidelity Bank PLC',
  ];

  @override
  void initState() {
    super.initState();
    _loadLiveOrganizationStructure();
  }

  Future<void> _loadLiveOrganizationStructure() async {
    try {
      final orgs = await StaffApiService.fetchOrganizationStructure();
      if (!mounted || orgs.isEmpty) return;

      setState(() {
        _organizations = orgs;
        final subNames = orgs
            .map((o) => (o['legalName'] ?? '').toString())
            .where((s) => s.isNotEmpty)
            .toList();

        if (subNames.isNotEmpty) {
          _subsidiaries = subNames;
          if (!_subsidiaries.contains(_subsidiary)) {
            _subsidiary = _subsidiaries.first;
          }
          _updateDepartmentsForSelectedSubsidiary();
        }
      });
    } catch (_) {}
  }

  void _updateDepartmentsForSelectedSubsidiary() {
    final matchedOrg = _organizations.firstWhere(
      (o) => (o['legalName'] ?? '') == _subsidiary || (o['code'] ?? '') == _subsidiary,
      orElse: () => {},
    );

    final rawDepts = (matchedOrg['departments'] as List<dynamic>?) ?? [];
    final deptNames = rawDepts
        .map((d) => (d['name'] ?? '').toString())
        .where((n) => n.isNotEmpty)
        .toList();

    if (deptNames.isNotEmpty) {
      setState(() {
        _departments = deptNames;
        if (!_departments.contains(_department)) {
          _department = _departments.first;
        }
      });
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _dobController.dispose();
    _jobTitleController.dispose();
    _resumptionDateController.dispose();
    _accountNumberController.dispose();
    _accountNameController.dispose();
    _salaryAccountNumberController.dispose();
    _salaryAccountNameController.dispose();
    _ninController.dispose();
    _bvnController.dispose();
    _stateOfOriginController.dispose();
    _lgaController.dispose();
    _residentialAddressController.dispose();
    _nokNameController.dispose();
    _nokRelationshipController.dispose();
    _nokPhoneController.dispose();
    _nokAddressController.dispose();
    super.dispose();
  }

  void _nextStep() {
    setState(() => _errorMessage = null);

    if (_currentStep == 0) {
      if (_avatarUrl == null || _avatarUrl!.isEmpty) {
        setState(() => _errorMessage = 'Passport photograph is mandatory. Please take or upload your face picture.');
        return;
      }
      if (_fullNameController.text.trim().length < 3) {
        setState(() => _errorMessage = 'Please enter your full legal name.');
        return;
      }
      if (!_emailController.text.trim().contains('@')) {
        setState(() => _errorMessage = 'Please enter a valid corporate email address.');
        return;
      }
      if (_passwordController.text.length < 8) {
        setState(() => _errorMessage = 'Password must be at least 8 characters long.');
        return;
      }
      if (_passwordController.text != _confirmPasswordController.text) {
        setState(() => _errorMessage = 'Passwords do not match.');
        return;
      }
    } else if (_currentStep == 1) {
      if (_jobTitleController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Please enter your official job title.');
        return;
      }
    } else if (_currentStep == 2) {
      if (_accountNumberController.text.trim().length < 10) {
        setState(() => _errorMessage = 'Please enter a valid 10-digit advance account number.');
        return;
      }
      if (_accountNameController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Please enter account name.');
        return;
      }
    }

    if (_currentStep < 3) {
      setState(() => _currentStep++);
    } else {
      _handleRegister();
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() {
        _currentStep--;
        _errorMessage = null;
      });
    } else {
      Navigator.pop(context);
    }
  }

  Future<void> _handleRegister() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await StaffApiService.registerStaff(
        avatarUrl: _avatarUrl!,
        fullName: _fullNameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
        phone: _phoneController.text.trim(),
        gender: _gender,
        dateOfBirth: _dobController.text.trim(),
        subsidiary: _subsidiary,
        department: _department,
        jobTitle: _jobTitleController.text.trim(),
        staffGrade: _staffGrade,
        workLocation: _workLocation,
        bankName: _bankName,
        accountNumber: _accountNumberController.text.trim(),
        accountName: _accountNameController.text.trim(),
        useSameAccountForSalary: _useSameAccountForSalary,
        salaryBankName: _useSameAccountForSalary ? _bankName : _salaryBankName,
        salaryAccountNumber: _useSameAccountForSalary ? _accountNumberController.text.trim() : _salaryAccountNumberController.text.trim(),
        salaryAccountName: _useSameAccountForSalary ? _accountNameController.text.trim() : _salaryAccountNameController.text.trim(),
        nin: _ninController.text.trim(),
        bvn: _bvnController.text.trim(),
        stateOfOrigin: _stateOfOriginController.text.trim(),
        lga: _lgaController.text.trim(),
        residentialAddress: _residentialAddressController.text.trim(),
        nextOfKinName: _nokNameController.text.trim(),
        nextOfKinRelationship: _nokRelationshipController.text.trim(),
        nextOfKinPhone: _nokPhoneController.text.trim(),
        nextOfKinAddress: _nokAddressController.text.trim(),
      );

      if (res['success'] != true) {
        setState(() => _errorMessage = res['error'] ?? 'Registration failed.');
        return;
      }

      final generatedEmpNo = res['employeeNumber'] as String;

      // Clear any stored provisional sessions - employee must wait for System Admin approval
      await StaffStorageService.clearUser();

      if (!mounted) return;

      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 68,
                height: 68,
                decoration: const BoxDecoration(
                  color: Color(0xFFFEF3C7),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.hourglass_top_rounded, color: Color(0xFFD97706), size: 36),
              ),
              const SizedBox(height: 16),
              const Text(
                'Registration Submitted!',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 6),
              const Text(
                'Your staff profile has been submitted to the System Administrator / GMD for verification and approval.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Column(
                  children: [
                    const Text('OFFICIAL EMPLOYEE NUMBER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFEA580C), letterSpacing: 0.5)),
                    const SizedBox(height: 4),
                    Text(
                      generatedEmpNo,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF9A3412), letterSpacing: 1.1),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shield_outlined, size: 12, color: Color(0xFFB45309)),
                          SizedBox(width: 4),
                          Text(
                            'Status: Pending Admin Approval',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF64748B)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'In accordance with BEMS security governance, you will be able to sign in once your account has been reviewed and activated.',
                        style: TextStyle(fontSize: 11, color: Color(0xFF475569), height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context); // close dialog
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const StaffLoginScreen()),
                      (route) => false,
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Return to Sign In', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      setState(() => _errorMessage = 'Registration submission error. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stepTitles = ['Identity', 'Corporate', 'Banking', 'Statutory'];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
          onPressed: _previousStep,
        ),
        title: const Text(
          'Staff Registration',
          style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.w800),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Stepper Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              color: Colors.white,
              child: Row(
                children: List.generate(4, (index) {
                  final isActive = index <= _currentStep;
                  final isCurrent = index == _currentStep;
                  return Expanded(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 22,
                                    height: 22,
                                    decoration: BoxDecoration(
                                      color: isCurrent
                                          ? const Color(0xFFEA580C)
                                          : isActive
                                              ? const Color(0xFFDCFCE7)
                                              : const Color(0xFFF1F5F9),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: isCurrent
                                          ? Text('${index + 1}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800))
                                          : isActive
                                              ? const Icon(Icons.check, size: 13, color: Color(0xFF16A34A))
                                              : Text('${index + 1}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w700)),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    stepTitles[index],
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                                      color: isCurrent ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Container(
                                height: 3,
                                decoration: BoxDecoration(
                                  color: isActive ? const Color(0xFFEA580C) : const Color(0xFFE2E8F0),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (index < 3) const SizedBox(width: 8),
                      ],
                    ),
                  );
                }),
              ),
            ),

            // Form Body
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_errorMessage != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFF87171)),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
                        ),
                      ),

                    if (_currentStep == 0) _buildStep1Identity(),
                    if (_currentStep == 1) _buildStep2Corporate(),
                    if (_currentStep == 2) _buildStep3Banking(),
                    if (_currentStep == 3) _buildStep4Statutory(),
                  ],
                ),
              ),
            ),

            // Bottom Navigation Actions
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                border: const Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, -3),
                  ),
                ],
              ),
              child: Row(
                children: [
                  if (_currentStep > 0) ...[
                    OutlinedButton(
                      onPressed: _previousStep,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      child: const Text('Back', style: TextStyle(color: Color(0xFF475569), fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _nextStep,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 1,
                      ),
                      child: _isLoading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              _currentStep == 3 ? 'Complete Registration' : 'Proceed to Step ${_currentStep + 2}',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep1Identity() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSectionHeader('Personal Identity & Security', 'Enter your legal identity and credentials for corporate authentication.'),
        const SizedBox(height: 16),

        // Mandatory Passport Photograph Section
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _avatarUrl != null ? const Color(0xFF10B981) : const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            children: [
              Stack(
                alignment: Alignment.bottomRight,
                children: [
                  Container(
                    width: 86,
                    height: 86,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFF1F5F9),
                      border: Border.all(
                        color: _avatarUrl != null ? const Color(0xFF10B981) : const Color(0xFFCBD5E1),
                        width: 2.5,
                      ),
                    ),
                    child: ClipOval(
                      child: _avatarUrl != null
                          ? Image.network(_avatarUrl!, width: 86, height: 86, fit: BoxFit.cover)
                          : const Center(
                              child: Icon(Icons.person_outline_rounded, size: 44, color: Color(0xFF94A3B8)),
                            ),
                    ),
                  ),
                  if (_avatarUrl != null)
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                      child: const Icon(Icons.check_rounded, color: Colors.white, size: 14),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Passport Photograph *',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 3),
              const Text(
                'Mandatory front-facing face photo for ID card & bank authorization',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isUploadingAvatar ? null : _showAvatarPickerSheet,
                  icon: _isUploadingAvatar
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : Icon(
                          _avatarUrl != null ? Icons.cached_rounded : Icons.camera_alt_rounded,
                          size: 16,
                          color: const Color(0xFFEA580C),
                        ),
                  label: Text(
                    _avatarUrl != null ? 'Change Passport Photo' : '📷 Take or Upload Photo *',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: Color(0xFFEA580C)),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFFED7AA)),
                    backgroundColor: const Color(0xFFFFF7ED),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),

        _buildInputCard([
          _buildTextField(label: 'LEGAL FULL NAME', controller: _fullNameController, hint: 'Surname Firstname Othername', icon: Icons.person_outline_rounded),
          const SizedBox(height: 14),
          _buildTextField(label: 'OFFICIAL CORPORATE EMAIL', controller: _emailController, hint: 'name@bemsfarms.com', icon: Icons.mail_outline_rounded, keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 14),
          _buildTextField(label: 'MOBILE TELEPHONE', controller: _phoneController, hint: '+234 800 000 0000', icon: Icons.phone_outlined, keyboardType: TextInputType.phone),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('GENDER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _gender,
                          isExpanded: true,
                          items: const [
                            DropdownMenuItem(value: 'MALE', child: Text('Male', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                            DropdownMenuItem(value: 'FEMALE', child: Text('Female', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                          ],
                          onChanged: (v) => setState(() => _gender = v!),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDateField(
                  label: 'DATE OF BIRTH',
                  controller: _dobController,
                  hint: 'Select Date of Birth',
                  icon: Icons.cake_outlined,
                  initialDate: DateTime(1995, 1, 1),
                  firstDate: DateTime(1940, 1, 1),
                  lastDate: DateTime.now().subtract(const Duration(days: 365 * 16)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildTextField(
            label: 'CREATE PASSWORD',
            controller: _passwordController,
            hint: 'Min 8 chars with symbols',
            icon: Icons.lock_outline_rounded,
            obscureText: _obscurePassword,
            suffixIcon: IconButton(
              icon: Icon(_obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: const Color(0xFF94A3B8), size: 18),
              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            ),
          ),
          const SizedBox(height: 14),
          _buildTextField(
            label: 'CONFIRM PASSWORD',
            controller: _confirmPasswordController,
            hint: 'Re-enter your password',
            icon: Icons.check_circle_outline_rounded,
            obscureText: _obscureConfirmPassword,
            suffixIcon: IconButton(
              icon: Icon(_obscureConfirmPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: const Color(0xFF94A3B8), size: 18),
              onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
            ),
          ),
        ]),
      ],
    );
  }

  Widget _buildStep2Corporate() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSectionHeader('Corporate Placement', 'Select your subsidiary assignment, operating department, and staff grade.'),
        const SizedBox(height: 16),
        _buildInputCard([
          const Text('SUBSIDIARY / BUSINESS UNIT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _subsidiary,
                isExpanded: true,
                items: _subsidiaries.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                onChanged: (v) {
                  if (v != null) {
                    setState(() {
                      _subsidiary = v;
                      _updateDepartmentsForSelectedSubsidiary();
                    });
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          const Text('DEPARTMENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _department,
                isExpanded: true,
                items: _departments.map((d) => DropdownMenuItem(value: d, child: Text(d, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                onChanged: (v) => setState(() => _department = v!),
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildTextField(label: 'OFFICIAL JOB TITLE', controller: _jobTitleController, hint: 'e.g. Feed Operations Lead', icon: Icons.badge_outlined),
          const SizedBox(height: 14),

          const Text('STAFF GRADE / LEVEL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _staffGrade,
                isExpanded: true,
                items: _staffGrades.map((g) => DropdownMenuItem(value: g, child: Text(g, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                onChanged: (v) => setState(() => _staffGrade = v!),
              ),
            ),
          ),
          const SizedBox(height: 14),

          const Text('PRIMARY WORK LOCATION', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _workLocation,
                isExpanded: true,
                items: _workLocations.map((l) => DropdownMenuItem(value: l, child: Text(l, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                onChanged: (v) => setState(() => _workLocation = v!),
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildDateField(
            label: 'OFFICIAL RESUMPTION DATE',
            controller: _resumptionDateController,
            hint: 'Select Resumption Date',
            icon: Icons.event_available_outlined,
            initialDate: DateTime.now(),
            firstDate: DateTime(2010, 1, 1),
            lastDate: DateTime.now().add(const Duration(days: 365)),
          ),
        ]),
      ],
    );
  }

  Widget _buildStep3Banking() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSectionHeader('Dual Corporate Banking', 'Configure your operational advance settlement bank and official payroll salary accounts.'),
        const SizedBox(height: 16),
        _buildInputCard([
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFED7AA)),
            ),
            child: const Row(
              children: [
                Icon(Icons.account_balance_wallet_rounded, color: Color(0xFFEA580C), size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Advance Account: Used for fast disbursement of approved operational fund requisitions.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF9A3412), fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          const Text('ADVANCE DISBURSEMENT BANK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _bankName,
                isExpanded: true,
                items: _bankOptions.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                onChanged: (v) => setState(() => _bankName = v!),
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildTextField(label: '10-DIGIT ACCOUNT NUMBER', controller: _accountNumberController, hint: '0123456789', icon: Icons.credit_card_rounded, keyboardType: TextInputType.number),
          const SizedBox(height: 14),
          _buildTextField(label: 'ACCOUNT BENEFICIARY NAME', controller: _accountNameController, hint: 'Exact name registered with bank', icon: Icons.badge_outlined),
          const SizedBox(height: 20),

          // Toggle for Salary Account
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Checkbox(
                  value: _useSameAccountForSalary,
                  activeColor: const Color(0xFFEA580C),
                  onChanged: (v) => setState(() => _useSameAccountForSalary = v ?? true),
                ),
                const Expanded(
                  child: Text(
                    'Use this exact bank account for monthly payroll & salary',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                  ),
                ),
              ],
            ),
          ),

          if (!_useSameAccountForSalary) ...[
            const SizedBox(height: 16),
            const Text('SEPARATE SALARY BANK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _salaryBankName,
                  isExpanded: true,
                  items: _bankOptions.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                  onChanged: (v) => setState(() => _salaryBankName = v!),
                ),
              ),
            ),
            const SizedBox(height: 14),
            _buildTextField(label: 'SALARY ACCOUNT NUMBER', controller: _salaryAccountNumberController, hint: '10-digit NUBAN', icon: Icons.credit_card_rounded, keyboardType: TextInputType.number),
            const SizedBox(height: 14),
            _buildTextField(label: 'SALARY ACCOUNT NAME', controller: _salaryAccountNameController, hint: 'Registered payroll name', icon: Icons.badge_outlined),
          ],
        ]),
      ],
    );
  }

  Widget _buildStep4Statutory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSectionHeader('Statutory & Next-of-Kin', 'Required compliance data for national identification and emergency records.'),
        const SizedBox(height: 16),
        _buildInputCard([
          Row(
            children: [
              Expanded(
                child: _buildTextField(label: 'NATIONAL NIN', controller: _ninController, hint: '11 digits', icon: Icons.fingerprint_rounded, keyboardType: TextInputType.number),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildTextField(label: 'BANK BVN', controller: _bvnController, hint: '11 digits', icon: Icons.verified_user_outlined, keyboardType: TextInputType.number),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _buildTextField(label: 'STATE OF ORIGIN', controller: _stateOfOriginController, hint: 'e.g. Kwara State', icon: Icons.map_outlined),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildTextField(label: 'LOCAL GOVT (LGA)', controller: _lgaController, hint: 'e.g. Ilorin South', icon: Icons.location_city_outlined),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildTextField(label: 'RESIDENTIAL ADDRESS', controller: _residentialAddressController, hint: 'Street, Estate, City', icon: Icons.home_outlined),
          const SizedBox(height: 20),

          // Emergency Header
          const Row(
            children: [
              Icon(Icons.emergency_outlined, size: 16, color: Color(0xFFDC2626)),
              SizedBox(width: 6),
              Text('EMERGENCY / NEXT OF KIN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFFDC2626), letterSpacing: 0.8)),
            ],
          ),
          const Divider(height: 20, color: Color(0xFFE2E8F0)),

          _buildTextField(label: 'NEXT OF KIN FULL NAME', controller: _nokNameController, hint: 'Full Name', icon: Icons.person_outline_rounded),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _buildTextField(label: 'RELATIONSHIP', controller: _nokRelationshipController, hint: 'Spouse / Sibling', icon: Icons.people_outline_rounded),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildTextField(label: 'EMERGENCY PHONE', controller: _nokPhoneController, hint: '+234 800 000 0000', icon: Icons.phone_outlined, keyboardType: TextInputType.phone),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildTextField(label: 'NEXT OF KIN ADDRESS', controller: _nokAddressController, hint: 'Residential address', icon: Icons.place_outlined),
        ]),
      ],
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A), letterSpacing: -0.4)),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.3)),
      ],
    );
  }

  Widget _buildInputCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: TextField(
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 18),
              suffixIcon: suffixIcon,
              hintText: hint,
              hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _selectDate({
    required TextEditingController controller,
    required DateTime initialDate,
    required DateTime firstDate,
    required DateTime lastDate,
  }) async {
    FocusScope.of(context).unfocus();

    DateTime pickerInitial = initialDate;
    if (controller.text.trim().isNotEmpty) {
      try {
        final parsed = DateTime.parse(controller.text.trim());
        if (parsed.isAfter(firstDate.subtract(const Duration(days: 1))) &&
            parsed.isBefore(lastDate.add(const Duration(days: 1)))) {
          pickerInitial = parsed;
        }
      } catch (_) {}
    }

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: pickerInitial,
      firstDate: firstDate,
      lastDate: lastDate,
      helpText: 'SELECT DATE',
      cancelText: 'CANCEL',
      confirmText: 'SELECT',
      builder: (BuildContext context, Widget? child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFEA580C),
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
            dialogBackgroundColor: Colors.white,
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFFEA580C),
                textStyle: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final y = picked.year.toString().padLeft(4, '0');
      final m = picked.month.toString().padLeft(2, '0');
      final d = picked.day.toString().padLeft(2, '0');
      setState(() {
        controller.text = '$y-$m-$d';
      });
    }
  }

  Widget _buildDateField({
    required String label,
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    required DateTime initialDate,
    required DateTime firstDate,
    required DateTime lastDate,
  }) {
    final hasValue = controller.text.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.8)),
        const SizedBox(height: 6),
        InkWell(
          onTap: () => _selectDate(
            controller: controller,
            initialDate: initialDate,
            firstDate: firstDate,
            lastDate: lastDate,
          ),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Icon(icon, color: const Color(0xFFEA580C), size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    hasValue ? controller.text : hint,
                    style: TextStyle(
                      color: hasValue ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                      fontSize: 13,
                      fontWeight: hasValue ? FontWeight.w700 : FontWeight.normal,
                    ),
                  ),
                ),
                const Icon(Icons.calendar_month_rounded, color: Color(0xFFEA580C), size: 18),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
