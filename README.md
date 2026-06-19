# nrf-solution

This is the parent repo for the Nature Restoration Fund (NRF) service. It brings
together the individual service repos as git submodules so you can:

- **Run the full stack locally** with a single command (via Tilt)
- **Run AI-assisted queries** across the entire codebase in one context
- **Run journey tests** against all services together

Each submodule is an independent repo with its own CI/CD. This repo does not
contain application code — it provides the glue to run everything together.

| Submodule         | Repo                        | Description                     |
|-------------------|-----------------------------|---------------------------------|
| `frontend`        | `DEFRA/nrf-frontend`        | Hapi.js web frontend            |
| `backend`         | `DEFRA/nrf-backend`         | Node.js API backend             |
| `impact-assessor` | `DEFRA/nrf-impact-assessor` | Python/FastAPI spatial analysis |
| `journey-tests`   | `DEFRA/nrf-journey-tests`   | Cucumber + Playwright E2E tests |
| `admin-frontend`  | `DEFRA/nrf-admin-frontend`  | Hapi.js web admin frontend      |


[Setup](./docs/setup.md)

[Running & workflow](./docs/running-workflow.md)


## AI agent tools

- [Setting Atlassian credentials](../nrf-solution/docs/ai/atlassian-credentials.md)
- [Code reviewer agent & skill](../nrf-solution/docs/ai/code-reviewer.md)
- [Test in browser skill](../nrf-solution/docs/ai/test-in-browser.md)
