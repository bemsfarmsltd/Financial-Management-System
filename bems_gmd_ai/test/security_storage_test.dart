import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bems_gmd_ai/models/auth_models.dart';
import 'package:bems_gmd_ai/services/chat_storage_service.dart';
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() { SharedPreferences.setMockInitialValues({}); FlutterSecureStorage.setMockInitialValues({}); });
  AuthUser user(String id) => AuthUser(id: id, email: '$id@example.invalid', fullName: id, role: 'GMD', token: 'private-token');
  test('session persists securely and logout removes it', () async {
    await ChatStorageService.saveUser(user('A'));
    expect((await ChatStorageService.getUser())?.token, 'private-token');
    expect((await SharedPreferences.getInstance()).getString('bems_auth_user'), isNull);
    await ChatStorageService.clearUser();
    expect(await ChatStorageService.getUser(), isNull);
  });
  test('unconfigured and another account PIN cannot unlock', () async {
    await ChatStorageService.saveUser(user('A'));
    expect(await ChatStorageService.verifySecurityPin('1234'), isFalse);
    expect(await ChatStorageService.verifySecurityPin('0000'), isFalse);
    await ChatStorageService.setSecurityPin('9837');
    expect(await ChatStorageService.verifySecurityPin('9837'), isTrue);
    await ChatStorageService.saveUser(user('B'));
    expect(await ChatStorageService.verifySecurityPin('9837'), isFalse);
  });
  test('chat history is scoped to the current account', () async {
    await ChatStorageService.saveUser(user('A'));
    await ChatStorageService.saveSessions([]);
    await ChatStorageService.setActiveSessionId('private-A');
    await ChatStorageService.saveUser(user('B'));
    expect(await ChatStorageService.getActiveSessionId(), isNull);
    await ChatStorageService.saveUser(user('A'));
    expect(await ChatStorageService.getActiveSessionId(), 'private-A');
  });
  test('missing role never defaults to an executive', () {
    expect(AuthUser.fromJson({'id': 'A'}).role, 'STAFF');
  });
}
