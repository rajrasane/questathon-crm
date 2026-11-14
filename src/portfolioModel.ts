import type {Account, WorkspaceResponse} from './model';

export const opportunityStages = ['identified', 'qualified', 'cleared', 'agreed', 'other'] as const;
export type OpportunityStage = typeof opportunityStages[number];
export function stageKey(value: string): OpportunityStage {
  const normalized = value.trim().toLowerCase();
  return opportunityStages.includes(normalized as OpportunityStage) ? normalized as OpportunityStage : 'other';
}
export function opportunityMix(accounts: Account[]) {
  const counts: Record<OpportunityStage, number> = {identified: 0, qualified: 0, cleared: 0, agreed: 0, other: 0};
  for (const account of accounts) for (const deal of account.deals || []) counts[stageKey(deal.stage.text)]++;
  return {counts, total: Object.values(counts).reduce((a, b) => a + b, 0), missing: accounts.filter(a => a.deals === null).length};
}
export function connectionState(ingestion: WorkspaceResponse['ingestion'], now = Date.now()) {
  if (ingestion?.error) return {label: 'Check needs attention', tone: 'warning'};
  if (ingestion?.mode !== 'live') return {label: 'Cached workspace', tone: 'neutral'};
  if (ingestion.pendingResource || !ingestion.lastCheckedAt) return {label: 'Loading supporting records', tone: 'pending'};
  if (now - Date.parse(ingestion.lastCheckedAt) > 6 * 60_000) return {label: 'Signal check overdue', tone: 'warning'};
  return {label: 'Signal checks connected', tone: 'success'};
}
