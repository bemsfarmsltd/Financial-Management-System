import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma';
import { resolveOrganizationScope, resolveAuthorizedOrganizationScope } from '../src/lib/organizations';
import { normalizeOrganizationIdentifier, isBemsGroup, assertGroupIdentityUpdate } from '../src/lib/organization-identity';
if (!process.env.DATABASE_URL?.includes('group_identity_')) throw new Error('Disposable group identity schema required.');
async function main() {
 const group=await prisma.organization.create({data:{code:'BEMS-GROUP',legalName:'BEMS Group',type:'GROUP'}});
 const children: Array<{id:string;code:string}>=[];
 for(let i=0;i<5;i++) children.push(await prisma.organization.create({data:{code:'SUB-'+i,legalName:'Subsidiary '+i,type:'SUBSIDIARY',...(i===0?{parentGroupId:group.id}:{})}}));
 const staff=await prisma.employee.create({data:{employeeNumber:'GROUP-TEST',legalName:'Test Staff',workEmail:'group-test@example.invalid',role:'STAFF',workLocation:'BEMS_GROUP_HQ'}});
 await prisma.employeeAssignment.create({data:{employeeId:staff.id,subsidiaryId:children[2].id,positionName:'Test'}});
 await prisma.$executeRawUnsafe(readFileSync('prisma/migrations/20261108000000_bems_group_identity/migration.sql','utf8'));
 assert.equal(await prisma.organization.count({where:{parentGroupId:group.id}}),5);
 assert.equal((await prisma.employee.findUniqueOrThrow({where:{id:staff.id}})).workLocation,'BEMS_GROUP');
 const expected=[group.id,...children.map(c=>c.id)].sort();
 for(const alias of [group.id,'BEMS-GROUP','bems-group-hq','BEMS_GROUP_HQ','group_hq','General HQ','BEMS Group','BEMS Group Holdings Ltd']) assert.deepEqual((await resolveOrganizationScope(alias)).organizationIds.sort(),expected,alias);
 const staffScope=await resolveAuthorizedOrganizationScope({...staff,canonicalRole:'STAFF',isExecutive:false,authSource:'HUMAN_SESSION'} as any,'BEMS-GROUP');
 assert.deepEqual(staffScope.organizationIds,[children[2].id]);
 assert.equal((await resolveOrganizationScope('unknown-org')).length,0);
 assert.equal(isBemsGroup({code:'BTECH',name:'BEMS Group Cloud & Technologies Ltd'}),false);
 assert.equal(normalizeOrganizationIdentifier('bems-group-hq'),'BEMS-GROUP');
 assert.throws(()=>assertGroupIdentityUpdate(group,{type:'SUBSIDIARY'}));
 assert.throws(()=>assertGroupIdentityUpdate(children[0],{type:'GROUP'}));
 assert.throws(()=>assertGroupIdentityUpdate(children[0],{legalName:'General HQ'}));
 assert.throws(()=>assertGroupIdentityUpdate(children[0],{legalName:'BEMS Group'}));
 assert.throws(()=>assertGroupIdentityUpdate(group,{legalName:'Headquarters'}));
 assertGroupIdentityUpdate(children[0],{legalName:'Renamed subsidiary'});
 // Migration is idempotent and does not create duplicate entities or assignments.
 await prisma.$executeRawUnsafe(readFileSync('prisma/migrations/20261108000000_bems_group_identity/migration.sql','utf8'));
 assert.equal(await prisma.organization.count(),6);assert.equal(await prisma.employeeAssignment.count(),1);
 console.log('PASS hierarchy repair, all group aliases, staff isolation, invalid-scope denial, identity protection and idempotency');
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1});
