import 'package:flutter_test/flutter_test.dart';
import 'package:bems_gmd_ai/main.dart';

void main() {
  testWidgets('BemsExecutiveAiApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const BemsExecutiveAiApp());
    expect(find.byType(BemsExecutiveAiApp), findsOneWidget);
  });
}
