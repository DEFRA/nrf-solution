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
# Auth defaults to the real Defra ID tenant; the stub only takes effect when
# DEFRA_ID_* in compose.override.yml point at it.
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
# Tilt frontend at localhost:3000. The browser must run on the host so it hits
# the same localhost origins a real user does — including the cdp-uploader form
# action on localhost:7337 — so the upload journey works with no extra wiring.
# Manual trigger; toggle E2E_HEADFUL=true to watch the browser drive the journey.
#
# NOTIFY_API_KEY is read from compose.override.yml (the backend's own copy of
# the secret) rather than journey-tests/.env.local, so the key only needs to
# be set in one place for devs running the suite through Tilt.
#
# The Defra ID mode (from DEFRA_ID_BASE_URL) and the test-user password are read
# from the frontend block of compose.override.yml for the same reason. Compose files escape a literal
# `$` as `$$`, so undo that here.
_notify_api_key = ''
_defra_id_env = {}
if os.path.exists('./compose.override.yml'):
    _override = read_yaml('./compose.override.yml')
    _notify_api_key = _override.get('services', {}).get('backend', {}).get('environment', {}).get('NOTIFY_API_KEY', '')
    _frontend_env = _override.get('services', {}).get('frontend', {}).get('environment', {})
    if _frontend_env.get('DEFRA_ID_USER_PASSWORD'):
        _defra_id_env['DEFRA_ID_USER_PASSWORD'] = str(_frontend_env['DEFRA_ID_USER_PASSWORD']).replace('$$', '$')
    # Stub mode when the frontend is pointed at the defra-id-stub, else real.
    _defra_id_env['DEFRA_ID_MODE'] = 'stub' if 'defra-id-stub' in str(_frontend_env.get('DEFRA_ID_BASE_URL', '')) else 'real'

local_resource(
    'journey-tests',
    cmd='./run-journey-tests.sh',
    env=dict({'NOTIFY_API_KEY': _notify_api_key}, **_defra_id_env),
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['e2e'],
    resource_deps=['frontend'],
)

# Build the feature dropdown from the actual .feature files at Tiltfile-eval
# time, so the list stays in sync as features are added or removed. Recurses
# into subfolders (e.g. draw/, upload/) and keeps the subfolder in the choice
# value — several subfolders share filenames (e.g. quote-full-journey.feature
# exists under both draw/ and upload/), so the basename alone isn't unique.
# listdir(recursive=True) returns absolute paths, so split on the known
# relative root rather than slicing a fixed length off the front.
_features_root = 'journey-tests/test/features'
_feature_files = sorted([
    p.split(_features_root + '/', 1)[1]
    for p in listdir(_features_root, recursive=True)
    if p.endswith('.feature')
])
_feature_choices = ['Run all features'] + _feature_files

cmd_button(
    'journey-tests:run',
    # Always headed, in Playwright's bundled Chromium (real GPU, fast map load).
    argv=['bash', '-c', '%s NOTIFY_API_KEY=%s E2E_HEADFUL=true FEATURE="$FEATURE" PARALLEL="$PARALLEL" ./run-journey-tests.sh' % (
        ' '.join(['%s=%s' % (k, shlex.quote(v)) for k, v in _defra_id_env.items()]),
        _notify_api_key,
    )],
    resource='journey-tests',
    text='Run journey tests',
    icon_name='travel_explore',
    inputs=[
        choice_input('FEATURE', choices=_feature_choices, label=''),
        text_input('PARALLEL', default='5', label='Tests running in parallel (1 = sequential)'),
    ],
)

# Tilt has no built-in cancel for a running manual local_resource, so this
# kills the host-run cucumber-js process and its parallel workers. Playwright
# closes the browsers it launched when its parent exits. Tilt can't show a
# button conditionally, so it's always visible. The id is 'stop' not 'cancel'
# because Tilt orders buttons by id and this must sort after 'run'.
cmd_button(
    'journey-tests:stop',
    argv=['bash', '-c', 'pkill -f "journey-tests/node_modules/.bin/cucumber-js|@cucumber/cucumber" || echo "No journey test run in progress"'],
    resource='journey-tests',
    text='Cancel journey tests',
    icon_name='cancel',
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
    'test-impact-assessor',
    cmd='docker compose exec -T impact-assessor uv run pytest tests/ app/ -v',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
    resource_deps=['impact-assessor'],
)

local_resource(
    'load-IA-data',
    # impact-assessor-migration has alembic/, scripts/ and tests/data/fixtures/ mounted;
    # spin up a one-shot container. Migrates before loading, mirroring the compose
    # service — new fixtures usually arrive alongside the revision that reshapes them,
    # and loading into an un-migrated schema fails confusingly.
    cmd='docker compose run --rm --no-deps --entrypoint sh impact-assessor-migration -c ' +
        '"python3 -m alembic upgrade head && ' +
        'python3 scripts/load_data.py --fixtures-dir tests/data/fixtures/"',
    # Fixtures are bind-mounted, so editing one changes the container filesystem without
    # rebuilding an image. Without these deps Tilt sees nothing, impact-assessor-migration
    # stays completed, every resource reads green and the DB silently holds stale data.
    deps=[
        'impact-assessor/tests/data/fixtures',
        'impact-assessor/alembic/versions',
    ],
    ignore=['**/.DS_Store', '**/__pycache__/**'],
    auto_init=False,
    trigger_mode=TRIGGER_MODE_AUTO,
    labels=['migrations'],
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
