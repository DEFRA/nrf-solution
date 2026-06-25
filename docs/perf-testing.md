# Performance testing

Performance tests run via [nrf-performance-tests](https://github.com/DEFRA/nrf-performance-tests) using JMeter. The submodule is included at `performance-tests/` and the container starts automatically with `tilt up` — it idles until you trigger a run.

## Running a test

1. Start the full stack with `tilt up` and wait for all services to be healthy.
2. In the Tilt dashboard, find the **performance-tests** card (under the **perf** label).
3. Click **Run perf tests**. The button executes `entrypoint.sh` inside the container against the running frontend.

The test runs the default `test` scenario — three JMeter thread groups (homepage, submit-quote, upload) in parallel. It will take several minutes.

## Viewing results

Results are written to `performance-tests/reports/` on your host. Open the HTML report in a browser:

```bash
open performance-tests/reports/index.html
```

The report breaks KPIs down per journey: `GET homepage`, `Submit quote`, and `Upload boundary flow`.

Raw results (`.jtl` file) land in the same directory alongside the report. Both are cleared automatically at the start of each run.

## Tuning the load profile

The **Run perf tests** button has inline inputs for the most common variables. Change them before clicking to adjust the run:

| Input              | Default | Description                        |
|--------------------|---------|------------------------------------|
| Threads per journey | `35`   | Concurrent users per thread group  |
| Ramp-up (s)        | `30`    | Time to reach full thread count    |
| Duration (s)       | `300`   | Maximum test duration              |
| Scenario           | `test`  | JMeter scenario file (without .jmx)|

With the defaults, the service sees 3 × 35 = 105 concurrent sessions (one thread group per journey).
