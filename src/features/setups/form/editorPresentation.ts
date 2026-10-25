import { createContext, useContext } from "react";
import type { components } from "../../../api/generated/schema";
export type FormIssue = { path: string; message: string };
export const EditorPresentation = createContext<{
  open: Record<string, boolean>;
  added: Record<string, boolean>;
  setAdded: (id: string, added: boolean) => void;
  setOpen: (id: string, open: boolean) => void;
  issues: FormIssue[];
  savedVersion: number;
  validate: (paths: string[]) => boolean;
  setup: components["schemas"]["Setup"] | undefined;
}>({
  open: {},
  added: {},
  setAdded: () => {},
  setOpen: () => {},
  issues: [],
  savedVersion: 0,
  validate: () => true,
  setup: undefined,
});
export const useEditorPresentation = () => useContext(EditorPresentation);
