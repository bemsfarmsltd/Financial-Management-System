import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class GmdStaffChatScreen extends StatefulWidget {
  final String? targetEmployeeId;
  final String? targetEmployeeName;
  final String? targetEmployeeNumber;

  const GmdStaffChatScreen({
    super.key,
    this.targetEmployeeId,
    this.targetEmployeeName,
    this.targetEmployeeNumber,
  });

  @override
  State<GmdStaffChatScreen> createState() => _GmdStaffChatScreenState();
}

class _GmdStaffChatScreenState extends State<GmdStaffChatScreen> {
  // If targetEmployeeId is passed, we show direct conversation
  late bool _isDirectThread;
  String? _activeEmployeeId;
  String? _activeEmployeeName;
  String? _activeEmployeeNumber;

  // Thread list state
  bool _isLoadingThreads = false;
  List<dynamic> _threads = [];
  String _threadSearchQuery = '';

  // Direct conversation state
  bool _isLoadingMessages = false;
  List<dynamic> _messages = [];
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isSending = false;
  Timer? _pollingTimer;

  // New Chat Staff Picker
  List<dynamic> _allStaff = [];

  @override
  void initState() {
    super.initState();
    _isDirectThread = widget.targetEmployeeId != null;
    _activeEmployeeId = widget.targetEmployeeId;
    _activeEmployeeName = widget.targetEmployeeName;
    _activeEmployeeNumber = widget.targetEmployeeNumber;

    if (_isDirectThread && _activeEmployeeId != null) {
      _loadConversation();
      _startPolling();
    } else {
      _loadThreads();
      _loadStaffDirectory();
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted && _activeEmployeeId != null) {
        _loadConversation(silent: true);
      }
    });
  }

  Future<void> _loadThreads() async {
    setState(() => _isLoadingThreads = true);
    final threads = await ApiService.fetchStaffChatThreads();
    if (mounted) {
      setState(() {
        _threads = threads;
        _isLoadingThreads = false;
      });
    }
  }

  Future<void> _loadStaffDirectory() async {
    try {
      final staff = await ApiService.fetchStaffDirectory();
      if (mounted) {
        setState(() => _allStaff = staff);
      }
    } catch (_) {}
  }

  Future<void> _loadConversation({bool silent = false}) async {
    if (_activeEmployeeId == null) return;
    if (!silent) setState(() => _isLoadingMessages = true);
    try {
      final data = await ApiService.fetchStaffChatMessages(_activeEmployeeId!);
      if (mounted) {
        final msgs = (data['messages'] as List<dynamic>?) ?? [];
        final emp = data['employee'] as Map<String, dynamic>?;
        setState(() {
          _messages = msgs;
          if (emp != null) {
            _activeEmployeeName = emp['legalName'] ?? _activeEmployeeName;
            _activeEmployeeNumber = emp['employeeNumber'] ?? _activeEmployeeNumber;
          }
          _isLoadingMessages = false;
        });
        if (!silent) {
          _scrollToBottom();
        }
      }
    } catch (_) {
      if (mounted && !silent) {
        setState(() => _isLoadingMessages = false);
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _activeEmployeeId == null || _isSending) return;

    setState(() => _isSending = true);
    _messageController.clear();

    try {
      final res = await ApiService.sendStaffChatMessage(
        employeeId: _activeEmployeeId!,
        message: text,
      );
      if (mounted) {
        final newMsg = res['message'];
        if (newMsg != null) {
          setState(() {
            _messages.add(newMsg);
          });
          _scrollToBottom();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _openThread(String employeeId, String employeeName, String? employeeNumber) {
    setState(() {
      _isDirectThread = true;
      _activeEmployeeId = employeeId;
      _activeEmployeeName = employeeName;
      _activeEmployeeNumber = employeeNumber;
      _messages = [];
    });
    _loadConversation();
    _startPolling();
  }

  void _closeDirectThread() {
    _pollingTimer?.cancel();
    setState(() {
      _isDirectThread = false;
      _activeEmployeeId = null;
      _activeEmployeeName = null;
      _activeEmployeeNumber = null;
      _messages = [];
    });
    _loadThreads();
  }

  void _showNewChatPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filtered = _allStaff.where((s) {
              final q = query.trim().toLowerCase();
              if (q.isEmpty) return true;
              final name = (s['legalName'] ?? '').toString().toLowerCase();
              final role = (s['role'] ?? '').toString().toLowerCase();
              final num = (s['employeeNumber'] ?? '').toString().toLowerCase();
              return name.contains(q) || role.contains(q) || num.contains(q);
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Direct Message Staff',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    onChanged: (val) => setModalState(() => query = val),
                    decoration: InputDecoration(
                      hintText: 'Search staff by name or employee number…',
                      hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                      prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF94A3B8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    style: const TextStyle(fontSize: 12.5),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(child: Text('No matching staff members found.', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)))
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                            itemBuilder: (_, idx) {
                              final staff = filtered[idx];
                              final empId = staff['id']?.toString() ?? '';
                              final name = staff['legalName'] ?? 'Staff';
                              final role = staff['role'] ?? 'STAFF';
                              final num = staff['employeeNumber'] ?? '';

                              return ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                leading: CircleAvatar(
                                  backgroundColor: const Color(0xFFEA580C).withOpacity(0.12),
                                  child: Text(name.isNotEmpty ? name[0] : 'S', style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                                ),
                                title: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                                subtitle: Text('$role · $num', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFF94A3B8)),
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _openThread(empId, name, num);
                                },
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isDirectThread) {
      return _buildDirectChatView();
    }
    return _buildThreadListView();
  }

  // --- THREAD LIST VIEW ---
  Widget _buildThreadListView() {
    final filteredThreads = _threads.where((t) {
      final q = _threadSearchQuery.trim().toLowerCase();
      if (q.isEmpty) return true;
      final emp = t['employee'] as Map<String, dynamic>?;
      final name = (emp?['legalName'] ?? '').toString().toLowerCase();
      final num = (emp?['employeeNumber'] ?? '').toString().toLowerCase();
      return name.contains(q) || num.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Staff Direct Desk', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B), size: 20),
            onPressed: _loadThreads,
          ),
          const SizedBox(width: 4),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFEA580C),
        icon: const Icon(Icons.edit_note_rounded, color: Colors.white),
        label: const Text('Message Staff', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 12.5)),
        onPressed: _showNewChatPicker,
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: TextField(
              onChanged: (val) => setState(() => _threadSearchQuery = val),
              decoration: InputDecoration(
                hintText: 'Search conversations…',
                hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF94A3B8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
              style: const TextStyle(fontSize: 12.5),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          Expanded(
            child: _isLoadingThreads
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
                : filteredThreads.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.chat_bubble_outline_rounded, size: 48, color: Color(0xFF94A3B8)),
                            SizedBox(height: 10),
                            Text('No staff conversations yet.', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF334155))),
                            SizedBox(height: 4),
                            Text('Tap "Message Staff" to send an instant directive.', style: TextStyle(color: Color(0xFF64748B), fontSize: 11.5)),
                          ],
                        ),
                      )
                    : ListView.separated(
                        itemCount: filteredThreads.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        itemBuilder: (ctx, idx) {
                          final item = filteredThreads[idx];
                          final emp = (item['employee'] as Map<String, dynamic>?) ?? {};
                          final lastMsg = (item['lastMessage'] as Map<String, dynamic>?) ?? {};
                          final unread = (item['unreadCount'] as int?) ?? 0;

                          final empId = emp['id']?.toString() ?? '';
                          final name = emp['legalName'] ?? 'Staff Member';
                          final num = emp['employeeNumber'] ?? '';
                          final msgText = lastMsg['message'] ?? '';
                          final createdStr = lastMsg['createdAt']?.toString();

                          String timeDisplay = '';
                          if (createdStr != null) {
                            try {
                              final dt = DateTime.parse(createdStr).toLocal();
                              timeDisplay = DateFormat('hh:mm a').format(dt);
                            } catch (_) {}
                          }

                          return InkWell(
                            onTap: () => _openThread(empId, name, num),
                            child: Container(
                              color: unread > 0 ? const Color(0xFFFFF7ED) : Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 22,
                                    backgroundColor: unread > 0 ? const Color(0xFFEA580C) : const Color(0xFFF1F5F9),
                                    child: Text(
                                      name.isNotEmpty ? name[0] : 'S',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        color: unread > 0 ? Colors.white : const Color(0xFF0F172A),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              name,
                                              style: TextStyle(
                                                fontSize: 13.5,
                                                fontWeight: unread > 0 ? FontWeight.w900 : FontWeight.w700,
                                                color: const Color(0xFF0F172A),
                                              ),
                                            ),
                                            Text(timeDisplay, style: TextStyle(fontSize: 10.5, color: unread > 0 ? const Color(0xFFEA580C) : const Color(0xFF94A3B8))),
                                          ],
                                        ),
                                        const SizedBox(height: 3),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                msgText,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: unread > 0 ? FontWeight.w700 : FontWeight.w500,
                                                  color: unread > 0 ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                                                ),
                                              ),
                                            ),
                                            if (unread > 0)
                                              Container(
                                                margin: const EdgeInsets.only(left: 6),
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFEA580C),
                                                  borderRadius: BorderRadius.circular(10),
                                                ),
                                                child: Text(
                                                  '$unread',
                                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                                                ),
                                              ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  // --- DIRECT CONVERSATION VIEW ---
  Widget _buildDirectChatView() {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _activeEmployeeName ?? 'Staff Member',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: Color(0xFF0F172A)),
            ),
            Text(
              _activeEmployeeNumber != null ? 'Staff ID: ${_activeEmployeeNumber!}' : 'Conglomerate Staff',
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
          onPressed: () {
            if (widget.targetEmployeeId != null) {
              Navigator.pop(context);
            } else {
              _closeDirectThread();
            }
          },
        ),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoadingMessages
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFEA580C)))
                : _messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.send_rounded, size: 40, color: Color(0xFF94A3B8)),
                            const SizedBox(height: 10),
                            Text(
                              'Start conversation with ${_activeEmployeeName ?? "Staff"}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'The staff member will receive an in-app notification.',
                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        itemCount: _messages.length,
                        itemBuilder: (ctx, idx) {
                          final msg = _messages[idx];
                          final senderRole = msg['senderRole']?.toString().toUpperCase() ?? 'STAFF';
                          final isGmd = senderRole == 'GMD' || senderRole == 'SYSTEM_ADMIN' || senderRole == 'SUPER_ADMIN';
                          final text = msg['message'] ?? '';
                          final createdStr = msg['createdAt']?.toString();

                          String time = '';
                          if (createdStr != null) {
                            try {
                              time = DateFormat('hh:mm a').format(DateTime.parse(createdStr).toLocal());
                            } catch (_) {}
                          }

                          return Align(
                            alignment: isGmd ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                              decoration: BoxDecoration(
                                color: isGmd ? const Color(0xFF0F172A) : Colors.white,
                                borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(14),
                                  topRight: const Radius.circular(14),
                                  bottomLeft: Radius.circular(isGmd ? 14 : 2),
                                  bottomRight: Radius.circular(isGmd ? 2 : 14),
                                ),
                                border: Border.all(
                                  color: isGmd ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.03),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: isGmd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                children: [
                                  if (!isGmd)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        _activeEmployeeName ?? 'Staff',
                                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                                      ),
                                    ),
                                  Text(
                                    text,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: isGmd ? Colors.white : const Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    time,
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      color: isGmd ? const Color(0xFF94A3B8) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
          // Input bar
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: 'Type message to staff…',
                        hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                      style: const TextStyle(fontSize: 13),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: const BoxDecoration(color: Color(0xFFEA580C), shape: BoxShape.circle),
                    child: IconButton(
                      icon: _isSending
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                      onPressed: _isSending ? null : _sendMessage,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
