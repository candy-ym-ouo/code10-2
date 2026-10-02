import type { FastifyPluginAsync } from "fastify";
import { buildProfilePatch, changePasswordSchema, updateProfileSchema } from "@practice/contracts";
import { parseOrThrow, isIanaTimezone } from "../lib/validation.js";
import { AppError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/security.js";
import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";

const selectUser = {
  id: true,
  email: true,
  displayName: true,
  defaultInstrument: true,
  timezone: true,
  locale: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

const userRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/me", async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.authUser!.id }, select: selectUser });
    if (!user) throw new AppError(404, "RESOURCE_NOT_FOUND", "用户不存在");
    return { user };
  });

  app.patch("/me", async (request) => {
    const input = parseOrThrow(updateProfileSchema, request.body);
    if (input.timezone && !isIanaTimezone(input.timezone)) {
      throw new AppError(400, "VALIDATION_ERROR", "时区不是有效的 IANA 时区");
    }
    // 乐观锁 + 字段级合并：仅更新提交的偏好字段，且仅当版本未漂移时生效。
    // 若期间安全设置（如密码）已变更，version 已递增，此处必然冲突而不是覆盖。
    const result = await prisma.user.updateMany({
      where: { id: request.authUser!.id, version: input.version },
      data: { ...buildProfilePatch(input), version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new AppError(409, "VERSION_CONFLICT", "设置已在其他窗口修改，请刷新后合并");
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.authUser!.id }, select: selectUser });
    await audit(request, "USER_SETTINGS_UPDATED", "USER", user.id, "SUCCESS");
    return { user };
  });

  app.post("/me/password", async (request) => {
    const input = parseOrThrow(changePasswordSchema, request.body);
    const user = await prisma.user.findUnique({ where: { id: request.authUser!.id } });
    if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError(400, "CURRENT_PASSWORD_INVALID", "当前密码不正确");
    }
    // 安全设置变更同时递增 version：此后任何持旧版本的偏好合并都会冲突，
    // 保证并发修改不会覆盖较新的安全设置。
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(input.newPassword), version: { increment: 1 } },
      }),
      prisma.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit(request, "USER_PASSWORD_CHANGED", "USER", user.id, "SUCCESS");
    return { success: true, message: "密码已更新，请重新登录" };
  });
};

export default userRoutes;
