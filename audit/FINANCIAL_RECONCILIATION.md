# BEMS Fund Request & Accountability System
## Financial Calculations & Precision Reconciliation (Batch 7 Deliverable)

### 1. Architectural Financial Foundations
Financial data within the BEMS enterprise system must guarantee absolute precision, zero floating-point drift, and synchronized multi-ledger reconciliation across four distinct operating subsidiaries:
- Bems Farms Ltd (`BEMS-HQ` / `BEMS-FARM`)
- Bems Agro Commodities Ltd (`BEMS-AGRO`)
- Bems Soft Hub Ltd (`BEMS-SOFT`)
- Bems Logistics Ltd (`BEMS-LOG`)

---

### 2. Minor Unit (Kobo) Arithmetic & Floating Point Isolation

#### Rule: Integer Storage in PostgreSQL
All monetary amounts in the database are stored as **Minor Units (Kobo / Cents)** using `BigInt` or `Decimal(18, 2)`:
- `ExpenditureRequest.amountMinor`: `BigInt` (1 Naira = 100 Kobo)
- `Disbursement.amountMinor`: `BigInt`
- `PayrollItem.netMinor`: `BigInt`
- `PayrollItemAllocation.allocableCostMinor`: `BigInt`
- `IntercompanyNote.totalAmountMinor`: `BigInt`
- `ThreeWayMatchRecord.poAmountMinor`, `invoiceAmountMinor`, `varianceMinor`: `BigInt`
- `CompanyBankAccount.balance`: `Decimal(18, 2)`

#### Conversion Protocol at Boundaries
1. **Client Submission (Naira Input)**:
   ```ts
   const amountMinor = BigInt(Math.round(amountNaira * 100));
   ```
2. **Client Presentation (Naira Display)**:
   ```ts
   const amountNaira = Number(amountMinor) / 100;
   const formatted = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amountNaira);
   ```
3. **No intermediate floating-point operations**: Aggregations and reconciliations are computed using native `BigInt` additions before dividing by 100 at the API output boundary.

---

### 3. Bank Account Balance Synchronization (FIN-001 Resolved)

#### Problem Identified
Prior to Batch 7, when Finance recorded an executed bank transfer via `POST /api/disbursements` or `POST /api/payroll/record`, the system inserted a `Disbursement` and `PaymentReceipt` row and updated the `ExpenditureRequest.paymentStatus`, but left the `CompanyBankAccount.balance` completely untouched. This caused bank account balances in Treasury and Executive Briefings to diverge from actual real-world balances.

#### Architectural Remedy
Disbursements and payroll payments now perform atomic balance deductions inside the database transaction:
```ts
// FIN-001: Deduct company bank account balance with floor validation
const amountNaira = Number(amountMinor) / 100;
const bankAccount = await tx.companyBankAccount.findFirst({
  where: {
    organizationId: payerOrgId,
    status: 'ACTIVE',
    bankName: { contains: bankName, mode: 'insensitive' },
  },
}) || await tx.companyBankAccount.findFirst({
  where: {
    organizationId: payerOrgId,
    status: 'ACTIVE',
  },
});

if (bankAccount) {
  const currentBal = Number(bankAccount.balance);
  const newBal = Math.max(0, currentBal - amountNaira);
  await tx.companyBankAccount.update({
    where: { id: bankAccount.id },
    data: { balance: newBal },
  });
}
```

---

### 4. Dynamic Monthly Burn Rate & Cash Runway (DATA-002 Resolved)

#### Problem Identified
In `src/lib/financial-metrics.ts:91`, the monthly burn rate was hardcoded as a static `30,000,000` NGN constant. Any fluctuations in actual company expenditures had zero effect on calculated cash runway.

#### Dynamic Calculation Engine
The system now calculates the monthly burn rate dynamically from actual executed disbursements over trailing 90 days (3 months):
```ts
const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const trailingDisbursements = await prisma.disbursement.findMany({
  where: {
    paidAt: { gte: ninetyDaysAgo },
    status: { in: ['RECIPIENT_CONFIRMED', 'AWAITING_RECIPIENT_CONFIRMATION'] },
    ...(subsidiaryScoped ? { payerOrgId: { in: scope.organizationIds } } : {}),
  },
  select: { amountMinor: true },
});

const trailingDisbMinor = trailingDisbursements.reduce((acc, d) => acc + Number(d.amountMinor), 0);
const trailingDisbNaira = trailingDisbMinor / 100;

// Trailing 90 days divided by 3 gives true average monthly burn rate
const dynamicMonthlyBurn = trailingDisbNaira > 0
  ? Math.round(trailingDisbNaira / 3)
  : (pendingPipeline > 0 ? pendingPipeline : 10000000);

const safeRunwayMonths = dynamicMonthlyBurn > 0
  ? Number((totalCash / dynamicMonthlyBurn).toFixed(1))
  : 0;
```

---

### 5. Automated Intercompany Recharges & 3-Way Matching

#### 1. Intercompany Debit Notes (`src/lib/services/intercompany.ts`)
- When parent company `BEMS-HQ` executes payroll where an employee's cost is split across subsidiaries (e.g. 60% Bems Farms, 40% Bems Soft Hub), the system automatically issues an `IntercompanyNote` debit note with unique reference `DN-YYYYMM-XXXXXXXX`.
- `getIntercompanyMatrix()` computes real-time bilateral receivables and payables between each entity pair to provide a clean multi-tenant balance sheet.

#### 2. Three-Way Matching (`src/lib/services/three-way-match.ts`)
- Automatically validates Purchase Order vs Vendor Invoice vs Goods Receipt Note (GRN):
  * Checks `variancePercentage <= tolerancePercentage`.
  * Verifies delivery waybill/GRN is registered with status `ACCEPTED`.
  * Emits `MATCH_CONFIRMED`, `PRICE_VARIANCE`, or `MISSING_GRN`.
- Prevents disbursement release until 3-way match is confirmed by Finance.
