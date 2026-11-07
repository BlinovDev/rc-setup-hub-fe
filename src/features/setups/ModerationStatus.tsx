import type { components } from "../../api/generated/schema";

const statuses = {
  pending: {
    label: "Pending review",
    colors:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    explanation:
      "Your setup is awaiting approval. You and your friends can view it, but it isn't visible publicly yet.",
    path: "M12 8v4l3 2",
  },
  approved: {
    label: "Approved",
    colors:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
    explanation: null,
    path: "m8 12 3 3 5-6",
  },
  rejected: {
    label: "Rejected",
    colors:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
    explanation:
      "Your setup wasn't approved and isn't publicly visible. You and your friends can still view it.",
    path: "m9 9 6 6m0-6-6 6",
  },
} as const;

export function ModerationStatus({
  status,
}: {
  status: components["schemas"]["Setup"]["moderation_status"];
}) {
  const state = statuses[status];
  return (
    <div className="space-y-1">
      <div
        className="flex flex-wrap items-center gap-2 text-sm"
        aria-label="Setup visibility and moderation"
      >
        <span className="inline-flex items-center gap-1">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18" />
          </svg>
          Public
        </span>
        <span aria-hidden="true">·</span>
        <span
          role="status"
          aria-label="Moderation status"
          className={`inline-flex min-h-6 items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${state.colors}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d={state.path} />
          </svg>
          {state.label}
        </span>
      </div>
      {state.explanation && (
        <p className="text-sm text-[var(--muted)]">{state.explanation}</p>
      )}
    </div>
  );
}
