import type { Trip } from "./types";

const ALL = ["yeah", "xinxin", "yuki", "lin", "chen", "yingjian", "fu"] as const;

export const DEMO_TRIP: Trip = {
  id: "yunnan-7",
  name: "云南七日",
  members: [
    { id: "yeah", name: "yeah", avatar: "/avatars/bei.jpg" },
    { id: "xinxin", name: "欣欣", avatar: "/avatars/mi.jpg" },
    { id: "yuki", name: "yuki", avatar: "/avatars/man.jpg" },
    { id: "lin", name: "林子苑", avatar: "/avatars/ning.jpg" },
    { id: "chen", name: "陈世节", avatar: "/avatars/zhe.jpg" },
    { id: "yingjian", name: "硬件", avatar: "/avatars/kai.jpg" },
    { id: "fu", name: "傅哥", avatar: "/avatars/zhou.jpg" },
  ],
  expenses: [
    {
      id: "e1",
      title: "昆明机场打车",
      amountCents: 14000,
      payerId: "yingjian",
      participantIds: [...ALL],
      createdAt: "2026-08-12T09:10:00.000Z",
    },
    {
      id: "e2",
      title: "大理古城民宿",
      amountCents: 210000,
      payerId: "yeah",
      participantIds: [...ALL],
      createdAt: "2026-08-12T16:40:00.000Z",
    },
    {
      id: "e3",
      title: "洱海骑行",
      amountCents: 35000,
      payerId: "xinxin",
      participantIds: ["yeah", "xinxin", "yingjian", "lin", "chen"],
      createdAt: "2026-08-13T11:20:00.000Z",
    },
    {
      id: "e4",
      title: "双廊海鲜",
      amountCents: 56000,
      payerId: "fu",
      participantIds: ["yeah", "xinxin", "lin", "chen", "yingjian", "fu"],
      createdAt: "2026-08-13T19:05:00.000Z",
    },
    {
      id: "e5",
      title: "玉龙雪山门票",
      amountCents: 84000,
      payerId: "chen",
      participantIds: ["yeah", "xinxin", "lin", "chen", "yingjian", "fu"],
      createdAt: "2026-08-15T08:30:00.000Z",
    },
    {
      id: "e6",
      title: "丽江晚饭",
      amountCents: 42000,
      payerId: "yuki",
      participantIds: [...ALL],
      createdAt: "2026-08-16T20:15:00.000Z",
    },
  ],
};

export function cloneDemoTrip(): Trip {
  return structuredClone(DEMO_TRIP);
}
