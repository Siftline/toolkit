import { z } from "zod";

// Each field decodes alone: one of the wrong type reads as absent and never fails the rest.
const thrownSchema = z.object({
  name: z.string().optional().catch(undefined),
  message: z.string().optional().catch(undefined),
  status: z.number().optional().catch(undefined),
  retryAfterMs: z.number().optional().catch(undefined),
  requestId: z.string().optional().catch(undefined),
  body: z.unknown().optional(),
});

/** The fields core reads off an SDK error, which it cannot name. */
export type Thrown = z.infer<typeof thrownSchema>;

/** Anything that is not an object carries no fields. */
export function decodeThrown(cause: unknown): Thrown {
  const decoded = thrownSchema.safeParse(cause);

  return decoded.success ? decoded.data : {};
}
