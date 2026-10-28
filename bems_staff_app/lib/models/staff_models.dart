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
  final String token;

  const StaffUser({
    required this.id,
    required this.fullName,
    required this.email,
    this.phone = '',
    this.gender = '',
    this.dateOfBirth = '',
    this.residentialAddress = '',
    this.cityState = '',
    this.employeeNumber = '',
    this.role = '',
    this.subsidiary = '',
    this.department = '',
    this.jobTitle = '',
    this.employmentType = '',
    this.resumptionDate = '',
    this.workLocation = '',
    this.staffGrade = '',
    this.bankName = '',
    this.accountNumber = '',
    this.accountName = '',
    this.salaryBankName = '',
    this.salaryAccountNumber = '',
    this.salaryAccountName = '',
    this.nextOfKinName = '',
    this.nextOfKinPhone = '',
    this.nextOfKinRelationship = '',
    this.nextOfKinAddress = '',
    this.maritalStatus = '',
    this.stateOfOrigin = '',
    this.lga = '',
    this.ninMask = '',
    this.bvnMask = '',
    this.avatarUrl = '',
    this.token = '',
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
    String? token,
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
      token: token ?? this.token,
    );
  }

  factory StaffUser.fromJson(Map<String, dynamic> json) {
    return StaffUser(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName'] ?? json['legalName'] ?? json['name'] ?? '',
      email: json['email'] ?? json['workEmail'] ?? '',
      phone: json['phone']?.toString() ?? '',
      gender: json['gender']?.toString() ?? '',
      dateOfBirth: json['dateOfBirth']?.toString() ?? '',
      residentialAddress: json['residentialAddress']?.toString() ?? '',
      cityState: json['cityState']?.toString() ?? '',
      employeeNumber: json['employeeNumber']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      subsidiary: json['subsidiary'] is Map ? (json['subsidiary']['legalName'] ?? '') : (json['subsidiary'] ?? json['subsidiaryName'] ?? ''),
      department: json['department']?.toString() ?? '',
      jobTitle: json['jobTitle']?.toString() ?? '',
      employmentType: json['employmentType']?.toString() ?? '',
      resumptionDate: json['resumptionDate']?.toString() ?? '',
      workLocation: json['workLocation']?.toString() ?? '',
      staffGrade: json['staffGrade']?.toString() ?? '',
      bankName: json['bankName']?.toString() ?? '',
      accountNumber: json['accountNumber']?.toString() ?? '',
      accountName: json['accountName'] ?? json['fullName'] ?? json['legalName'] ?? '',
      salaryBankName: json['salaryBankName']?.toString() ?? '',
      salaryAccountNumber: json['salaryAccountNumber']?.toString() ?? '',
      salaryAccountName: json['salaryAccountName'] ?? json['accountName'] ?? json['fullName'] ?? '',
      nextOfKinName: json['nextOfKinName']?.toString() ?? '',
      nextOfKinPhone: json['nextOfKinPhone']?.toString() ?? '',
      nextOfKinRelationship: json['nextOfKinRelationship']?.toString() ?? '',
      nextOfKinAddress: json['nextOfKinAddress']?.toString() ?? '',
      maritalStatus: json['maritalStatus']?.toString() ?? '',
      stateOfOrigin: json['stateOfOrigin']?.toString() ?? '',
      lga: json['lga']?.toString() ?? '',
      ninMask: json['ninMask']?.toString() ?? '',
      bvnMask: json['bvnMask']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString() ?? '',
      token: json['token']?.toString() ?? '',
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
        'token': token,
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
  final String dueDate;
  final bool isRecurring;
  final String? recurringInterval;
  final String? nextRecurringDate;
  final String? vendorName;
  final bool isIntercompany;
  final List<String> attachments;

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
    this.payeeName = '',
    this.avatarUrl = '',
    this.lineItems = const [],
    this.currentApproverStage = '',
    this.dueDate = '',
    this.isRecurring = false,
    this.recurringInterval,
    this.nextRecurringDate,
    this.vendorName = '',
    this.isIntercompany = false,
    this.attachments = const [],
  });

  factory FundRequestItem.fromJson(Map<String, dynamic> json) {
    double parsedAmount = 0.0;
    if (json['amountNaira'] is num) {
      parsedAmount = (json['amountNaira'] as num).toDouble();
    } else if (json['amount'] is num) {
      parsedAmount = (json['amount'] as num).toDouble();
    } else if (json['amountMinor'] is num) {
      parsedAmount = (json['amountMinor'] as num).toDouble() / 100.0;
    } else {
      parsedAmount = (num.tryParse(json['amountNaira']?.toString() ?? json['amount']?.toString() ?? '0') ?? 0).toDouble();
    }

    return FundRequestItem(
      id: json['id']?.toString() ?? '',
      requestNumber: json['requestNumber'] ?? json['code'] ?? '',
      title: json['title'] ?? json['description'] ?? json['purpose'] ?? 'Expenditure Request',
      purpose: json['purpose'] ?? json['description'] ?? json['title'] ?? 'Requisition',
      justification: json['justification'] ?? json['businessJustification'] ?? '',
      deliverable: json['deliverable'] ?? json['retirementProofRequired'] ?? '',
      category: json['category'] ?? 'OPERATIONAL',
      subsidiary: json['subsidiary'] is Map
          ? (json['subsidiary']['legalName'] ?? '')
          : (json['subsidiaryName'] ?? json['subsidiary'] ?? ''),
      department: json['department'] ?? json['departmentName'] ?? '',
      amountNaira: parsedAmount,
      urgency: json['urgency'] ?? 'NORMAL',
      approvalStatus: json['approvalStatus'] ?? json['status'] ?? 'SUBMITTED',
      paymentStatus: json['paymentStatus'] ?? 'PENDING',
      accountabilityStatus: json['accountabilityStatus'] ?? 'PENDING',
      createdAt: json['createdAt'] ?? json['submittedDate'] ?? '',
      neededBy: json['neededBy'] ?? '',
      payeeName: json['beneficiary'] ?? json['payeeName'] ?? (json['vendor'] is Map ? json['vendor']['name'] : json['vendor']) ?? '',
      avatarUrl: json['avatarUrl'] ?? '',
      lineItems: (json['lineItems'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      currentApproverStage: json['currentApproverStage'] ?? json['statusLabel'] ?? '',
      dueDate: json['dueDate'] ?? json['neededBy'] ?? '',
      isRecurring: json['isRecurring'] == true,
      recurringInterval: json['recurringInterval']?.toString(),
      nextRecurringDate: json['nextRecurringDate']?.toString(),
      vendorName: json['vendorName']?.toString() ?? (json['vendor'] is Map ? json['vendor']['name']?.toString() : json['vendor']?.toString()) ?? '',
      isIntercompany: json['isIntercompany'] == true,
      attachments: (json['attachments'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
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
    this.avatarUrl = '',
  });

  factory DisbursementItem.fromJson(Map<String, dynamic> json) {
    return DisbursementItem(
      id: json['id']?.toString() ?? '',
      reference: json['externalReference'] ?? json['reference'] ?? '',
      amountNaira: (json['amountNaira'] is num)
          ? (json['amountNaira'] as num).toDouble()
          : (num.tryParse(json['amountNaira']?.toString() ?? '0') ?? 0).toDouble(),
      bankName: json['bankName'] ?? '',
      accountNumber: json['accountNumber']?.toString(),
      paidAt: json['paidAt'] ?? '',
      status: json['status'] ?? 'RECORDED',
      confirmed: json['confirmed'] == true || json['status'] == 'CONFIRMED',
      title: json['request']?['title'] ?? json['title'] ?? '',
      avatarUrl: json['avatarUrl'] ?? '',
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
    this.requestId = '',
    required this.requestNumber,
    required this.title,
    required this.amountNaira,
    this.disbursedAt = '',
    this.dueAt = '',
    this.hoursRemaining = 72,
    this.totalHoursSla = 72,
    this.isOverdue = false,
    this.status = 'PENDING_RETIREMENT',
    this.requiredDeliverables = '',
    this.bankReference = '',
    this.avatarUrl = '',
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
      requestNumber: json['request']?['requestNumber'] ?? json['requestNumber'] ?? '',
      title: json['request']?['title'] ?? json['purpose'] ?? '',
      amountNaira: (json['amountNaira'] is num)
          ? (json['amountNaira'] as num).toDouble()
          : (num.tryParse(json['amountNaira']?.toString() ?? '0') ?? 0).toDouble(),
      disbursedAt: json['disbursedAt'] ?? '',
      dueAt: dueStr,
      hoursRemaining: diffHours,
      totalHoursSla: 72,
      isOverdue: overdue || json['status'] == 'OVERDUE',
      status: json['status'] ?? (overdue ? 'OVERDUE' : 'OPEN'),
      requiredDeliverables: json['requiredDeliverables'] ?? '',
      bankReference: json['bankReference'] ?? '',
      avatarUrl: json['avatarUrl'] ?? '',
    );
  }
}
