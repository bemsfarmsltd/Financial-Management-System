class StaffUser {
  final String id;
  final String fullName;
  final String email;
  final String phone;
  final String gender;
  final String dateOfBirth;
  final String residentialAddress;
  final String cityState;

  // Corporate
  final String employeeNumber;
  final String role;
  final String subsidiary;
  final String department;
  final String jobTitle;
  final String employmentType;
  final String resumptionDate;
  final String workLocation;
  final String staffGrade;

  // Dual Banking
  final String bankName;
  final String accountNumber;
  final String accountName;
  final String salaryBankName;
  final String salaryAccountNumber;
  final String salaryAccountName;

  // Next of Kin
  final String nextOfKinName;
  final String nextOfKinPhone;
  final String nextOfKinRelationship;
  final String nextOfKinAddress;

  // Statutory
  final String maritalStatus;
  final String stateOfOrigin;
  final String lga;
  final String ninMask;
  final String bvnMask;

  final String avatarUrl;

  const StaffUser({
    required this.id,
    required this.fullName,
    required this.email,
    this.phone = '+234 803 456 7890',
    this.gender = 'Male',
    this.dateOfBirth = '14 May 1988',
    this.residentialAddress = 'Plot 14, Farm Settlement Road, Iseyin',
    this.cityState = 'Oyo State, Nigeria',
    this.employeeNumber = 'BEMS-FEED-2026-0042',
    this.role = 'OPERATIONS_DIRECTOR',
    this.subsidiary = 'BEMS Feed Mill Operations',
    this.department = 'Feed Operations & Processing',
    this.jobTitle = 'Director of Feed Plant Operations',
    this.employmentType = 'Full-Time Permanent',
    this.resumptionDate = '02 February 2024',
    this.workLocation = 'Oyo Feed Mill Complex',
    this.staffGrade = 'PRINCIPAL_OFFICER_L8',
    this.bankName = 'Access Bank PLC',
    this.accountNumber = '0123456789',
    this.accountName = 'Engr. Damilola Adeyemi',
    this.salaryBankName = 'Zenith Bank PLC',
    this.salaryAccountNumber = '1012345678',
    this.salaryAccountName = 'Engr. Damilola Adeyemi',
    this.nextOfKinName = 'Mrs. Grace Adeyemi',
    this.nextOfKinPhone = '+234 802 334 5566',
    this.nextOfKinRelationship = 'Spouse',
    this.nextOfKinAddress = 'Plot 14, Farm Settlement Road, Iseyin, Oyo State',
    this.maritalStatus = 'Married',
    this.stateOfOrigin = 'Ogun State',
    this.lga = 'Abeokuta South',
    this.ninMask = '2938•••••81',
    this.bvnMask = '2219•••••44',
    this.avatarUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  });

  StaffUser copyWith({
    String? fullName,
    String? phone,
    String? residentialAddress,
    String? cityState,
    String? bankName,
    String? accountNumber,
    String? accountName,
    String? salaryBankName,
    String? salaryAccountNumber,
    String? salaryAccountName,
    String? nextOfKinName,
    String? nextOfKinPhone,
    String? nextOfKinRelationship,
    String? nextOfKinAddress,
    String? avatarUrl,
  }) {
    return StaffUser(
      id: id,
      fullName: fullName ?? this.fullName,
      email: email,
      phone: phone ?? this.phone,
      gender: gender,
      dateOfBirth: dateOfBirth,
      residentialAddress: residentialAddress ?? this.residentialAddress,
      cityState: cityState ?? this.cityState,
      employeeNumber: employeeNumber,
      role: role,
      subsidiary: subsidiary,
      department: department,
      jobTitle: jobTitle,
      employmentType: employmentType,
      resumptionDate: resumptionDate,
      workLocation: workLocation,
      staffGrade: staffGrade,
      bankName: bankName ?? this.bankName,
      accountNumber: accountNumber ?? this.accountNumber,
      accountName: accountName ?? this.accountName,
      salaryBankName: salaryBankName ?? this.salaryBankName,
      salaryAccountNumber: salaryAccountNumber ?? this.salaryAccountNumber,
      salaryAccountName: salaryAccountName ?? this.salaryAccountName,
      nextOfKinName: nextOfKinName ?? this.nextOfKinName,
      nextOfKinPhone: nextOfKinPhone ?? this.nextOfKinPhone,
      nextOfKinRelationship: nextOfKinRelationship ?? this.nextOfKinRelationship,
      nextOfKinAddress: nextOfKinAddress ?? this.nextOfKinAddress,
      maritalStatus: maritalStatus,
      stateOfOrigin: stateOfOrigin,
      lga: lga,
      ninMask: ninMask,
      bvnMask: bvnMask,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }

  factory StaffUser.fromJson(Map<String, dynamic> json) {
    return StaffUser(
      id: json['id']?.toString() ?? 'staff-01',
      fullName: json['fullName'] ?? json['legalName'] ?? json['name'] ?? 'Staff Member',
      email: json['email'] ?? json['workEmail'] ?? 'staff@bemsfarms.com',
      phone: json['phone'] ?? '+234 803 456 7890',
      gender: json['gender'] ?? 'Male',
      dateOfBirth: json['dateOfBirth'] ?? '14 May 1988',
      residentialAddress: json['residentialAddress'] ?? 'Plot 14, Farm Settlement Road, Iseyin',
      cityState: json['cityState'] ?? 'Oyo State, Nigeria',
      employeeNumber: json['employeeNumber'] ?? 'BEMS-FEED-2026-0042',
      role: json['role'] ?? 'OPERATIONS_DIRECTOR',
      subsidiary: json['subsidiary'] ?? json['subsidiaryName'] ?? 'BEMS Feed Mill Operations',
      department: json['department'] ?? 'Feed Operations & Processing',
      jobTitle: json['jobTitle'] ?? 'Director of Feed Plant Operations',
      employmentType: json['employmentType'] ?? 'Full-Time Permanent',
      resumptionDate: json['resumptionDate'] ?? '02 February 2024',
      workLocation: json['workLocation'] ?? 'Oyo Feed Mill Complex',
      staffGrade: json['staffGrade'] ?? 'PRINCIPAL_OFFICER_L8',
      bankName: json['bankName'] ?? 'Access Bank PLC',
      accountNumber: json['accountNumber'] ?? '0123456789',
      accountName: json['accountName'] ?? json['fullName'] ?? 'Engr. Damilola Adeyemi',
      salaryBankName: json['salaryBankName'] ?? 'Zenith Bank PLC',
      salaryAccountNumber: json['salaryAccountNumber'] ?? '1012345678',
      salaryAccountName: json['salaryAccountName'] ?? json['fullName'] ?? 'Engr. Damilola Adeyemi',
      nextOfKinName: json['nextOfKinName'] ?? 'Mrs. Grace Adeyemi',
      nextOfKinPhone: json['nextOfKinPhone'] ?? '+234 802 334 5566',
      nextOfKinRelationship: json['nextOfKinRelationship'] ?? 'Spouse',
      nextOfKinAddress: json['nextOfKinAddress'] ?? 'Plot 14, Farm Settlement Road, Iseyin, Oyo State',
      maritalStatus: json['maritalStatus'] ?? 'Married',
      stateOfOrigin: json['stateOfOrigin'] ?? 'Ogun State',
      lga: json['lga'] ?? 'Abeokuta South',
      ninMask: json['ninMask'] ?? '2938•••••81',
      bvnMask: json['bvnMask'] ?? '2219•••••44',
      avatarUrl: json['avatarUrl'] ?? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'fullName': fullName,
        'email': email,
        'phone': phone,
        'gender': gender,
        'dateOfBirth': dateOfBirth,
        'residentialAddress': residentialAddress,
        'cityState': cityState,
        'employeeNumber': employeeNumber,
        'role': role,
        'subsidiary': subsidiary,
        'department': department,
        'jobTitle': jobTitle,
        'employmentType': employmentType,
        'resumptionDate': resumptionDate,
        'workLocation': workLocation,
        'staffGrade': staffGrade,
        'bankName': bankName,
        'accountNumber': accountNumber,
        'accountName': accountName,
        'salaryBankName': salaryBankName,
        'salaryAccountNumber': salaryAccountNumber,
        'salaryAccountName': salaryAccountName,
        'nextOfKinName': nextOfKinName,
        'nextOfKinPhone': nextOfKinPhone,
        'nextOfKinRelationship': nextOfKinRelationship,
        'nextOfKinAddress': nextOfKinAddress,
        'maritalStatus': maritalStatus,
        'stateOfOrigin': stateOfOrigin,
        'lga': lga,
        'ninMask': ninMask,
        'bvnMask': bvnMask,
        'avatarUrl': avatarUrl,
      };
}

class FundRequestItem {
  final String id;
  final String requestNumber;
  final String title;
  final String purpose;
  final String justification;
  final String deliverable;
  final String category;
  final String subsidiary;
  final String department;
  final double amountNaira;
  final String urgency;
  final String approvalStatus;
  final String paymentStatus;
  final String accountabilityStatus;
  final String createdAt;
  final String neededBy;
  final String payeeName;
  final String avatarUrl;
  final List<String> lineItems;
  final String currentApproverStage;

  const FundRequestItem({
    required this.id,
    required this.requestNumber,
    required this.title,
    required this.purpose,
    required this.justification,
    required this.deliverable,
    required this.category,
    required this.subsidiary,
    required this.department,
    required this.amountNaira,
    required this.urgency,
    required this.approvalStatus,
    required this.paymentStatus,
    required this.accountabilityStatus,
    required this.createdAt,
    required this.neededBy,
    this.payeeName = 'Vendor Logistics Ltd',
    this.avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    this.lineItems = const ['25 Metric Tonnes Yellow Maize Grains', 'Weighbridge Inspection & Offloading Fee'],
    this.currentApproverStage = 'GMD Executive Sign-off',
  });

  factory FundRequestItem.fromJson(Map<String, dynamic> json) {
    return FundRequestItem(
      id: json['id']?.toString() ?? '',
      requestNumber: json['requestNumber'] ?? json['code'] ?? 'REQ-2026',
      title: json['title'] ?? json['purpose'] ?? 'Fund Request',
      purpose: json['purpose'] ?? json['title'] ?? 'Operational expenditure',
      justification: json['justification'] ?? 'Operational continuity requirement.',
      deliverable: json['deliverable'] ?? 'Physical GRN note and receipt verification.',
      category: json['category'] ?? 'OPERATIONAL',
      subsidiary: json['subsidiary'] is Map ? json['subsidiary']['legalName'] : (json['subsidiary'] ?? 'BEMS Farms Ltd'),
      department: json['department'] ?? 'Operations',
      amountNaira: (json['amountNaira'] is num)
          ? (json['amountNaira'] as num).toDouble()
          : (num.tryParse(json['amountNaira']?.toString() ?? '0') ?? 0).toDouble(),
      urgency: json['urgency'] ?? 'NORMAL',
      approvalStatus: json['approvalStatus'] ?? 'SUBMITTED',
      paymentStatus: json['paymentStatus'] ?? 'PENDING',
      accountabilityStatus: json['accountabilityStatus'] ?? 'PENDING',
      createdAt: json['createdAt'] ?? 'Today',
      neededBy: json['neededBy'] ?? 'Within 48 Hours',
      payeeName: json['beneficiary'] ?? json['payeeName'] ?? 'Golden Feed Logistics Ltd',
      avatarUrl: json['avatarUrl'] ?? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      lineItems: (json['lineItems'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const ['25 MT Feed Inputs', 'Logistics Haulage'],
      currentApproverStage: json['currentApproverStage'] ?? 'GMD Executive Sign-off',
    );
  }
}

class DisbursementItem {
  final String id;
  final String reference;
  final double amountNaira;
  final String bankName;
  final String? accountNumber;
  final String paidAt;
  final String status;
  final bool confirmed;
  final String title;
  final String avatarUrl;

  const DisbursementItem({
    required this.id,
    required this.reference,
    required this.amountNaira,
    required this.bankName,
    this.accountNumber,
    required this.paidAt,
    required this.status,
    required this.confirmed,
    required this.title,
    this.avatarUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  });

  factory DisbursementItem.fromJson(Map<String, dynamic> json) {
    return DisbursementItem(
      id: json['id']?.toString() ?? '',
      reference: json['externalReference'] ?? json['reference'] ?? 'TRF-BNK-98214',
      amountNaira: (json['amountNaira'] is num)
          ? (json['amountNaira'] as num).toDouble()
          : (num.tryParse(json['amountNaira']?.toString() ?? '0') ?? 0).toDouble(),
      bankName: json['bankName'] ?? 'Access Bank PLC',
      accountNumber: json['accountNumber']?.toString(),
      paidAt: json['paidAt'] ?? 'Today',
      status: json['status'] ?? 'RECORDED',
      confirmed: json['confirmed'] == true || json['status'] == 'CONFIRMED',
      title: json['request']?['title'] ?? json['title'] ?? 'Advance Disbursal',
      avatarUrl: json['avatarUrl'] ?? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    );
  }
}

class AccountabilityCaseItem {
  final String id;
  final String requestId;
  final String requestNumber;
  final String title;
  final double amountNaira;
  final String disbursedAt;
  final String dueAt;
  final int hoursRemaining;
  final int totalHoursSla;
  final bool isOverdue;
  final String status;
  final String requiredDeliverables;
  final String bankReference;
  final String avatarUrl;

  const AccountabilityCaseItem({
    required this.id,
    required this.requestId,
    required this.requestNumber,
    required this.title,
    required this.amountNaira,
    this.disbursedAt = '21 Oct 2026, 10:15 AM',
    required this.dueAt,
    required this.hoursRemaining,
    this.totalHoursSla = 72,
    required this.isOverdue,
    required this.status,
    required this.requiredDeliverables,
    this.bankReference = 'TRF-BNK-98190',
    this.avatarUrl = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  });

  factory AccountabilityCaseItem.fromJson(Map<String, dynamic> json) {
    final dueStr = json['dueAt']?.toString() ?? '';
    int diffHours = 72;
    bool overdue = false;
    if (dueStr.isNotEmpty) {
      try {
        final dueDate = DateTime.parse(dueStr);
        diffHours = dueDate.difference(DateTime.now()).inHours;
        overdue = diffHours < 0;
      } catch (_) {}
    }

    return AccountabilityCaseItem(
      id: json['id']?.toString() ?? '',
      requestId: json['requestId']?.toString() ?? '',
      requestNumber: json['request']?['requestNumber'] ?? json['requestNumber'] ?? 'REQ-2026',
      title: json['request']?['title'] ?? json['purpose'] ?? 'Operational advance',
      amountNaira: (json['amountNaira'] is num)
          ? (json['amountNaira'] as num).toDouble()
          : (num.tryParse(json['amountNaira']?.toString() ?? '0') ?? 0).toDouble(),
      disbursedAt: json['disbursedAt'] ?? '21 Oct 2026, 10:15 AM',
      dueAt: dueStr,
      hoursRemaining: diffHours,
      totalHoursSla: 72,
      isOverdue: overdue || json['status'] == 'OVERDUE',
      status: json['status'] ?? (overdue ? 'OVERDUE' : 'OPEN'),
      requiredDeliverables: json['requiredDeliverables'] ?? 'Goods Received Note (GRN) & receipt',
      bankReference: json['bankReference'] ?? 'TRF-BNK-98190',
      avatarUrl: json['avatarUrl'] ?? 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    );
  }
}
