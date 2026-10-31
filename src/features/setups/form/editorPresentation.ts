import { createContext, useContext } from "react";
export type FormIssue = { path: string; message: string };
export const EditorPresentation = createContext<{
  savedVersion: number;
  removeIssues: (paths: string[]) => void;
}>({
  savedVersion: 0,
  removeIssues: () => {},
});
export const useEditorPresentation = () => useContext(EditorPresentation);
