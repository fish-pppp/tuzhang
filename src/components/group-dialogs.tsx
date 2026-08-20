import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { createGroup, joinGroup } from "@/lib/split/group-api";
import { profileFromUser } from "@/lib/split/profile";

export function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ id: string; inviteCode: string; name: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setError(null);
    setPending(false);
    setCreated(null);
    setCopied(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("请先登录");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("给群组起个名字");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createGroup({
        data: { name: trimmed, ...profileFromUser(user) },
      });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setPending(false);
    }
  }

  async function copyInvite() {
    if (!created) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${created.inviteCode}`
        : created.inviteCode;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "群组已建好" : "新建群组"}</DialogTitle>
          <DialogDescription>
            {created
              ? "把邀请码发给同行，他们登录后就能一起记账。"
              : "登录后的每个人加入同一个群，各自用自己的账号记。"}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-bg-elevated px-4 py-3">
              <p className="text-xs text-muted">邀请码</p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-[0.2em]">
                {created.inviteCode}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => void copyInvite()}>
                {copied ? "已复制链接" : "复制邀请链接"}
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  reset();
                  void navigate({
                    to: "/g/$groupId",
                    params: { groupId: created.id },
                  });
                }}
              >
                进入群组
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">群组名称</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="云南七日、周末聚餐…"
                maxLength={40}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-owe">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "创建中…" : "创建"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function JoinGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("请先登录");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await joinGroup({
        data: { code, ...profileFromUser(user) },
      });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      onOpenChange(false);
      setCode("");
      void navigate({ to: "/g/$groupId", params: { groupId: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>加入群组</DialogTitle>
          <DialogDescription>输入朋友发你的邀请码。</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">邀请码</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例如 AB12CD"
              maxLength={12}
              className="font-display tracking-[0.18em]"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-owe">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending || !code.trim()}>
            {pending ? "加入中…" : "加入"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
