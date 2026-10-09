import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { PublicIdentity } from "../users/PublicIdentity";
import { useState } from "react";
import type { components } from "../../api/generated/schema";
import { FriendshipError } from "./api";
import { FriendshipControl } from "./FriendshipControl";
import { useUserSearch, validUserSearch } from "./queries";
export function UserSearch({
  friendships,
  feedback,
}: {
  friendships: components["schemas"]["FriendshipList"];
  feedback: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [validation, setValidation] = useState("");
  const search = useUserSearch(q, true);
  return (
    <section aria-labelledby="find-people" className="space-y-3">
      <h3 id="find-people" className="text-xl font-semibold">
        Find people
      </h3>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const normalized = text.trim();
          if (!validUserSearch(normalized)) {
            setValidation("Use at most 64 characters without null characters.");
            setQ("");
            return;
          }
          setValidation("");
          if (normalized && normalized === q) void search.refetch();
          else setQ(normalized);
        }}
      >
        <label className="grid gap-1">
          Nickname
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="rounded border p-2"
          />
        </label>
        <Button
          variant="primary"
          type="submit"
          className="min-h-11 rounded border px-4 py-2"
        >
          Search
        </Button>
      </form>
      {validation && <InlineNotice tone="error">{validation}</InlineNotice>}
      {!q && !validation && <p>Search by nickname to find people.</p>}
      {q && search.isPending && <LoadingState>Searching people…</LoadingState>}
      {search.isError && (
        <InlineNotice tone="error">
          {search.error instanceof FriendshipError &&
          search.error.status === 400
            ? "Invalid nickname search."
            : "Unable to search people."}{" "}
          <Button
            disabled={search.isFetching}
            onClick={() => void search.refetch()}
          >
            Retry search
          </Button>
        </InlineNotice>
      )}
      {q && !search.isError && search.data?.length === 0 && (
        <p>No people found.</p>
      )}
      {q && !search.isError && (
        <ul className="space-y-3">
          {search.data?.map((user) => {
            return (
              <li key={user.id} className="rounded border p-4">
                <div className="identity-action-row">
                  <PublicIdentity user={user} />
                  <div className="relationship-control">
                    <FriendshipControl
                      userId={user.id}
                      friendships={friendships}
                      feedback={feedback}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
