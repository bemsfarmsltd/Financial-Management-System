import 'package:flutter/material.dart';

class IPhoneDeviceFrame extends StatelessWidget {
  final Widget child;
  final String time;
  final bool showIsland;
  final double scale;

  const IPhoneDeviceFrame({
    super.key,
    required this.child,
    this.time = '9:41',
    this.showIsland = true,
    this.scale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    const double frameWidth = 380;
    const double frameHeight = 780;
    const double cornerRadius = 50;
    const double innerRadius = 42;

    return Transform.scale(
      scale: scale,
      child: Container(
        width: frameWidth,
        height: frameHeight,
        decoration: BoxDecoration(
          color: const Color(0xFF0C0A09),
          borderRadius: BorderRadius.circular(cornerRadius),
          // Titanium chassis border with metallic highlights and deep drop-shadow
          border: Border.all(color: const Color(0xFF292524), width: 3.5),
          boxShadow: [
            // Ambient molten floor glow
            BoxShadow(
              color: const Color(0xFFEA580C).withOpacity(0.35),
              blurRadius: 50,
              spreadRadius: 2,
              offset: const Offset(0, 20),
            ),
            // Deep obsidian chassis shadow
            BoxShadow(
              color: Colors.black.withOpacity(0.9),
              blurRadius: 35,
              offset: const Offset(0, 15),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(innerRadius),
          child: Stack(
            children: [
              // Screen Content
              Positioned.fill(child: child),

              // Top iOS Status Bar & Dynamic Island
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Time
                      Text(
                        time,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.2,
                        ),
                      ),

                      // Dynamic Island
                      if (showIsland)
                        Container(
                          width: 108,
                          height: 28,
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.8),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              // Camera sensor lens reflection
                              Container(
                                width: 10,
                                height: 10,
                                margin: const EdgeInsets.only(right: 12),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: const Color(0xFF0F172A),
                                  border: Border.all(color: const Color(0xFF1E293B), width: 1),
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Status icons (Cellular, Wifi, Battery)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.signal_cellular_alt_rounded, size: 14, color: Colors.white),
                          const SizedBox(width: 4),
                          const Icon(Icons.wifi_rounded, size: 14, color: Colors.white),
                          const SizedBox(width: 4),
                          Container(
                            width: 20,
                            height: 10,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(3),
                              border: Border.all(color: Colors.white, width: 1.2),
                            ),
                            padding: const EdgeInsets.all(1.2),
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(1.5),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // iOS Home Indicator Pill at bottom
              Positioned(
                bottom: 8,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    width: 125,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.35),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
