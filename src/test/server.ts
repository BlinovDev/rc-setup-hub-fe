import { setupServer } from "msw/node";

// Each API-boundary test registers only the handlers it needs.
export const server = setupServer();
