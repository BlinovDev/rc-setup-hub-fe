import { createContext, useContext } from "react";
import type { components } from "../../../api/generated/schema";
export type FormIssue = { path: string; message: string };
export const EditorPresentation = createContext<{
  open: Record<string, boolean>;
  remove: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  issues: FormIssue[];
  savedVersion: number;
  validate: (paths: string[]) => boolean;
  setup: components["schemas"]["Setup"] | undefined;
}>({
  open: {},
  remove: () => {},
  setOpen: () => {},
  issues: [],
  savedVersion: 0,
  validate: () => true,
  setup: undefined,
});
export const useEditorPresentation = () => useContext(EditorPresentation);
