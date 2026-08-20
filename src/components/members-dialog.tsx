import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MemberAvatar } from "@/components/member-avatar";
import { useTripStore } from "@/lib/split/store";

export function MembersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trip = useTripStore((s) => s.trip);
  const addMember = useTripStore((s) => s.addMember);
  const renameMember = useTripStore((s) => s.renameMember);
  const removeMember = useTripStore((s) => s.removeMember);
  const [name, setName] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    addMember(name);
    setName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>同行的人</DialogTitle>
          <DialogDescription>加人、改名，或移出这次旅行。</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <ul className="space-y-2">
            {trip.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg bg-bg-elevated px-3 py-2 shadow-card"
              >
                <MemberAvatar member={m} size="sm" />
                <Input
                  value={m.name}
                  onChange={(e) => renameMember(m.id, e.target.value)}
                  className="h-10 bg-transparent shadow-none"
                  aria-label={`${m.name} 的名字`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 text-muted hover:text-owe"
                  disabled={trip.members.length <= 1}
                  onClick={() => removeMember(m.id)}
                  aria-label={`移除 ${m.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <form onSubmit={onAdd} className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="新同行人的名字"
              maxLength={12}
            />
            <Button type="submit" variant="secondary" disabled={!name.trim()}>
              加入
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
