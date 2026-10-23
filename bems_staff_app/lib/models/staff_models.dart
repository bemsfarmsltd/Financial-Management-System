class StaffUser {
  final String id;
  final String fullName;
  final String email;
  final String role;
  final String? subsidiary;
  final String? department;
  final String? employeeNumber;
  final String? bankName;
  final String? accountNumber;

  const StaffUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.subsidiary,
    this.department,
    this.employeeNumber,
    this.bankName,
    this.accountNumber,
  });

  factory StaffUser.fromJson(Map<String, dynamic> json) {
    return StaffUser(
      id: json['id']?.toString() ?? 'staff-01',
      fullName: json['fullName'] ?? json['legalName'] ?? json['name'] ?? 'Staff Member',
      email: json['email'] ?? json['workEmail'] ?? 'staff@bemsfarms.com',
      role: json['role'] ?? 'OPERATIONS_STAFF',
      subsidiary: json['subsidiary'] ?? json['subsidiaryName'] ?? 'BEMS Farms Ltd',
      department: json['department'] ?? 'Operations',
      employeeNumber: json['employeeNumber'] ?? 'BEMS-EMP-042',
      bankName: json['bankName'] ?? 'Access Bank PLC',
      accountNumber: json['accountNumber'] ?? '0123456789',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'fullName': fullName,
        'email': email,
        'role': role,
        'subsidiary': subsidiary,
        'department': department,
        'employeeNumber': employeeNumber,
        'bankName': bankName,
        'accountNumber': accountNumber,
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
    );
  }
}

class AccountabilityCaseItem {
  final String id;
  final String requestId;
  final String requestNumber;
  final String title;
  final double amountNaira;
  final String dueAt;
  final int hoursRemaining;
  final bool isOverdue;
  final String status;
  final String requiredDeliverables;

  const AccountabilityCaseItem({
    required this.id,
    required this.requestId,
    required this.requestNumber,
    required this.title,
    required this.amountNaira,
    required this.dueAt,
    required this.hoursRemaining,
    required this.isOverdue,
    required this.status,
    required this.requiredDeliverables,
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
      dueAt: dueStr,
      hoursRemaining: diffHours,
      isOverdue: overdue || json['status'] == 'OVERDUE',
      status: json['status'] ?? (overdue ? 'OVERDUE' : 'OPEN'),
      requiredDeliverables: json['requiredDeliverables'] ?? 'Goods Received Note (GRN) & receipt',
    );
  }
}
