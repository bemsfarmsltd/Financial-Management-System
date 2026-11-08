import 'package:flutter_test/flutter_test.dart';
import 'package:bems_gmd_ai/models/workstation_scope.dart';
void main() {
 test('BEMS Group appears once above actual subsidiaries', () {
  final entries=WorkstationRepository.getWorkstations({'organizations':[
   {'code':'BEMS-GROUP','legalName':'BEMS Group','type':'GROUP'},
   {'code':'BTECH','legalName':'SmartAIRS','type':'SUBSIDIARY'},
  ]});
  expect(entries.length,2);expect(entries.first.fullName,'BEMS Group');expect(entries.last.code,'BTECH');
  expect(WorkstationRepository.isGroupScope('HQ'),isTrue);
  expect(WorkstationRepository.isGroupScope('BEMS-GROUP'),isTrue);
  expect(WorkstationRepository.isGroupScope('BTECH'),isFalse);
 });
}
