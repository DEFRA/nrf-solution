local_resource(
    'frontend-compose',
    serve_cmd='source ~/.nvm/nvm.sh && nvm use && docker compose up',
    serve_dir='./frontend',
)

docker_compose('./backend/compose.yml', project_name='backend')

local_resource(
    'impact-assessor-compose',
    serve_cmd='docker compose up',
    serve_dir='./impact-assessor',
)

# Impact assessor app (FastAPI, runs locally)
local_resource(
    'impact-assessor-app',
    serve_cmd=' && '.join([
        'export GIT_HASH=$(git rev-parse HEAD)',
        'export PORT=8085',
        'export AWS_ENDPOINT_URL=http://localhost:4568',
        'export MONGO_URI=mongodb://localhost:27018/',
        'export ENV=dev',
        'export HOST=0.0.0.0',
        'export LOG_CONFIG=logging-dev.json',
        'export DB_IAM_AUTHENTICATION=false',
        'export DB_PORT=5434',
        'export $(grep -v "^#" compose/aws.env | xargs)',
        'export $(grep -v "^#" compose/secrets.env | xargs)',
        'uv run uvicorn app.main:app --host $HOST --port $PORT --reload --log-config=$LOG_CONFIG',
    ]),
    serve_dir='./impact-assessor',
    resource_deps=['impact-assessor-compose'],
)

# Manual dependency install buttons
local_resource(
    'frontend-npm-install',
    cmd='source ~/.nvm/nvm.sh && nvm use && npm install',
    dir='./frontend',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
)

local_resource(
    'backend-npm-install',
    cmd='source ~/.nvm/nvm.sh && nvm use && npm install',
    dir='./backend',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
)

local_resource(
    'impact-assessor-uv-sync',
    cmd='uv sync',
    dir='./impact-assessor',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
)

# Frontend app (runs locally via npm)
local_resource(
    'frontend-app',
    serve_cmd='source ~/.nvm/nvm.sh && nvm use && npm run dev',
    serve_dir='./frontend',
    resource_deps=['frontend-compose'],
)

local_resource(
    'format',
    cmd='./format.sh',
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
)
