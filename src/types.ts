export type Intent = 'reconcile' | 'refund' | 'fee' | 'knowledge' | 'unsupported' | 'blocked';
export type MerchantId = 'demo-qinghe' | 'demo-yunji' | 'demo-xinghu';
export interface Scope {
  merchantId: MerchantId;
  billDate: string;
}
export interface Merchant {
  id: MerchantId;
  name: string;
  industry: string;
  feeBps: number;
}
export interface Trade {
  id: string;
  merchantId: MerchantId;
  date: string;
  amount: number;
  fee: number;
  status: 'SUCCESS';
}
export interface PosOrder {
  id: string;
  merchantId: MerchantId;
  date: string;
  amount: number;
}
export interface Refund {
  id: string;
  orderId: string;
  merchantId: MerchantId;
  date: string;
  amount: number;
  status: 'SUCCESS' | 'PROCESSING' | 'ABNORMAL';
}
export interface KnowledgeChunk {
  id: string;
  title: string;
  text: string;
  url: string;
  authority: 'official' | 'demo';
  updated: string;
  tags: string[];
}
export interface Evidence {
  id: string;
  title: string;
  detail: string;
  kind: 'ledger' | 'knowledge' | 'calculation';
  url?: string;
}
export interface Finding {
  id: string;
  category: 'duplicate' | 'missing-pos' | 'missing-bill' | 'amount' | 'fee' | 'refund';
  title: string;
  amount: number;
  severity: 'high' | 'medium' | 'low';
  detail: string;
  orderIds: string[];
}
export interface Reconciliation {
  tradeCount: number;
  posCount: number;
  gross: number;
  posGross: number;
  fee: number;
  refunds: number;
  pendingRefunds: number;
  net: number;
  difference: number;
  findings: Finding[];
  series: { date: string; gross: number; net: number }[];
}
export interface ToolStep {
  name: string;
  state: 'done' | 'blocked';
  detail: string;
}
export interface Answer {
  id: string;
  query: string;
  intent: Intent;
  status: 'answered' | 'clarify' | 'blocked';
  title: string;
  summary: string;
  sections: { title: string; content: string; evidenceIds: string[] }[];
  evidence: Evidence[];
  steps: ToolStep[];
  suggestions: string[];
  ticket?: { title: string; body: string; owner: string };
  latencyMs: number;
  engine: 'evidence' | 'hunyuan';
  modelNote?: string;
}
export interface AuditEvent {
  id: string;
  time: string;
  action: string;
  scope: Scope;
  detail: string;
}
export interface EvaluationCase {
  id: string;
  group: string;
  query: string;
  scope: Scope;
  expectedIntent: Intent;
  expectedStatus: Answer['status'];
  requiredEvidence: string[];
  forbiddenText?: string[];
}
export interface EvaluationResult {
  id: string;
  group: string;
  query: string;
  passed: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
  answer: Answer;
}
