import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/chat_models.dart';
import '../services/api_service.dart';
import '../services/bemi_voice_service.dart';
import '../services/chat_storage_service.dart';
import '../widgets/action_cards.dart';
import '../widgets/chat_history_drawer.dart';
import '../widgets/executive_markdown_body.dart';
import 'voice_orb_screen.dart';
import 'wallet_funding_screen.dart';

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
  String _agentMode = 'auto'; // 'auto', 'both', 'financial', 'hr'
  bool _voiceReadoutEnabled = false;
  final List<Map<String, dynamic>> _pendingAttachments = [];
  bool _isUploadingAttachment = false;

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

  Future<void> _showAttachmentModal() async {
    final nameController = TextEditingController(text: 'executive-memo.txt');
    final contentController = TextEditingController();

    final result = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Attach Document / Receipt Note for BEMi',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Upload a document, CSV snippet, invoice text, or executive brief for BEMi to audit.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameController,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'File / Document Name',
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: contentController,
                maxLines: 5,
                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: 'Document / Receipt Content or CSV Rows',
                  alignLabelWithHint: true,
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (contentController.text.trim().isEmpty) return;
                    Navigator.pop(ctx, {
                      'fileName': nameController.text.trim().isEmpty
                          ? 'executive-attachment.txt'
                          : nameController.text.trim(),
                      'content': contentController.text.trim(),
                    });
                  },
                  icon: const Icon(Icons.attach_file_rounded, size: 18),
                  label: const Text('Attach to Prompt', style: TextStyle(fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );

    if (result == null) return;
    setState(() {
      _isUploadingAttachment = true;
    });
    try {
      final bytes = utf8.encode(result['content']!);
      final uploaded = await ApiService.uploadAiAttachmentBytes(
        bytes: bytes,
        fileName: result['fileName']!,
      );
      if (mounted) {
        setState(() {
          _pendingAttachments.add(uploaded);
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _pendingAttachments.add({
            'fileName': result['fileName']!,
            'mimeType': 'text/plain',
            'textContent': result['content']!,
          });
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingAttachment = false;
        });
      }
    }
  }

  Future<void> _handleSend([String? presetText]) async {
    var text = (presetText ?? _textController.text).trim();
    if ((text.isEmpty && _pendingAttachments.isEmpty) || _isTyping) return;

    // Parse explicit @finance / @hr / @both / @auto tag if typed
    final tagMatch = RegExp(r'^[@/](finance|financial|hr|people|both|all|auto)\b\s*', caseSensitive: false).firstMatch(text);
    if (tagMatch != null) {
      final token = tagMatch.group(1)!.toLowerCase();
      text = text.substring(tagMatch.group(0)!.length).trim();
      setState(() {
        if (token == 'finance' || token == 'financial') {
          _agentMode = 'financial';
        } else if (token == 'hr' || token == 'people') {
          _agentMode = 'hr';
        } else if (token == 'both' || token == 'all') {
          _agentMode = 'both';
        } else if (token == 'auto') {
          _agentMode = 'auto';
        }
      });
    }

    if (text.isEmpty && _pendingAttachments.isNotEmpty) {
      text = 'Attached ${_pendingAttachments.map((a) => a['fileName']).join(', ')} for executive analysis.';
    }

    _textController.clear();
    final attachmentsToSend = List<Map<String, dynamic>>.from(_pendingAttachments);
    _pendingAttachments.clear();

    final userMsg = ChatMessage(
      id: 'user-${DateTime.now().millisecondsSinceEpoch}',
      sender: 'user',
      content: text,
      timestamp: 'Now',
      attachments: attachmentsToSend.isNotEmpty ? attachmentsToSend : null,
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
        conversationId: _currentSession.id,
        agentMode: _agentMode,
        attachments: attachmentsToSend,
      );

      Map<String, dynamic>? resolvedActionCard;
      if (response['actionCard'] is Map<String, dynamic>) {
        resolvedActionCard = Map<String, dynamic>.from(response['actionCard']);
      } else if (response['staged_action'] is Map<String, dynamic>) {
        final sa = Map<String, dynamic>.from(response['staged_action']);
        resolvedActionCard = {
          'type': 'STAGED_ACTION',
          'cardType': 'STAGED_ACTION',
          'staged_action_id': sa['staged_action_id'],
          'confirmation_hash': sa['confirmation_hash'],
          'actionType': sa['action_type'],
          'summary': sa['summary'],
          'preview': sa['payload_preview'] ?? {},
          'warnings': sa['warnings'] ?? [],
          'blocking_errors': sa['blocking_errors'] ?? [],
          'expires_at': sa['expires_at'],
          'status': sa['status'] ?? 'PENDING',
        };
      }

      final quickRepliesList = (response['quick_replies'] as List? ?? response['followUps'] as List?)
          ?.map((e) => e.toString())
          .where((s) => s.trim().isNotEmpty)
          .toList();

      final assistantMsg = ChatMessage(
        id: 'ai-${DateTime.now().millisecondsSinceEpoch}',
        sender: 'assistant',
        content: response['message'] ?? 'Response generated.',
        timestamp: response['timestamp'] ?? 'Now',
        actionCard: resolvedActionCard,
        quickReplies: quickRepliesList,
      );

      setState(() {
        _messages.add(assistantMsg);
        _isTyping = false;
      });
      _scrollToBottom();

      if (_voiceReadoutEnabled && assistantMsg.content.isNotEmpty) {
        BemiVoiceService.speak(assistantMsg.content, force: true);
      }

      _currentSession.messages = List.from(_messages);
      ChatStorageService.upsertSession(_currentSession);
    } catch (e) {
      final errDetail = e.toString().replaceFirst('Exception: ', '').trim();
      final fallbackMsg = ChatMessage(
        id: 'err-${DateTime.now().millisecondsSinceEpoch}',
        sender: 'assistant',
        content: errDetail.isNotEmpty
            ? 'Could not complete that request: $errDetail'
            : 'Could not reach BEMS AI right now. Please try again.',
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
            icon: Icon(
              _voiceReadoutEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
              color: _voiceReadoutEnabled ? const Color(0xFFEA580C) : const Color(0xFF64748B),
              size: 20,
            ),
            tooltip: _voiceReadoutEnabled ? 'Mute Voice Readout' : 'Enable Voice Readout',
            onPressed: () {
              setState(() {
                _voiceReadoutEnabled = !_voiceReadoutEnabled;
              });
              if (!_voiceReadoutEnabled) {
                BemiVoiceService.stop();
              }
            },
          ),
          IconButton(icon: const Icon(Icons.account_balance_wallet_outlined), tooltip: 'Wallet funding and releases', onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WalletFundingScreen()))),
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
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              border: Border(
                top: BorderSide(color: Color(0xFFE2E8F0)),
                bottom: BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildAgentPill('auto', '✦ Auto', const Color(0xFF334155), Colors.white),
                  const SizedBox(width: 6),
                  _buildAgentPill('both', '✦ Both', const Color(0xFF7C3AED), const Color(0xFFF5F3FF)),
                  const SizedBox(width: 6),
                  _buildAgentPill('financial', '⚡ Finance', const Color(0xFFEA580C), const Color(0xFFFFF7ED)),
                  const SizedBox(width: 6),
                  _buildAgentPill('hr', '👥 HR Ops', const Color(0xFF0284C7), const Color(0xFFF0F9FF)),
                ],
              ),
            ),
          ),
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
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => BemiVoiceService.speak(msg.content, force: true),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFED7AA)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.volume_up_rounded, size: 11, color: Color(0xFFEA580C)),
                      SizedBox(width: 3),
                      Text(
                        'Listen',
                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                      ),
                    ],
                  ),
                ),
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
                ExecutiveMarkdownBody(content: msg.content),
                if (msg.actionCard != null) ...[
                  const SizedBox(height: 12),
                  InteractiveActionCard(data: msg.actionCard!),
                ],
                if (msg.quickReplies != null && msg.quickReplies!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: msg.quickReplies!.map((qr) {
                      return InkWell(
                        onTap: _isTyping ? null : () => _handleSend(qr),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Text(
                            '$qr ›',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF334155),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      );
    }
  }

  Widget _buildAgentPill(String mode, String label, Color activeColor, Color activeBg) {
    final isActive = _agentMode == mode;
    return GestureDetector(
      onTap: () {
        setState(() {
          _agentMode = mode;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isActive ? activeBg : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? activeColor.withOpacity(0.4) : Colors.transparent,
          ),
          boxShadow: isActive
              ? const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 4, offset: Offset(0, 1))]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
            color: isActive ? activeColor : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_pendingAttachments.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                height: 30,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _pendingAttachments.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 6),
                  itemBuilder: (context, idx) {
                    final att = _pendingAttachments[idx];
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFDBA74)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.description_outlined, size: 13, color: Color(0xFFEA580C)),
                          const SizedBox(width: 4),
                          Text(
                            att['fileName']?.toString() ?? 'Attachment',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF9A3412)),
                          ),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                _pendingAttachments.removeAt(idx);
                              });
                            },
                            child: const Icon(Icons.close_rounded, size: 13, color: Color(0xFF9A3412)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          Row(
            children: [
              // Attach File / Document button
              IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: _pendingAttachments.isNotEmpty ? const Color(0xFFFFF7ED) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _pendingAttachments.isNotEmpty ? const Color(0xFFFDBA74) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Icon(
                    Icons.attach_file_rounded,
                    color: _pendingAttachments.isNotEmpty ? const Color(0xFFEA580C) : const Color(0xFF475569),
                    size: 18,
                  ),
                ),
                tooltip: 'Attach File or Document',
                onPressed: _isUploadingAttachment ? null : _showAttachmentModal,
              ),
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
        ],
      ),
    );
  }
}
