import { FilterPanel } from "../search/FilterPanel";
import { SetupPresets, type SetupScope } from "../search/SetupPresets";
import { PhotoImage } from "../setups/photos/PhotoImage";
import { useSetup } from "../setups/queries";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../../shared/components/Button";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { chassisLabel, SetupError } from "../setups/api";
import { useCandidates, useComparison } from "./queries";
import {
  readPair,
  comparisonSections,
  chassisWarning,
  notSpecified,
  type Setup,
} from "./model";

type Side = "left" | "right";
export function ComparePage({ viewer }: { viewer: string }) {
  const [params, setParams] = useSearchParams();
  const { left, right, valid } = readPair(params);
  const [editing, setEditing] = useState<Side | null>(null);
  const activeSide = editing ?? (!left ? "left" : !right ? "right" : null);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const pair = useComparison(left, right, viewer, valid && !!left && !!right);
  // Never render cached technical values while authorization is being rechecked,
  // or after a failed recheck. No partial result or detail-cache seeding.
  const result = pair.isSuccess && !pair.isFetching ? pair.data : undefined;
  const singleLeft = useSetup(left, valid && !!left && !right);
  const singleRight = useSetup(right, valid && !!right && !left);
  const selected = {
    left:
      result?.left ??
      (!right && singleLeft.isSuccess && !singleLeft.isFetching
        ? singleLeft.data
        : undefined),
    right:
      result?.right ??
      (!left && singleRight.isSuccess && !singleRight.isFetching
        ? singleRight.data
        : undefined),
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const lastFocusedPair = useRef("");
  useEffect(() => {
    if (activeSide) lastFocusedPair.current = "";
    else if (result && lastFocusedPair.current !== `${left}:${right}`) {
      lastFocusedPair.current = `${left}:${right}`;
      heading.current?.focus();
    }
  }, [result, activeSide, left, right]);
  function select(id: string) {
    if (!activeSide) return;
    const next = {
      left_id: left,
      right_id: right,
      [`${activeSide}_id`]: id.toLowerCase(),
    };
    setParams(
      Object.fromEntries(Object.entries(next).filter(([, value]) => value)),
    );
    setEditing(activeSide === "left" && !right ? "right" : null);
  }
  const unsupported =
    result &&
    (result.left.schema_version !== 1 || result.right.schema_version !== 1);
  return (
    <section className="space-y-4" aria-labelledby="compare-title">
      <h2 id="compare-title" className="page-title">
        Compare setups
      </h2>
      <p>
        Select exactly two different setups visible to you. Comparison is
        read-only.
      </p>
      {!valid ? (
        <InlineNotice tone="error">
          Choose two distinct setups with valid IDs.{" "}
          <Button
            onClick={() => {
              setParams({});
              setEditing(null);
            }}
          >
            Reset comparison
          </Button>
        </InlineNotice>
      ) : (
        <>
          <div className="comparison-choices">
            {(["left", "right"] as const).map((side) => (
              <Button
                key={side}
                className="comparison-slot"
                aria-pressed={activeSide === side}
                onClick={() => setEditing(side)}
              >
                <span className="comparison-slot-label">
                  {side === "left" ? "First setup" : "Second setup"}
                </span>
                {selected[side] ? (
                  <>
                    <PhotoImage
                      photo={selected[side]?.cover_photo}
                      alt={`Cover of ${selected[side]?.title}`}
                    />
                    <strong>{selected[side]?.title}</strong>
                    <span className="text-sm">
                      {chassisLabel(selected[side]!)}
                    </span>
                    <span className="comparison-slot-action">Change setup</span>
                  </>
                ) : (
                  <span>
                    {(side === "left" ? left : right)
                      ? "Checking selected setup…"
                      : "+ Choose setup"}
                  </span>
                )}
              </Button>
            ))}
          </div>
          {activeSide && (
            <SetupSelector
              key={activeSide}
              side={activeSide}
              viewer={viewer}
              otherId={activeSide === "left" ? right : left}
              otherModelId={
                selected[activeSide === "left" ? "right" : "left"]
                  ?.chassis_model_id ?? null
              }
              onSelect={select}
              onCancel={left && right ? () => setEditing(null) : undefined}
            />
          )}
          {left && right && !activeSide && (
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  onChange={(event) => setOnlyDifferences(event.target.checked)}
                />
                Only differences
              </label>
              <Button
                disabled={pair.isFetching}
                onClick={() => void pair.refetch()}
              >
                {pair.isError ? "Retry comparison" : "Refresh comparison"}
              </Button>
            </div>
          )}
          {left && right && pair.isFetching && (
            <LoadingState>Checking access to both setups…</LoadingState>
          )}
          {left && right && pair.isError && (
            <InlineNotice tone="error">
              {pair.error instanceof SetupError &&
              [400, 404].includes(pair.error.status)
                ? "One or both setups not found or unavailable."
                : "Unable to load comparison. Please retry."}
            </InlineNotice>
          )}
          {unsupported && (
            <InlineNotice tone="error">
              One or both setup data versions are not supported.
            </InlineNotice>
          )}
          {result && !activeSide && !unsupported && (
            <>
              <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold">
                Setup comparison
              </h3>
              {chassisWarning(result.left, result.right) && (
                <InlineNotice className="comparison-warning">
                  Different or custom chassis: verify compatibility before
                  applying any settings.
                </InlineNotice>
              )}
              <p id="comparison-help">
                Differences are marked in text and color. Only differences shows
                values specified on both sides. Scroll the table horizontally on
                narrow screens.
              </p>
              <ComparisonTables
                left={result.left}
                right={result.right}
                onlyDifferences={onlyDifferences}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
function SetupSelector({
  side,
  viewer,
  otherId,
  otherModelId,
  onSelect,
  onCancel,
}: {
  side: Side;
  viewer: string;
  otherId: string;
  otherModelId: string | null;
  onSelect: (id: string) => void;
  onCancel?: (() => void) | undefined;
}) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [scope, setScope] = useState<SetupScope>("all");
  const [sameModel, setSameModel] = useState(false);
  const search = useCandidates(
    q,
    viewer,
    true,
    sameModel ? otherModelId : null,
    scope,
  );
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.matchMedia?.("(min-width: 768px)").matches)
      input.current?.focus();
  }, []);
  // An error/recheck must not leave old protected candidate titles on screen.
  const items =
    search.isSuccess && !search.isRefetching
      ? search.data.pages.flatMap((page) => page.items)
      : [];
  const unique = [
    ...new Map(items.map((item) => [item.id.toLowerCase(), item])).values(),
  ];
  return (
    <section
      className="space-y-3 rounded border bg-white p-4"
      aria-label={`Choose ${side === "left" ? "first" : "second"} setup`}
    >
      <h3 className="font-semibold">
        Choose {side === "left" ? "first" : "second"} setup
      </h3>
      <SetupPresets
        scope={scope}
        onChange={setScope}
        signedIn={viewer !== "guest"}
        allLabel="All available"
      />
      {otherModelId && (
        <div className="filter-presets" aria-label="Chassis preset">
          <Button aria-pressed={!sameModel} onClick={() => setSameModel(false)}>
            All models
          </Button>
          <Button aria-pressed={sameModel} onClick={() => setSameModel(true)}>
            Same model
          </Button>
        </div>
      )}
      <FilterPanel active={!!q}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = text.trim();
            if (value.length > 100 || value.includes("\0")) {
              setInvalid(true);
              return;
            }
            setInvalid(false);
            setQ(value);
          }}
        >
          <label className="grid flex-1 gap-1">
            Title or owner nickname
            <input
              ref={input}
              className="rounded border p-2"
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "candidate-validation" : undefined}
            />
          </label>
          <Button type="submit">Search setups</Button>
        </form>
        {invalid && (
          <InlineNotice id="candidate-validation" tone="error">
            Use at most 100 characters without null characters.
          </InlineNotice>
        )}
      </FilterPanel>
      {q && (
        <div className="filter-presets">
          <Button
            onClick={() => {
              setQ("");
              setText("");
            }}
          >
            Search: {q} ×
          </Button>
        </div>
      )}
      {(search.isPending || search.isRefetching) && (
        <LoadingState>Loading visible setups…</LoadingState>
      )}
      {search.isError && (
        <InlineNotice tone="error">
          Unable to search visible setups.{" "}
          <Button onClick={() => void search.refetch()}>Retry search</Button>
        </InlineNotice>
      )}
      {search.isSuccess && !search.isRefetching && unique.length === 0 && (
        <p>No visible setups match this search.</p>
      )}
      <ul className="space-y-2">
        {unique.map((item) => (
          <li key={item.id}>
            <Button
              className="comparison-candidate"
              disabled={item.id.toLowerCase() === otherId}
              onClick={() => onSelect(item.id)}
              aria-label={`Select ${item.title} as ${side === "left" ? "first" : "second"} setup`}
            >
              <PhotoImage
                photo={item.cover_photo}
                alt={`Cover of ${item.title}`}
              />
              <span>
                {item.title}
                {item.id.toLowerCase() === otherId ? " — Already selected" : ""}
              </span>
              <span className="text-sm">
                {item.owner.nickname} · {chassisLabel(item)}
              </span>
            </Button>
          </li>
        ))}
      </ul>
      {search.isFetchNextPageError && (
        <InlineNotice tone="error">Unable to load more setups.</InlineNotice>
      )}
      {search.hasNextPage && (
        <Button
          disabled={search.isFetching}
          onClick={() => void search.fetchNextPage({ cancelRefetch: false })}
        >
          {search.isFetchingNextPage
            ? "Loading more…"
            : search.isFetchNextPageError
              ? "Retry load more"
              : "Load more setups"}
        </Button>
      )}
      {onCancel && <Button onClick={onCancel}>Cancel selection</Button>}
    </section>
  );
}
export function ComparisonTables({
  left,
  right,
  onlyDifferences,
}: {
  left: Setup;
  right: Setup;
  onlyDifferences: boolean;
}) {
  const sections = comparisonSections(left, right, onlyDifferences);
  return (
    <div className="space-y-4">
      {sections.length === 0 && (
        <p role="status">No comparable differences found.</p>
      )}
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h4 className="text-lg font-semibold">{section.title}</h4>
          <div
            className="comparison-scroll"
            tabIndex={0}
            role="region"
            aria-label={`${section.title} comparison table`}
            aria-describedby="comparison-help"
          >
            <table className="comparison-table">
              <caption className="sr-only">
                {section.title}: {left.title} and {right.title}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Parameter</th>
                  <th scope="col">
                    <Link to={`/setups/${left.id}`}>{left.title}</Link>
                  </th>
                  <th scope="col">
                    <Link to={`/setups/${right.id}`}>{right.title}</Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={
                      row.different ? "comparison-different" : undefined
                    }
                  >
                    <th scope="row">
                      {row.label}
                      {row.different && (
                        <span className="comparison-difference-label">
                          Different
                        </span>
                      )}
                    </th>
                    <td>{row.left ?? notSpecified}</td>
                    <td>{row.right ?? notSpecified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
