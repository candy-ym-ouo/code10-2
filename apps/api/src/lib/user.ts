import { Prisma } from "@prisma/client";

// 所有返回给前端的用户信息必须来自同一个选择集合，
// 保证时区、默认乐器、界面偏好与版本号在登录/刷新/设置各入口口径一致。
export const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  defaultInstrument: true,
  timezone: true,
  locale: true,
  theme: true,
  version: true,
} as const satisfies Prisma.UserSelect;
