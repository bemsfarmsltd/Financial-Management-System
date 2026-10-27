import 'package:flutter/material.dart';
import '../models/auth_models.dart';
import '../models/chat_models.dart';
import '../services/chat_storage_service.dart';
import '../screens/login_screen.dart';
import '../screens/executive_chat_screen.dart';
import '../screens/gmd_profile_screen.dart';

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
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            // Drawer Header with "+ New Chat"
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
                        'New Executive Chat',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const Divider(color: Color(0xFFE2E8F0), height: 1),

            // Sessions List Header
            const Padding(
              padding: EdgeInsets.fromLTRB(18, 14, 18, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'BEMi STRATEGIC SESSIONS',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                    color: Color(0xFF64748B),
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
                      ? const Center(
                          child: Text(
                            'No previous conversations',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          itemCount: _sessions.length,
                          itemBuilder: (context, index) {
                            final session = _sessions[index];
                            final isActive = session.id == widget.activeSessionId;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 5),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? const Color(0xFFFFF7ED)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                                border: isActive
                                    ? Border.all(color: const Color(0xFFFED7AA))
                                    : null,
                              ),
                              child: ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                                leading: Icon(
                                  Icons.chat_bubble_outline_rounded,
                                  size: 16,
                                  color: isActive ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                                ),
                                title: Text(
                                  session.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w600,
                                    color: isActive ? const Color(0xFF9A3412) : const Color(0xFF0F172A),
                                  ),
                                ),
                                subtitle: Text(
                                  session.updatedAt,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: Color(0xFF94A3B8),
                                  ),
                                ),
                                trailing: IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 14, color: Color(0xFF94A3B8)),
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

            // Profile & Fingerprint Security Tile
            InkWell(
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const GmdProfileScreen()),
                );
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFDBA74)),
                      ),
                      child: const Icon(Icons.fingerprint_rounded, size: 18, color: Color(0xFFEA580C)),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Profile & Fingerprint Security',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Color(0xFF94A3B8)),
                  ],
                ),
              ),
            ),

            const Divider(color: Color(0xFFE2E8F0), height: 1),

            // Bottom Profile / Sign Out
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const GmdProfileScreen()),
                      );
                    },
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFFEA580C), Color(0xFFC2410C)],
                        ),
                        border: Border.all(color: const Color(0xFFFED7AA)),
                      ),
                      child: const Center(
                        child: Text(
                          'GMD',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const GmdProfileScreen()),
                        );
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.user?.fullName ?? 'Group Managing Director',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          Text(
                            widget.user?.role ?? 'Group Managing Director',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 20),
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
