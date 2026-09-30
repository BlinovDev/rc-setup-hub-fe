import type { ComponentPropsWithRef } from "react";
export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      type={type}
      className={`ui-button ui-button-${variant} ${className}`}
      {...props}
    />
  );
}
