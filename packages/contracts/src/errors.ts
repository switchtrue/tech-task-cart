import { z } from "./zod-openapi";

export const ApiErrorCode = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "PRODUCT_NOT_FOUND",
  "CART_ITEM_NOT_FOUND",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
