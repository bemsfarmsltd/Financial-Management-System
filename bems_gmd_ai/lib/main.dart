import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/bems_theme.dart';
import 'screens/studio_showcase_screen.dart';

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
      home: const StudioShowcaseScreen(),
    );
  }
}
