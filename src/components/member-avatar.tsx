import { cn } from "@/lib/utils";
import type { Member } from "@/lib/split/types";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "size-8 text-xs",
  md: "size-12 text-sm",
  lg: "size-14 text-lg sm:size-20 sm:text-xl",
};

export function MemberAvatar({
  member,
  size = "md",
  selected = false,
  className,
}: {
  member: Member;
  size?: Size;
  selected?: boolean;
  className?: string;
}) {
  const initial = member.name.slice(0, 1);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-chip text-primary",
        "outline outline-1 -outline-offset-1 outline-fg/10",
        sizeClass[size],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
        className,
      )}
    >
      {member.avatar ? (
        <img
          src={member.avatar}
          alt=""
          className="size-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <span className="grid size-full place-items-center font-medium">
          {initial}
        </span>
      )}
    </span>
  );
}
