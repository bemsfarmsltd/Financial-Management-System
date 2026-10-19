import 'package:flutter/material.dart';

class BemsTheme {
  // Brand color tokens inspired by Finance & TripGlide mockups
  static const Color background = Color(0xFFF8FAFC); // Clean light canvas
  static const Color surface = Color(0xFFFFFFFF); // Pure white card
  static const Color surfaceLight = Color(0xFFFFF7ED); // Warm orange tint surface
  static const Color surfaceMuted = Color(0xFFF1F5F9); // Light pill grey
  static const Color cardBorder = Color(0xFFE2E8F0); // Subtle crisp border

  // Official BEMS Group Brand Palette (Vibrant Orange & Warm Copper)
  static const Color brandOrange = Color(0xFFF97316); // Official BEMS Group Vibrant Orange
  static const Color brandOrangeDark = Color(0xFFEA580C);
  static const Color brandOrangeLight = Color(0xFFFB923C);
  static const Color brandOrangeSubtle = Color(0xFFFFF7ED); // Warm cream highlight
  static const Color brandOrangeBorder = Color(0xFFFFEDD5);

  // Mapped primary accents to blend seamlessly with the brand color
  static const Color primaryAccent = brandOrange;
  static const Color primaryBlue = brandOrange;
  static const Color primaryBlueLight = brandOrangeDark;
  static const Color primaryCobalt = brandOrange; // Remapped to brand orange
  static const Color primaryCobaltLight = brandOrangeLight;
  static const Color cobaltDark = Color(0xFF0F172A);

  static const Color successEmerald = Color(0xFF10B981);
  static const Color warningAmber = Color(0xFFF59E0B);
  static const Color errorRose = Color(0xFFF43F5E);

  // Typography Tokens
  static const Color textPrimary = Color(0xFF0F172A); // Deep charcoal black
  static const Color textSecondary = Color(0xFF64748B); // Muted slate
  static const Color textMuted = Color(0xFF94A3B8); // Light slate

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: background,
      primaryColor: brandOrange,
      colorScheme: const ColorScheme.light(
        primary: brandOrange,
        secondary: brandOrangeLight,
        surface: surface,
        error: errorRose,
        onPrimary: Colors.white,
        onSurface: textPrimary,
      ),
      cardTheme: CardTheme(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: cardBorder, width: 1.0),
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: background,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.4,
        ),
        iconTheme: IconThemeData(color: textPrimary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: textPrimary, // Sleek black button like TripGlide
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.1,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: cardBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: primaryCobalt, width: 1.5),
        ),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 13),
        hintStyle: const TextStyle(color: textMuted, fontSize: 13),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      ),
    );
  }
}
