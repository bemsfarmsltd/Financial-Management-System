class FundRequestItem {
  final String id;
  final String requestNumber;
  final String title;
  final String category;
  final double amount;
  final String currency;
  final String status;
  final String statusLabel;
  final int stepIndex; // 0 to 4
  final String submittedDate;
  final String subsidiaryName;
  final String departmentName;
  final bool needsRetirement;
  final String? rejectionReason;
  final List<String> channelComments;

  FundRequestItem({
    required this.id,
    required this.requestNumber,
    required this.title,
    required this.category,
    required this.amount,
    this.currency = 'NGN',
    required this.status,
    required this.statusLabel,
    required this.stepIndex,
    required this.submittedDate,
    required this.subsidiaryName,
    required this.departmentName,
    this.needsRetirement = false,
    this.rejectionReason,
    this.channelComments = const [],
  });

  factory FundRequestItem.fromJson(Map<String, dynamic> json) {
    return FundRequestItem(
      id: json['id']?.toString() ?? '',
      requestNumber: json['requestNumber'] ?? json['number'] ?? 'REQ-000',
      title: json['title'] ?? 'Untitled Request',
      category: json['category'] ?? 'Operational Expense',
      amount: (json['amount'] is num) ? (json['amount'] as num).toDouble() : 0.0,
      currency: json['currency'] ?? 'NGN',
      status: json['status'] ?? 'SUBMITTED',
      statusLabel: json['statusLabel'] ?? json['status'] ?? 'Submitted',
      stepIndex: json['stepIndex'] ?? 0,
      submittedDate: json['submittedDate'] ?? json['createdAt'] ?? 'Today',
      subsidiaryName: json['subsidiaryName'] ?? 'Bems Group Cloud & Technologies Ltd',
      departmentName: json['departmentName'] ?? 'Technology',
      needsRetirement: json['needsRetirement'] ?? false,
      rejectionReason: json['rejectionReason'],
      channelComments: (json['comments'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'requestNumber': requestNumber,
      'title': title,
      'category': category,
      'amount': amount,
      'currency': currency,
      'status': status,
      'stepIndex': stepIndex,
      'needsRetirement': needsRetirement,
    };
  }
}
