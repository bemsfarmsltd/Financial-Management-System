import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/bems_theme.dart';
import 'screens/bemi_splash_screen.dart';
import 'screens/app_upgrade_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';
import 'services/chat_storage_service.dart';

final GlobalKey<NavigatorState> gmdNavigatorKey = GlobalKey<NavigatorState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  // Global HTTP 426 (Upgrade Required) live listener
  ApiService.onUpgradeRequired = (info) {
    final context = gmdNavigatorKey.currentContext;
    if (context != null) {
      gmdNavigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => AppUpgradeScreen(
            currentVersion: ApiService.appVersion,
            requiredVersion: info['minimumAllowedVersion']?.toString() ?? '1.0.1',
            downloadUrl: info['directDownloadUrl']?.toString() ?? 'https://bemserp.work/download/gmd-app.apk',
            notes: info['upgradePromptNotes']?.toString() ?? 'A critical update is required to continue.',
          ),
        ),
        (route) => false,
      );
    }
  };

  // Global HTTP 401/403 (User Suspended or Deleted) live listener
  ApiService.onSessionInvalidated = () async {
    await ChatStorageService.clearUser();
    final currentState = gmdNavigatorKey.currentState;
    if (currentState != null) {
      currentState.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
      final currentCtx = gmdNavigatorKey.currentContext;
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

  runApp(const BemsExecutiveAiApp());
}

class BemsExecutiveAiApp extends StatelessWidget {
  const BemsExecutiveAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: gmdNavigatorKey,
      title: 'BEMS Executive - Fund Request & Accountability System',
      debugShowCheckedModeBanner: false,
      theme: BemsTheme.lightTheme,
      home: const BemiSplashScreen(),
    );
  }
}
