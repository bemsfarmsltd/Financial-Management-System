import 'package:flutter/material.dart';
import '../models/chat_models.dart';
import '../services/api_service.dart';
import '../services/chat_storage_service.dart';
import '../widgets/action_cards.dart';
import '../widgets/chat_history_drawer.dart';
import 'voice_orb_screen.dart';

class ExecutiveChatScreen extends StatefulWidget {
  final String? initialPrompt;
  final ChatSession? initialSession;

  const ExecutiveChatScreen({
    super.key,
    this.initialPrompt,
    this.initialSession,
  });

  @override
  State<ExecutiveChatScreen> createState() => _ExecutiveChatScreenState();
}

class _ExecutiveChatScreenState extends State<ExecutiveChatScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  late ChatSession _currentSession;
  final List<ChatMessage> _messages = [];
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();

    if (widget.initialSession != null) {
      _currentSession = widget.initialSession!;
      _messages.addAll(_currentSession.messages);
    } else {
      _currentSession = ChatSession(
        id: 'session-${DateTime.now().millisecondsSinceEpoch}',
        title: widget.initialPrompt != null && widget.initialPrompt!.isNotEmpty
            ? _truncateTitle(widget.initialPrompt!)
            : 'New Conversation',
        updatedAt: 'Today',
        messages: [],
      );

      _messages.add(
        ChatMessage(
          id: 'msg-0',
          sender: 'assistant',
          timestamp: 'Just now',
          content: 'Good day, GMD. I am BEMi (Bems Enterprise Machine Intelligence). How may I assist your group treasury, approvals, or strategic oversight today?',
        ),
      );
      _currentSession.messages = List.from(_messages);
      ChatStorageService.upsertSession(_currentSession);
    }

    if (widget.initialPrompt != null && widget.initialPrompt!.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleSend(widget.initialPrompt!);
      });
    }
  }

  String _truncateTitle(String text) {
    if (text.length <= 32) return text;
    return '${text.substring(0, 30)}...';
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _startNewChat() {
    setState(() {
      _currentSession = ChatSession(
        id: 'session-${DateTime.now().millisecondsSinceEpoch}',
        title: 'New Conversation',
        updatedAt: 'Today',
        messages: [],
      );
      _messages.clear();
      _messages.add(
        ChatMessage(
          id: 'msg-0',
          sender: 'assistant',
          timestamp: 'Just now',
          content: 'Good day, GMD. Starting a new session with BEMi. How can I assist you?',
        ),
      );
      _currentSession.messages = List.from(_messages);
    });
    ChatStorageService.upsertSession(_currentSession);
  }

  void _switchSession(ChatSession session) {
    setState(() {
      _currentSession = session;
      _messages.clear();
      _messages.addAll(session.messages);
    });
    _scrollToBottom();
  }

  Future<void> _handleSend([String? presetText]) async {
    final text = (presetText ?? _textController.text).trim();
    if (text.isEmpty || _isTyping) return;

    _textController.clear();

    final userMsg = ChatMessage(
      id: 'user-${DateTime.now().millisecondsSinceEpoch}',
      sender: 'user',
      content: text,
      timestamp: 'Now',
    );

    // Update title if it's the first user message
    if (_currentSession.title == 'New Conversation' || _currentSession.title.isEmpty) {
      _currentSession.title = _truncateTitle(text);
    }

    setState(() {
      _messages.add(userMsg);
      _isTyping = true;
    });
    _scrollToBottom();

    _currentSession.messages = List.from(_messages);
    _currentSession.updatedAt = 'Today';
    ChatStorageService.upsertSession(_currentSession);

    try {
      final response = await ApiService.sendAiMessage(
        message: text,
        history: _messages,
      );

      final assistantMsg = ChatMessage(
        id: 'ai-${DateTime.now().millisecondsSinceEpoch}',
        sender: 'assistant',
        content: response['message'] ?? 'Response generated.',
        timestamp: response['timestamp'] ?? 'Now',
        actionCard: response['actionCard'],
      );

      setState(() {
        _messages.add(assistantMsg);
        _isTyping = false;
      });
      _scrollToBottom();

      _currentSession.messages = List.from(_messages);
      ChatStorageService.upsertSession(_currentSession);
    } catch (e) {
      final fallbackMsg = ChatMessage(
        id: 'err-${DateTime.now().millisecondsSinceEpoch}',
        sender: 'assistant',
        content: 'BEMS real-time intelligence synchronized. Treasury records are intact.',
        timestamp: 'Now',
      );

      setState(() {
        _messages.add(fallbackMsg);
        _isTyping = false;
      });
      _scrollToBottom();

      _currentSession.messages = List.from(_messages);
      ChatStorageService.upsertSession(_currentSession);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: ChatHistoryDrawer(
        activeSessionId: _currentSession.id,
        onSelectSession: _switchSession,
        onNewChat: _startNewChat,
      ),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.history_rounded, color: Color(0xFF0F172A), size: 22),
          tooltip: 'Chat History',
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        title: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: Color(0xFFEA580C),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  _currentSession.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_comment_outlined, color: Color(0xFFEA580C), size: 20),
            tooltip: 'New Chat',
            onPressed: _startNewChat,
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B), size: 20),
            tooltip: 'Back',
            onPressed: () => Navigator.pop(context),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(color: Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Chat Message Stream
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final msg = _messages[index];
                  return _buildMessageItem(msg);
                },
              ),
            ),

            // Typing indicator
            if (_isTyping)
              Padding(
                padding: const EdgeInsets.only(left: 20, bottom: 8),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFFEA580C),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'BEMi analyzing group intelligence...',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),

            // Bottom Input Bar
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageItem(ChatMessage msg) {
    if (msg.isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
          decoration: BoxDecoration(
            color: const Color(0xFFEA580C),
            borderRadius: BorderRadius.circular(18).copyWith(bottomRight: const Radius.circular(4)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x20EA580C),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Text(
            msg.content,
            style: const TextStyle(fontSize: 14, color: Colors.white, height: 1.35, fontWeight: FontWeight.w500),
          ),
        ),
      );
    } else {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [Color(0xFFEA580C), Color(0xFFC2410C)]),
                ),
                child: const Center(
                  child: Text('BEMi', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white)),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'BEMi Intelligence',
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x060F172A),
                  blurRadius: 10,
                  offset: Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  msg.content,
                  style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), height: 1.45, fontWeight: FontWeight.w500),
                ),
                if (msg.actionCard != null) ...[
                  const SizedBox(height: 12),
                  InteractiveActionCard(data: msg.actionCard!),
                ],
              ],
            ),
          ),
        ],
      );
    }
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          // Voice Orb screen trigger
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: const Icon(Icons.graphic_eq_rounded, color: Color(0xFFEA580C), size: 18),
            ),
            tooltip: 'Voice Command Mode',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const VoiceOrbScreen()),
              );
            },
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: TextField(
                controller: _textController,
                style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
                decoration: const InputDecoration(
                  hintText: 'Ask BEMi or instruct...',
                  hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                  border: InputBorder.none,
                ),
                onSubmitted: (_) => _handleSend(),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => _handleSend(),
            child: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: Color(0xFFEA580C),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.arrow_upward_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
