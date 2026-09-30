import type { components } from "../../api/generated/schema";
export function VisibilityBadge({
  value,
}: {
  value: components["schemas"]["Setup"]["visibility"];
}) {
  return (
    <span className={`visibility-badge visibility-${value}`}>
      Visibility: {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}
