import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../models/staff_models.dart';

class SubsidiaryBrand {
  final String id;
  final String name;
  final String code;
  final String type;
  final Color color;
  final String? logoUrl;

  const SubsidiaryBrand({
    this.id = '',
    this.name = 'Staff Workspace',
    this.code = '',
    this.type = 'SUBSIDIARY',
    this.color = const Color(0xFFEA580C),
    this.logoUrl,
  });

  String get initials {
    final cleaned = code.replaceFirst(RegExp(r'^BEMS-?', caseSensitive: false), '').trim();
    if (cleaned.isNotEmpty) {
      return cleaned.substring(0, cleaned.length >= 2 ? 2 : 1).toUpperCase();
    }
    final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.length >= 2) {
      return '${words[0][0]}${words[1][0]}'.toUpperCase();
    }
    if (words.isNotEmpty && words[0].isNotEmpty) {
      return words[0].substring(0, words[0].length >= 2 ? 2 : 1).toUpperCase();
    }
    return 'SW';
  }
}

class SubsidiaryTheme {
  static final ValueNotifier<SubsidiaryBrand> notifier =
      ValueNotifier<SubsidiaryBrand>(const SubsidiaryBrand());

  static SubsidiaryBrand get current => notifier.value;

  static Color accent(BuildContext context) {
    return Theme.of(context).colorScheme.primary;
  }

  static Color parseHex(String? hex, {Color fallback = const Color(0xFFEA580C)}) {
    if (hex == null) return fallback;
    final clean = hex.trim().replaceFirst('#', '');
    if (clean.length == 6) {
      final parsed = int.tryParse('FF$clean', radix: 16);
      if (parsed != null) return Color(parsed);
    } else if (clean.length == 8) {
      final parsed = int.tryParse(clean, radix: 16);
      if (parsed != null) return Color(parsed);
    }
    return fallback;
  }

  static void applyUser(StaffUser? user) {
    if (user == null) {
      notifier.value = const SubsidiaryBrand();
      return;
    }
    final resolvedName = user.subsidiary.trim().isNotEmpty
        ? user.subsidiary.trim()
        : 'Staff Workspace';
    notifier.value = SubsidiaryBrand(
      id: user.subsidiaryId,
      name: resolvedName,
      code: user.subsidiaryCode,
      type: user.subsidiaryType.isNotEmpty ? user.subsidiaryType : 'SUBSIDIARY',
      color: parseHex(user.subsidiaryBrandColor),
      logoUrl: user.subsidiaryLogoUrl.trim().isNotEmpty ? user.subsidiaryLogoUrl.trim() : null,
    );
  }

  static String? resolveNetworkLogoUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return null;
    final trimmed = rawUrl.trim();
    // Flutter Image.network cannot decode SVGs directly without an SVG decoder.
    if (trimmed.toLowerCase().split('?').first.endsWith('.svg')) {
      return null;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (kIsWeb) {
      return trimmed.startsWith('/') ? trimmed : '/$trimmed';
    }
    const prodHost = 'https://bemserp.work';
    return trimmed.startsWith('/') ? '$prodHost$trimmed' : '$prodHost/$trimmed';
  }
}

class SubsidiaryLogoBadge extends StatelessWidget {
  final double size;
  final double borderRadius;
  final SubsidiaryBrand? brand;

  const SubsidiaryLogoBadge({
    super.key,
    this.size = 40,
    this.borderRadius = 12,
    this.brand,
  });

  @override
  Widget build(BuildContext context) {
    final activeBrand = brand ?? SubsidiaryTheme.current;
    final resolvedUrl = SubsidiaryTheme.resolveNetworkLogoUrl(activeBrand.logoUrl);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: activeBrand.color.withOpacity(0.25)),
        boxShadow: [
          BoxShadow(
            color: activeBrand.color.withOpacity(0.14),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: resolvedUrl != null
          ? Padding(
              padding: EdgeInsets.all(size * 0.12),
              child: Image.network(
                resolvedUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => _MonogramFallback(brand: activeBrand, size: size),
              ),
            )
          : _MonogramFallback(brand: activeBrand, size: size),
    );
  }
}

class _MonogramFallback extends StatelessWidget {
  final SubsidiaryBrand brand;
  final double size;

  const _MonogramFallback({required this.brand, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [brand.color, brand.color.withOpacity(0.78)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        brand.initials,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w900,
          fontSize: size * 0.36,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}
