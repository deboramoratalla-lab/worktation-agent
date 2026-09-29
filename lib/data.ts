// Sample request data for the case study. Names and dates are invented.
// Risk levels come from the rules engine, never from the model.

export type Level = 'Low' | 'Medium' | 'High';
export type StepState = 'Done' | 'Working' | 'Waiting' | 'Needs you' | 'Blocked';
export type Owner = 'Approver' | 'Employee' | 'WorkFlex' | 'Agent' | 'You';

export type RiskDimension = { id: string; name: string; level: Level; why: string; rule: string };
export type Step = { id: string; title: string; owner: Owner; state: StepState; meta: string };
export type Doc = { id: string; name: string; meta: string; status: 'ready' | 'requested' | 'unverified' };
export type ActivityEntry = {
  id: string;
  kind: 'agent' | 'agent-failed' | 'decision' | 'comment' | 'system';
  title: string;
  body?: string;
  time: string;
  undoable?: boolean;
  source?: string;
};

export type WorkationRequest = {
  id: string;
  employee: string;
  role: string;
  from: { country: string; code: 'AT' };
  to: { country: string; code: 'TH' };
  dates: { start: string; end: string; label: string };
  workingDays: number;
  submitted: string; // ISO
  today: string; // ISO, the day the prototype pretends it is
  daysAbroad: { year: number; before: number; thisTrip: number; limit: number };
  risks: RiskDimension[];
  lowCount: number;
  steps: Step[];
  documents: Doc[];
  activity: ActivityEntry[];
  sourceChecks: { name: string; status: 'current' | 'unreachable' | 'missing' }[];
};

const base: WorkationRequest = {
  id: 'W-CDVNQZ',
  employee: 'Lili Mans',
  role: 'Software engineer',
  from: { country: 'Austria', code: 'AT' },
  to: { country: 'Thailand', code: 'TH' },
  dates: { start: '2026-05-04', end: '2026-05-08', label: '4 to 8 May 2026' },
  workingDays: 5,
  submitted: '2026-03-31',
  today: '2026-04-04',
  daysAbroad: { year: 2026, before: 21, thisTrip: 5, limit: 183 },
  risks: [
    { id: 'ss', name: 'Social security', level: 'Medium', why: 'A1 certificate needed. Issued by WorkFlex on 2 Apr.', rule: 'BT_WE_12' },
    { id: 'we', name: 'Work entitlement', level: 'Low', why: 'Business visa uploaded on 3 Apr covers remote work for 5 days.', rule: 'WE_TH_03' },
  ],
  lowCount: 8,
  steps: [
    { id: 'mgr', title: 'Manager approval', owner: 'Approver', state: 'Done', meta: 'Tom Weber · 31 Mar' },
    { id: 'visa', title: 'Thai business visa', owner: 'Employee', state: 'Done', meta: 'Uploaded by Lili · 3 Apr' },
    { id: 'a1', title: 'A1 certificate', owner: 'WorkFlex', state: 'Done', meta: 'Issued · 2 Apr' },
    { id: 'it', title: 'IT security approval', owner: 'Approver', state: 'Done', meta: 'Anna Roth · 3 Apr' },
  ],
  documents: [
    { id: 'visa', name: 'Thai business visa', meta: 'Uploaded by Lili · 3 Apr', status: 'ready' },
    { id: 'a1', name: 'A1 certificate', meta: 'Issued · 2 Apr', status: 'ready' },
    { id: 'report', name: 'Risk assessment report', meta: 'PDF · 10 pages · 31 Mar', status: 'ready' },
  ],
  activity: [
    { id: 'a-recheck', kind: 'agent', title: 'Agent re-checked the risk', body: 'Lili uploaded her business visa. Work entitlement is now low risk.', time: '3 Apr, 11:20 · auto', undoable: true },
    { id: 'a-it', kind: 'decision', title: 'Anna Roth approved IT security', time: '3 Apr, 09:12' },
    { id: 'a-visa', kind: 'agent', title: 'Agent asked Lili for her business visa', body: 'Why: work entitlement is high risk until a business visa is uploaded.', time: '1 Apr, 09:00 · auto' },
    { id: 'a-a1', kind: 'system', title: 'A1 certificate issued', time: '2 Apr, 15:40' },
    { id: 'a-mgr', kind: 'decision', title: 'Tom Weber approved as manager', time: '31 Mar, 16:20' },
  ],
  sourceChecks: [
    { name: 'Manager approval', status: 'current' },
    { name: 'Thai business visa', status: 'current' },
    { name: 'A1 certificate (issuer)', status: 'current' },
    { name: 'IT security approval', status: 'current' },
  ],
};

const clone = (r: WorkationRequest): WorkationRequest => JSON.parse(JSON.stringify(r));

// Each scenario is a different request in Laura's queue.
function as(r: WorkationRequest, full: string, id: string): WorkationRequest {
  const first = full.split(' ')[0];
  const out: WorkationRequest = JSON.parse(JSON.stringify(r).replace(/Lili Mans/g, full).replace(/Lili/g, first));
  out.id = id;
  return out;
}

export type ScenarioId = 'ready' | 'working' | 'check' | 'conflict';

export const scenarios: Record<ScenarioId, { label: string; build: () => WorkationRequest }> = {
  ready: { label: 'Ready for decision', build: () => clone(base) },
  working: {
    label: 'Agent working',
    build: () => {
      const r = clone(base);
      r.today = '2026-04-03';
      r.risks[1] = { ...r.risks[1], level: 'High', why: 'No business visa yet. Remote work on a tourist entry is not allowed in Thailand.' };
      r.steps[1] = { ...r.steps[1], owner: 'Agent', state: 'Working', meta: 'Agent asked Lili · 1 Apr' };
      r.steps[3] = { ...r.steps[3], state: 'Waiting', meta: 'Anna Roth · no reply since 31 Mar' };
      r.documents[0] = { ...r.documents[0], meta: 'Requested by the agent · 1 Apr', status: 'requested' };
      r.activity = r.activity.filter((a) => !['a-recheck', 'a-it'].includes(a.id));
      r.sourceChecks[1].status = 'missing';
      r.sourceChecks[3].status = 'missing';
      return as(r, 'Suba Kanchana', 'W-HT72LA');
    },
  },
  check: {
    label: "Agent couldn't verify",
    build: () => {
      const r = clone(base);
      r.steps[2] = { ...r.steps[2], owner: 'You', state: 'Needs you', meta: "Couldn't verify with issuer · Needs you" };
      r.documents[1] = { ...r.documents[1], meta: 'Issued · 2 Apr · not verified', status: 'unverified' };
      r.activity.unshift({ id: 'a-fail', kind: 'agent-failed', title: "Agent couldn't verify the A1 certificate", body: "Why: the issuer's portal timed out twice. The step is back with you.", time: '4 Apr, 10:42 · auto' });
      r.sourceChecks[2].status = 'unreachable';
      return as(r, 'Stefan Rade', 'W-PQ81MX');
    },
  },
  conflict: {
    label: 'Data conflict',
    build: () => {
      const r = clone(base);
      r.dates = { start: '2024-05-04', end: '2024-05-08', label: '4 to 8 May 2024' };
      return as(r, 'Mara Klein', 'W-ZK40RB');
    },
  },
};
