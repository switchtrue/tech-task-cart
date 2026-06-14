import type { MiddlewareHandler } from "hono";
import { USER_HEADER } from "@cart/contracts";
import { prisma } from "../db.js";
import { ApiException } from "../lib/errors.js";

export type CurrentUserEnv = { Variables: { userId: string } };

export const currentUser: MiddlewareHandler<CurrentUserEnv> = async (c, next) => {
  const headerId = c.req.header(USER_HEADER);
  if (!headerId) {
    throw new ApiException(401, "UNAUTHORIZED", `Missing ${USER_HEADER} header`);
  }
  const user = await prisma.user.findUnique({ where: { id: headerId } });
  if (!user) {
    throw new ApiException(401, "UNAUTHORIZED", "Unknown user");
  }
  c.set("userId", user.id);
  await next();
};
