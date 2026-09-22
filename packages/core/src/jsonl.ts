/**
 * One value per non-blank line. A line that `parseLine` throws on is handed to `fail` with
 * its 1-based number, and whatever `fail` returns is thrown.
 */
export function parseJsonLines<T>(
  text: string,
  parseLine: (line: string) => T,
  fail: (line: number, cause: unknown) => Error,
): T[] {
  const values: T[] = [];
  for (const [offset, line] of text.split("\n").entries()) {
    if (line.trim() === "") continue;
    try {
      values.push(parseLine(line));
    } catch (cause) {
      throw fail(offset + 1, cause);
    }
  }
  return values;
}
