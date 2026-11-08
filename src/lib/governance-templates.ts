export const GOVERNANCE_TEMPLATES = [
  { id: 'tpl-fund-request-standard', title: 'Fund request decision controls', description: 'Require a reason when an executive makes an approval decision.', settings: { 'approval.controls': { requireDecisionReason: true } } },
  { id: 'tpl-accountability-72h', title: '72-hour accountability', description: 'Set standard accountability to 72 hours and emergency accountability to 24 hours.', settings: { 'accountability.controls': { standardHours: 72, emergencyHours: 24 } } },
  { id: 'standard_corporate', title: 'Standard corporate governance', description: 'Apply decision reasons and the 72-hour accountability settings together.', settings: { 'approval.controls': { requireDecisionReason: true }, 'accountability.controls': { standardHours: 72, emergencyHours: 24 } } },
] as const;
