import 'package:flutter/material.dart';
import '../../models/staff_models.dart';
import '../../services/staff_api_service.dart';
import '../../services/staff_storage_service.dart';
String walletMoney(String value){final amount=BigInt.parse(value),abs=BigInt.parse(value).abs();final whole=(abs~/BigInt.from(100)).toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'),(m)=>'${m[1]},');return '${amount.isNegative?'-':''}₦$whole.${(abs%BigInt.from(100)).toString().padLeft(2,'0')}';}
String _minor(String value){if(!RegExp(r'^(0|[1-9]\d*)(\.\d{1,2})?$').hasMatch(value))throw Exception('Enter a naira amount with at most two decimal places.');final p=value.split('.');return(BigInt.parse(p[0])*BigInt.from(100)+BigInt.parse(p.length==1?'0':p[1].padRight(2,'0'))).toString();}
class StaffWalletScreen extends StatefulWidget{
 final StaffUser user;const StaffWalletScreen({super.key,required this.user});
 @override State<StaffWalletScreen> createState()=>_StaffWalletScreenState();
}
class _StaffWalletScreenState extends State<StaffWalletScreen>{
 late Future<Map<String,dynamic>> _wallet;bool _busy=false;
 @override void initState(){super.initState();_wallet=StaffApiService.getOwnWallet(widget.user);}
 void _reload(){setState(()=>_wallet=StaffApiService.getOwnWallet(widget.user));}
 Future<String?> _password(String title,String details) async{
  final controller=TextEditingController();
  final result=await showDialog<String>(context:context,builder:(c)=>AlertDialog(title:Text(title),content:Column(mainAxisSize:MainAxisSize.min,children:[Text(details),TextField(controller:controller,obscureText:true,autofillHints:const[AutofillHints.password],decoration:const InputDecoration(labelText:'Current account password'))]),actions:[TextButton(onPressed:()=>Navigator.pop(c),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,controller.text),child:const Text('Confirm exact transaction'))]));
  // Dispose after the dialog's closing animation no longer uses its controller.
  await Future<void>.delayed(const Duration(milliseconds:250));controller.dispose();return result;
 }
 Future<void> _bank() async{
  final number=TextEditingController();String? code;
  try{
   final banks=await StaffApiService.walletBanks(widget.user);if(!mounted)return;
   final ok=await showDialog<bool>(context:context,builder:(c)=>StatefulBuilder(builder:(c,set)=>AlertDialog(title:const Text('Verify your withdrawal bank'),content:Column(mainAxisSize:MainAxisSize.min,children:[DropdownButtonFormField<String>(value:code,isExpanded:true,hint:const Text('Choose bank'),items:banks.map((b)=>DropdownMenuItem<String>(value:b['code'] as String,child:Text(b['name'] as String,overflow:TextOverflow.ellipsis))).toList(),onChanged:(v)=>set(()=>code=v)),TextField(controller:number,keyboardType:TextInputType.number,maxLength:10,decoration:const InputDecoration(labelText:'Your account number')),const Text('Account name must match your staff identity.')]),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Continue'))])));
   if(ok!=true||!mounted)return;
   final password=await _password('Confirm bank verification','Verify your own account ending ${number.text.length>=4?number.text.substring(number.text.length-4):number.text}.');if(password==null||!mounted)return;
   setState(()=>_busy=true);await StaffApiService.walletRequest(widget.user,'bank',{'accountNumber':number.text,'bankCode':code,'password':password});
   if(mounted){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Bank account verified.')));_reload();}
  }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}finally{number.dispose();if(mounted)setState(()=>_busy=false);}
 }
 Future<void> _withdraw(Map<String,dynamic> wallet) async{
  final banks=wallet['banks'] as List<dynamic>;final credits=(wallet['credits'] as List<dynamic>).where((c)=>BigInt.parse(c['availableMinor'] as String)>BigInt.zero).toList();
  if(banks.isEmpty||credits.isEmpty){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Verify your bank and select available GMD-approved funds first.')));return;}
  final amount=TextEditingController();String? credit;
  try{
   final ok=await showDialog<bool>(context:context,builder:(c)=>StatefulBuilder(builder:(c,set)=>AlertDialog(title:const Text('Withdraw approved funds'),content:Column(mainAxisSize:MainAxisSize.min,children:[DropdownButtonFormField<String>(value:credit,isExpanded:true,hint:const Text('Choose approved source'),items:[const DropdownMenuItem<String>(value:'ALL',child:Text('Combine approved sources, oldest first')),...credits.map((x)=>DropdownMenuItem<String>(value:x['id'] as String,child:Text('${x['category']} · ${walletMoney(x['availableMinor'] as String)}',overflow:TextOverflow.ellipsis)))],onChanged:(v)=>set(()=>credit=v)),TextField(controller:amount,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Amount (₦)')),Text('Bank account ending ${banks[0]['lastFour']}. The company pays transfer fees.')]),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Review withdrawal'))])));
   if(ok!=true||credit==null||!mounted)return;
   final amountMinor=_minor(amount.text);final password=await _password('Confirm withdrawal','${walletMoney(amountMinor)} to your verified account ending ${banks[0]['lastFour']}. No second GMD approval is required.');if(password==null||!mounted)return;
   setState(()=>_busy=true);
   var candidate=<String,dynamic>{'amountMinor':amountMinor,'bankAccountId':banks[0]['id'],'idempotencyKey':'mobile-${DateTime.now().microsecondsSinceEpoch}-$credit','creditAllocations':[{'creditLotId':credit,'amountMinor':amountMinor}]};
   if(credit=='ALL'){final plan=await StaffApiService.walletRequest(widget.user,'withdrawal-plan',candidate);candidate=Map<String,dynamic>.from(plan['intent'] as Map);}
   final intent=await StaffStorageService.walletIntent(widget.user.id,candidate);
   final proof=await StaffApiService.walletRequest(widget.user,'challenges',{'purpose':'WITHDRAWAL','payload':intent,'password':password});
   final result=await StaffApiService.walletRequest(widget.user,'withdrawals',{'intent':intent,'challengeId':proof['id'],'challengeToken':proof['token']});
   await StaffStorageService.clearWalletIntent(widget.user.id);
   if(mounted){ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Withdrawal ${result['reference']}: ${result['status']}. Check status before another payment.')));_reload();}
  }catch(e){if(mounted){ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e Refresh withdrawal history before retrying.')));_reload();}}finally{amount.dispose();if(mounted)setState(()=>_busy=false);}
 }
 Future<void> _returnFunds(Map<String,dynamic> wallet) async{
  final credits=(wallet['credits'] as List<dynamic>).where((c)=>['PROJECT','REQUEST'].contains(c['category'])&&BigInt.parse(c['availableMinor'] as String)>BigInt.zero).toList();
  if(credits.isEmpty){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('No unused project funds are available to return.')));return;}
  final amount=TextEditingController(),reason=TextEditingController();String? credit;
  try{final ok=await showDialog<bool>(context:context,builder:(c)=>StatefulBuilder(builder:(c,set)=>AlertDialog(title:const Text('Return unused project funds'),content:Column(mainAxisSize:MainAxisSize.min,children:[DropdownButtonFormField<String>(value:credit,isExpanded:true,hint:const Text('Choose project source'),items:credits.map((x)=>DropdownMenuItem<String>(value:x['id'] as String,child:Text('${x['category']} · ${walletMoney(x['availableMinor'] as String)}'))).toList(),onChanged:(v)=>set(()=>credit=v)),TextField(controller:amount,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Amount (₦)')),TextField(controller:reason,decoration:const InputDecoration(labelText:'Reason')),const Text('This returns your unused entitlement to company funding. It cannot claw back salary or reimbursement.')]),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Review return'))])));
   if(ok!=true||credit==null||!mounted)return;final value=_minor(amount.text);final password=await _password('Confirm project return','Return ${walletMoney(value)} of unused project funds to the company.');if(password==null||!mounted)return;
   setState(()=>_busy=true);final intent={'creditLotId':credit,'amountMinor':value,'reason':reason.text,'idempotencyKey':'return-${DateTime.now().microsecondsSinceEpoch}'};
   final proof=await StaffApiService.walletRequest(widget.user,'challenges',{'purpose':'RETURN_PROJECT','payload':intent,'password':password});await StaffApiService.walletRequest(widget.user,'project-returns',{'intent':intent,'challengeId':proof['id'],'challengeToken':proof['token']});if(mounted)_reload();
  }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}finally{amount.dispose();reason.dispose();if(mounted)setState(()=>_busy=false);}
 }
 Future<void> _cancel(String id) async{setState(()=>_busy=true);try{await StaffApiService.walletRequest(widget.user,'withdrawals/$id/cancel',{});if(mounted)_reload();}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}finally{if(mounted)setState(()=>_busy=false);}}
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('My wallet'),actions:[IconButton(onPressed:_busy?null:_reload,tooltip:'Refresh wallet',icon:const Icon(Icons.refresh))]),body:FutureBuilder<Map<String,dynamic>>(future:_wallet,builder:(context,snapshot){
  if(snapshot.hasError)return Center(child:Padding(padding:const EdgeInsets.all(24),child:Column(mainAxisSize:MainAxisSize.min,children:[Text(snapshot.error.toString()),TextButton(onPressed:_reload,child:const Text('Retry'))])));
  if(!snapshot.hasData)return const Center(child:CircularProgressIndicator());final wallet=snapshot.data!,credits=wallet['credits'] as List<dynamic>,withdrawals=wallet['withdrawals'] as List<dynamic>;
  return ListView(padding:const EdgeInsets.all(20),children:[if(wallet['environment']=='sandbox')const Text('Sandbox wallet - test funds',style:TextStyle(fontWeight:FontWeight.bold)),const Text('Only GMD-approved funds can be withdrawn. Wallet credit and bank transfer are separate events.'),for(final m in [('Approved available','availableMinor'),('Pending withdrawals','heldMinor'),('Bank settled','settledMinor')])Card(child:ListTile(title:Text(m.$1),subtitle:Text(walletMoney(wallet[m.$2] as String),style:const TextStyle(fontSize:24,fontWeight:FontWeight.bold)))),Text(wallet['withdrawalMessage'] as String),for(final b in wallet['banks'] as List<dynamic>)Text('${b['accountName']} · account ending ${b['lastFour']}'),OutlinedButton(onPressed:_busy?null:_bank,child:const Text('Verify or change my bank account')),FilledButton(onPressed:_busy||wallet['withdrawalsEnabled']!=true?null:()=>_withdraw(wallet),child:Text(wallet['withdrawalsEnabled']==true?'Withdraw approved funds':'Transfers awaiting company activation')),OutlinedButton(onPressed:_busy?null:()=>_returnFunds(wallet),child:const Text('Return unused project funds')),const SizedBox(height:20),const Text('Source-linked credits',style:TextStyle(fontSize:20,fontWeight:FontWeight.bold)),if(credits.isEmpty)const Text('No approved credits yet.'),for(final c in credits)Card(child:ListTile(title:Text(c['category'] as String),subtitle:Text('${walletMoney(c['availableMinor'] as String)} available · ${c['sourceType']}'))),const SizedBox(height:20),const Text('Withdrawal history',style:TextStyle(fontSize:20,fontWeight:FontWeight.bold)),for(final w in withdrawals)Card(child:ListTile(title:Text('${walletMoney(w['amountMinor'] as String)} · ${w['status']}'),subtitle:Text('${w['reference']}\nCompany fee ${walletMoney(w['feeMinor'] as String)}'),trailing:w['status']=='HELD'?TextButton(onPressed:_busy?null:()=>_cancel(w['id'] as String),child:const Text('Cancel queued')):null))]);
 }));
}
