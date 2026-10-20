import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/bems_theme.dart';

class DynamicStreamingText extends StatefulWidget {
  final String text;
  final TextStyle? style;
  final Duration charDuration;
  final VoidCallback? onComplete;

  const DynamicStreamingText({
    super.key,
    required this.text,
    this.style,
    this.charDuration = const Duration(milliseconds: 28),
    this.onComplete,
  });

  @override
  State<DynamicStreamingText> createState() => _DynamicStreamingTextState();
}

class _DynamicStreamingTextState extends State<DynamicStreamingText> with SingleTickerProviderStateMixin {
  String _displayedText = '';
  int _currentIndex = 0;
  Timer? _timer;
  late AnimationController _cursorController;

  @override
  void initState() {
    super.initState();
    _cursorController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..repeat(reverse: true);
    _startStreaming();
  }

  @override
  void didUpdateWidget(covariant DynamicStreamingText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text) {
      _startStreaming();
    }
  }

  void _startStreaming() {
    _timer?.cancel();
    setState(() {
      _displayedText = '';
      _currentIndex = 0;
    });

    _timer = Timer.periodic(widget.charDuration, (timer) {
      if (_currentIndex < widget.text.length) {
        setState(() {
          _displayedText += widget.text[_currentIndex];
          _currentIndex++;
        });
      } else {
        timer.cancel();
        widget.onComplete?.call();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _cursorController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final defaultStyle = Theme.of(context).textTheme.headlineMedium?.copyWith(
          color: BemsTheme.textPrimary,
          fontWeight: FontWeight.w700,
          height: 1.35,
          letterSpacing: -0.2,
        );

    final isStreaming = _currentIndex < widget.text.length;

    return AnimatedBuilder(
      animation: _cursorController,
      builder: (context, child) {
        return RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: widget.style ?? defaultStyle,
            children: [
              TextSpan(text: _displayedText),
              if (isStreaming)
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Opacity(
                    opacity: _cursorController.value,
                    child: Container(
                      width: 3,
                      height: (widget.style?.fontSize ?? 22) * 1.1,
                      margin: const EdgeInsets.only(left: 4),
                      decoration: BoxDecoration(
                        color: BemsTheme.primaryLight,
                        borderRadius: BorderRadius.circular(2),
                        boxShadow: const [
                          BoxShadow(
                            color: BemsTheme.primaryGlow,
                            blurRadius: 8,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
