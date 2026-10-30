import { FilterPanel } from "./FilterPanel";
import { SetupPresets } from "./SetupPresets";
import { SignInButton } from "../auth/SignInButton";
import { Link } from "react-router";
import { currentUserOptions } from "../auth/queries";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { brandsOptions, modelsOptions } from "../chassis/queries";
import { ChassisError } from "../chassis/api";
import { currentUserKey } from "../auth/queries";
import { SetupError } from "../setups/api";
import { filterParams, readFilters, type DiscoveryFilters } from "./filters";
import { useSetupSearch } from "./queries";
import { SetupSearchCard } from "./SetupSearchCard";

export function DiscoveryPage() {
  const session = useQuery(currentUserOptions);
  const [params, setParams] = useSearchParams();
  const { filters, valid } = readFilters(params);
  const client = useQueryClient();
  const brands = useQuery({ ...brandsOptions, enabled: valid });
  const models = useQuery(modelsOptions(valid ? filters.brandId : null));
  const personal = filters.scope !== "all";
  const search = useSetupSearch(
    filters,
    valid && (!personal || !!session.data),
    session.data?.id ?? "guest",
  );
  useEffect(() => {
    if (
      [brands.error, models.error].some(
        (error) => error instanceof ChassisError && error.status === 401,
      )
    ) {
      void client
        .cancelQueries({ queryKey: currentUserKey, exact: true })
        .then(() => client.setQueryData(currentUserKey, null));
    }
  }, [brands.error, models.error, client]);
  function update(next: DiscoveryFilters) {
    setParams(filterParams(next));
  }
  if (!valid)
    return (
      <section className="space-y-4">
        <h2 className="page-title">Explore</h2>
        <InlineNotice tone="error">
          Invalid search filters. Use a valid UUID and search text of at most
          100 characters without null characters.
        </InlineNotice>
        <Button onClick={() => setParams({})}>Reset filters</Button>
      </section>
    );
  if (personal && !session.data)
    return (
      <section className="space-y-4">
        <h2 className="page-title">Explore</h2>
        <p>Sign in to browse your setups and your friends’ setups.</p>
        <SignInButton />
        <Button onClick={() => update({ ...filters, scope: "all" })}>
          Browse public setups
        </Button>
      </section>
    );
  const items =
    personal && (!search.isSuccess || search.isRefetching)
      ? []
      : (search.data?.pages.flatMap((page) => page.items) ?? []);
  return (
    <section className="space-y-4">
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">Community setups</p>
          <h2 className="page-title">Explore</h2>
        </div>
        {session.data ? (
          <Link className="action-link action-link-primary" to="/my/setups/new">
            Create a setup
          </Link>
        ) : (
          <SignInButton>Sign in to share a setup</SignInButton>
        )}
      </header>
      <SetupPresets
        scope={filters.scope}
        signedIn={!!session.data}
        allLabel="All public"
        onChange={(scope) => update({ ...filters, scope })}
      />
      {filters.q && (
        <div className="filter-presets" aria-label="Active search">
          <Button onClick={() => update({ ...filters, q: "" })}>
            Search: {filters.q} ×
          </Button>
        </div>
      )}
      {(filters.brandId || filters.modelId) && (
        <div className="filter-presets" aria-label="Active chassis filters">
          <Button
            onClick={() => update({ ...filters, brandId: null, modelId: null })}
          >
            {models.data?.find((model) => model.id === filters.modelId)?.name ??
              brands.data?.find((brand) => brand.id === filters.brandId)
                ?.name ??
              "Selected chassis"}{" "}
            ×
          </Button>
        </div>
      )}
      <FilterPanel active={!!(filters.q || filters.brandId || filters.modelId)}>
        <SearchForm
          key={filters.q}
          initialText={filters.q}
          onSearch={(q) => update({ ...filters, q })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1">
            Brand
            <select
              className="rounded border p-2"
              value={filters.brandId ?? ""}
              onChange={(event) =>
                update({
                  ...filters,
                  brandId: event.target.value || null,
                  modelId: null,
                })
              }
            >
              <option value="">All brands</option>
              {filters.brandId &&
                !brands.data?.some((brand) => brand.id === filters.brandId) && (
                  <option value={filters.brandId}>Selected brand</option>
                )}
              {brands.data?.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            Model
            <select
              className="rounded border p-2"
              value={filters.modelId ?? ""}
              disabled={!filters.brandId && !filters.modelId}
              onChange={(event) =>
                update({ ...filters, modelId: event.target.value || null })
              }
            >
              <option value="">All models</option>
              {filters.modelId &&
                !models.data?.some((model) => model.id === filters.modelId) && (
                  <option value={filters.modelId}>Selected model</option>
                )}
              {models.data?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {brands.isPending && <LoadingState>Loading brands…</LoadingState>}
        {brands.isError && (
          <InlineNotice tone="error">
            Unable to load brands.{" "}
            <Button
              disabled={brands.isFetching}
              onClick={() => void brands.refetch()}
            >
              Retry brands
            </Button>
          </InlineNotice>
        )}
        {brands.data?.length === 0 && <p>No active brands available.</p>}
        {filters.brandId && models.isPending && (
          <LoadingState>Loading models…</LoadingState>
        )}
        {models.isError && (
          <InlineNotice tone="error">
            {models.error instanceof ChassisError && models.error.status === 404
              ? "Selected brand unavailable."
              : "Unable to load models."}{" "}
            <Button
              disabled={models.isFetching}
              onClick={() => void models.refetch()}
            >
              Retry models
            </Button>
          </InlineNotice>
        )}
        {models.data?.length === 0 && <p>No active models available.</p>}
        {(filters.brandId || filters.modelId) && (
          <Button
            onClick={() => update({ ...filters, brandId: null, modelId: null })}
          >
            Clear chassis filters
          </Button>
        )}
      </FilterPanel>
      {(search.isPending || (personal && search.isRefetching)) && (
        <LoadingState>Loading setups…</LoadingState>
      )}
      {search.isError && (!search.data || personal) && (
        <InlineNotice tone="error">
          {search.error instanceof SetupError && search.error.status === 400
            ? "Invalid search or filters."
            : "Unable to load setups."}{" "}
          <Button
            disabled={search.isFetching}
            onClick={() => void search.refetch()}
          >
            Retry search
          </Button>
        </InlineNotice>
      )}
      {search.isSuccess && !search.isRefetching && items.length === 0 && (
        <p>No setups match these filters.</p>
      )}
      <div className="setup-cards">
        {items.map((item) => (
          <SetupSearchCard key={item.id} item={item} />
        ))}
      </div>
      {search.isFetchNextPageError && (
        <InlineNotice tone="error">
          Unable to load more setups. Please retry.
        </InlineNotice>
      )}
      {search.hasNextPage && (
        <Button
          className="rounded border px-4 py-2"
          disabled={search.isFetching}
          onClick={() => void search.fetchNextPage({ cancelRefetch: false })}
        >
          {search.isFetchingNextPage
            ? "Loading more…"
            : search.isFetchNextPageError
              ? "Retry load more"
              : "Load more"}
        </Button>
      )}
    </section>
  );
}

function SearchForm({
  initialText,
  onSearch,
}: {
  initialText: string;
  onSearch: (q: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [validation, setValidation] = useState("");
  return (
    <>
      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          const q = text.trim();
          if (q.length > 100 || q.includes("\0")) {
            setValidation(
              "Use at most 100 characters without null characters.",
            );
            return;
          }
          setValidation("");
          onSearch(q);
        }}
      >
        <label className="grid min-w-0 gap-1">
          Title or owner nickname
          <input
            className="rounded border p-2"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <Button
          variant="primary"
          type="submit"
          className="rounded border px-4 py-2"
        >
          Search
        </Button>
      </form>
      {validation && <InlineNotice tone="error">{validation}</InlineNotice>}
    </>
  );
}
