import type { FastifyPluginAsync } from "fastify";
import { changePasswordSchema, updateProfileSchema } from "@practice/contracts";
import { parseOrThrow, isIanaTimezone } from "../lib/validation.js";
import { AppError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/security.js";
import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";
import { publicUserSelect } from "../lib/user.js";

const selectUser = {
  ...publicUserSelect,
  status: true,
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

  // 只做字段级合并，并以 version 做乐观并发控制：
  // 请求未携带的偏好字段保持服务端现值不变；版本不匹配时拒绝写入，
  // 绝不覆盖较新的设置（尤其是密码哈希等安全字段不经过此路径）。
  app.patch("/me", async (request) => {
    const input = parseOrThrow(updateProfileSchema, request.body);
    if (input.timezone && !isIanaTimezone(input.timezone)) {
      throw new AppError(400, "VALIDATION_ERROR", "时区不是有效的 IANA 时区");
    }
    const result = await prisma.user.updateMany({
      where: { id: request.authUser!.id, version: input.version },
      data: {
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
        ...(input.defaultInstrument === undefined ? {} : { defaultInstrument: input.defaultInstrument }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
        ...(input.locale === undefined ? {} : { locale: input.locale }),
        ...(input.theme === undefined ? {} : { theme: input.theme }),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new AppError(409, "VERSION_CONFLICT", "设置已在其他窗口被修改，请刷新后合并");
    }
    const user = await prisma.user.findUnique({ where: { id: request.authUser!.id }, select: selectUser });
    if (!user) throw new AppError(404, "RESOURCE_NOT_FOUND", "用户不存在");
    await audit(
      request,
      "USER_PREFERENCES_UPDATED",
      "USER",
      user.id,
      "SUCCESS",
      Object.fromEntries(
        ["displayName", "defaultInstrument", "timezone", "locale", "theme"]
          .filter((key) => key in input)
          .map((key) => [key, true]),
      ),
    );
    return { user };
  });

  app.post("/me/password", async (request) => {
    const input = parseOrThrow(changePasswordSchema, request.body);
    const user = await prisma.user.findUnique({ where: { id: request.authUser!.id } });
    if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError(400, "CURRENT_PASSWORD_INVALID", "当前密码不正确");
    }
    // 安全变更同样推进版本号，使拿着旧版本号的偏好保存请求无法覆盖新安全状态。
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword), version: { increment: 1 } } }),
      prisma.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit(request, "USER_PASSWORD_CHANGED", "USER", user.id, "SUCCESS");
    return { success: true, message: "密码已更新，请重新登录" };
  });
};

export default userRoutes;
