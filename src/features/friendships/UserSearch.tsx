import { useState } from "react";
import type { components } from "../../api/generated/schema";
import { FriendshipError } from "./api";
import { AddFriend, FriendshipActions } from "./FriendshipActions";
import { useUserSearch, validUserSearch } from "./queries";
export function PublicIdentity({
  user,
}: {
  user: components["schemas"]["PublicProfile"];
}) {
  return (
    <p>
      {user.avatar_url && (
        <img
          className="inline-block h-8 w-8 rounded-full mr-2"
          src={user.avatar_url}
          alt=""
        />
      )}
      {user.nickname}
    </p>
  );
}
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
        className="flex flex-wrap gap-3"
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
        <button type="submit" className="min-h-11 rounded border px-4 py-2">
          Search
        </button>
      </form>
      {validation && <p role="alert">{validation}</p>}
      {!q && !validation && <p>Search by nickname to find people.</p>}
      {q && search.isPending && <p role="status">Searching people…</p>}
      {search.isError && (
        <p role="alert">
          {search.error instanceof FriendshipError &&
          search.error.status === 400
            ? "Invalid nickname search."
            : "Unable to search people."}{" "}
          <button
            disabled={search.isFetching}
            onClick={() => void search.refetch()}
          >
            Retry search
          </button>
        </p>
      )}
      {q && !search.isError && search.data?.length === 0 && (
        <p>No people found.</p>
      )}
      {q && !search.isError && (
        <ul className="space-y-3">
          {search.data?.map((user) => {
            const bucket = (["incoming", "outgoing", "accepted"] as const).find(
              (key) =>
                friendships[key].some((item) => item.user.id === user.id),
            );
            const item = bucket
              ? friendships[bucket].find((item) => item.user.id === user.id)
              : undefined;
            return (
              <li key={user.id} className="rounded border p-4 space-y-2">
                <PublicIdentity user={user} />
                {bucket && item ? (
                  <>
                    <p>
                      {bucket === "incoming"
                        ? "Incoming request"
                        : bucket === "outgoing"
                          ? "Request sent"
                          : "Friends"}
                    </p>
                    <FriendshipActions
                      item={item}
                      bucket={bucket}
                      feedback={feedback}
                    />
                  </>
                ) : (
                  <AddFriend userId={user.id} feedback={feedback} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
