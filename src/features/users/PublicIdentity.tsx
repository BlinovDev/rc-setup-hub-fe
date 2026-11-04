import { Avatar } from "../profile/Avatar";
import { Link } from "react-router";
import type { components } from "../../api/generated/schema";
export function PublicIdentity({
  user,
}: {
  user: components["schemas"]["PublicProfile"];
}) {
  return (
    <Link
      className="inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 underline"
      to={`/users/${user.id}`}
    >
      <Avatar url={user.avatar_url} />
      <span className="min-w-0 break-words">{user.nickname}</span>
    </Link>
  );
}
