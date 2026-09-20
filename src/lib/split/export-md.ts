import { APP_UPDATED_LABEL, APP_VERSION } from "@/lib/app-version";
import { computeLedger, expenseSplitLabel, shareBreakdown } from "./calc";
import { formatMoney } from "./money";
import { tripSettlements } from "./settlement";
import {
  isActiveExpense,
  isCustomSplit,
  isOpenExpense,
  isSettledExpense,
  type Expense,
  type Member,
  type Settlement,
  type Trip,
} from "./types";

function shanghaiStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function memberName(members: Map<string, Member>, id: string): string {
  return members.get(id)?.name ?? "未知";
}

function expenseBlock(
  expense: Expense,
  members: Map<string, Member>,
): string[] {
  const payer = memberName(members, expense.payerId);
  const slices = shareBreakdown(expense);
  const lines = [
    `### ${expense.title}`,
    "",
    `- 金额：${formatMoney(expense.amountCents)}`,
    `- 付款：${payer}`,
    `- 分摊：${expenseSplitLabel(expense)}${isCustomSplit(expense) ? "（不是人均 AA）" : ""}`,
    `- 记账：${shanghaiStamp(expense.createdAt)}`,
  ];
  if (isSettledExpense(expense)) {
    lines.push("- 状态：已结算（线下结清，账单已锁定）");
  } else if (!isActiveExpense(expense)) {
    lines.push(`- 状态：已删除`);
    lines.push(`- 删除原因：${expense.deleteReason || "未填写"}`);
    if (expense.deletedAt) {
      lines.push(`- 删除时间：${shanghaiStamp(expense.deletedAt)}`);
    }
  } else {
    lines.push("- 状态：未结算");
  }
  if (slices.length > 0) {
    lines.push("");
    lines.push("每人承担：");
    for (const slice of slices) {
      lines.push(`- ${memberName(members, slice.memberId)}：${formatMoney(slice.cents)}`);
    }
  }
  lines.push("");
  return lines;
}

function settlementBlock(
  settlement: Settlement,
  members: Map<string, Member>,
  expenses: Expense[],
  index: number,
): string[] {
  const included = expenses.filter((e) => settlement.expenseIds.includes(e.id));
  const lines = [
    `### 第 ${index} 次提前结算`,
    "",
    `- 结算时间：${shanghaiStamp(settlement.createdAt)}`,
    `- 操作人：${settlement.createdBy ? memberName(members, settlement.createdBy) : "成员"}`,
    `- 锁定账单：${included.length} 笔`,
    "",
  ];
  if (settlement.transfers.length === 0) {
    lines.push("线下无需转账，当时账已经平了。");
    lines.push("");
  } else {
    lines.push("线下转账（当时的结法）：");
    for (const t of settlement.transfers) {
      lines.push(
        `- ${memberName(members, t.fromId)} → ${memberName(members, t.toId)} ${formatMoney(t.cents)}`,
      );
    }
    lines.push("");
  }
  if (included.length > 0) {
    lines.push("包含账单：");
    for (const e of included) {
      lines.push(`- ${e.title}（${formatMoney(e.amountCents)}）`);
    }
    lines.push("");
  }
  return lines;
}

export function exportTripMarkdown(trip: Trip): string {
  const members = new Map(
    trip.members.map((m) => [m.id, m] as const),
  );
  const ledger = computeLedger(trip);
  const settlements = [...tripSettlements(trip)].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  );
  const open = trip.expenses.filter(isOpenExpense);
  const settled = trip.expenses.filter(
    (e) => isActiveExpense(e) && isSettledExpense(e),
  );
  const deleted = trip.expenses.filter((e) => !isActiveExpense(e));
  const exportedAt = shanghaiStamp(new Date().toISOString());

  const lines: string[] = [
    `# ${trip.name} · 途账记录`,
    "",
    `- 应用版本：${APP_VERSION}`,
    `- 版本更新日期：${APP_UPDATED_LABEL}`,
    `- 导出时间：${exportedAt}`,
    `- 同行：${trip.members.map((m) => m.name).join("、") || "（无）"}`,
    "",
    "## 本期结余（未结算账单）",
    "",
    `| 成员 | 已付 | 应付 | 净额 |`,
    `| --- | ---: | ---: | ---: |`,
  ];

  for (const row of ledger.perPerson) {
    const name = memberName(members, row.memberId);
    const net =
      row.netCents > 0
        ? `应收 ${formatMoney(row.netCents)}`
        : row.netCents < 0
          ? `应付 ${formatMoney(-row.netCents)}`
          : "已平";
    lines.push(
      `| ${name} | ${formatMoney(row.paidCents)} | ${formatMoney(row.shareCents)} | ${net} |`,
    );
  }

  lines.push("");
  lines.push(`本期未结清：${formatMoney(ledger.unsettledCents)}`);
  lines.push("");
  lines.push("## 本期怎么还");
  lines.push("");
  if (ledger.transfers.length === 0) {
    lines.push("本期没有待转的钱。");
    lines.push("");
  } else {
    for (const t of ledger.transfers) {
      lines.push(
        `- ${memberName(members, t.fromId)} → ${memberName(members, t.toId)} ${formatMoney(t.cents)}`,
      );
    }
    lines.push("");
  }

  if (settlements.length > 0) {
    lines.push("## 提前结算记录");
    lines.push("");
    lines.push("结算在线下完成。确认结算后，对应账单已锁定，不能再改。");
    lines.push("");
    settlements.forEach((s, i) => {
      lines.push(...settlementBlock(s, members, trip.expenses, i + 1));
    });
  }

  lines.push("## 未结算账单");
  lines.push("");
  if (open.length === 0) {
    lines.push("没有未结算的账单。");
    lines.push("");
  } else {
    for (const expense of open) {
      lines.push(...expenseBlock(expense, members));
    }
  }

  if (settled.length > 0) {
    lines.push("## 已结算账单");
    lines.push("");
    for (const expense of settled) {
      lines.push(...expenseBlock(expense, members));
    }
  }

  if (deleted.length > 0) {
    lines.push("## 删除记录");
    lines.push("");
    for (const expense of deleted) {
      lines.push(...expenseBlock(expense, members));
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(`由途账 ${APP_VERSION} 导出。`);
  lines.push("");
  return lines.join("\n");
}

export function exportFileName(tripName: string, now = new Date()): string {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(now);
  const safe = tripName.replace(/[\\/:*?"<>|]+/g, "").trim() || "途账";
  return `${safe}-${stamp}.md`;
}

export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
