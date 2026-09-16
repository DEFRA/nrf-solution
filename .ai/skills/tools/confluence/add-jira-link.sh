#!/bin/bash
# Prepend a Jira story link to a Confluence page
# Usage: ./add-jira-link.sh PAGE_ID_OR_URL JIRA_KEY JIRA_URL
# Example: ./add-jira-link.sh 6596757546 NRF2-1234 https://eaflood.atlassian.net/browse/NRF2-1234

set -e

INPUT="${1:-}"
JIRA_KEY="${2:-}"
JIRA_URL="${3:-}"
USER="${ATLASSIAN_USER:-}"
BASE_URL="https://eaflood.atlassian.net/wiki"

if [[ -z "$USER" ]]; then
  echo "Error: ATLASSIAN_USER environment variable not set"
  exit 1
fi

if [[ -z "$ATLASSIAN_TOKEN" ]]; then
  echo "Error: ATLASSIAN_TOKEN environment variable not set"
  exit 1
fi

if [[ -z "$INPUT" || -z "$JIRA_KEY" || -z "$JIRA_URL" ]]; then
  echo "Usage: ./add-jira-link.sh PAGE_ID_OR_URL JIRA_KEY JIRA_URL"
  exit 1
fi

if ! [[ "$JIRA_KEY" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]]; then
  echo "Error: invalid Jira key format: $JIRA_KEY"
  exit 1
fi

# Extract page ID if a URL was provided
if [[ "$INPUT" =~ ^https?:// ]]; then
  PAGE_ID=$(echo "$INPUT" | sed -E 's#.*/pages/([0-9]+).*#\1#')
else
  PAGE_ID="$INPUT"
fi

if ! [[ "$PAGE_ID" =~ ^[0-9]+$ ]]; then
  echo "Error: unable to determine page ID from input: $INPUT"
  exit 1
fi

# Fetch current page (storage format + version + title)
response=$(curl -s -u "$USER:$ATLASSIAN_TOKEN" \
  -H "Accept: application/json" \
  "$BASE_URL/rest/api/content/$PAGE_ID?expand=body.storage,version,title")

if echo "$response" | jq -e '.statusCode' > /dev/null 2>&1; then
  echo "Error: $(echo "$response" | jq -r '.message // "Unknown error"')"
  exit 1
fi

CURRENT_VERSION=$(echo "$response" | jq -r '.version.number')
TITLE=$(echo "$response" | jq -r '.title')
CURRENT_BODY=$(echo "$response" | jq -r '.body.storage.value')

NEW_VERSION=$((CURRENT_VERSION + 1))
JIRA_LINK="<p><strong>Jira story</strong>: <a href=\"$JIRA_URL\">$JIRA_KEY</a></p>"
UPDATED_BODY="${JIRA_LINK}${CURRENT_BODY}"

# Build the update payload
payload=$(jq -n \
  --arg title "$TITLE" \
  --argjson version "$NEW_VERSION" \
  --arg body "$UPDATED_BODY" \
  '{
    "version": { "number": $version },
    "title": $title,
    "type": "page",
    "body": {
      "storage": {
        "value": $body,
        "representation": "storage"
      }
    }
  }')

update_response=$(curl -s -o /dev/null -w "%{http_code}" \
  -u "$USER:$ATLASSIAN_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$payload" \
  "$BASE_URL/rest/api/content/$PAGE_ID")

if [[ "$update_response" == "200" ]]; then
  echo "Updated: $BASE_URL/spaces/NRFDT/pages/$PAGE_ID"
else
  echo "Error: Confluence API returned HTTP $update_response"
  exit 1
fi
