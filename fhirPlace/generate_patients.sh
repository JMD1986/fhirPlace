#!/bin/bash

# Generate FHIR patients using Synthea via Docker
# Usage: ./generate_patients.sh [number_of_patients]

PATIENTS=${1:-1000}
OUTPUT_DIR="$(pwd)/public/synthea/fhir"

echo "🏥 Generating $PATIENTS patients with Synthea..."
echo "📁 Output directory: $OUTPUT_DIR"
echo ""

docker run --rm \
  -v "$(pwd)/public/synthea:/output" \
  gradle:8.14-jdk21 bash -c \
  "cd /tmp && \
   git clone https://github.com/synthetichealth/synthea.git && \
   cd synthea && \
   ./gradlew build -x test && \
   ./run_synthea -p $PATIENTS -fhir --output /output/fhir"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Successfully generated $PATIENTS patients!"
  echo "📊 Updating manifest..."
  npm run synthea:manifest
else
  echo "❌ Failed to generate patients"
  exit 1
fi
