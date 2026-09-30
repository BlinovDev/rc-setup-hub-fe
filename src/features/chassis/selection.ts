// Frontend selection state; a brand without a model is incomplete, not Custom.
export type ChassisSelection = {
  brandId: string | null;
  modelId: string | null;
};

export function selectedChassisModelId(
  selection: ChassisSelection,
): string | null | undefined {
  if (selection.brandId === null) return null;
  return selection.modelId ?? undefined;
}
