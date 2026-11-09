// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

Future<bool> downloadFile(String url, String filename) async {
  try {
    final anchor = html.AnchorElement(href: url)
      ..setAttribute('download', filename)
      ..target = '_blank';
    html.document.body?.children.add(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch (_) {
    html.window.open(url, '_blank');
    return true;
  }
}
