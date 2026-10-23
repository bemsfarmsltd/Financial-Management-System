import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import '../models/staff_models.dart';
import '../services/staff_api_service.dart';

class RequestChatScreen extends StatefulWidget {
  final String requestNumber;
  final String requestTitle;
  final StaffUser currentUser;

  const RequestChatScreen({
    super.key,
    required this.requestNumber,
    required this.requestTitle,
    required this.currentUser,
  });

  @override
  State<RequestChatScreen> createState() => _RequestChatScreenState();
}

class _RequestChatScreenState extends State<RequestChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<dynamic> _messages = [];
  List<dynamic> _participants = [];
  bool _isLoading = true;
  bool _isSending = false;
  String? _errorMessage;
  Timer? _pollingTimer;

  String _visibility = 'GROUP'; // 'GROUP' or 'PRIVATE'
  String? _selectedRecipientId;

  String? _pendingAttachmentUrl;
  String? _pendingAttachmentName;
  bool _isUploadingAttachment = false;

  Future<void> _pickChatCamera() async {
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (photo == null) return;
      setState(() => _isUploadingAttachment = true);
      final bytes = await photo.readAsBytes();
      final url = await StaffApiService.uploadAvatar(bytes: bytes, filename: photo.name);
      setState(() {
        _pendingAttachmentUrl = url;
        _pendingAttachmentName = photo.name;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Camera error: $e'), backgroundColor: const Color(0xFFDC2626)),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingAttachment = false);
    }
  }

  Future<void> _pickChatFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      final file = result.files.first;
      final bytes = file.bytes;
      if (bytes == null) return;
      setState(() => _isUploadingAttachment = true);
      final url = await StaffApiService.uploadAvatar(bytes: bytes, filename: file.name);
      setState(() {
        _pendingAttachmentUrl = url;
        _pendingAttachmentName = file.name;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('File picker error: $e'), backgroundColor: const Color(0xFFDC2626)),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingAttachment = false);
    }
  }

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Add Attachment', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 16),
              ListTile(
                leading: const CircleAvatar(backgroundColor: Color(0xFFFFF7ED), child: Icon(Icons.camera_alt_rounded, color: Color(0xFFEA580C))),
                title: const Text('Take Photo / Receipt', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                subtitle: const Text('Open phone camera directly', style: TextStyle(fontSize: 11)),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickChatCamera();
                },
              ),
              ListTile(
                leading: const CircleAvatar(backgroundColor: Color(0xFFEFF6FF), child: Icon(Icons.file_present_rounded, color: Color(0xFF2563EB))),
                title: const Text('Upload Document or Gallery', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                subtitle: const Text('Choose PDF, Invoice or Image file', style: TextStyle(fontSize: 11)),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickChatFile();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted) _loadMessages(isBackground: true);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool isBackground = false}) async {
    try {
      final res = await StaffApiService.getRequestChat(
        requestNumber: widget.requestNumber,
        employeeId: widget.currentUser.id,
      );

      if (mounted) {
        setState(() {
          _messages = res['messages'] ?? [];
          _participants = res['participants'] ?? [];
          if (!isBackground) _isLoading = false;
          _errorMessage = null;
        });

        if (!isBackground) {
          _scrollToBottom();
        }
      }
    } catch (e) {
      if (mounted && !isBackground) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
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

  Future<void> _sendMessage() async {
    final text = _textController.text.trim();
    if ((text.isEmpty && _pendingAttachmentUrl == null) || _isSending) return;

    final attachmentUrl = _pendingAttachmentUrl;
    final attachmentName = _pendingAttachmentName;

    setState(() {
      _isSending = true;
      _pendingAttachmentUrl = null;
      _pendingAttachmentName = null;
    });
    _textController.clear();

    try {
      await StaffApiService.sendRequestMessage(
        requestNumber: widget.requestNumber,
        employeeId: widget.currentUser.id,
        text: text.isNotEmpty ? text : (attachmentName != null ? 'Attached: $attachmentName' : 'File attached'),
        visibility: _visibility,
        recipientId: _visibility == 'PRIVATE' ? _selectedRecipientId : null,
        attachmentUrl: attachmentUrl,
        attachmentName: attachmentName,
      );

      await _loadMessages(isBackground: true);
      _scrollToBottom();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF064E3B),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  widget.requestNumber,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEA580C),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'COLLAB CHANNEL',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 8.5,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            Text(
              widget.requestTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Colors.white.withOpacity(0.8),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            onPressed: () => _loadMessages(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Participants Carousel
          if (_participants.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: Colors.white,
              child: Row(
                children: [
                  const Icon(Icons.group_rounded, size: 14, color: Color(0xFF64748B)),
                  const SizedBox(width: 8),
                  Text(
                    'Stakeholders (${_participants.length}):',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _participants.map((p) {
                          final name = p['name'] ?? 'Officer';
                          final role = p['role'] ?? 'Approver';
                          return Container(
                            margin: const EdgeInsets.only(right: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  name,
                                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '($role)',
                                  style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ],
              ),
            ),

          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Messages View
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF064E3B)),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 36),
                              const SizedBox(height: 10),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                              ),
                              const SizedBox(height: 12),
                              ElevatedButton(
                                onPressed: () => _loadMessages(),
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF064E3B)),
                                child: const Text('Try Again', style: TextStyle(color: Colors.white)),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _messages.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFFA7F3D0)),
                                  ),
                                  child: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF047857), size: 32),
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'No messages in this channel yet.',
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'Ask a question or provide context to approvers.',
                                  style: TextStyle(color: Color(0xFF64748B), fontSize: 11.5),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                            itemCount: _messages.length,
                            itemBuilder: (context, index) {
                              final msg = _messages[index];
                              return _buildMessageBubble(msg);
                            },
                          ),
          ),

          // Bottom Input Bar
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -3),
                ),
              ],
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Visibility Options
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => setState(() => _visibility = 'GROUP'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _visibility == 'GROUP' ? const Color(0xFFECFDF5) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: _visibility == 'GROUP' ? const Color(0xFFA7F3D0) : Colors.transparent,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.public_rounded,
                                size: 12,
                                color: _visibility == 'GROUP' ? const Color(0xFF047857) : const Color(0xFF64748B),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Group Broadcast',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: _visibility == 'GROUP' ? const Color(0xFF047857) : const Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            _visibility = 'PRIVATE';
                            if (_selectedRecipientId == null && _participants.isNotEmpty) {
                              final other = _participants.firstWhere(
                                (p) => p['id'] != widget.currentUser.id,
                                orElse: () => _participants.first,
                              );
                              _selectedRecipientId = other['id'];
                            }
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _visibility == 'PRIVATE' ? const Color(0xFFFFF7ED) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: _visibility == 'PRIVATE' ? const Color(0xFFFED7AA) : Colors.transparent,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.lock_outline_rounded,
                                size: 12,
                                color: _visibility == 'PRIVATE' ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Private Message',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: _visibility == 'PRIVATE' ? const Color(0xFFEA580C) : const Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (_visibility == 'PRIVATE' && _participants.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _selectedRecipientId,
                              isDense: true,
                              isExpanded: true,
                              iconSize: 16,
                              items: _participants
                                  .where((p) => p['id'] != widget.currentUser.id)
                                  .map<DropdownMenuItem<String>>((p) {
                                return DropdownMenuItem<String>(
                                  value: p['id'],
                                  child: Text(
                                    '${p['name']} (${p['role']})',
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) => setState(() => _selectedRecipientId = val),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (_isUploadingAttachment)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        children: [
                          SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB))),
                          SizedBox(width: 8),
                          Text('Uploading attachment...', style: TextStyle(fontSize: 11, color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),

                  if (_pendingAttachmentName != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.attach_file_rounded, size: 16, color: Color(0xFF047857)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              _pendingAttachmentName!,
                              style: const TextStyle(fontSize: 11, color: Color(0xFF047857), fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF047857)),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            onPressed: () => setState(() {
                              _pendingAttachmentUrl = null;
                              _pendingAttachmentName = null;
                            }),
                          ),
                        ],
                      ),
                    ),

                  // Input Box
                  Row(
                    children: [
                      IconButton(
                        onPressed: _isUploadingAttachment ? null : _showAttachmentOptions,
                        icon: const Icon(Icons.attach_file_rounded, color: Color(0xFF64748B), size: 22),
                        tooltip: 'Attach photo or document',
                      ),
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: TextField(
                            controller: _textController,
                            minLines: 1,
                            maxLines: 4,
                            textCapitalization: TextCapitalization.sentences,
                            style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                            decoration: const InputDecoration(
                              hintText: 'Type a message to approvers...',
                              hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: (_isSending || _isUploadingAttachment) ? null : _sendMessage,
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFF064E3B),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF064E3B).withOpacity(0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: _isSending
                              ? const Center(
                                  child: SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  ),
                                )
                              : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(dynamic msg) {
    final authorId = msg['authorId']?.toString();
    final isMe = authorId == widget.currentUser.id;
    final authorName = msg['authorName']?.toString() ?? 'Staff';
    final authorRole = msg['authorRole']?.toString() ?? 'Approver';
    final body = msg['body']?.toString() ?? '';
    final visibility = msg['visibility']?.toString() ?? 'GROUP';
    final createdAt = msg['createdAt'] != null
        ? DateTime.tryParse(msg['createdAt'].toString()) ?? DateTime.now()
        : DateTime.now();
    final timeStr = DateFormat('hh:mm a').format(createdAt);

    final isAudit = msg['messageType'] == 'AUDIT_EVENT';

    if (isAudit) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.history_edu_rounded, size: 14, color: Color(0xFF64748B)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                body,
                style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w600),
              ),
            ),
            Text(timeStr, style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                isMe ? 'You' : authorName,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF334155)),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isMe ? const Color(0xFFFED7AA) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  authorRole.replaceAll('_', ' '),
                  style: TextStyle(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w800,
                    color: isMe ? const Color(0xFFC2410C) : const Color(0xFF475569),
                  ),
                ),
              ),
              if (visibility == 'PRIVATE') ...[
                const SizedBox(width: 4),
                const Icon(Icons.lock_rounded, size: 11, color: Color(0xFFEA580C)),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isMe ? const Color(0xFFEA580C) : Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMe ? 16 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 16),
              ),
              border: isMe ? null : Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (msg['attachmentUrl'] != null && msg['attachmentUrl'].toString().isNotEmpty) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: (msg['attachmentUrl'].toString().toLowerCase().contains('.pdf'))
                        ? Container(
                            padding: const EdgeInsets.all(10),
                            color: isMe ? Colors.white.withOpacity(0.15) : const Color(0xFFF1F5F9),
                            child: Row(
                              children: [
                                const Icon(Icons.picture_as_pdf_rounded, color: Colors.red, size: 22),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    msg['attachmentName']?.toString() ?? 'Attached PDF Document',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                      color: isMe ? Colors.white : const Color(0xFF0F172A),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : Image.network(
                            msg['attachmentUrl'].toString(),
                            height: 150,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              height: 60,
                              color: isMe ? Colors.white.withOpacity(0.15) : const Color(0xFFF1F5F9),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.insert_drive_file_rounded, color: isMe ? Colors.white : const Color(0xFF64748B)),
                                  const SizedBox(width: 6),
                                  Text(msg['attachmentName']?.toString() ?? 'Attachment', style: TextStyle(color: isMe ? Colors.white : const Color(0xFF0F172A), fontSize: 11)),
                                ],
                              ),
                            ),
                          ),
                  ),
                  const SizedBox(height: 6),
                ],
                Text(
                  body,
                  style: TextStyle(
                    fontSize: 13,
                    color: isMe ? Colors.white : const Color(0xFF0F172A),
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.bottomRight,
                  child: Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 9.5,
                      color: isMe ? Colors.white.withOpacity(0.8) : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
