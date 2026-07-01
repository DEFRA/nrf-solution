# Journey testing

Journey (end-to-end) tests run via [nrf-journey-tests](https://github.com/DEFRA/nrf-journey-tests) using Cucumber and Playwright. The submodule is included at `journey-tests/`.

Unlike the other test suites, the browser runs **on your host**, not in a container — it drives the Tilt stack through `localhost:3010` exactly as a real user's browser does. This is what lets the upload journey work: the cdp-uploader form action (`localhost:7337`) resolves the same way it does for a user, with no container networking hacks.

## Running the tests

1. Start the full stack with `tilt up` and wait for all services to be healthy.
2. In the Tilt dashboard, find the **journey-tests** card (under the **e2e** label).
3. Click **Run journey tests**.

The first run installs the suite's npm dependencies and the Playwright browser (a one-off, a few minutes). Subsequent runs start immediately.

## Watching the browser

Set **Headful** to `true` on the Run button to watch the browser drive the journey in a visible window. Headful mode uses your system Chrome (via `BROWSER_CHANNEL=chrome`), which has a real GPU so the draw-boundary journey's WebGL map renders correctly.

## Email verification

The quote confirmation steps check emails via GOV.UK Notify and need `NOTIFY_API_KEY`. Add it to `journey-tests/.env.local` (gitignored) before running:

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

The **Run journey tests** button has inline inputs. Change them before clicking to adjust the run:

| Input   | Default    | Description                                                        |
|---------|------------|--------------------------------------------------------------------|
| Feature | `All`      | Run the whole suite, or pick a single `.feature` file              |
| Headful | `false`    | Set `true` to watch the browser in a visible window                |
| Browser | `chromium` | Browser engine — `chromium`, `firefox` or `webkit`                 |
| Tags    | *(empty)*  | Cucumber tag filter, e.g. `@smoke` or `@regression and not @flaky` |

The **Feature** list is generated from the files in `journey-tests/test/features/` when Tilt loads, so it stays in sync as features are added or removed (reload the Tiltfile to pick up new ones).

The tests can also be run directly from the repo root with `./run-journey-tests.sh` (honours the same `FEATURE`, `E2E_HEADFUL`, `BROWSER` and `TAGS` environment variables).
