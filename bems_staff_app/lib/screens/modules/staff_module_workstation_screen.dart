import 'package:flutter/material.dart';
import '../../models/staff_models.dart';

class ModuleConfig {
  final String id;
  final String eyebrow;
  final String title;
  final String subtitle;
  final String description;
  final IconData icon;
  final List<Color> gradientColors;
  final String statusText;
  final List<Map<String, dynamic>> quickActions;
  final List<Map<String, String>> metricCards;
  final List<Map<String, String>> sampleTasks;

  const ModuleConfig({
    required this.id,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.icon,
    required this.gradientColors,
    required this.statusText,
    required this.quickActions,
    required this.metricCards,
    required this.sampleTasks,
  });
}

class StaffModuleWorkstationScreen extends StatelessWidget {
  final StaffUser user;
  final ModuleConfig config;

  const StaffModuleWorkstationScreen({
    super.key,
    required this.user,
    required this.config,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(config.title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 14),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text(config.statusText, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF334155))),
              ],
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          // Hero Module Banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: config.gradientColors,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(22),
              boxShadow: [
                BoxShadow(color: config.gradientColors.first.withOpacity(0.25), blurRadius: 14, offset: const Offset(0, 5)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.18), borderRadius: BorderRadius.circular(20)),
                      child: Text(config.eyebrow, style: const TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w900, letterSpacing: 0.8)),
                    ),
                    Icon(config.icon, color: Colors.white, size: 26),
                  ],
                ),
                const SizedBox(height: 14),
                Text(config.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white)),
                const SizedBox(height: 4),
                Text(config.description, style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.9), height: 1.35)),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Real-Time Module Key Metrics
          Row(
            children: config.metricCards.map((m) {
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: m == config.metricCards.last ? 0 : 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(m['label'] ?? '', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(m['value'] ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                      const SizedBox(height: 2),
                      Text(m['sub'] ?? '', style: const TextStyle(fontSize: 9.5, color: Color(0xFF10B981), fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 22),

          // Workstation Quick Actions
          const Text('Operational Actions', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
          const SizedBox(height: 12),

          ...config.quickActions.map((qa) {
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (qa['color'] as Color? ?? const Color(0xFFEA580C)).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(qa['icon'] as IconData? ?? Icons.star_rounded, color: qa['color'] as Color? ?? const Color(0xFFEA580C), size: 20),
                ),
                title: Text(qa['title'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A))),
                subtitle: Text(qa['desc'] as String? ?? '', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('${qa['title']} initiated for ${user.fullName}'), backgroundColor: const Color(0xFF059669)),
                  );
                },
              ),
            );
          }),

          const SizedBox(height: 20),

          // Active Records / Tasks
          const Text('Active Shift Logs & Manifest', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E8F0))),
            child: Column(
              children: config.sampleTasks.map((t) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(t['task'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF0F172A))),
                            Text(t['details'] ?? '', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                      Text(t['time'] ?? '', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8))),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

