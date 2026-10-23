import 'package:flutter/material.dart';
import '../models/auth_models.dart';
import '../models/chat_models.dart';
import '../services/chat_storage_service.dart';
import '../screens/login_screen.dart';
import '../screens/executive_chat_screen.dart';

class ChatHistoryDrawer extends StatefulWidget {
  final AuthUser? user;
  final String? activeSessionId;
  final Function(ChatSession)? onSelectSession;
  final VoidCallback? onNewChat;

  const ChatHistoryDrawer({
    super.key,
    this.user,
    this.activeSessionId,
    this.onSelectSession,
    this.onNewChat,
  });

  @override
  State<ChatHistoryDrawer> createState() => _ChatHistoryDrawerState();
}

class _ChatHistoryDrawerState extends State<ChatHistoryDrawer> {
  List<ChatSession> _sessions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    final list = await ChatStorageService.getSessions();
    if (mounted) {
      setState(() {
        _sessions = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleDeleteSession(String id) async {
    await ChatStorageService.deleteSession(id);
    await _loadSessions();
  }

  void _handleSignOut() async {
    await ChatStorageService.clearUser();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFF070B14),
      child: SafeArea(
        child: Column(
          children: [
            // Drawer Header with "+ New Chat"
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context); // close drawer
                        if (widget.onNewChat != null) {
                          widget.onNewChat!();
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ExecutiveChatScreen(),
                            ),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEA580C),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.add_rounded, size: 20),
                      label: const Text(
                        'New Chat',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const Divider(color: Colors.white12, height: 1),

            // Sessions List Header
            const Padding(
              padding: EdgeInsets.fromLTRB(18, 14, 18, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'BEMi CHAT HISTORY',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: Color(0xFF94A3B8),
                  ),
                ),
              ),
            ),

            // Sessions List
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Color(0xFFEA580C),
                      ),
                    )
                  : _sessions.isEmpty
                      ? Center(
                          child: Text(
                            'No previous conversations',
                            style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          itemCount: _sessions.length,
                          itemBuilder: (context, index) {
                            final session = _sessions[index];
                            final isActive = session.id == widget.activeSessionId;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 4),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? const Color(0xFFEA580C).withOpacity(0.18)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                                border: isActive
                                    ? Border.all(color: const Color(0xFFEA580C).withOpacity(0.4))
                                    : null,
                              ),
                              child: ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                                leading: Icon(
                                  Icons.chat_bubble_outline_rounded,
                                  size: 16,
                                  color: isActive ? const Color(0xFFF97316) : Colors.white60,
                                ),
                                title: Text(
                                  session.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                                    color: isActive ? Colors.white : Colors.white70,
                                  ),
                                ),
                                subtitle: Text(
                                  session.updatedAt,
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.white.withOpacity(0.35),
                                  ),
                                ),
                                trailing: IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 14, color: Colors.white30),
                                  onPressed: () => _handleDeleteSession(session.id),
                                ),
                                onTap: () {
                                  Navigator.pop(context); // close drawer
                                  if (widget.onSelectSession != null) {
                                    widget.onSelectSession!(session);
                                  } else {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => ExecutiveChatScreen(initialSession: session),
                                      ),
                                    );
                                  }
                                },
                              ),
                            );
                          },
                        ),
            ),

            const Divider(color: Colors.white12, height: 1),

            // Bottom Profile / Sign Out
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Color(0xFFEA580C), Color(0xFF9A3412)],
                      ),
                    ),
                    child: const Center(
                      child: Text(
                        'BG',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.user?.fullName ?? 'Executive',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          widget.user?.role ?? 'GMD',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withOpacity(0.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.logout_rounded, color: Colors.white60, size: 20),
                    tooltip: 'Sign Out',
                    onPressed: _handleSignOut,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
