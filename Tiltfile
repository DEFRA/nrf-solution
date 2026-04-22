docker_compose('./compose.yml')

# Labels for Docker Compose services
dc_resource('backend',                  labels=['main'])
dc_resource('frontend',                 labels=['main'])
dc_resource('impact-assessor',          labels=['main'])
dc_resource('cdp-uploader',             labels=['stubs'])
dc_resource('defra-id-stub',            labels=['stubs'])
dc_resource('localstack',               labels=['infra'])
dc_resource('postgres',                 labels=['infra'])
dc_resource('redis',                    labels=['infra'])
dc_resource('mongodb',                  labels=['infra'])
dc_resource('caddy',                    labels=['infra'])
dc_resource('liquibase',                labels=['migrations'])
dc_resource('impact-assessor-migration',labels=['migrations'])

local_resource(
    'format',
    cmd='./format.sh',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
    labels=['dev'],
)

local_resource(
    'errors',
    serve_cmd='docker compose logs -f --no-log-prefix 2>&1 | grep --line-buffered -i "error"',
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO,
    labels=['debug'],
)
