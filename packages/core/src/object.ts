/** Anything a property can be read off. Arrays count; the callers read named keys only. */
export function isObjectLike(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null;
}
