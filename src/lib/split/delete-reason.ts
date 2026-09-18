/** Require a short, explicit reason so deletion history is readable. */
export function normalizeDeleteReason(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length < 2) {
    throw new Error("请写清楚删除原因，至少 2 个字");
  }
  if (text.length > 80) {
    throw new Error("删除原因请控制在 80 字以内");
  }
  return text;
}

export const DELETE_REASON_PRESETS = ["记错了", "重复记账", "已经退款", "不算进这次 AA"] as const;
