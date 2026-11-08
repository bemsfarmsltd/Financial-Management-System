import 'package:flutter_test/flutter_test.dart';
import 'package:bems_staff_app/screens/wallet/staff_wallet_screen.dart';
void main() {
  test('Wallet money formatting preserves exact kobo and large integer values', () {
    expect(walletMoney('0'), '₦0.00');
    expect(walletMoney('10001'), '₦100.01');
    expect(walletMoney('999999999999999'), '₦9,999,999,999,999.99');
    expect(walletMoney('-101'), '-₦1.01');
  });
}
