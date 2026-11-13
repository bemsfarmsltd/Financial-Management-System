import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/staff_splash_screen.dart';
import 'screens/app_upgrade_screen.dart';
import 'screens/staff_login_screen.dart';
import 'services/staff_api_service.dart';
import 'services/staff_storage_service.dart';
import 'services/staff_notification_service.dart';
import 'theme/subsidiary_theme.dart';

final GlobalKey<NavigatorState> staffNavigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await StaffNotificationService().initialize();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  // Global HTTP 426 (Upgrade Required) live listener
  StaffApiService.onUpgradeRequired = (info) {
    final context = staffNavigatorKey.currentContext;
    if (context != null) {
      staffNavigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => StaffAppUpgradeScreen(
            currentVersion: StaffApiService.appVersion,
            requiredVersion: info['minimumAllowedVersion']?.toString() ?? '1.0.0',
            downloadUrl: info['directDownloadUrl']?.toString() ?? 'https://bemserp.work/download/staff-app.apk',
            notes: info['upgradePromptNotes']?.toString() ?? 'A critical update is required to continue.',
          ),
        ),
        (route) => false,
      );
    }
  };

  // Global HTTP 401/403 (User Suspended or Deleted) live listener
  StaffApiService.onSessionInvalidated = () async {
    await StaffStorageService.clearUser();
    final currentState = staffNavigatorKey.currentState;
    if (currentState != null) {
      currentState.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const StaffLoginScreen()),
        (route) => false,
      );
      final currentCtx = staffNavigatorKey.currentContext;
      if (currentCtx != null && currentCtx.mounted) {
        ScaffoldMessenger.of(currentCtx).showSnackBar(
          const SnackBar(
            content: Text('Session terminated. This account does not exist or has been suspended.'),
            backgroundColor: Color(0xFFDC2626),
            duration: Duration(seconds: 4),
          ),
        );
      }
    }
  };

  runApp(const BemsStaffApp());
}

class BemsStaffApp extends StatelessWidget {
  const BemsStaffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<SubsidiaryBrand>(
      valueListenable: SubsidiaryTheme.notifier,
      builder: (context, brand, _) {
        final primaryColor = brand.color;
        final secondaryColor = Color.lerp(primaryColor, Colors.white, 0.25) ?? primaryColor;
        final appTitle = brand.name.isNotEmpty && brand.name != 'Staff Workspace'
            ? '${brand.name} Staff'
            : 'Staff Workspace';
        return MaterialApp(
          navigatorKey: staffNavigatorKey,
          title: appTitle,
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            brightness: Brightness.light,
            scaffoldBackgroundColor: const Color(0xFFF8FAFC),
            colorScheme: ColorScheme.light(
              primary: primaryColor,
              secondary: secondaryColor,
              surface: Colors.white,
              error: const Color(0xFFEF4444),
            ),
            cardColor: Colors.white,
            dividerColor: const Color(0xFFE2E8F0),
            textTheme: GoogleFonts.plusJakartaSansTextTheme(ThemeData.light().textTheme),
            appBarTheme: const AppBarTheme(
              backgroundColor: Colors.white,
              elevation: 0,
              iconTheme: IconThemeData(color: Color(0xFF0F172A)),
              titleTextStyle: TextStyle(
                color: Color(0xFF0F172A),
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          home: const StaffSplashScreen(),
        );
      },
    );
  }
}
