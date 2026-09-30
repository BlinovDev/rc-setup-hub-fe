# Frontend testing strategy

Testing is a progress gate for vibe-coded development.

## Test layers

### 1. Unit tests

Use Vitest.

Good targets:

- numeric form parsing (`""` vs `"0"`);
- URL/filter parsing;
- cursor/load-more helpers if frontend-specific logic exists;
- small formatting/view-model helpers;
- error mapping.

### 2. Component/route tests

Use React Testing Library.

Test behavior visible to the user rather than implementation details.

Examples:

- authenticated shell renders current user;
- login state renders correctly;
- setup form preserves zero values;
- friendship request sections show correct actions;
- inaccessible setup route renders a generic unavailable state.

### 3. API-boundary tests

Use MSW to mock the backend HTTP boundary for frontend tests.

Do not mock deep internal implementation details of the API client when an HTTP-level mock is practical.

Test representative responses:

```text
200 / 201 / 204
400
401
404
409
500
```

### 4. End-to-end tests

Add Playwright after core screens exist.

Minimum eventual E2E flow:

1. resolve authenticated test session;
2. list chassis;
3. create setup with explicit zero numeric value;
4. edit setup;
5. make setup public;
6. find it in discovery;
7. open stable detail route;
8. second user sends/accepts friendship;
9. friends-only visibility works;
10. remove friendship and access disappears;
11. delete setup.

Real Google OAuth should not be required for the normal automated frontend suite. Use an appropriate test session/backend strategy for E2E.

## Mandatory regressions

### Optional numeric zero

At least one test must prove:

```text
input "0" -> request numeric 0
input ""  -> omitted/undefined
```

### Auth storage

No frontend test or implementation should rely on localStorage/sessionStorage tokens.

### Visibility UX

The frontend may display actions based on known ownership, but tests must not assume this is the security boundary.

A backend 404 for an inaccessible setup should render the same generic unavailable UI as a missing setup unless the backend contract says otherwise.

### Search

Public discovery tests should verify filters/query state and pagination behavior without showing friends/private records supplied outside the endpoint contract.

### Friendships

Test:

- incoming request accept/reject controls;
- outgoing cancel control;
- accepted remove control;
- mutation invalidates/reloads friendship data.

## Phase verification commands

Phase FE 0 should establish canonical scripts such as:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Exact script names may be finalized in FE 0 and then must remain stable unless there is a reason to change them.
