import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';
import type { AuthenticatedAiActor } from '@/lib/ai-tools-auth';

// All model reads made by an AI tool inherit the verified workspace, including
// lists nested in include/select. A query parameter can narrow this boundary.
export async function getAiReadClient(actor: AuthenticatedAiActor) {
  const scope = await resolveAuthorizedOrganizationScope(actor as any, actor.scopedOrganizationId || 'ALL');
  const ids = scope.organizationIds;
  const employee = { assignments: { some: { subsidiaryId: { in: ids }, status: 'ACTIVE' } } };
  const filters: Record<string, any> = {
    WalletBudgetEnvelope: { organizationId: { in: ids } },
    WalletCreditLot: { organizationId: { in: ids }, ...(!actor.isExecutive ? { employeeId: actor.id } : {}) },
    Organization: { id: { in: ids } }, Department: { organizationId: { in: ids } },
    Employee: actor.isExecutive ? employee : { id: actor.id },
    EmployeeAssignment: { subsidiaryId: { in: ids } }, CompanyBankAccount: { organizationId: { in: ids } },
    WorkspaceSetting: { organizationId: { in: ids } }, Budget: { organizationId: { in: ids } },
    BudgetLine: { budget: { organizationId: { in: ids } } },
    ExpenditureRequest: { subsidiaryId: { in: ids }, ...(!actor.isExecutive ? { requestedById: actor.id } : {}) },
    Disbursement: { payerOrgId: { in: ids } },
    AccountabilityCase: { request: { subsidiaryId: { in: ids } } },
    AttendanceStation: { organizationId: { in: ids } }, AttendancePolicy: { organizationId: { in: ids } },
    AttendanceRecord: { employee }, StaffWorkSchedule: { employee }, LeaveRequest: { employee },
    PayrollItem: { employee }, PayrollBatch: { items: { some: { employee } } },
    PayrollPeriod: { batches: { some: { items: { some: { employee } } } } },
    PayrollItemAllocation: { subsidiaryId: { in: ids } },
    StaffAdminMessage: { employee }, FollowupTask: { assignee: employee },
    IntercompanyNote: { sourceEntityId: { in: ids }, targetEntityId: { in: ids } },
    VendorInvoice: { request: { subsidiaryId: { in: ids } } }, GoodsReceiptNote: { request: { subsidiaryId: { in: ids } } },
    ThreeWayMatchRecord: { request: { subsidiaryId: { in: ids } } },
    AuditEvent: { subsidiaryId: { in: ids } }, SystemNotification: { employeeId: actor.id },
  };
  const models = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));
  function narrow(model: string, args: any, filterRoot = true) {
    const filter = filters[model];
    if (filter && filterRoot) args.where = { ...args.where, AND: [...(Array.isArray(args.where?.AND) ? args.where.AND : args.where?.AND ? [args.where.AND] : []), filter] };
    for (const key of ['include', 'select']) {
      for (const [name, value] of Object.entries(args[key] || {})) {
        const field = models.get(model)?.fields.find(item => item.name === name && item.kind === 'object');
        if (!field || !value) continue;
        const nested = value === true ? {} : { ...(value as object) };
        narrow(field.type, nested, field.isList);
        if (Object.keys(nested).length) args[key][name] = nested;
      }
    }
  }
  return prisma.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    if (!['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
      throw new Error('AI tools can only read business records or create proposals.');
    }
    if (model.startsWith('Wallet') && !filters[model]) throw new Error('Use a dedicated scoped wallet projection for this record.');
    const scopedArgs: any = { ...args };
    narrow(model, scopedArgs);
    return query(scopedArgs);
  } } } }) as unknown as typeof prisma;
}
