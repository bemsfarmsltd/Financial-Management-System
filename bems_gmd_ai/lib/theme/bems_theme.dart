import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class BemsTheme {
  // Backgrounds (Clean light aesthetic matching BEMS Staff App)
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Colors.white;
  static const Color surfaceElevated = Colors.white;
  static const Color surfaceGlass = Color(0xFFF1F5F9);
  static const Color surfaceTintOrange = Color(0xFFFFF7ED);

  // Molten Amber & Electric Orange Palette
  static const Color primary = Color(0xFFEA580C);
  static const Color primaryLight = Color(0xFFFB923C);
  static const Color primaryGlow = Color(0xFFFF8A3D);
  static const Color accentGold = Color(0xFFF59E0B);
  static const Color neonWhite = Color(0xFFFFF7ED);

  // Status & Semantics
  static const Color success = Color(0xFF059669);
  static const Color successBg = Color(0xFFECFDF5);
  static const Color error = Color(0xFFDC2626);
  static const Color errorBg = Color(0xFFFEF2F2);
  static const Color warning = Color(0xFFD97706);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color info = Color(0xFF0284C7);
  static const Color infoBg = Color(0xFFF0F9FF);

  // Borders
  static const Color borderSubtle = Color(0xFFE2E8F0);
  static const Color borderAmber = Color(0xFFFED7AA);

  // Text Colors
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textMuted = Color(0xFF94A3B8);

  // Gradients
  static const LinearGradient amberGradient = LinearGradient(
    colors: [Color(0xFFF97316), Color(0xFFEA580C), Color(0xFFC2410C)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [Colors.white, Color(0xFFFAFAFA)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient executiveHeaderGradient = LinearGradient(
    colors: [Color(0xFFFFF7ED), Colors.white],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      colorScheme: const ColorScheme.light(
        primary: primary,
        secondary: primaryLight,
        surface: surface,
        error: error,
      ),
      cardColor: surface,
      dividerColor: borderSubtle,
      fontFamily: GoogleFonts.plusJakartaSans().fontFamily,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(ThemeData.light().textTheme).copyWith(
        displayLarge: GoogleFonts.plusJakartaSans(fontSize: 32, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: -0.5),
        headlineLarge: GoogleFonts.plusJakartaSans(fontSize: 24, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: -0.3),
        headlineMedium: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w700, color: textPrimary),
        titleLarge: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: textPrimary),
        bodyLarge: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w400, color: textPrimary, height: 1.5),
        bodyMedium: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w400, color: textSecondary, height: 1.4),
        labelSmall: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w700, color: primary, letterSpacing: 0.5),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: textPrimary),
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  // Alias for backward compatibility while routing to light theme
  static ThemeData get darkTheme => lightTheme;
}
