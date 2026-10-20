import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class BemsTheme {
  // Backgrounds
  static const Color background = Color(0xFF050811);
  static const Color surface = Color(0xFF0A101D);
  static const Color surfaceElevated = Color(0xFF111B2E);
  static const Color surfaceGlass = Color(0x1AFFFFFF);

  // Molten Amber & Electric Orange Palette
  static const Color primary = Color(0xFFEA580C);
  static const Color primaryLight = Color(0xFFF97316);
  static const Color primaryGlow = Color(0xFFFF8A3D);
  static const Color accentGold = Color(0xFFF59E0B);
  static const Color neonWhite = Color(0xFFFFF7ED);

  // Border & Glows
  static const Color borderSubtle = Color(0x1FFFFFFF);
  static const Color borderAmber = Color(0x40EA580C);

  // Text Colors
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // Gradients
  static const LinearGradient amberGradient = LinearGradient(
    colors: [Color(0xFFF97316), Color(0xFFEA580C), Color(0xFFC2410C)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient glassGradient = LinearGradient(
    colors: [Color(0x1FFFFFFF), Color(0x05FFFFFF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient backgroundRadial = LinearGradient(
    colors: [Color(0xFF180A04), Color(0xFF050811)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      fontFamily: GoogleFonts.outfit().fontFamily,
      textTheme: TextTheme(
        displayLarge: GoogleFonts.outfit(fontSize: 34, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: -0.5),
        headlineLarge: GoogleFonts.outfit(fontSize: 26, fontWeight: FontWeight.w800, color: textPrimary),
        headlineMedium: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w700, color: textPrimary),
        titleLarge: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w700, color: textPrimary),
        bodyLarge: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w400, color: textPrimary, height: 1.5),
        bodyMedium: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w400, color: textSecondary, height: 1.4),
        labelSmall: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w700, color: primaryLight, letterSpacing: 0.8),
      ),
    );
  }
}
