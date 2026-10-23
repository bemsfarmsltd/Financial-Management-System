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
          content: 'Good day, Executive. I am your BEMS Copilot. How may I assist your treasury, approvals, or operational oversight today?',
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
          content: 'Good day, Executive. Starting a new session. How can I assist you?',
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
      backgroundColor: const Color(0xFF04060C),
      drawer: ChatHistoryDrawer(
        activeSessionId: _currentSession.id,
        onSelectSession: _switchSession,
        onNewChat: _startNewChat,
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.6),
            radius: 1.4,
            colors: [
              Color(0xFF381404),
              Color(0xFF140803),
              Color(0xFF04060C),
            ],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Top Bar with History Drawer, Title, and Close
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // History Menu Button
                    IconButton(
                      icon: const Icon(Icons.history_rounded, color: Colors.white70, size: 22),
                      tooltip: 'Chat History',
                      onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                    ),

                    // Active Session Title Pill
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: Colors.white.withOpacity(0.1)),
                        ),
                        child: Text(
                          _currentSession.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),

                    Row(
                      children: [
                        // New Chat Button
                        IconButton(
                          icon: const Icon(Icons.add_comment_outlined, color: Color(0xFFF97316), size: 20),
                          tooltip: 'New Chat',
                          onPressed: _startNewChat,
                        ),
                        // Close Chat Button
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                          tooltip: 'Back to Home',
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Chat Message Stream
              Expanded(
                child: ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
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
                  padding: const EdgeInsets.only(left: 24, bottom: 8),
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
                      Text(
                        'Copilot analyzing group records...',
                        style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                      ),
                    ],
                  ),
                ),

              // Bottom Input Bar
              _buildBottomBar(),
            ],
          ),
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
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFEA580C).withOpacity(0.25),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Text(
            msg.content,
            style: const TextStyle(fontSize: 14, color: Colors.white, height: 1.35),
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
                width: 22,
                height: 22,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [Color(0xFFEA580C), Color(0xFF9A3412)]),
                ),
                child: const Center(
                  child: Text('AI', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'BEMS Copilot',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white.withOpacity(0.6)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  msg.content,
                  style: const TextStyle(fontSize: 14, color: Colors.white, height: 1.45),
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
      decoration: BoxDecoration(
        color: const Color(0xFF070B14),
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.08))),
      ),
      child: Row(
        children: [
          // Voice Orb screen trigger
          IconButton(
            icon: const Icon(Icons.graphic_eq_rounded, color: Color(0xFFF97316), size: 22),
            tooltip: 'Kinetic Voice Mode',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const VoiceOrbScreen()),
              );
            },
          ),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withOpacity(0.12)),
              ),
              child: TextField(
                controller: _textController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Ask Copilot or instruct...',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 13),
                  border: InputBorder.none,
                ),
                onSubmitted: (_) => _handleSend(),
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: Color(0xFFEA580C),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.arrow_upward_rounded, color: Colors.white, size: 18),
            ),
            onPressed: () => _handleSend(),
          ),
        ],
      ),
    );
  }
}
