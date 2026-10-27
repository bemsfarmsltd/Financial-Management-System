import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/bems_theme.dart';
import 'screens/bemi_splash_screen.dart';

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
  runApp(const BemsExecutiveAiApp());
}

class BemsExecutiveAiApp extends StatelessWidget {
  const BemsExecutiveAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BEMS Executive - Fund Request & Accountability System',
      debugShowCheckedModeBanner: false,
      theme: BemsTheme.lightTheme,
      home: const BemiSplashScreen(),
    );
  }
}
