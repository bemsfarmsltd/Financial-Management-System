import 'dart:async';
import 'package:flutter/material.dart';
import 'api_service.dart';
import '../screens/gmd_staff_chat_screen.dart';

class InAppChatNotificationService {
  static final InAppChatNotificationService _instance = InAppChatNotificationService._internal();
  factory InAppChatNotificationService() => _instance;
  InAppChatNotificationService._internal();

  Timer? _timer;
  int _lastUnreadCount = 0;
  int get unreadCount => _lastUnreadCount;
  String? _lastMessageId;
  BuildContext? _currentContext;

  void setContext(BuildContext context) {
    _currentContext = context;
  }

  void start() {
    _timer?.cancel();
    _checkUnread();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _checkUnread());
  }

  void stop() {
    _timer?.cancel();
  }

  Future<void> _checkUnread() async {
    try {
      final info = await ApiService.fetchUnreadChatInfo();
      final unreadCount = (info['unreadCount'] as int?) ?? 0;
      final latest = info['latestMessage'] as Map<String, dynamic>?;

      if (latest != null) {
        final messageId = latest['id']?.toString();
        // If there is a new unread message that we haven't popped yet
        if (unreadCount > 0 && messageId != _lastMessageId && _currentContext != null) {
          _lastMessageId = messageId;
          _lastUnreadCount = unreadCount;
          _showInAppBanner(latest);
        }
      } else {
        _lastUnreadCount = unreadCount;
      }
    } catch (_) {}
  }

  void _showInAppBanner(Map<String, dynamic> msg) {
    final ctx = _currentContext;
    if (ctx == null) return;

    final senderName = msg['senderName'] ?? msg['employeeName'] ?? 'Staff Member';
    final text = msg['message']?.toString() ?? 'New message';
    final employeeId = msg['employeeId']?.toString();

    ScaffoldMessenger.of(ctx).hideCurrentSnackBar();
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFEA580C), width: 1.5),
        ),
        duration: const Duration(seconds: 6),
        content: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFEA580C),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chat_bubble_rounded, color: Colors.white, size: 16),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Direct Message: $senderName',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    text,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
          ],
        ),
        action: SnackBarAction(
          label: 'Reply →',
          textColor: const Color(0xFFFB923C),
          onPressed: () {
            if (employeeId != null) {
              Navigator.of(ctx).push(
                MaterialPageRoute(
                  builder: (_) => GmdStaffChatScreen(
                    targetEmployeeId: employeeId,
                    targetEmployeeName: senderName,
                  ),
                ),
              );
            }
          },
        ),
      ),
    );
  }
}
