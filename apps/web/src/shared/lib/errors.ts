import { toast } from "sonner";
import { ApiError } from "@/shared/lib/api";
import { asSentence } from "@/shared/lib/validation-messages";

/**
 * Why an action failed, in words the person who tried it can act on: the API's own reason
 * (validation rules already in plain English via ApiError), or a sensible line for the
 * failures that have no useful server text (offline, rate limit, server error).
 */
export function errorReason(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.reasons.length) return error.message;
    if (error.status === 403 && /^forbidden( resource)?$/i.test(error.message)) {
      return "You don't have permission to do this.";
    }
    if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
    if (error.status >= 500)
      return "Something went wrong on our side. Please try again in a moment.";
    if (/^HTTP \d+$/.test(error.message)) return "The request failed. Please try again.";
    return asSentence(error.message);
  }
  // fetch() rejects with a TypeError when the network or server can't be reached at all.
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (error instanceof Error && error.message) return asSentence(error.message);
  return "Something went wrong. Please try again.";
}

/**
 * The one way to report a failed action. The title says what failed ("Couldn't send the
 * invoice"); the description says why ("Client email is required."), so the person knows what
 * to fix. Without a title, the reason alone is shown.
 */
export function toastError(error: unknown, title?: string): void {
  const reason = errorReason(error);
  if (title) toast.error(title, { description: reason });
  else toast.error(reason);
}
