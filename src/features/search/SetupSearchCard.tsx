import { PublicIdentity } from "../users/PublicIdentity";
import { Link } from "react-router";
import type { components } from "../../api/generated/schema";
export function SetupSearchCard({
  item,
}: {
  item: components["schemas"]["SetupSearchItem"];
}) {
  return (
    <article className="rounded border p-4 space-y-2">
      <h3 className="text-xl font-semibold">
        <Link className="underline" to={`/setups/${item.id}`}>
          {item.title}
        </Link>
      </h3>
      <p>
        <PublicIdentity user={item.owner} />
      </p>
      <p>
        {item.chassis
          ? `${item.chassis.brand_name} ${item.chassis.model_name}`
          : "Custom / not listed"}
      </p>
      <p>
        Created:{" "}
        <time dateTime={item.created_at}>
          {new Date(item.created_at).toLocaleString()}
        </time>
      </p>
      <p>
        Updated:{" "}
        <time dateTime={item.updated_at}>
          {new Date(item.updated_at).toLocaleString()}
        </time>
      </p>
    </article>
  );
}
