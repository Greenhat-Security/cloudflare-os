// Green Hat fork: a deployment-wide read-only policy for every Google resource.
//
// `READ_ONLY=true` on the Worker (set from `workers.google.readOnly` in the wrapper's
// deployment.jsonc) makes agents able to read Gmail, Calendar, Docs, Sheets, Drive and BigQuery
// while every write is refused before it is queued for approval, and refused again if an approval
// staged before the switch is applied afterwards. Sheets, Drive and BigQuery have no write methods
// of their own, so the guards live in Gmail (one action funnel), Docs and Calendar.

/** Only the variable this policy reads, so any Worker env satisfies it. */
export type ReadOnlyEnv = { READ_ONLY?: string };

/**
 * Whether this deployment's Google integration is read-only.
 *
 * Normalized, so a stray " True " reads as set rather than silently leaving writes enabled.
 */
export function isReadOnly(env: ReadOnlyEnv): boolean {
  return (env.READ_ONLY ?? "").trim().toLowerCase() === "true";
}

/**
 * What a refused write tells the agent and the approver.
 *
 * The phrase "declined this call before running it" is load-bearing: the Workshop recognises it
 * (overseer.ts) as a call that never reached the provider, so an approval refused by this policy
 * is settled as rejected with the reason in chat rather than held open as an unconfirmed write.
 */
export const READ_ONLY_MESSAGE =
    "This deployment's Google integration is read-only, so the gatekeeper declined this call " +
    "before running it: agents can read Gmail, Calendar, Docs, Sheets, Drive and BigQuery but " +
    "cannot send, edit, create or change anything.";

/** Refuses the call when this deployment's Google integration is read-only. */
export function requireWritable(env: ReadOnlyEnv): void {
  if (isReadOnly(env)) throw new Error(READ_ONLY_MESSAGE);
}

/**
 * Prepended to a resource's type bundle in read-only mode, so an agent learns the rule from the
 * types it is given instead of from its first refused call.
 */
export function readOnlyTypes(env: ReadOnlyEnv, types: string): string {
  if (!isReadOnly(env)) return types;
  return "// READ-ONLY DEPLOYMENT: every method that sends, edits, creates or changes anything " +
      "throws (Gmail send/reply/replyAll/forward/archive/trash/mark*/star/label, Docs " +
      "replaceText/appendText, Calendar createEvent/updateEvent). Read freely.\n\n" + types;
}
