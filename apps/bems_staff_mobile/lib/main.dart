import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'core/constants.dart';
import 'screens/main_shell_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BemsStaffApp());
}

class BemsStaffApp extends StatelessWidget {
  const BemsStaffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: BemsTheme.lightTheme, // Clean white canvas & cobalt blue design
      home: const MainShellScreen(),
    );
  }
}
