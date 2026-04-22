#!/bin/bash

# awslocal is a LocalStack CLI wrapper — automatically targets http://localhost:4566

echo "[INIT SCRIPT] Starting LocalStack setup" >&2

echo "[INIT SCRIPT] Creating S3 buckets" >&2

awslocal s3 mb s3://cdp-uploader-quarantine --region eu-west-2
awslocal s3 mb s3://boundaries --region eu-west-2

echo "[INIT SCRIPT] Creating SQS queues" >&2

awslocal sqs create-queue --queue-name cdp-clamav-results --region eu-west-2
awslocal sqs create-queue --queue-name cdp-uploader-download-requests --region eu-west-2
awslocal sqs create-queue \
  --queue-name cdp-uploader-scan-results-callback.fifo \
  --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true"}' \
  --region eu-west-2

# Mock ClamAV — used by cdp-uploader when MOCK_VIRUS_SCAN_ENABLED=true
awslocal sqs create-queue --queue-name mock-clamav --region eu-west-2
awslocal s3api put-bucket-notification-configuration \
  --bucket cdp-uploader-quarantine \
  --notification-configuration '{"QueueConfigurations":[{"QueueArn":"arn:aws:sqs:eu-west-2:000000000000:mock-clamav","Events":["s3:ObjectCreated:*"]}]}' \
  --region eu-west-2

echo "[INIT SCRIPT] Creating SNS topics" >&2

# Topic name uses underscores — matches SNS_TOPIC_ARN_QUOTE_ESTIMATE_REQUEST in nrf-backend env
awslocal sns create-topic --name nrf_quote_estimate_request --region eu-west-2

echo "[INIT SCRIPT] Creating impact-assessor SQS queue and SNS subscription" >&2

# Queue consumed by impact-assessor
awslocal sqs create-queue --queue-name nrf-impact-assessment-jobs --region eu-west-2

# Subscribe the queue to the quote-estimate SNS topic so published jobs reach the consumer
awslocal sns subscribe \
  --topic-arn arn:aws:sns:eu-west-2:000000000000:nrf_quote_estimate_request \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:eu-west-2:000000000000:nrf-impact-assessment-jobs \
  --region eu-west-2

echo "[INIT SCRIPT] LocalStack setup complete" >&2
