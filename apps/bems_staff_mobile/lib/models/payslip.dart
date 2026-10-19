class PayslipPayment {
  final String id;
  final String periodName;
  final String amountFormatted;
  final double grossAmount;
  final double netAmount;
  final double taxPaye;
  final double pensionDeduction;
  final String bankName;
  final String reference;
  final String paidAt;
  final String status;
  final String? receiptUrl;
  final String? receiptFileName;
  final bool isConfirmedByStaff;
  final String? confirmationDate;

  PayslipPayment({
    required this.id,
    required this.periodName,
    required this.amountFormatted,
    required this.grossAmount,
    required this.netAmount,
    required this.taxPaye,
    required this.pensionDeduction,
    required this.bankName,
    required this.reference,
    required this.paidAt,
    required this.status,
    this.receiptUrl,
    this.receiptFileName,
    this.isConfirmedByStaff = false,
    this.confirmationDate,
  });

  factory PayslipPayment.fromJson(Map<String, dynamic> json) {
    final confirmation = json['confirmation'];
    return PayslipPayment(
      id: json['id'] ?? '',
      periodName: json['periodName'] ?? 'Current Period',
      amountFormatted: json['amountFormatted'] ?? '₦0',
      grossAmount: (json['grossAmount'] is num) ? (json['grossAmount'] as num).toDouble() : 750000.0,
      netAmount: (json['netAmount'] is num) ? (json['netAmount'] as num).toDouble() : 680000.0,
      taxPaye: (json['taxPaye'] is num) ? (json['taxPaye'] as num).toDouble() : 45000.0,
      pensionDeduction: (json['pensionDeduction'] is num) ? (json['pensionDeduction'] as num).toDouble() : 25000.0,
      bankName: json['bankName'] ?? 'Access Bank Plc',
      reference: json['reference'] ?? 'TRF-PAY-000',
      paidAt: json['paidAt'] ?? '',
      status: json['status'] ?? 'VERIFIED',
      receiptUrl: json['receipt']?['url'],
      receiptFileName: json['receipt']?['fileName'],
      isConfirmedByStaff: confirmation != null && confirmation['decision'] == 'CONFIRMED',
      confirmationDate: confirmation?['confirmedAt'],
    );
  }
}
