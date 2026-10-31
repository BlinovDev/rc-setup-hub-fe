import { useEffect } from "react";
import { useNavigate } from "react-router";
import { consumeCloneTarget } from "./cloneIntent";

export function CloneContinuation() {
  const navigate = useNavigate();
  useEffect(() => {
    const id = consumeCloneTarget();
    if (id) void navigate(`/setups/${id}?clone=confirm`, { replace: true });
  }, [navigate]);
  return null;
}
