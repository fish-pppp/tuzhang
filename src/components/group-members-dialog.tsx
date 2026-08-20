import { useState } from "react";
import { Copy } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Member } from "@/lib/split/types";

export function GroupMembersDialog({
  open,
  onOpenChange,
  members,
  meId,
  inviteCode,
  createdBy,
  onUpdateMyName,
  onLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  meId: string | null;
  inviteCode?: string;
  createdBy?: string;
  onUpdateMyName?: (name: string) => void | Promise<void>;
  onLeave?: () => void;
}) {
  const me = members.find((m) => m.id === meId);
  const [name, setName] = useState(me?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function copyInvite() {
    if (!inviteCode) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${inviteCode}`
        : inviteCode;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !onUpdateMyName) return;
    setSaving(true);
    try {
      await onUpdateMyName(trimmed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setConfirmLeave(false);
          setName(me?.name ?? "");
        } else {
          setName(me?.name ?? "");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>群组成员</DialogTitle>
          <DialogDescription>
            每个人登录后用自己的账号出现在这里。把邀请码发给还没加入的人。
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {inviteCode ? (
            <div className="rounded-xl bg-bg-elevated px-4 py-3">
              <p className="text-xs text-muted">邀请码</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-[0.18em]">
                {inviteCode}
              </p>
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
              >
                <Copy className="size-3" />
                {copied ? "已复制邀请链接" : "复制邀请链接"}
              </button>
            </div>
          ) : null}

          {onUpdateMyName && me ? (
            <form onSubmit={(e) => void saveName(e)} className="space-y-2">
              <Label htmlFor="my-group-name">我在群里的称呼</Label>
              <div className="flex gap-2">
                <Input
                  id="my-group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={saving || !name.trim() || name.trim() === me.name}
                >
                  保存
                </Button>
              </div>
            </form>
          ) : null}

          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg bg-bg-elevated px-3 py-2"
              >
                <MemberAvatar member={m} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.id === meId ? (
                      <span className="ml-1 font-normal text-muted">我</span>
                    ) : null}
                  </p>
                  {m.id === createdBy ? (
                    <p className="text-xs text-subtle">创建者</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {onLeave ? (
            confirmLeave ? (
              <div className="rounded-xl bg-bg-elevated px-3 py-3">
                <p className="text-sm">确定退出这个群？你将看不到之后的账单。</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setConfirmLeave(false)}
                  >
                    留下
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      onOpenChange(false);
                      onLeave();
                    }}
                  >
                    退出
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="h-11 text-sm text-muted hover:text-owe"
              >
                退出群组
              </button>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
