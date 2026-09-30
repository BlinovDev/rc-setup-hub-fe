import { Link } from "react-router";
import type { components } from "../../api/generated/schema";
export function PublicIdentity({
  user,
}: {
  user: components["schemas"]["PublicProfile"];
}) {
  return (
    <Link className="underline" to={`/users/${user.id}`}>
      {user.avatar_url && (
        <img
          className="inline-block h-8 w-8 rounded-full mr-2"
          src={user.avatar_url}
          alt=""
        />
      )}
      {user.nickname}
    </Link>
  );
}
