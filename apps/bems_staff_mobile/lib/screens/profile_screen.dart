import 'package:flutter/material.dart';
import '../core/theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _whatsappNotifications = true;
  bool _slackNotifications = true;
  bool _emailNotifications = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile & Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Profile Header Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: BemsTheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: BemsTheme.cardBorder),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: BemsTheme.primaryBlue.withOpacity(0.2),
                  child: const Text(
                    'TB',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: BemsTheme.primaryBlueLight,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Temitope Bakare',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Lead DevOps Engineer',
                        style: TextStyle(fontSize: 12, color: BemsTheme.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: BemsTheme.primaryBlue.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'ID: BEMS-TECH-0482',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BemsTheme.primaryBlueLight),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Organization & Banking Details
          const Text('Assignment & Disbursement Bank', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 8),

          Container(
            decoration: BoxDecoration(
              color: BemsTheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BemsTheme.cardBorder),
            ),
            child: Column(
              children: [
                _buildInfoTile(
                  icon: Icons.business_rounded,
                  label: 'Primary Subsidiary',
                  value: 'Bems Group Cloud & Technologies Ltd',
                ),
                const Divider(color: BemsTheme.cardBorder, height: 1),
                _buildInfoTile(
                  icon: Icons.badge_outlined,
                  label: 'Department',
                  value: 'Technology & DevOps',
                ),
                const Divider(color: BemsTheme.cardBorder, height: 1),
                _buildInfoTile(
                  icon: Icons.email_outlined,
                  label: 'Corporate Email',
                  value: 'temitope@bemsgroup.com',
                ),
                const Divider(color: BemsTheme.cardBorder, height: 1),
                _buildInfoTile(
                  icon: Icons.account_balance_rounded,
                  label: 'Advance Payout Account',
                  value: 'Access Bank · 0123456789',
                  badge: 'VERIFIED',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Notification Bridge Preferences
          const Text('Notification Bridge Hooks', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 4),
          const Text('Real-time alerts for HOD sign-offs, GMD approvals, and disbursement receipts', style: TextStyle(fontSize: 11, color: BemsTheme.textMuted)),
          const SizedBox(height: 10),

          Container(
            decoration: BoxDecoration(
              color: BemsTheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BemsTheme.cardBorder),
            ),
            child: Column(
              children: [
                SwitchListTile(
                  value: _whatsappNotifications,
                  title: const Text('WhatsApp Bot Bridge', style: TextStyle(fontSize: 13, color: Colors.white)),
                  subtitle: const Text('Direct status alert when money is transferred', style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary)),
                  activeColor: BemsTheme.successEmerald,
                  onChanged: (v) => setState(() => _whatsappNotifications = v),
                ),
                const Divider(color: BemsTheme.cardBorder, height: 1),
                SwitchListTile(
                  value: _slackNotifications,
                  title: const Text('Slack Channel Notifications', style: TextStyle(fontSize: 13, color: Colors.white)),
                  subtitle: const Text('Requests channel message ping on comments', style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary)),
                  activeColor: BemsTheme.primaryBlue,
                  onChanged: (v) => setState(() => _slackNotifications = v),
                ),
                const Divider(color: BemsTheme.cardBorder, height: 1),
                SwitchListTile(
                  value: _emailNotifications,
                  title: const Text('Email Notifications', style: TextStyle(fontSize: 13, color: Colors.white)),
                  subtitle: const Text('Official audit notification vouchers', style: TextStyle(fontSize: 11, color: BemsTheme.textSecondary)),
                  activeColor: BemsTheme.primaryBlue,
                  onChanged: (v) => setState(() => _emailNotifications = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // App version info
          Center(
            child: Column(
              children: const [
                Text(
                  'BEMS Staff Mobile v1.0.0 (Build 2026.1)',
                  style: TextStyle(fontSize: 11, color: BemsTheme.textMuted),
                ),
                SizedBox(height: 2),
                Text(
                  'Bems Group Holdings Ltd · Financial Accountability System',
                  style: TextStyle(fontSize: 10, color: BemsTheme.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String label,
    required String value,
    String? badge,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: BemsTheme.primaryBlueLight),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: BemsTheme.textMuted, fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          if (badge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: BemsTheme.successEmerald.withOpacity(0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                badge,
                style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: BemsTheme.successEmerald),
              ),
            ),
        ],
      ),
    );
  }
}
