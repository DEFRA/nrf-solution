# Journey testing

Journey (end-to-end) tests run via [nrf-journey-tests](https://github.com/DEFRA/nrf-journey-tests) using Cucumber and Playwright. The submodule is included at `journey-tests/`.

Unlike the other test suites, the browser runs **on your host**, not in a container — it drives the Tilt stack through `localhost:3000` exactly as a real user's browser does. This is what lets the upload journey work: the cdp-uploader form action (`localhost:7337`) resolves the same way it does for a user, with no container networking hacks.

## Running the tests

1. Start the full stack with `tilt up` and wait for all services to be healthy.
2. In the Tilt dashboard, find the **journey-tests** card (under the **e2e** label).
3. Click **Run journey tests**.

The first run installs the suite's npm dependencies and the Playwright browser (a one-off, a few minutes). Subsequent runs start immediately.

## Watching the browser

The Run button always runs headful (`E2E_HEADFUL=true`) in Playwright's **bundled Chromium**, so you can watch the browser drive the journey in a visible window. Bundled Chromium is a deliberate choice, not a fallback: headful it has a real GPU, so the draw-boundary journey's WebGL map renders correctly (headless it falls back to SwiftShader). The system Chrome channel (`BROWSER_CHANNEL=chrome`) is an opt-in for direct runs only — on macOS it loaded the draw map page in ~14s versus under 1s in bundled Chromium — so the Tilt path never sets it.

## Email verification

The quote confirmation steps check emails via GOV.UK Notify and need `NOTIFY_API_KEY`. Through Tilt the key is read from `compose.override.yml` (the backend's own copy of the secret, wired into the Run button by the Tiltfile), so it only needs to be set in one place. `journey-tests/.env.local` (gitignored) matters only when running `./run-journey-tests.sh` directly, outside Tilt:

```
NOTIFY_API_KEY=<key>
```

Obtain the key from another team dev or [CDP secrets](https://portal.cdp-int.defra.cloud/test-suites/nrf-journey-tests/secrets). Without it, the email verification steps fail; the rest of the suite still runs.

## Viewing results

The Allure report is generated at `journey-tests/allure-report/index.html` after each run. Open it in a browser:

```bash
open journey-tests/allure-report/index.html
```

Screenshots of failed scenarios are attached automatically.

## Options

The **Run journey tests** button has two inline inputs. Change them before clicking to adjust the run:

| Input    | Default             | Description                                                                                          |
|----------|---------------------|------------------------------------------------------------------------------------------------------|
| Feature  | `Run all features`  | Run the whole suite, or pick a single `.feature` file                                                |
| Parallel | `5`                 | Scenarios running in parallel (1 = sequential; the suite's own default when unset is 3)              |

The run is always headful in Playwright's bundled Chromium — there is no headless/browser/tags input (see [Watching the browser](#watching-the-browser)).

The **Feature** list is generated from the files in `journey-tests/test/features/` when Tilt loads, so it stays in sync as features are added or removed (reload the Tiltfile to pick up new ones).

The tests can also be run directly from the repo root with `./run-journey-tests.sh`. That path additionally honours `E2E_HEADFUL` (default headless), `BROWSER` (`chromium`, `firefox` or `webkit`), `BROWSER_CHANNEL` and `TAGS` (Cucumber tag filter, e.g. `@smoke`); the Tilt button passes only `FEATURE` and `PARALLEL`.

## Adding a page to an existing journey

Extend the existing feature file for the area (for example `request-to-use.feature`) rather than adding a new one, and register new page objects in `test/support/world.js`. Don't add steps that depend on a page that isn't built yet; leave them out and note them in the PR description. The story that builds the next page adds the follow-on step (for example `I should be taken to {string}`, which checks the URL path).

## Checking step wiring without the stack

When the Tilt stack isn't running, `npx cucumber-js --dry-run` (run in `journey-tests/` after `npm install`) checks that every step in the feature files matches a step definition, without launching a browser.
