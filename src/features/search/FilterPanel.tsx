import { useEffect, useState, type ReactNode } from "react";

export function FilterPanel({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(
    () => window.matchMedia?.("(min-width: 768px)").matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 768px)");
    const resize = () => setOpen(media?.matches ?? false);
    media?.addEventListener("change", resize);
    return () => media?.removeEventListener("change", resize);
  }, []);
  return (
    <details
      className="search-filters"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Filters{active ? " · Active" : ""}</summary>
      {children}
    </details>
  );
}
