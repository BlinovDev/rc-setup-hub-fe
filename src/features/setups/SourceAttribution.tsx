import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { getSetup } from "./api";
import { detailKey, withSession } from "./queries";

export function SourceAttribution({
  setupId,
  sourceId,
}: {
  setupId: string;
  sourceId: string;
}) {
  const client = useQueryClient();
  const source = useQuery({
    queryKey: [...detailKey(setupId), "source", sourceId],
    queryFn: ({ signal }) =>
      withSession(client, () => getSetup(sourceId, signal)),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  if (
    !source.isSuccess ||
    source.isFetching ||
    source.data.visibility !== "public" ||
    source.data.moderation_status !== "approved"
  )
    return null;
  return (
    <p>
      <Link className="text-link" to={`/setups/${sourceId}`}>
        Based on original setup
      </Link>
    </p>
  );
}
