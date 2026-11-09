import 'package:url_launcher/url_launcher.dart';

Future<bool> downloadFile(String url, String filename) async {
  try {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      return await launchUrl(uri, mode: LaunchMode.platformDefault);
    }
  } catch (_) {
    return false;
  }
}
