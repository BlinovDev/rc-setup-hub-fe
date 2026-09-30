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
  const [params, setParams] = useSearchParams();
  const { filters, valid } = readFilters(params);
  const client = useQueryClient();
  const brands = useQuery({ ...brandsOptions, enabled: valid });
  const models = useQuery(modelsOptions(valid ? filters.brandId : null));
  const search = useSetupSearch(filters, valid);
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
        <h2>Public setups</h2>
        <InlineNotice tone="error">
          Invalid search filters. Use a valid UUID and search text of at most
          100 characters without null characters.
        </InlineNotice>
        <Button onClick={() => setParams({})}>Reset filters</Button>
      </section>
    );
  const items = search.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Public setups</h2>
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
      {search.isPending && <LoadingState>Loading public setups…</LoadingState>}
      {search.isError && !search.data && (
        <InlineNotice tone="error">
          {search.error instanceof SetupError && search.error.status === 400
            ? "Invalid search or filters."
            : "Unable to load public setups."}{" "}
          <Button
            disabled={search.isFetching}
            onClick={() => void search.refetch()}
          >
            Retry search
          </Button>
        </InlineNotice>
      )}
      {search.data && items.length === 0 && (
        <p>No public setups match these filters.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
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
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
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
