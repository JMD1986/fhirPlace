const fs = require('fs')
const path = require('path')

const outDir = path.resolve(__dirname, '..', 'public', 'synthea')
const fhirDir = path.join(outDir, 'fhir')
const manifestPath = path.join(outDir, 'manifest.json')

function main() {
  try {
    if (!fs.existsSync(outDir)) {
      console.warn('No synthea output directory found at', outDir)
      fs.mkdirSync(outDir, { recursive: true })
    }

    if (!fs.existsSync(fhirDir)) {
      console.warn('No fhir folder found under', fhirDir)
    }

    const files = []
    if (fs.existsSync(fhirDir)) {
      const items = fs.readdirSync(fhirDir)
      for (const name of items) {
        const full = path.join(fhirDir, name)
        const stat = fs.statSync(full)
        if (stat.isFile()) {
          // include JSON and NDJSON files
          if (name.toLowerCase().endsWith('.json') || name.toLowerCase().endsWith('.ndjson')) {
            files.push(name)
          }
        }
      }
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      files,
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log('Wrote manifest with', files.length, 'files to', manifestPath)
  } catch (err) {
    console.error('Failed to generate manifest:', err)
    process.exit(1)
  }
}

main()
