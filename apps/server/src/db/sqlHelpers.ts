/**
 * Builds a `column in (?, ?, ...)` clause + matching params for a dynamic
 * list of values — replaces Postgres's `= any($1::type[])` array binding,
 * which MySQL has no equivalent for.
 */
export function sqlIn(values: unknown[]): { clause: string; params: unknown[] } {
  if (values.length === 0) {
    return { clause: '(select 1 where false)', params: [] };
  }
  return { clause: `(${values.map(() => '?').join(', ')})`, params: values };
}

/**
 * MySQL's DATETIME columns reject ISO 8601 strings as-is (the 'T'/'Z'
 * separators aren't valid in its literal format) — only a real JS `Date`
 * object gets auto-formatted correctly by mysql2. Anywhere a datetime is
 * built as a string (e.g. `new Date().toISOString()`) before being bound as
 * a query parameter, run it through this first.
 */
export function toMysqlDatetime(iso: string): string {
  return iso.replace('T', ' ').replace('Z', '');
}
