import type { Pool } from "pg";
import { applyReservationEvent, type IncomingReservation } from "./webhook";
import { fingerprint } from "./import";
/** Installation contract only; no vendor API or credentials are assumed. */
export interface ReadOnlyReservationAdapter {
  readonly provider: string;
  readonly readOnly: true;
  readUpdates(input: {
    from: string;
    to: string;
    cursor?: string;
    signal: AbortSignal;
  }): Promise<{ reservations: IncomingReservation[]; nextCursor?: string }>;
}
/** Recover missed updates by replaying a bounded inclusive source-update window.
 * Retry the same complete window after failure. No success watermark is advanced here.
 * After correcting a review-required mapping, start a new named attempt; retain the failed event.
 * Earlier pages may already have committed; deterministic event IDs make retry safe.
 */
export async function recoverReservationWindow(
  pool: Pool,
  org: string,
  source: string,
  adapter: ReadOnlyReservationAdapter,
  window: { from: string; to: string; attemptId?: string },
  signal: AbortSignal,
) {
  const from = Date.parse(window.from),
    to = Date.parse(window.to);
  if (
    (window.attemptId !== undefined &&
      !/^[a-zA-Z0-9_-]{1,80}$/.test(window.attemptId)) ||
    adapter.readOnly !== true ||
    !org ||
    !source ||
    !/^[\w-]{1,80}$/.test(source) ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from > to ||
    to - from > 31 * 86400000
  )
    throw Error(
      "Use a read-only adapter and a valid recovery window of at most 31 days.",
    );
  let cursor: string | undefined;
  const seen = new Set<string>();
  let pages = 0;
  for (; pages < 100; pages++) {
    if (signal.aborted)
      throw Error("Recovery cancelled; retry the same window.");
    const page = await adapter.readUpdates({ ...window, cursor, signal });
    if (signal.aborted)
      throw Error("Recovery cancelled; retry the same window.");
    if (
      !Array.isArray(page.reservations) ||
      page.reservations.length > 500 ||
      page.reservations.some(
        (r) =>
          !Number.isFinite(Date.parse(r.updatedAt)) ||
          Date.parse(r.updatedAt) < from ||
          Date.parse(r.updatedAt) > to,
      )
    )
      throw Error(
        "Recovery page exceeds its source-update window or page limit.",
      );
    if (
      page.nextCursor &&
      (typeof page.nextCursor !== "string" ||
        page.nextCursor.length > 1000 ||
        seen.has(page.nextCursor))
    )
      throw Error(
        "Recovery pagination repeated or returned an invalid cursor.",
      );
    if (page.reservations.length) {
      const eventId =
        "recovery_" +
        fingerprint({
          window,
          cursor: cursor || null,
          records: page.reservations,
        });
      const result = await applyReservationEvent(pool, org, source, {
        eventId,
        reservations: page.reservations,
      });
      if (result.status === "review_required")
        throw Error(
          "Recovery stopped for source validation review; no success watermark was advanced.",
        );
    }
    if (!page.nextCursor)
      return {
        status: "completed" as const,
        pages: pages + 1,
        window,
        provider: adapter.provider,
        liveVerified: false,
      };
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw Error("Recovery page limit reached; retry with a smaller window.");
}
