import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/staff_models.dart';
import 'staff_api_service.dart';

class StaffNotificationService {
  static final StaffNotificationService _instance = StaffNotificationService._internal();
  factory StaffNotificationService() => _instance;
  StaffNotificationService._internal();

  final FlutterLocalNotificationsPlugin _localPlugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;
  Timer? _periodicSyncTimer;

  static const String channelId = 'bems_staff_alerts';
  static const String channelName = 'Workspace Alerts & Dispatches';
  static const String channelDesc = 'Real-time notifications for fund requisitions, wallet disbursements, approvals, and attendance.';

  /// Initialize native notification channels and permissions
  Future<void> initialize() async {
    if (_isInitialized) return;

    if (kIsWeb) {
      _isInitialized = true;
      return;
    }

    try {
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const darwinSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: darwinSettings,
        macOS: darwinSettings,
      );

      await _localPlugin.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (response) {
          debugPrint('[NotificationService] Tapped notification payload: ${response.payload}');
        },
      );

      // Create Android Notification Channel
      final androidPlatform = _localPlugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlatform != null) {
        await androidPlatform.createNotificationChannel(
          const AndroidNotificationChannel(
            channelId,
            channelName,
            description: channelDesc,
            importance: Importance.max,
            playSound: true,
            enableVibration: true,
          ),
        );

        // Request POST_NOTIFICATIONS permission on Android 13+
        await androidPlatform.requestNotificationsPermission();
      }

      _isInitialized = true;
      debugPrint('[NotificationService] Native local notifications initialized successfully.');
    } catch (e) {
      debugPrint('[NotificationService] Initialization error: $e');
    }
  }

  /// Post a phone system notification directly into the phone tray / status bar
  Future<void> showPhoneNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (kIsWeb) return;
    if (!_isInitialized) await initialize();

    try {
      final androidDetails = AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: channelDesc,
        importance: Importance.max,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
        playSound: true,
        enableVibration: true,
        styleInformation: BigTextStyleInformation(
          body,
          contentTitle: title,
          summaryText: 'Staff Workspace',
        ),
      );

      const darwinDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      final details = NotificationDetails(
        android: androidDetails,
        iOS: darwinDetails,
        macOS: darwinDetails,
      );

      await _localPlugin.show(id, title, body, details, payload: payload);
      debugPrint('[NotificationService] System notification posted: "$title" - "$body"');
    } catch (e) {
      debugPrint('[NotificationService] Failed to show system notification: $e');
    }
  }

  /// Sync notifications from backend and trigger phone notification for any new unread item
  Future<void> syncAndNotify(StaffUser user) async {
    try {
      final notifications = await StaffApiService.fetchNotifications(
        employeeId: user.id,
        token: user.token,
      );

      if (notifications.isEmpty) return;

      final prefs = await SharedPreferences.getInstance();
      final storedLastId = prefs.getString('bems_last_notified_notification_id');

      // If first run, remember current top without spamming historical items
      if (storedLastId == null) {
        final newestId = notifications.first['id']?.toString();
        if (newestId != null) {
          await prefs.setString('bems_last_notified_notification_id', newestId);
        }
        return;
      }

      // Check for incoming notifications that are newer than storedLastId
      for (final n in notifications) {
        final nid = n['id']?.toString() ?? '';
        if (nid == storedLastId) {
          break; // reached previously notified items
        }

        final title = n['title']?.toString() ?? 'Workspace Notification';
        final body = n['body']?.toString() ?? (n['message']?.toString() ?? 'You have a new update.');
        final notificationHash = nid.hashCode.abs();

        await showPhoneNotification(
          id: notificationHash,
          title: title,
          body: body,
          payload: nid,
        );
      }

      // Update stored latest notification ID
      final newest = notifications.first['id']?.toString();
      if (newest != null && newest != storedLastId) {
        await prefs.setString('bems_last_notified_notification_id', newest);
      }
    } catch (e) {
      debugPrint('[NotificationService] syncAndNotify error: $e');
    }
  }

  /// Start periodic background polling for incoming notifications
  void startPeriodicSync(StaffUser user, {Duration interval = const Duration(seconds: 45)}) {
    _periodicSyncTimer?.cancel();
    // Run immediate check
    syncAndNotify(user);
    // Recurring timer
    _periodicSyncTimer = Timer.periodic(interval, (_) => syncAndNotify(user));
  }

  /// Stop periodic background polling
  void stopPeriodicSync() {
    _periodicSyncTimer?.cancel();
    _periodicSyncTimer = null;
  }
}
