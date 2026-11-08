/** Approved staff keep their own portal access during leave; suspension/termination always deny access. */
export function canAccessEmployeePortal(employee: { role: string; status: string; approvalStatus: string }) {
  return employee.approvalStatus === 'APPROVED' && ['STAFF', 'GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(employee.role) &&
    (employee.status === 'ACTIVE' || (employee.role === 'STAFF' && employee.status === 'ON_LEAVE'));
}
