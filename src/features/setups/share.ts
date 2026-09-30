export const shareNavigation = {
  origin: () => window.location.origin,
  copy: (url: string) => navigator.clipboard.writeText(url),
};
export const setupShareUrl = (id: string) =>
  `${shareNavigation.origin()}/setups/${id}`;
