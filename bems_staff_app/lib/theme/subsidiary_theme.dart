import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
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

  static String? resolveMediaUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return null;
    final trimmed = rawUrl.trim();
    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const prodHost = 'https://bemserp.work';
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    if (kIsWeb) {
      try {
        final base = Uri.base;
        final host = base.host.toLowerCase();
        final isErpOrigin =
            host.contains('bemserp.work') ||
            host.contains('hostingersite.com') ||
            ((host == 'localhost' || host == '127.0.0.1') && base.port == 3000);
        if (isErpOrigin) {
          return '${base.origin}$cleanPath';
        }
      } catch (_) {}
    }
    return '$prodHost$cleanPath';
  }

  static String? resolveNetworkLogoUrl(String? rawUrl) => resolveMediaUrl(rawUrl);

  static bool isSvgUrl(String url) {
    final lower = url.toLowerCase();
    if (lower.startsWith('data:image/svg+xml')) return true;
    return lower.split('?').first.endsWith('.svg');
  }

  static Uint8List? decodeDataUriBytes(String dataUri) {
    final commaIdx = dataUri.indexOf(',');
    if (commaIdx < 0 || commaIdx + 1 >= dataUri.length) return null;
    final meta = dataUri.substring(0, commaIdx).toLowerCase();
    final payload = dataUri.substring(commaIdx + 1);
    try {
      if (meta.contains(';base64')) {
        return base64Decode(payload);
      }
      return Uint8List.fromList(utf8.encode(Uri.decodeComponent(payload)));
    } catch (_) {
      return null;
    }
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

  Widget _buildLogoContent(SubsidiaryBrand activeBrand, String resolvedUrl) {
    if (resolvedUrl.startsWith('data:image/')) {
      final bytes = SubsidiaryTheme.decodeDataUriBytes(resolvedUrl);
      if (bytes == null || bytes.isEmpty) {
        return _MonogramFallback(brand: activeBrand, size: size);
      }
      if (SubsidiaryTheme.isSvgUrl(resolvedUrl)) {
        return Padding(
          padding: EdgeInsets.all(size * 0.12),
          child: SvgPicture.memory(
            bytes,
            fit: BoxFit.contain,
            placeholderBuilder: (_) => _MonogramFallback(brand: activeBrand, size: size),
          ),
        );
      }
      return Padding(
        padding: EdgeInsets.all(size * 0.1),
        child: Image.memory(
          bytes,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _MonogramFallback(brand: activeBrand, size: size),
        ),
      );
    }

    if (SubsidiaryTheme.isSvgUrl(resolvedUrl)) {
      return Padding(
        padding: EdgeInsets.all(size * 0.12),
        child: SvgPicture.network(
          resolvedUrl,
          fit: BoxFit.contain,
          placeholderBuilder: (_) => _MonogramFallback(brand: activeBrand, size: size),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.all(size * 0.1),
      child: Image.network(
        resolvedUrl,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => _MonogramFallback(brand: activeBrand, size: size),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final activeBrand = brand ?? SubsidiaryTheme.current;
    final resolvedUrl = SubsidiaryTheme.resolveMediaUrl(activeBrand.logoUrl);

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
          ? _buildLogoContent(activeBrand, resolvedUrl)
          : _MonogramFallback(brand: activeBrand, size: size),
    );
  }
}

class StaffAvatar extends StatelessWidget {
  final String? avatarUrl;
  final String fullName;
  final double radius;
  final Color? accentColor;

  const StaffAvatar({
    super.key,
    required this.avatarUrl,
    required this.fullName,
    this.radius = 24,
    this.accentColor,
  });

  String get _initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty && parts[0].isNotEmpty) return parts[0][0].toUpperCase();
    return 'S';
  }

  @override
  Widget build(BuildContext context) {
    final color = accentColor ?? SubsidiaryTheme.current.color;
    final resolvedUrl = SubsidiaryTheme.resolveMediaUrl(avatarUrl);
    final diameter = radius * 2;

    Widget fallback() => Container(
          width: diameter,
          height: diameter,
          color: color.withOpacity(0.12),
          alignment: Alignment.center,
          child: Text(
            _initials,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w900,
              fontSize: radius * 0.72,
            ),
          ),
        );

    Widget content;
    if (resolvedUrl == null) {
      content = fallback();
    } else if (resolvedUrl.startsWith('data:image/')) {
      final bytes = SubsidiaryTheme.decodeDataUriBytes(resolvedUrl);
      content = (bytes != null && bytes.isNotEmpty)
          ? Image.memory(
              bytes,
              width: diameter,
              height: diameter,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => fallback(),
            )
          : fallback();
    } else {
      content = Image.network(
        resolvedUrl,
        width: diameter,
        height: diameter,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => fallback(),
      );
    }

    return ClipOval(
      child: SizedBox(
        width: diameter,
        height: diameter,
        child: content,
      ),
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
