// Shared, framework-agnostic domain types for the Grovyn One platform.
// Centralized here so no application (or shared UI) duplicates a domain enum/DTO.

/** Check-in / status enum shared by the shell, UI status badges, and Engineering pages. */
export type Status = "on_track" | "blocked" | "completed";

export const statusLabel = (s: Status): string =>
  s === "on_track" ? "On track" : s === "blocked" ? "Blocked" : "Completed";
