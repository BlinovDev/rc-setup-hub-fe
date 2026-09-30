import type { ReactNode } from "react";
export function LoadingState({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role="status" className={`loading-state ${className}`}>
      <span aria-hidden="true" className="loading-marker" />
      {children}
    </p>
  );
}
export function InlineNotice({
  children,
  className = "",
  tone = "success",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "success" | "error";
  id?: string;
}) {
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={`inline-notice notice-${tone} ${className}`}
    >
      {children}
    </div>
  );
}
