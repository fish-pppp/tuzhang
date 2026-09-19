/** Owner-only member removal. Throws Chinese errors the UI can show as-is. */
export function assertCanRemoveMember(input: {
  actorId: string;
  ownerId: string;
  targetId: string;
}): void {
  if (input.actorId !== input.ownerId) {
    throw new Error("只有创建该群的群主可以移除成员");
  }
  if (input.targetId === input.actorId) {
    throw new Error("不能移除自己");
  }
}
