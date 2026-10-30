import type { paths } from "../../api/generated/schema";
import { Button } from "../../shared/components/Button";

export type SetupScope = NonNullable<
  NonNullable<
    paths["/api/v1/setups/visible"]["get"]["parameters"]["query"]
  >["scope"]
>;

export function SetupPresets({
  scope,
  onChange,
  signedIn,
  allLabel,
}: {
  scope: SetupScope;
  onChange: (scope: SetupScope) => void;
  signedIn: boolean;
  allLabel: string;
}) {
  if (!signedIn) return null;
  return (
    <div className="filter-presets" role="group" aria-label="Setup collection">
      {(
        [
          ["all", allLabel],
          ["mine", "Mine"],
          ["friends", "Friends"],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          aria-pressed={scope === value}
          onClick={() => onChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
