import 'package:flutter/material.dart';
import '../theme/bems_theme.dart';
import '../models/chat_models.dart';
import '../services/api_service.dart';
import '../widgets/action_cards.dart';
import 'voice_orb_screen.dart';

class ExecutiveChatScreen extends StatefulWidget {
  final String? initialPrompt;

  const ExecutiveChatScreen({
    super.key,
    this.initialPrompt,
  });

  @override
  State<ExecutiveChatScreen> createState() => _ExecutiveChatScreenState();
}

class _ExecutiveChatScreenState extends State<ExecutiveChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    _messages.add(
      ChatMessage(
        id: 'msg-0',
        sender: 'assistant',
        timestamp: 'Just now',
        content: 'BEMS Executive AI Core initialized. Grounded directly with live PostgreSQL ledger & verified company accounts.',
      ),
    );

    if (widget.initialPrompt != null && widget.initialPrompt!.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleSend(widget.initialPrompt!);
      });
    }
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

    setState(() {
      _messages.add(userMsg);
      _isTyping = true;
    });
    _scrollToBottom();

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
    } catch (e) {
      setState(() {
        _messages.add(
          ChatMessage(
            id: 'err-${DateTime.now().millisecondsSinceEpoch}',
            sender: 'assistant',
            content: 'Could not connect to live ledger. Displaying offline financial state.',
            timestamp: 'Now',
          ),
        );
        _isTyping = false;
      });
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.6),
            radius: 1.4,
            colors: [
              Color(0xFF240E04), // Ambient top glow
              Color(0xFF0B1220), // Deep obsidian
              Color(0xFF050811), // Bottom black
            ],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Top Close Bar (Matching reference Screen 3)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const SizedBox(width: 40),
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withOpacity(0.12)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.close_rounded, size: 14, color: BemsTheme.textSecondary),
                            SizedBox(width: 6),
                            Text(
                              'Close chat',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BemsTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.mic_rounded, color: BemsTheme.primaryLight),
                      onPressed: () {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(builder: (_) => const VoiceOrbScreen()),
                        );
                      },
                    ),
                  ],
                ),
              ),

              // Conversation Messages Stream (Matching reference Screen 3)
              Expanded(
                child: ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  itemCount: _messages.length,
                  itemBuilder: (context, index) {
                    final msg = _messages[index];
                    final isUser = msg.isUser;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 18),
                      child: Row(
                        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Mini glowing molten orb avatar for assistant
                          if (!isUser) ...[
                            Container(
                              width: 28,
                              height: 28,
                              margin: const EdgeInsets.only(right: 10, top: 4),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: BemsTheme.amberGradient,
                                boxShadow: [
                                  BoxShadow(
                                    color: BemsTheme.primary.withOpacity(0.6),
                                    blurRadius: 10,
                                  ),
                                ],
                              ),
                            ),
                          ],

                          // Message Bubble
                          Flexible(
                            child: Column(
                              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: isUser ? const Color(0xFFEA580C) : const Color(0xFF141F33),
                                    borderRadius: BorderRadius.only(
                                      topLeft: const Radius.circular(18),
                                      topRight: const Radius.circular(18),
                                      bottomLeft: Radius.circular(isUser ? 18 : 4),
                                      bottomRight: Radius.circular(isUser ? 4 : 18),
                                    ),
                                    border: Border.all(
                                      color: isUser ? Colors.transparent : BemsTheme.borderAmber.withOpacity(0.3),
                                    ),
                                    boxShadow: [
                                      if (isUser)
                                        BoxShadow(
                                          color: BemsTheme.primary.withOpacity(0.3),
                                          blurRadius: 12,
                                          offset: const Offset(0, 4),
                                        ),
                                    ],
                                  ),
                                  child: Text(
                                    msg.content,
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: isUser ? Colors.white : BemsTheme.textPrimary,
                                      height: 1.45,
                                    ),
                                  ),
                                ),

                                // Interactive Action Card
                                if (msg.actionCard != null)
                                  InteractiveActionCard(data: msg.actionCard!),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // "BEMS AI is working..." Indicator
              if (_isTyping)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 14,
                        height: 14,
                        margin: const EdgeInsets.only(right: 8),
                        child: const CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(BemsTheme.primaryLight),
                        ),
                      ),
                      const Text(
                        'Grounding with live ledger…',
                        style: TextStyle(fontSize: 12, color: BemsTheme.primaryLight, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),

              // Bottom Input Bar (Matching reference Screen 3)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: Color(0xFF090F1C),
                  border: Border(top: BorderSide(color: BemsTheme.borderSubtle)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.white.withOpacity(0.1)),
                        ),
                        child: TextField(
                          controller: _textController,
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          decoration: const InputDecoration(
                            hintText: 'Ask AI a question…',
                            hintStyle: TextStyle(color: BemsTheme.textMuted, fontSize: 13),
                            border: InputBorder.none,
                          ),
                          onSubmitted: (val) => _handleSend(val),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => _handleSend(),
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: BemsTheme.amberGradient,
                          boxShadow: [
                            BoxShadow(
                              color: BemsTheme.primary.withOpacity(0.4),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.arrow_upward_rounded, color: Colors.white, size: 20),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
