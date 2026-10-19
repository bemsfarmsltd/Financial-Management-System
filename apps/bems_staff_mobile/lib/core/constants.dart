import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

class AppConstants {
  static const String appName = 'BEMS Staff';
  static const String appTagline = 'Expenditure, Advance Retirement & Payroll Desk';

  // Base URL resolution based on platform
  static String get defaultBaseUrl {
    if (kIsWeb) return 'http://localhost:3000';
    if (Platform.isAndroid) {
      // 10.0.2.2 maps to host machine localhost in Android Emulator
      return 'http://10.0.2.2:3000';
    }
    // iOS simulator / physical devices on the same Wi-Fi
    return 'http://localhost:3000';
  }

  // Endpoints
  static const String loginEndpoint = '/api/auth/login';
  static const String sessionEndpoint = '/api/auth/session';
  static const String requestsEndpoint = '/api/requests';
  static const String createRequestEndpoint = '/api/requests/create';
  static const String accountabilityEndpoint = '/api/accountability';
  static const String myPaymentsEndpoint = '/api/payroll/my-payments';

  // Policy rules
  static const int retirementWindowHours = 72;

  // Formatting helpers
  static final NumberFormat currencyFormatter = NumberFormat.currency(
    symbol: '₦',
    decimalDigits: 0,
    locale: 'en_NG',
  );

  static String formatNaira(num amount) {
    return currencyFormatter.format(amount);
  }
}
