import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bems_staff_app/models/staff_models.dart';
import 'package:bems_staff_app/services/staff_storage_service.dart';
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() { SharedPreferences.setMockInitialValues({}); FlutterSecureStorage.setMockInitialValues({}); });
  test('staff session persists securely and logout removes it', () async {
    await StaffStorageService.saveUser(const StaffUser(id: 'A', fullName: 'Staff', email: 'staff@example.invalid', token: 'private-token'));
    expect((await StaffStorageService.getUser())?.token, 'private-token');
    expect((await SharedPreferences.getInstance()).getString('bems_staff_user'), isNull);
    await StaffStorageService.clearUser();
    expect(await StaffStorageService.getUser(), isNull);
  });
  test('biometric credentials are absent from ordinary preferences', () async {
    await StaffStorageService.saveCredentials(email: 'staff@example.invalid', password: 'private-password');
    expect((await SharedPreferences.getInstance()).getString('bems_staff_saved_password'), isNull);
    expect((await StaffStorageService.getSavedCredentials())?['password'], 'private-password');
    await StaffStorageService.clearCredentials();
    expect(await StaffStorageService.getSavedCredentials(), isNull);
  });
}
