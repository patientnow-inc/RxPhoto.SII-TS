#!/bin/bash

# Function to display usage
usage() {
  echo "Usage: $0 --profile <profile> --demoUI <bool> --bucket <string> --signature <bool> --secrets <string> --secretsKey <string>"
  exit 1
}

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --profile) profile="$2"; shift ;;
    --demoUI) demoUI="$2"; shift ;;
    --bucket) bucket="$2"; shift ;;
    --signature) signature="$2"; shift ;;
    --secrets) secrets="$2"; shift ;;
    --secretsKey) secretsKey="$2"; shift ;;
    *) echo "Unknown parameter passed: $1"; usage ;;
  esac
  shift
done

# Validate required arguments
if [ -z "$profile" ] || [ -z "$demoUI" ] || [ -z "$bucket" ] || [ -z "$signature" ] || [ -z "$secrets" ] || [ -z "$secretsKey" ]; then
  usage
fi

# Run the commands
npm run clean:install

overrideWarningsEnabled=false npx cdk bootstrap --profile "$profile"

overrideWarningsEnabled=false npx cdk deploy \
  --parameters DeployDemoUIParameter="$demoUI" \
  --parameters SourceBucketsParameter="$bucket" \
  --parameters EnableSignatureParameter="$signature" \
  --parameters SecretsManagerSecretParameter="$secrets" \
  --parameters SecretsManagerKeyParameter="$secretsKey" \
  --parameters AutoWebPParameter=Yes \
  --profile "$profile"
