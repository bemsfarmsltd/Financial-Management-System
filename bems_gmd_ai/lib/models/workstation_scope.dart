import 'package:flutter/material.dart';
import '../widgets/charts/treasury_pie_chart.dart';
import '../widgets/charts/expenditure_histogram.dart';
import '../widgets/charts/subsidiary_burn_bars.dart';

class WorkstationProfile {
  final String code;
  final String shortName;
  final String fullName;
  final String description;
  final String totalTreasuryDisplay;
  final double totalTreasuryAmount;
  final String runwayWeeks;
  final double budgetCeiling;
  final double spentAmount;
  final String burnBadge;
  final Color themeColor;
  final List<BankShareData> bankAccounts;
  final List<MonthlyBurnData> monthlyBurnHistory;
  final int totalAdvances;
  final int retiredOnTime;
  final int inProgressAdvances;
  final int overdueAdvances;
  final List<SubsidiaryBudgetItem>? customSubsidiaries;

  const WorkstationProfile({
    required this.code,
    required this.shortName,
    required this.fullName,
    required this.description,
    required this.totalTreasuryDisplay,
    required this.totalTreasuryAmount,
    required this.runwayWeeks,
    required this.budgetCeiling,
    required this.spentAmount,
    required this.burnBadge,
    required this.themeColor,
    required this.bankAccounts,
    required this.monthlyBurnHistory,
    required this.totalAdvances,
    required this.retiredOnTime,
    required this.inProgressAdvances,
    required this.overdueAdvances,
    this.customSubsidiaries,
  });

  double get burnPercentage => budgetCeiling > 0 ? (spentAmount / budgetCeiling) * 100 : 0.0;

  String get id => code;
  String get name => shortName;
  int get slaAdvances => totalAdvances;
  int get slaRetiredOnTime => retiredOnTime;
  int get slaInProgress => inProgressAdvances;
  int get slaOverdue => overdueAdvances;
  List<MonthlyBurnData> get monthlyBurn => monthlyBurnHistory;

  List<SubsidiaryBudgetItem> get subsidiaries => customSubsidiaries ?? _defaultSubsidiaries;

  List<SubsidiaryBudgetItem> get _defaultSubsidiaries {
    if (code == 'SOFT') {
      return const [
        SubsidiaryBudgetItem(
          entityName: 'BemsSoft Hub Ltd',
          code: 'TECH',
          budgetCeiling: 25000000,
          spentAmount: 18500000,
          themeColor: Color(0xFF2563EB),
        ),
      ];
    } else if (code == 'LOG') {
      return const [
        SubsidiaryBudgetItem(
          entityName: 'Bems Logistics Ltd',
          code: 'LOGS',
          budgetCeiling: 45000000,
          spentAmount: 32100000,
          themeColor: Color(0xFFEA580C),
        ),
      ];
    } else if (code == 'HQ') {
      return const [
        SubsidiaryBudgetItem(
          entityName: 'Group Corporate HQ',
          code: 'CORP',
          budgetCeiling: 14000000,
          spentAmount: 6000000,
          themeColor: Color(0xFF059669),
        ),
      ];
    } else {
      return const [
        SubsidiaryBudgetItem(
          entityName: 'BemsSoft Hub Ltd',
          code: 'TECH',
          budgetCeiling: 25000000,
          spentAmount: 18500000,
          themeColor: Color(0xFF2563EB),
        ),
        SubsidiaryBudgetItem(
          entityName: 'Bems Logistics Ltd',
          code: 'LOGS',
          budgetCeiling: 45000000,
          spentAmount: 32100000,
          themeColor: Color(0xFFEA580C),
        ),
        SubsidiaryBudgetItem(
          entityName: 'Group Corporate HQ',
          code: 'CORP',
          budgetCeiling: 14000000,
          spentAmount: 6000000,
          themeColor: Color(0xFF059669),
        ),
      ];
    }
  }
}

class WorkstationRepository {
  static const WorkstationProfile allGroup = WorkstationProfile(
    code: 'all',
    shortName: 'All Workstations',
    fullName: 'BEMS Group Holdings (Consolidated)',
    description: 'Consolidated conglomerate operations & treasury pools',
    totalTreasuryDisplay: '₦0.00',
    totalTreasuryAmount: 0.0,
    runwayWeeks: '0 Wks Reserve',
    budgetCeiling: 0.0,
    spentAmount: 0.0,
    burnBadge: '0.0% Spent',
    themeColor: Color(0xFFEA580C),
    bankAccounts: [],
    monthlyBurnHistory: [],
    totalAdvances: 0,
    retiredOnTime: 0,
    inProgressAdvances: 0,
    overdueAdvances: 0,
  );

  static List<WorkstationProfile> getWorkstations(Map<String, dynamic>? data) {
    final list = <WorkstationProfile>[allGroup];
    final orgs = (data?['organizations'] as List<dynamic>?) ?? [];
    final colors = [
      const Color(0xFF2563EB),
      const Color(0xFFEA580C),
      const Color(0xFF059669),
      const Color(0xFFD97706),
      const Color(0xFF7C3AED),
      const Color(0xFF0D9488),
    ];
    int idx = 0;
    for (final org in orgs) {
      final code = (org['code'] ?? org['id'] ?? 'SUB').toString();
      final name = (org['legalName'] ?? org['name'] ?? 'Subsidiary').toString();
      list.add(WorkstationProfile(
        code: code,
        shortName: name.length > 20 ? '${name.substring(0, 18)}…' : name,
        fullName: name,
        description: 'Subsidiary operations & department budgets',
        totalTreasuryDisplay: '₦0.00',
        totalTreasuryAmount: 0.0,
        runwayWeeks: '0 Wks Reserve',
        budgetCeiling: 0.0,
        spentAmount: 0.0,
        burnBadge: '0.0% Spent',
        themeColor: colors[idx % colors.length],
        bankAccounts: const [],
        monthlyBurnHistory: const [],
        totalAdvances: 0,
        retiredOnTime: 0,
        inProgressAdvances: 0,
        overdueAdvances: 0,
      ));
      idx++;
    }
    return list;
  }

  static List<WorkstationProfile> get allWorkstations => [allGroup];

  static WorkstationProfile getByCode(String code, [Map<String, dynamic>? data]) {
    final workstations = getWorkstations(data);
    return workstations.firstWhere(
      (w) => w.code.toLowerCase() == code.toLowerCase(),
      orElse: () => allGroup,
    );
  }

  static Color _getScopeColor(String scope) {
    switch (scope.toUpperCase()) {
      case 'SOFT':
        return const Color(0xFF2563EB);
      case 'LOG':
        return const Color(0xFFEA580C);
      case 'HQ':
        return const Color(0xFF059669);
      default:
        return const Color(0xFFEA580C);
    }
  }

  static WorkstationProfile compute({
    required String scope,
    required Map<String, dynamic>? data,
  }) {
    if (data == null || data.isEmpty) {
      return getByCode(scope);
    }

    final requests = (data['requests'] as List<dynamic>?) ?? [];
    final budgets = (data['budgets'] as List<dynamic>?) ?? [];
    final accountabilityCases = (data['accountabilityCases'] as List<dynamic>?) ?? [];

    bool matchesScope(String? orgCode, String? orgName) {
      if (scope == 'all') return true;
      final c = (orgCode ?? '').toUpperCase();
      final n = (orgName ?? '').toUpperCase();
      if (scope == 'SOFT') return c.contains('SOFT') || n.contains('SOFT') || n.contains('TECH');
      if (scope == 'LOG') return c.contains('LOG') || n.contains('LOG') || n.contains('SUPPLY');
      if (scope == 'HQ') return c.contains('GROUP') || c.contains('HQ') || n.contains('CORP') || n.contains('ADMIN');
      return true;
    }

    // 1. Filter budgets
    final scopedBudgets = budgets.where((b) {
      final orgCode = b['organization']?['code']?.toString() ?? b['organizationId']?.toString();
      final orgName = b['organization']?['legalName']?.toString();
      return matchesScope(orgCode, orgName);
    }).toList();

    double totalAllocated = 0.0;
    double totalSpent = 0.0;
    for (final b in scopedBudgets) {
      totalAllocated += (num.tryParse(b['totalAmount']?.toString() ?? '0') ?? 0).toDouble();
      totalSpent += (num.tryParse(b['spentAmount']?.toString() ?? '0') ?? 0).toDouble();
    }

    // 2. Filter requests
    final scopedRequests = requests.where((r) {
      final subCode = r['subsidiary']?['code']?.toString();
      final subName = r['subsidiary']?['legalName']?.toString();
      return matchesScope(subCode, subName);
    }).toList();

    // 4. Resolve Real Treasury Bank Accounts directly from database
    final rawTreasuryAccounts = (data['treasuryAccounts'] as List<dynamic>?) ?? [];
    final List<BankShareData> dynamicBankAccounts = [];
    double liquidBalance = 0.0;

    final colors = [
      const Color(0xFFEA580C),
      const Color(0xFF2563EB),
      const Color(0xFF059669),
      const Color(0xFFD97706),
      const Color(0xFF7C3AED),
    ];

    if (rawTreasuryAccounts.isNotEmpty) {
      int colorIdx = 0;
      for (final acc in rawTreasuryAccounts) {
        final accScope = acc['scope']?.toString() ?? 'all';
        final accBank = acc['bankName']?.toString() ?? 'Corporate Treasury';
        final accNum = acc['accountNumber']?.toString() ?? '0129384756';
        final accBal = (num.tryParse(acc['balanceNaira']?.toString() ?? acc['balance']?.toString() ?? '0') ?? 0).toDouble();

        bool match = false;
        if (scope == 'all') {
          match = true;
        } else if (scope == 'HQ' && (accScope == 'HQ' || accBank.contains('Corporate') || accBank.contains('Head Office'))) {
          match = true;
        } else if (scope == 'LOG' && (accScope == 'LOG' || accBank.contains('Agribusiness') || accBank.contains('Logistics') || accBank.contains('Feed'))) {
          match = true;
        } else if (scope == 'SOFT' && (accScope == 'SOFT' || accBank.contains('Tech') || accBank.contains('Cloud'))) {
          match = true;
        }

        if (match) {
          liquidBalance += accBal;
          dynamicBankAccounts.add(BankShareData(
            bankName: accBank,
            accountNumber: accNum,
            amount: accBal,
            color: colors[colorIdx % colors.length],
          ));
          colorIdx++;
        }
      }
    }

    // If no bank accounts found in DB, use uncommitted budget as estimated reserve if available, else 0.0
    if (liquidBalance <= 0 && rawTreasuryAccounts.isEmpty) {
      liquidBalance = totalAllocated > 0 ? (totalAllocated - totalSpent) : 0.0;
    }

    // 6. Monthly burn history from live database requests
    final months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    final Map<String, double> monthActuals = {'Jun': 0, 'Jul': 0, 'Aug': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0};
    for (final r in scopedRequests) {
      final dtStr = r['createdAt']?.toString();
      if (dtStr != null) {
        final dt = DateTime.tryParse(dtStr);
        if (dt != null) {
          final mIndex = dt.month - 6; // Jun=6 -> 0
          if (mIndex >= 0 && mIndex < months.length) {
            final mName = months[mIndex];
            final amt = (num.tryParse(r['amountNaira']?.toString() ?? '0') ?? 0).toDouble();
            monthActuals[mName] = (monthActuals[mName] ?? 0.0) + amt;
          }
        }
      }
    }
    final double monthlyCeiling = totalAllocated > 0 ? (totalAllocated / 3.0) : 25000000.0;
    final List<MonthlyBurnData> dynamicMonthlyBurn = months.map((m) {
      final actual = monthActuals[m] ?? 0.0;
      return MonthlyBurnData(
        month: m,
        actualSpent: actual,
        budgetCeiling: monthlyCeiling,
        isCurrentMonth: m == 'Oct',
      );
    }).toList();

    // 7. 72h SLA Metrics from real accountabilityCases
    final scopedCases = accountabilityCases.where((c) {
      final subCode = c['request']?['subsidiary']?['code']?.toString();
      final subName = c['request']?['subsidiary']?['legalName']?.toString();
      return matchesScope(subCode, subName);
    }).toList();

    final totalAdv = scopedCases.length;
    final overdueCount = scopedCases.where((c) => c['status'] == 'OVERDUE').length;
    final retiredCount = scopedCases.where((c) => c['status'] == 'RETIRED' || c['status'] == 'RESOLVED').length;
    final inProgCount = scopedCases.where((c) => c['status'] == 'OPEN' || c['status'] == 'SUBMITTED').length;

    // 8. Dynamic Subsidiary Bars from real DB budgets
    final List<SubsidiaryBudgetItem> dynamicSubsidiaries = [];
    if (scope == 'all' && budgets.isNotEmpty) {
      for (final b in budgets) {
        final name = b['organization']?['legalName'] ?? 'Subsidiary';
        final code = b['organization']?['code'] ?? 'SUB';
        final ceiling = (num.tryParse(b['totalAmount']?.toString() ?? '0') ?? 0).toDouble();
        final spent = (num.tryParse(b['spentAmount']?.toString() ?? '0') ?? 0).toDouble();
        Color c = const Color(0xFFEA580C);
        if (code.toString().contains('SOFT')) c = const Color(0xFF2563EB);
        if (code.toString().contains('LOG')) c = const Color(0xFFEA580C);
        if (code.toString().contains('GROUP') || code.toString().contains('HQ')) c = const Color(0xFF059669);
        dynamicSubsidiaries.add(SubsidiaryBudgetItem(
          entityName: name.toString(),
          code: code.toString(),
          budgetCeiling: ceiling > 0 ? ceiling : 25000000.0,
          spentAmount: spent,
          themeColor: c,
        ));
      }
    } else if (scopedBudgets.isNotEmpty) {
      final b = scopedBudgets.first;
      final name = b['organization']?['legalName'] ?? 'Business Unit';
      final code = b['organization']?['code'] ?? scope;
      final ceiling = (num.tryParse(b['totalAmount']?.toString() ?? '0') ?? 0).toDouble();
      final spent = (num.tryParse(b['spentAmount']?.toString() ?? '0') ?? 0).toDouble();
      dynamicSubsidiaries.add(SubsidiaryBudgetItem(
        entityName: name.toString(),
        code: code.toString(),
        budgetCeiling: ceiling > 0 ? ceiling : 25000000.0,
        spentAmount: spent,
        themeColor: _getScopeColor(scope),
      ));
    }

    final double burnPct = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0.0;
    final double runway = (totalSpent > 0 && liquidBalance > 0)
        ? ((liquidBalance / totalSpent) * 4.3).clamp(1.0, 52.0)
        : 0.0;

    String displayTreasury;
    if (liquidBalance <= 0) {
      displayTreasury = '₦0.00';
    } else if (liquidBalance >= 1000000) {
      displayTreasury = '₦${(liquidBalance / 1000000).toStringAsFixed(1)}M';
    } else if (liquidBalance >= 1000) {
      displayTreasury = '₦${(liquidBalance / 1000).toStringAsFixed(0)}K';
    } else {
      displayTreasury = '₦${liquidBalance.toStringAsFixed(2)}';
    }

    final base = getByCode(scope, data);

    return WorkstationProfile(
      code: scope,
      shortName: base.shortName,
      fullName: base.fullName,
      description: base.description,
      totalTreasuryDisplay: displayTreasury,
      totalTreasuryAmount: liquidBalance,
      runwayWeeks: runway > 0 ? '${runway.toStringAsFixed(0)} Wks Reserve' : '0 Wks Reserve',
      budgetCeiling: totalAllocated,
      spentAmount: totalSpent,
      burnBadge: '${burnPct.toStringAsFixed(1)}% Spent',
      themeColor: base.themeColor,
      bankAccounts: dynamicBankAccounts,
      monthlyBurnHistory: dynamicMonthlyBurn,
      totalAdvances: totalAdv,
      retiredOnTime: retiredCount,
      inProgressAdvances: inProgCount > 0 ? inProgCount : (totalAdv - overdueCount - retiredCount).clamp(0, 99),
      overdueAdvances: overdueCount,
      customSubsidiaries: dynamicSubsidiaries.isNotEmpty ? dynamicSubsidiaries : null,
    );
  }
}
