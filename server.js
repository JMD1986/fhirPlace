import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Serve static files from public/synthea
app.use('/synthea', express.static(path.join(__dirname, 'public/synthea')));

// Get all patients
app.get('/api/patients', (req, res) => {
  try {
    const fhirDir = path.join(__dirname, 'public/synthea/fhir');
    const files = fs.readdirSync(fhirDir);
    
    const patients = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(fhirDir, file);
        const data = fs.readFileSync(filePath, 'utf-8');
        try {
          const patient = JSON.parse(data);
          return {
            id: patient.id || file.replace('.json', ''),
            name: patient.name?.[0]?.text || file.replace('.json', ''),
            filename: file,
            resourceType: patient.resourceType,
          };
        } catch (e) {
          return null;
        }
      })
      .filter(p => p !== null);

    res.json(patients);
  } catch (error) {
    console.error('Error reading patients:', error);
    res.status(500).json({ error: 'Failed to read patients' });
  }
});

// Get a specific patient by ID
app.get('/api/patients/:id', (req, res) => {
  try {
    const fhirDir = path.join(__dirname, 'public/synthea/fhir');
    const files = fs.readdirSync(fhirDir);
    const targetFile = files.find(file => 
      file.includes(req.params.id) || file.replace('.json', '') === req.params.id
    );

    if (!targetFile) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const filePath = path.join(fhirDir, targetFile);
    const data = fs.readFileSync(filePath, 'utf-8');
    const patient = JSON.parse(data);

    res.json(patient);
  } catch (error) {
    console.error('Error reading patient:', error);
    res.status(500).json({ error: 'Failed to read patient' });
  }
});

// Get patient count
app.get('/api/patients-count', (req, res) => {
  try {
    const fhirDir = path.join(__dirname, 'public/synthea/fhir');
    const files = fs.readdirSync(fhirDir);
    const count = files.filter(file => file.endsWith('.json')).length;
    res.json({ count });
  } catch (error) {
    console.error('Error counting patients:', error);
    res.status(500).json({ error: 'Failed to count patients' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🏥 FHIR Patient Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   GET /api/patients - List all patients`);
  console.log(`   GET /api/patients/:id - Get specific patient`);
  console.log(`   GET /api/patients-count - Get total patient count`);
  console.log(`   GET /api/health - Health check`);
});
