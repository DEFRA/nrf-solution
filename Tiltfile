load('ext://uibutton', 'cmd_button', 'text_input')

docker_compose('./compose.yml')

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
