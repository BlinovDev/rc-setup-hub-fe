/** Font-independent disclosure geometry, centered in its square view box. */
export function Chevron({
  className = "",
  up = false,
}: {
  className?: string;
  up?: boolean;
}) {
  return (
    <svg
      className={`disclosure-chevron ${className}`}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      style={up ? { transform: "rotate(180deg)" } : undefined}
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
