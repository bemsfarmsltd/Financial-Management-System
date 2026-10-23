class ChatMessage {
  final String id;
  final String sender; // 'user' or 'assistant'
  final String content;
  final String timestamp;
  final Map<String, dynamic>? actionCard;

  ChatMessage({
    required this.id,
    required this.sender,
    required this.content,
    required this.timestamp,
    this.actionCard,
  });

  bool get isUser => sender == 'user';

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] ?? '',
      sender: json['sender'] ?? 'assistant',
      content: json['content'] ?? '',
      timestamp: json['timestamp'] ?? '',
      actionCard: json['actionCard'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sender': sender,
      'content': content,
      'timestamp': timestamp,
      'actionCard': actionCard,
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
