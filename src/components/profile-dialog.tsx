import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { friendlyError } from "@/lib/errors";
import { compressAvatarFile } from "@/lib/split/avatar";
import { removeMyAvatar, updateMyAvatar } from "@/lib/split/avatar-api";

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const shown = preview ?? user?.profileImageUrl ?? null;
  const label = user?.displayName ?? user?.primaryEmail ?? "已登录";

  async function refreshViews(image: string | null) {
    const client = authClient as typeof authClient & {
      updateUser?: (data: { image: string | null }) => Promise<unknown>;
    };
    if (typeof client.updateUser === "function") {
      try {
        await client.updateUser({ image });
      } catch {
        // Session cookie may stay stale for a few minutes; getSession still helps.
      }
    }
    await authClient.getSession();
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
    await queryClient.invalidateQueries({ queryKey: ["group"] });
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const base64 = await compressAvatarFile(file);
      setPreview(`data:image/jpeg;base64,${base64}`);
      const { image } = await updateMyAvatar({ data: { base64 } });
      await refreshViews(image);
      setPreview(null);
      onOpenChange(false);
    } catch (err) {
      setError(friendlyError(err, "换头像失败"));
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    setError(null);
    setPending(true);
    try {
      await removeMyAvatar();
      await refreshViews(null);
      setPreview(null);
    } catch (err) {
      setError(friendlyError(err, "去掉头像失败"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          setPreview(null);
          setPending(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>我的头像</DialogTitle>
          <DialogDescription>
            换一张照片，群组里大家都能看到。照片只会存在这台站点的数据库里。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {shown ? (
              <img
                src={shown}
                alt=""
                className="size-24 rounded-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
              />
            ) : (
              <span className="grid size-24 place-items-center rounded-full bg-chip font-display text-3xl font-semibold text-primary">
                {label.slice(0, 1)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium">{label}</p>
          <input
            ref={inputRef}
            id="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={pending}
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <div className="flex w-full gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <Camera className="size-4" />
              {pending ? "处理中…" : "选一张照片"}
            </Button>
            {user?.profileImageUrl || preview ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void onRemove()}
              >
                去掉
              </Button>
            ) : null}
          </div>
          {error ? <p className="w-full text-sm text-owe">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
