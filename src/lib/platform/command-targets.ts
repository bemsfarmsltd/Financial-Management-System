import { redactUntrustedAndSensitiveFields } from '@/lib/platform/read-catalog';
import { createHash } from 'node:crypto';
import { resolveOrganizationScope } from '@/lib/organizations';

export interface TargetSnapshot { model: string; id: string; digest: string; preview?: unknown; lookup?: Record<string, any>; }
const targetFields: Array<[string, string[]]> = [
  ['expenditureRequest', ['request_id', 'requestId', 'request_ids']],
  ['employee', ['employee_id', 'employeeId', 'employee_ids', 'assigneeId']],
  ['budget', ['budget_id']],
  ['companyBankAccount', ['payer_account_id', 'payerAccountId', 'account_id']],
  ['accountabilityCase', ['case_id', 'caseId', 'accountabilityCaseId']], ['vendor', ['vendor_id', 'vendorId']],
  ['payrollItem', ['itemId', 'payrollItemId', 'itemIds']], ['payrollBatch', ['batchId']],
  ['leaveRequest', ['leaveId', 'leave_id']], ['followupTask', ['taskId', 'task_id']],
  ['organization', ['organization_id', 'organizationId', 'subsidiaryId', 'subsidiary_id', 'payer_org_id', 'payerOrgId', 'paymentEntityId', 'sourceEntityId', 'targetEntityId', 'source_entity_id', 'target_entity_id']],
  ['intercompanyNote', ['noteId', 'noteIds', 'targetNoteIds']],
  ['requestChannel', ['channelId']],
  ['attendanceStation', ['stationId']],
  ['approvalPolicy', []], ['workspaceSetting', []],
];
const genericModels: Record<string, string> = {
  subsidiary_update: 'organization', attendance_override: 'attendanceRecord',
  task_action: 'followupTask', leave_action: 'leaveRequest',
};
const includes: Record<string, object> = {
  accountabilityCase: { request: true }, requestChannel: { request: true },
  employee: { assignments: { orderBy: { id: 'asc' } } }, budget: { lines: { orderBy: { id: 'asc' } } },
  expenditureRequest: { approvalSteps: { orderBy: { id: 'asc' } }, requester: true, vendor: true }, payrollBatch: { items: { orderBy: { id: 'asc' }, include: { allocations: true } } },
  payrollItem: { employee: true, batch: true, allocations: true },
};
function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item)).digest('hex');
}
function readTarget(client: any, model: string, id: string, lookup?: Record<string, any>) {
  return client[model].findUnique({ where: lookup || { id }, ...(includes[model] ? { include: includes[model] } : {}) });
}
export async function captureCommandTargets(client: any, payload: Record<string, any>, actionType?: string): Promise<TargetSnapshot[]> {
  const targets: TargetSnapshot[] = [];
  const delegatedOrg = payload._delegated_organization_id;
  const allowed = delegatedOrg ? (await resolveOrganizationScope(delegatedOrg)).organizationIds : null;
  const definitions = targetFields.map(([model, fields]) => [model, [...fields]] as [string, string[]]);
  const generic = actionType && genericModels[actionType];
  if (generic && payload.id) {
    const existing = definitions.find(([model]) => model === generic);
    if (existing) existing[1].push('id'); else definitions.push([generic, ['id']]);
  }
  if (actionType === 'policy_update' && payload.id) definitions.find(([model]) => model === 'approvalPolicy')![1].push('id');
  for (const [model, fields] of definitions) {
    const ids = [...new Set(fields.flatMap(field => Array.isArray(payload[field]) ? payload[field] : payload[field] ? [payload[field]] : []).map(String))];
    for (const id of ids) {
      const record = await readTarget(client, model, id);
      if (!record) throw new Error('Resolve an exact ' + model + ' ID before staging.');
      if (allowed) {
        const entityId = model === 'organization' ? record.id : record.subsidiaryId || record.organizationId || record.payerOrgId || record.request?.subsidiaryId || record.batch?.paymentEntityId || record.paymentEntityId || record.scopeSubsidiaryId || record.sourceEntityId;
        if (entityId && !allowed.includes(entityId)) throw new Error('Target belongs to another delegated workspace.');
        if (record.targetEntityId && !allowed.includes(record.targetEntityId)) throw new Error('Both intercompany entities must be authorized.');
        const employeeId = model === 'employee' ? record.id : record.employeeId;
        if (employeeId) {
          const assignment = await client.employeeAssignment.findFirst({ where: { employeeId, status: 'ACTIVE', subsidiaryId: { in: allowed } } });
          if (!assignment) throw new Error('Target employee belongs to another delegated workspace.');
        }
        if (model === 'payrollBatch') {
          for (const item of record.items) {
            if (item.allocations.some((allocation: any) => !allowed.includes(allocation.subsidiaryId))) throw new Error('Use the group workspace for a payroll batch spanning entities.');
            if (!await client.employeeAssignment.findFirst({ where: { employeeId: item.employeeId, status: 'ACTIVE', subsidiaryId: { in: allowed } } })) throw new Error('Payroll staff belong to another workspace.');
          }
        }
      }
      targets.push({ model, id: record.id, digest: digest(record), preview: redactUntrustedAndSensitiveFields(record) });
    }
  }
  if (actionType === 'attendance_override' && ['UPDATE_POLICY', 'TOGGLE_STARLINK_LOCK', 'TOGGLE_GEOFENCE_LOCK', 'TOGGLE_POWER_OUTAGE'].includes(String(payload.action_type || payload.sub_action || '').toUpperCase())) {
    const organizations = payload.scope === 'GROUP' ? await client.organization.findMany({ where: { status: 'ACTIVE' }, select: { id: true } }) : [{ id: payload.organizationId || payload.subsidiaryId || delegatedOrg }];
    payload._policy_target_ids = organizations.map((organization: any) => organization.id).filter(Boolean);
    const stations = await client.attendanceStation.findMany({ where: { organizationId: { in: payload._policy_target_ids } } });
    payload._policy_station_ids = stations.map((station: any) => station.id);
    for (const station of stations) targets.push({ model: 'attendanceStation', id: station.id, digest: digest(station), preview: redactUntrustedAndSensitiveFields(station) });
    for (const organizationId of payload._policy_target_ids) {
      const lookup = { organizationId };
      const record = await client.attendancePolicy.findUnique({ where: lookup });
      targets.push({ model: 'attendancePolicy', id: organizationId, lookup, digest: digest(record), preview: redactUntrustedAndSensitiveFields(record) });
    }
  }
  if (actionType === 'policy_update' && ['UPDATE_WORKSPACE_SETTINGS', 'UPDATE_SETTINGS'].includes(String(payload.sub_action || '').toUpperCase())) {
    const organizationId = payload.organizationId || payload.organization_id || payload.subsidiaryId;
    if (!organizationId || !payload.key) throw new Error('Choose an exact settings entity and section.');
    const lookup = { organizationId_key: { organizationId, key: String(payload.key) } };
    const record = await client.workspaceSetting.findUnique({ where: lookup });
    targets.push({ model: 'workspaceSetting', id: organizationId + '/' + payload.key, lookup, digest: digest(record), preview: redactUntrustedAndSensitiveFields(record) });
  }
  return targets;
}
export async function assertCommandTargetsUnchanged(client: any, targets: TargetSnapshot[]) {
  const models = new Set([...targetFields.map(([model]) => model), ...Object.values(genericModels), 'attendancePolicy']);
  for (const target of targets) {
    if (!models.has(target.model)) throw new Error('Invalid proposal target.');
    const record = await readTarget(client, target.model, target.id, target.lookup);
    if (digest(record) !== target.digest) throw new Error('The target changed. Request a fresh preview before approval.');
  }
}
