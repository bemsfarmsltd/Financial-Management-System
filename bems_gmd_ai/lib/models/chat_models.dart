class ChatMessage {
  final String id;
  final String sender; // 'user' or 'assistant'
  final String content;
  final String timestamp;
  final Map<String, dynamic>? actionCard;
  final List<String>? quickReplies;
  final List<Map<String, dynamic>>? attachments;

  ChatMessage({
    required this.id,
    required this.sender,
    required this.content,
    required this.timestamp,
    this.actionCard,
    this.quickReplies,
    this.attachments,
  });

  bool get isUser => sender == 'user';

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] ?? '',
      sender: json['sender'] ?? 'assistant',
      content: json['content'] ?? '',
      timestamp: json['timestamp'] ?? '',
      actionCard: json['actionCard'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['actionCard'])
          : null,
      quickReplies: (json['quickReplies'] as List?)
          ?.map((e) => e.toString())
          .toList(),
      attachments: (json['attachments'] as List?)
          ?.whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sender': sender,
      'content': content,
      'timestamp': timestamp,
      'actionCard': actionCard,
      if (quickReplies != null) 'quickReplies': quickReplies,
      if (attachments != null) 'attachments': attachments,
    };
  }
}

class ChatSession {
  final String id;
  String title;
  String updatedAt;
  List<ChatMessage> messages;

  ChatSession({
    required this.id,
    required this.title,
    required this.updatedAt,
    required this.messages,
  });

  factory ChatSession.fromJson(Map<String, dynamic> json) {
    return ChatSession(
      id: json['id'] ?? '',
      title: json['title'] ?? 'Executive Conversation',
      updatedAt: json['updatedAt'] ?? 'Today',
      messages: (json['messages'] as List<dynamic>?)
              ?.map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'updatedAt': updatedAt,
      'messages': messages.map((m) => m.toJson()).toList(),
    };
  }
}
