import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/staff_splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF04060C),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const BemsStaffApp());
}

class BemsStaffApp extends StatelessWidget {
  const BemsStaffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BEMS Staff',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF04060C),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFEA580C),
          secondary: Color(0xFFFB923C),
          surface: Color(0xFF0A0F1D),
          error: Color(0xFFEF4444),
        ),
        textTheme: GoogleFonts.plusJakartaSansTextTheme(ThemeData.dark().textTheme),
      ),
      home: const StaffSplashScreen(),
    );
  }
}
