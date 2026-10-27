import { z } from "zod";

const audienceSchema = z.union([z.string(), z.array(z.string()).min(1)]);

export const accessClaimsSchema = z.looseObject({
  email: z.string().min(1),
  exp: z.number().int(),
  iat: z.number().int(),
  nbf: z.number().int(),
  aud: audienceSchema,
});

export type AccessAudience = z.infer<typeof audienceSchema>;

export interface AccessClaims {
  readonly email: string;
  readonly exp: number;
  readonly iat: number;
  readonly nbf: number;
  readonly aud: AccessAudience;
}
