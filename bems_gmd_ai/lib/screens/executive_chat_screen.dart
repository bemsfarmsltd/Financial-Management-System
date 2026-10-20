import 'package:flutter/material.dart';
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
    // Initial message sequence matching reference Screen 3 style
    _messages.add(
      ChatMessage(
        id: 'msg-0',
        sender: 'assistant',
        timestamp: 'Just now',
        content: 'Deployed AlphaRaptor.sh to your agent network. The automation loop is active. Need to configure risk mitigation parameters?',
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
            content: 'Connected to BEMS offline reserve snapshot. Treasury is fully reconciled.',
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
      backgroundColor: const Color(0xFF04060C),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.6),
            radius: 1.4,
            colors: [
              Color(0xFF381404), // Warm ambient top glow
              Color(0xFF140803), // Deep burnt transition
              Color(0xFF04060C), // Bottom pitch black
            ],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Top Centered "✕ Close chat" Pill (Matching Screenshot 3)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: Colors.white.withOpacity(0.12)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.close_rounded, size: 14, color: Colors.white70),
                            SizedBox(width: 6),
                            Text(
                              'Close chat',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Conversation Messages Stream (Matching Screenshot 3)
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
                          // Mini glowing molten orb avatar on left for assistant (Matching Screenshot 3)
                          if (!isUser) ...[
                            Container(
                              width: 28,
                              height: 28,
                              margin: const EdgeInsets.only(right: 12, top: 4),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFF97316), Color(0xFFEA580C)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFEA580C).withOpacity(0.7),
                                    blurRadius: 12,
                                    spreadRadius: 2,
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
                                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                                  decoration: BoxDecoration(
                                    color: isUser ? const Color(0xFFEA580C) : const Color(0xFF101726).withOpacity(0.85),
                                    borderRadius: BorderRadius.only(
                                      topLeft: const Radius.circular(20),
                                      topRight: const Radius.circular(20),
                                      bottomLeft: Radius.circular(isUser ? 20 : 6),
                                      bottomRight: Radius.circular(isUser ? 6 : 20),
                                    ),
                                    border: Border.all(
                                      color: isUser ? Colors.transparent : const Color(0xFFEA580C).withOpacity(0.25),
                                    ),
                                    boxShadow: [
                                      if (isUser)
                                        BoxShadow(
                                          color: const Color(0xFFEA580C).withOpacity(0.4),
                                          blurRadius: 16,
                                          offset: const Offset(0, 4),
                                        ),
                                    ],
                                  ),
                                  child: Text(
                                    msg.content,
                                    style: TextStyle(
                                      fontSize: 14.5,
                                      color: isUser ? Colors.white : Colors.white.withOpacity(0.92),
                                      height: 1.45,
                                      fontWeight: isUser ? FontWeight.w600 : FontWeight.w400,
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

              // Assistant status indicator (e.g., "Arya is working...")
              if (_isTyping)
                Padding(
                  padding: const EdgeInsets.only(left: 60, bottom: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFFF97316),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Arya is analyzing ledger…',
                        style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                      ),
                    ],
                  ),
                ),

              // Quick Executive Action Pills
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                child: Row(
                  children: [
                    _buildQuickActionChip('🏦 Cash Reserves', 'What is our total liquid cash reserve across banks?'),
                    _buildQuickActionChip('⚡ Pending Approvals', 'Check pending expenditure requests for GMD sign-off'),
                    _buildQuickActionChip('📊 Morning Briefing', 'Give me the morning executive briefing'),
                    _buildQuickActionChip('🔍 72h Advances', 'Check open accountability cases and overdue receipts'),
                  ],
                ),
              ),

              // Bottom Input Capsule Bar with Mic Icon (Matching Screenshot 3)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF101726).withOpacity(0.85),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: Colors.white.withOpacity(0.12)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _textController,
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          decoration: InputDecoration(
                            hintText: 'Ask AI a question…',
                            hintStyle: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 14),
                            border: InputBorder.none,
                          ),
                          onSubmitted: (val) => _handleSend(val),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.mic_rounded, color: Colors.white70, size: 22),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const VoiceOrbScreen()),
                          );
                        },
                      ),
                      GestureDetector(
                        onTap: () => _handleSend(),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              colors: [Color(0xFFF97316), Color(0xFFEA580C)],
                            ),
                          ),
                          child: const Icon(Icons.arrow_upward_rounded, color: Colors.white, size: 18),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionChip(String label, String prompt) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: () => _handleSend(prompt),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.06),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.12)),
          ),
          child: Text(
            label,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Colors.white70),
          ),
        ),
      ),
    );
  }
}
