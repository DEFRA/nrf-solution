load('ext://uibutton', 'cmd_button', 'text_input', 'choice_input')

compose_files = ['./compose.yml']
if os.path.exists('./compose.override.yml'):
    compose_files.append('./compose.override.yml')
docker_compose(compose_files)

# Labels for Docker Compose services
dc_resource('backend',                  labels=['main'])
dc_resource('frontend',                 labels=['main'])
dc_resource('admin-frontend',           labels=['main'])
dc_resource('impact-assessor',          labels=['main'])
dc_resource('cdp-uploader',             labels=['stubs'])
dc_resource('defra-id-stub',            labels=['stubs'])
dc_resource('squid',                    labels=['infra'])
dc_resource('localstack',               labels=['infra'])
dc_resource('postgres',                 labels=['infra'])
dc_resource('redis',                    labels=['infra'])
dc_resource('mongodb',                  labels=['infra'])
dc_resource('caddy',                    labels=['infra'])
dc_resource('liquibase',                labels=['migrations'])
dc_resource('impact-assessor-migration',labels=['migrations'])
dc_resource('performance-tests',        labels=['perf'])

# ── Stop / Start buttons for failure simulation ─────────────────────────────
# Attaches inline buttons to each service card — no extra sidebar entries.
for svc in ['backend', 'frontend', 'impact-assessor', 'postgres', 'redis', 'localstack']:
    cmd_button(
        '%s:stop' % svc,
        argv=['docker', 'compose', 'stop', svc],
        resource=svc,
        text='Stop',
        icon_name='stop',
    )
    cmd_button(
        '%s:start' % svc,
        argv=['docker', 'compose', 'up', '-d', '--no-deps', svc],
        resource=svc,
        text='Start',
        icon_name='play_arrow',
    )

# ── Performance test trigger ────────────────────────────────────────────────
cmd_button(
    'performance-tests:run',
    argv=[
        'bash', '-c',
        'docker compose exec -T -e THREAD_COUNT=$THREAD_COUNT -e RAMPUP_SECONDS=$RAMPUP_SECONDS -e DURATION_SECONDS=$DURATION_SECONDS -e TEST_SCENARIO=$TEST_SCENARIO performance-tests ./entrypoint.sh',
    ],
    resource='performance-tests',
    text='Run perf tests',
    icon_name='speed',
    inputs=[
        text_input('THREAD_COUNT',     default='35',   label='Threads per journey'),
        text_input('RAMPUP_SECONDS',   default='30',   label='Ramp-up (s)'),
        text_input('DURATION_SECONDS', default='300',  label='Duration (s)'),
        text_input('TEST_SCENARIO',    default='test', label='Scenario'),
    ],
)

# ── Journey tests (host-run) ────────────────────────────────────────────────
# Runs the Playwright/Cucumber suite on the HOST (not in a container) against the
# Tilt frontend at localhost:3010. The browser must run on the host so it hits
# the same localhost origins a real user does — including the cdp-uploader form
# action on localhost:7337 — so the upload journey works with no extra wiring.
# Manual trigger; toggle E2E_HEADFUL=true to watch the browser drive the journey.
local_resource(
    'journey-tests',
    cmd='./run-journey-tests.sh',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['e2e'],
    resource_deps=['frontend'],
)

# Build the feature dropdown from the actual .feature files at Tiltfile-eval
# time, so the list stays in sync as features are added or removed.
_feature_files = sorted([
    os.path.basename(p)
    for p in listdir('journey-tests/test/features')
    if p.endswith('.feature')
])
_feature_choices = ['Run all features'] + _feature_files

cmd_button(
    'journey-tests:run',
    argv=['bash', '-c', 'E2E_HEADFUL="$E2E_HEADFUL" BROWSER="$BROWSER" TAGS="$TAGS" FEATURE="$FEATURE" ./run-journey-tests.sh'],
    resource='journey-tests',
    text='Run journey tests',
    icon_name='travel_explore',
    inputs=[
        choice_input('FEATURE', choices=_feature_choices, label=''),
        text_input('E2E_HEADFUL', default='false',    label='Headful — watch the browser (true/false)'),
        text_input('BROWSER',     default='chromium', label='Browser (chromium/firefox/webkit)'),
        text_input('TAGS',        default='',         label='Cucumber tag filter (optional)'),
    ],
)

# ── SQS / SNS helpers on the localstack card ────────────────────────────────
# Output appears in the localstack log panel.
_AWS = 'AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=eu-west-2 aws --endpoint-url=http://localhost:4566'
_SQS = 'http://localhost:4566/000000000000/nrf-impact-assessment-jobs'
_SNS = 'arn:aws:sns:eu-west-2:000000000000:nrf_quote_estimate_request'

cmd_button(
    'localstack:sqs-depth',
    argv=['bash', '-c', '%s sqs get-queue-attributes --queue-url %s --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible | python3 -m json.tool' % (_AWS, _SQS)],
    resource='localstack',
    text='SQS Depth',
    icon_name='bar_chart',
)

cmd_button(
    'localstack:sqs-peek',
    argv=['bash', '-c', '%s sqs receive-message --queue-url %s --visibility-timeout 0 --max-number-of-messages 10 | python3 -m json.tool' % (_AWS, _SQS)],
    resource='localstack',
    text='SQS Peek',
    icon_name='visibility',
)

cmd_button(
    'localstack:sqs-purge',
    argv=['bash', '-c', '%s sqs purge-queue --queue-url %s' % (_AWS, _SQS)],
    resource='localstack',
    text='SQS Purge',
    icon_name='delete_sweep',
)

cmd_button(
    'localstack:sns-publish',
    argv=['bash', '-c', '%s sns publish --topic-arn %s --message "file://$PAYLOAD_FILE"' % (_AWS, _SNS)],
    resource='localstack',
    text='SNS Publish',
    icon_name='send',
    inputs=[
        text_input(
            'PAYLOAD_FILE',
            default='impact-assessor/scripts/sample_quote_payload.json',
            placeholder='Path to JSON payload file',
            label='Payload file',
        ),
    ],
)

# ── dev: manual one-shot helpers ────────────────────────────────────────────

local_resource(
    'format',
    cmd='./format.sh',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
)

local_resource(
    'lint',
    cmd='docker compose exec -T backend npm run lint && docker compose exec -T frontend npm run lint && docker compose exec -T impact-assessor uv run ruff check .',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
)

local_resource(
    'test-backend',
    # Uses vitest.tilt.config.js: skips Docker-dependent global-setup, points at the
    # already-running Tilt postgres (5432), localstack (4566) and cdp-uploader (7337).
    cmd='docker compose exec -T backend npm test -- --config vitest.tilt.config.js',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
    resource_deps=['backend'],
)

local_resource(
    'test-frontend',
    # Uses vitest.tilt.config.js: skips the Redis global-setup (Redis is already
    # reachable on the Docker network as redis:6379) and clears proxy env vars.
    cmd='docker compose exec -T frontend npm test -- --config vitest.tilt.config.js',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
    resource_deps=['frontend'],
)

local_resource(
    'test-impact-assessor',
    cmd='docker compose exec -T impact-assessor uv run pytest tests/ app/ -v',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
    resource_deps=['impact-assessor'],
)

local_resource(
    'load-fixtures',
    # impact-assessor-migration has scripts/ and tests/data/fixtures/ mounted; spin up a one-shot container
    cmd='docker compose run --rm --no-deps --entrypoint python3 impact-assessor-migration scripts/load_data.py --fixtures-dir tests/data/fixtures/',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
    resource_deps=['impact-assessor-migration'],
)

# ── debug: live log streams ──────────────────────────────────────────────────

local_resource(
    'errors',
    serve_cmd='docker compose logs -f --tail=100 2>&1 | grep --line-buffered "ERROR"',
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO,
    labels=['debug'],
)

local_resource(
    'warnings',
    serve_cmd='docker compose logs -f --tail=100 2>&1 | grep --line-buffered "WARN"',
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO,
    labels=['debug'],
)
