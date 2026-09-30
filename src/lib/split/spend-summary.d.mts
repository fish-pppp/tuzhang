export type SpendSummaryInput = {
  id: string;
  title?: string;
  groupId?: string;
  groupName?: string;
  amountCents?: number;
  myShareCents?: number;
  paidByMe?: boolean;
  createdAt?: string;
  settled?: boolean;
};

export type SpendSummaryLine = {
  id: string;
  title: string;
  groupId: string;
  groupName: string;
  amountCents: number;
  myShareCents: number;
  createdAt: string;
  settled: boolean;
  partId: string;
  percent: number;
};

export type SpendSummaryPart = {
  id: string;
  label: string;
  cents: number;
  percent: number;
  bills: SpendSummaryLine[];
};

export type SpendSummaryGroup = {
  id: string;
  name: string;
  cents: number;
  percent: number;
  bills: SpendSummaryLine[];
};

export type SpendSummary = {
  totalShareCents: number;
  paidCents: number;
  billCount: number;
  parts: SpendSummaryPart[];
  groups: SpendSummaryGroup[];
  bills: SpendSummaryLine[];
};

export const SPEND_PARTS: ReadonlyArray<{ id: string; label: string; keywords: readonly string[] }>;

export const SPEND_PART_IDS: readonly string[];

export function spendPartLabel(id: string): string;
export function spendTitleKey(title: string): string;
export function normalizeSpendPartId(value: unknown): string | null;
export function partsFromModelChoices(
  titles: readonly string[],
  choices: ReadonlyArray<{ id?: string | number; part?: string } | null | undefined>,
): Record<string, string>;
export function classifySpendTitle(title: string): string;
export function allocatePercents(weights: number[], total: number): number[];
export function formatSpendPercent(value: number): string;
export function summarizeSpend(
  bills: readonly SpendSummaryInput[],
  partOverrides?: Readonly<Record<string, string>> | null,
): SpendSummary;
