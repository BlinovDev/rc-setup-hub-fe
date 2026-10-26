import { useLayoutEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router";
import { setupOptions } from "../features/setups/queries";
import { isUuid } from "../features/search/filters";
import { chassisLabel } from "../features/setups/api";

// One head owner reads the existing detail query without causing another request.
// The shell remounts it for every viewer transition, alongside protected content.
export function RouteMetadata({
  unresolved = false,
}: {
  unresolved?: boolean;
}) {
  const location = useLocation();
  const match = /^\/setups\/([^/]+)\/?$/.exec(location.pathname);
  const id = match?.[1];
  const client = useQueryClient();
  const detail = useQuery({
    ...setupOptions(client, id && isUuid(id) ? id : "metadata-inactive"),
    enabled: false,
    gcTime: 0,
  });
  const setup =
    !unresolved && detail.isSuccess && detail.data?.visibility === "public"
      ? detail.data
      : undefined;
  const title = setup
    ? `${setup.title} | RC Setup Hub`
    : location.pathname === "/"
      ? "Explore RC drift setups | RC Setup Hub"
      : "RC Setup Hub";
  const description = setup
    ? `${setup.title}. ${chassisLabel(setup)}. ${setup.notes || "View this public RC drift setup, technical details and photos."}`
        .replace(/\s+/g, " ")
        .slice(0, 160)
    : "Explore RC drift setups shared by the community. Sign in to save and share your own.";
  const canonical = new URL(
    setup ? `/setups/${setup.id}` : location.pathname,
    window.location.origin,
  ).href;
  useLayoutEffect(() => {
    document.title = title;
    const meta = (name: string, content: string, property = false) => {
      const attribute = property ? "property" : "name";
      let element = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${name}"]`,
      );
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.append(element);
      }
      element.content = content;
    };
    meta("description", description);
    meta("robots", setup ? "index, follow" : "noindex, nofollow");
    meta("og:title", title, true);
    meta("og:description", description, true);
    meta("og:type", "website", true);
    meta("og:url", canonical, true);
    meta("twitter:card", "summary");
    meta("twitter:title", title);
    meta("twitter:description", description);
    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.append(link);
    }
    link.href = canonical;
    return () => {
      document.title = "RC Setup Hub";
      document.head
        .querySelector('meta[name="robots"]')
        ?.setAttribute("content", "noindex, nofollow");
      document.head
        .querySelector('meta[name="description"]')
        ?.setAttribute("content", "RC Setup Hub");
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head
        .querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')
        .forEach((element) => element.remove());
    };
  }, [title, description, canonical, setup]);
  return null;
}
