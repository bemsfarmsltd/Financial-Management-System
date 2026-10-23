import 'package:flutter_test/flutter_test.dart';
import 'package:bems_staff_app/main.dart';

void main() {
  testWidgets('App starts smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const BemsStaffApp());
    expect(find.byType(BemsStaffApp), findsOneWidget);
  });
}
