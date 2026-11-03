import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'chat_storage_service.dart';

class BemiVoiceService {
  static const MethodChannel _channel = MethodChannel('com.bemsgroup.bems_gmd_ai/tts');
  static final ValueNotifier<bool> isSpeaking = ValueNotifier<bool>(false);
  static bool _initialized = false;
  static Timer? _fallbackTimer;

  static void _ensureInitialized() {
    if (_initialized) return;
    _initialized = true;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onSpeakingStateChanged') {
        final args = call.arguments;
        if (args is Map) {
          final speaking = args['isSpeaking'] == true;
          isSpeaking.value = speaking;
          if (!speaking) {
            _fallbackTimer?.cancel();
          }
        }
      }
    });
  }

  static String buildWelcomeGreeting({
    required String userName,
    String businessName = 'BEMS Group',
  }) {
    final trimmed = userName.trim();
    final displayName = trimmed.isNotEmpty ? trimmed : 'Dr Pastra';
    return 'Welcome $displayName. My name is BEMi, your Executive Assistant. '
        'This is the $businessName workspace. '
        'Click on continue to dashboard to proceed and view your intelligence and expenditure insights for today.';
  }

  static Future<void> speakWelcomeGreeting({
    required String userName,
    String businessName = 'BEMS Group',
    bool force = false,
  }) async {
    final text = buildWelcomeGreeting(userName: userName, businessName: businessName);
    await speak(text, force: force);
  }

  static Future<void> speak(String text, {bool force = false}) async {
    _ensureInitialized();
    final enabled = await ChatStorageService.isVoiceWelcomeEnabled();
    if (!enabled && !force) return;

    final rate = await ChatStorageService.getVoiceRate();
    final pitch = await ChatStorageService.getVoicePitch();
    final persona = await ChatStorageService.getVoicePersona();

    try {
      isSpeaking.value = true;
      _fallbackTimer?.cancel();
      // Estimate duration as a safety fallback in case platform callback is delayed
      final wordCount = text.split(RegExp(r'\s+')).length;
      final estimatedMs = ((wordCount / 2.3) * 1000).clamp(3500, 18000).toInt();
      _fallbackTimer = Timer(Duration(milliseconds: estimatedMs), () {
        isSpeaking.value = false;
      });

      await _channel.invokeMethod('speak', {
        'text': text,
        'rate': rate,
        'pitch': pitch,
        'persona': persona,
      });
    } catch (_) {
      // Keep visual speaking state active for a few seconds if running in simulator without TTS engine
      _fallbackTimer?.cancel();
      _fallbackTimer = Timer(const Duration(seconds: 6), () {
        isSpeaking.value = false;
      });
    }
  }

  static Future<void> stop() async {
    _ensureInitialized();
    _fallbackTimer?.cancel();
    isSpeaking.value = false;
    try {
      await _channel.invokeMethod('stop');
    } catch (_) {}
  }
}

