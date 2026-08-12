/**
 * Compile-time assertions for the type-level contracts the app relies on.
 *
 * These helpers produce no runtime code — they exist so that a wrong type is a
 * build failure rather than a bug someone finds later. Use them in `.test.ts`
 * files alongside the runtime expectations:
 *
 * ```ts
 * export type _Payload = Expect<Equals<PayloadFor<"session">, SessionInfo>>;
 * ```
 */

/**
 * True only when `T` and `U` are mutually assignable. The tuple wrappers stop
 * conditional types from distributing over unions, so `Equals<string | number,
 * string>` is correctly `false` rather than a distributed half-match.
 */
export type Equals<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;

/** Fails to compile unless its argument is exactly `true`. */
export type Expect<T extends true> = T;

/** Fails to compile unless its argument is exactly `false`. */
export type ExpectFalse<T extends false> = T;
