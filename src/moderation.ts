/** Moderation state of an uploaded assessment. */
export type ModerationStatus = "unmoderated" | "moderated";

/**
 * Moderation status for an uploaded assessment. There is nothing to moderate
 * entries with yet, so every entry is currently unmoderated. This is the single
 * place that decision lives — once moderation exists (an Assessor Agent or a
 * human-in-the-loop, see doc/PLAN.md) it will inspect the entry here.
 */
export function moderationStatus(): ModerationStatus {
  return "unmoderated";
}
