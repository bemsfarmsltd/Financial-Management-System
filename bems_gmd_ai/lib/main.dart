import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/bems_theme.dart';
import 'services/chat_storage_service.dart';
import 'screens/login_screen.dart';
import 'screens/welcome_entry_screen.dart';
import 'screens/executive_home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF050811),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const BemsExecutiveAiApp());
}

class BemsExecutiveAiApp extends StatelessWidget {
  const BemsExecutiveAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BEMS Executive AI',
      debugShowCheckedModeBanner: false,
      theme: BemsTheme.darkTheme,
      home: const AppRoot(),
    );
  }
}

class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  Widget? _initialScreen;

  @override
  void initState() {
    super.initState();
    _determineInitialScreen();
  }

  Future<void> _determineInitialScreen() async {
    final user = await ChatStorageService.getUser();
    if (user == null) {
      if (mounted) {
        setState(() => _initialScreen = const LoginScreen());
      }
      return;
    }

    final hasSeen = await ChatStorageService.hasSeenWelcome();
    if (mounted) {
      if (!hasSeen) {
        setState(() => _initialScreen = WelcomeEntryScreen(userName: user.fullName));
      } else {
        setState(() => _initialScreen = ExecutiveHomeScreen(userName: user.fullName));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_initialScreen != null) {
      return _initialScreen!;
    }

    // Splash loading screen
    return const Scaffold(
      backgroundColor: Color(0xFF04060C),
      body: Center(
        child: SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: Color(0xFFEA580C),
          ),
        ),
      ),
    );
  }
}
