import { z } from "zod";

export const CODE_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
export const CODE_LENGTH = 7;
export const MAX_LIFETIME_DAYS = 365;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_TARGET_LENGTH = 2000;

export const shortCodeSchema = z
  .string()
  .length(CODE_LENGTH)
  .regex(/^[2-9a-kmnp-z]+$/u);

export const targetUrlSchema = z
  .url()
  .max(MAX_TARGET_LENGTH)
  .regex(/^https:\/\/[^\s/?#]\S*$/u);

export const linkPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

export const lifetimeDaysSchema = z.int().min(1).max(MAX_LIFETIME_DAYS);

export const newShortLinkSchema = z.strictObject({
  target: targetUrlSchema,
  lifetimeDays: lifetimeDaysSchema,
  password: linkPasswordSchema.optional(),
});

export type ShortCode = z.infer<typeof shortCodeSchema>;
export type NewShortLink = z.infer<typeof newShortLinkSchema>;
