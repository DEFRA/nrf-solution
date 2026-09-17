#!/bin/bash
# Create a new JIRA ticket
# Usage: ./create-ticket.sh [options]
#
# Options:
#   -p, --project KEY       Project key (default: NRF2)
#   -s, --summary TEXT      Ticket summary (required)
#   -d, --description TEXT  Description (use - to read from stdin)
#   -t, --type TYPE         Issue type (default: Story)
#   -P, --priority LEVEL    Priority: Lowest, Low, Medium, High, Highest
#   -l, --labels LABELS     Labels (comma-separated)
#   --parent KEY            Parent issue key (e.g. NRF2-100)
#   -h, --help              Show this help message
#
# Examples:
#   ./create-ticket.sh -s "My new story"
#   ./create-ticket.sh -s "My story" -d "Some description" -P High
#   echo "Description from pipe" | ./create-ticket.sh -s "My story" -d -
#   ./create-ticket.sh -s "My story" --parent NRF2-100 -l "frontend,accessibility"

set -e

# Defaults
PROJECT="NRF2"
SUMMARY=""
DESCRIPTION=""
TYPE="Story"
PRIORITY=""
LABELS=""
PARENT=""

show_help() {
    cat << EOF
Create a new JIRA ticket

Usage: ./create-ticket.sh [options]

Options:
  -p, --project KEY       Project key (default: NRF2)
  -s, --summary TEXT      Ticket summary (required)
  -d, --description TEXT  Description (use - to read from stdin)
  -t, --type TYPE         Issue type (default: Story)
  -P, --priority LEVEL    Priority: Lowest, Low, Medium, High, Highest
  -l, --labels LABELS     Labels (comma-separated)
  --parent KEY            Parent issue key (e.g. NRF2-100)
  -h, --help              Show this help message

Examples:
  ./create-ticket.sh -s "My new story"
  ./create-ticket.sh -s "My story" -d "Some description" -P High
  echo "Long description" | ./create-ticket.sh -s "My story" -d -
  ./create-ticket.sh -s "My story" --parent NRF2-100 -l "frontend,accessibility"

Environment Variables:
  ATLASSIAN_USER   Your Atlassian email address
  ATLASSIAN_TOKEN  Your Atlassian API token
EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--project)
            PROJECT="$2"
            shift 2
            ;;
        -s|--summary)
            SUMMARY="$2"
            shift 2
            ;;
        -d|--description)
            if [[ "$2" == "-" ]]; then
                DESCRIPTION=$(cat)
            else
                DESCRIPTION="$2"
            fi
            shift 2
            ;;
        -t|--type)
            TYPE="$2"
            shift 2
            ;;
        -P|--priority)
            PRIORITY="$2"
            shift 2
            ;;
        -l|--labels)
            LABELS="$2"
            shift 2
            ;;
        --parent)
            PARENT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            echo "Error: Unexpected argument '$1'"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate required fields
if [[ -z "$SUMMARY" ]]; then
    echo "Error: --summary is required"
    echo "Use --help for usage information"
    exit 1
fi

# Validate priority if provided
if [[ -n "$PRIORITY" ]]; then
    case "$PRIORITY" in
        Lowest|Low|Medium|High|Highest) ;;
        *)
            echo "Error: Invalid priority '$PRIORITY'. Must be Lowest, Low, Medium, High, or Highest"
            exit 1
            ;;
    esac
fi

# Validate parent key format if provided
if [[ -n "$PARENT" && ! "$PARENT" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]]; then
    echo "Error: Invalid parent key format '$PARENT'. Expected format: NRF2-123"
    exit 1
fi

# Check environment variables
USER="${ATLASSIAN_USER:-}"
if [[ -z "$USER" ]]; then
    echo "Error: ATLASSIAN_USER environment variable not set"
    exit 1
fi

if [[ -z "$ATLASSIAN_TOKEN" ]]; then
    echo "Error: ATLASSIAN_TOKEN environment variable not set"
    exit 1
fi

AUTH="$USER:$ATLASSIAN_TOKEN"
BASE_URL="https://eaflood.atlassian.net"

# Build the JSON payload
PAYLOAD=$(jq -n \
    --arg project "$PROJECT" \
    --arg summary "$SUMMARY" \
    --arg type "$TYPE" \
    '{
        fields: {
            project: {key: $project},
            summary: $summary,
            issuetype: {name: $type}
        }
    }')

if [[ -n "$DESCRIPTION" ]]; then
    PAYLOAD=$(echo "$PAYLOAD" | jq --arg description "$DESCRIPTION" '.fields.description = $description')
fi

if [[ -n "$PRIORITY" ]]; then
    PAYLOAD=$(echo "$PAYLOAD" | jq --arg priority "$PRIORITY" '.fields.priority = {name: $priority}')
fi

if [[ -n "$LABELS" ]]; then
    LABELS_JSON=$(echo "$LABELS" | tr ',' '\n' | jq -R . | jq -s .)
    PAYLOAD=$(echo "$PAYLOAD" | jq --argjson labels "$LABELS_JSON" '.fields.labels = $labels')
fi

if [[ -n "$PARENT" ]]; then
    PAYLOAD=$(echo "$PAYLOAD" | jq --arg parent "$PARENT" '.fields.parent = {key: $parent}')
fi

# Create the ticket
response=$(curl -s -X POST \
    -u "$AUTH" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    -w "\n%{http_code}" \
    "$BASE_URL/rest/api/2/issue")

# Extract HTTP status code
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Check for errors
if [[ "$http_code" == "201" ]]; then
    key=$(echo "$body" | jq -r '.key')
    echo "Created: $key"
    echo "URL: $BASE_URL/browse/$key"
else
    echo "Error creating ticket (HTTP $http_code):"
    if [[ -n "$body" ]]; then
        echo "$body" | jq -r '.errorMessages[]? // .errors // .' 2>/dev/null || echo "$body"
    fi
    exit 1
fi
