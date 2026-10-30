import { chassisLabel } from "../setups/api";
import { PhotoImage } from "../setups/photos/PhotoImage";
import { PublicIdentity } from "../users/PublicIdentity";
import { Link } from "react-router";
import type { components } from "../../api/generated/schema";
export function SetupSearchCard({
  item,
}: {
  item: components["schemas"]["SetupSearchItem"];
}) {
  return (
    <article className="setup-card rounded border p-4">
      <PhotoImage photo={item.cover_photo} alt={`Cover of ${item.title}`} />
      <div className="setup-card-content space-y-2">
        <h3 className="text-xl font-semibold">
          <Link className="setup-title-link" to={`/setups/${item.id}`}>
            {item.title}
          </Link>
        </h3>
        <p>
          <PublicIdentity user={item.owner} />
        </p>
        <p>{chassisLabel(item)}</p>
        <p className="setup-card-date">
          Updated{" "}
          <time dateTime={item.updated_at}>
            {new Date(item.updated_at).toLocaleDateString()}
          </time>
        </p>
      </div>
    </article>
  );
}
