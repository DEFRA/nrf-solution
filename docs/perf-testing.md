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

Only the HTML report and the JMeter log reach your host (`performance-tests/reports/` and `performance-tests/logs/` — the only two mounted directories). The raw `.jtl` results file is written to the container's working directory (`/opt/perftest/<timestamp>-perftest-<scenario>-report.jtl`) and is lost when the container goes away. The contents of `reports/` are cleared automatically at the start of each run.

A local run also always **exits 1**: with `RESULTS_OUTPUT_S3_PATH` unset (it is set nowhere locally), the entrypoint fails at the S3-upload step after JMeter has finished. That is expected — by then the HTML report is already in `reports/`.

## Tuning the load profile

The **Run perf tests** button has inline inputs for the most common variables. Change them before clicking to adjust the run:

| Input              | Default | Description                        |
|--------------------|---------|------------------------------------|
| Threads per journey | `35`   | Concurrent users per thread group  |
| Ramp-up (s)        | `30`    | Time to reach full thread count    |
| Duration (s)       | `300`   | Maximum test duration              |
| Scenario           | `test`  | JMeter scenario file (without .jmx)|

With the defaults, the service sees 3 × 35 = 105 concurrent sessions (one thread group per journey).
