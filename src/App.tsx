import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [patient, setPatient] = useState<Record<string, unknown> | null>(null)
  const [loadingPatient, setLoadingPatient] = useState(false)
  const [patientError, setPatientError] = useState<string | null>(null)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button
          style={{ marginLeft: 12 }}
          onClick={async () => {
            setLoadingPatient(true)
            setPatientError(null)
            try {
              // tries to fetch a sample patient exported by Synthea
              const res = await fetch('/synthea/patient-0.json')
              if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
              const json = await res.json()
              setPatient(json)
            } catch (err: unknown) {
              setPatient(null)
              const message = err instanceof Error ? err.message : String(err)
              setPatientError(message || 'Failed to load patient')
            } finally {
              setLoadingPatient(false)
            }
          }}
        >
          {loadingPatient ? 'Loading…' : 'Load sample patient'}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      {patientError && <div style={{ color: 'crimson' }}>{patientError}</div>}
      {patient && (() => {
        const id = typeof patient['id'] === 'string' ? patient['id'] as string : undefined
        const name = (() => {
          const names = patient['name']
          if (!Array.isArray(names) || names.length === 0) return undefined
          const first = names[0]
          if (typeof first !== 'object' || first === null) return undefined
          const firstRec = first as Record<string, unknown>
          const given = firstRec['given']
          const givenStr = Array.isArray(given) ? given.filter(g => typeof g === 'string').join(' ') : ''
          const family = typeof firstRec['family'] === 'string' ? firstRec['family'] as string : ''
          const full = [givenStr, family].filter(Boolean).join(' ')
          return full || undefined
        })()
        const gender = typeof patient['gender'] === 'string' ? patient['gender'] as string : undefined
        const birthDate = typeof patient['birthDate'] === 'string' ? patient['birthDate'] as string : undefined

        return (
          <div style={{ textAlign: 'left', marginTop: 18 }}>
            <h2>Patient (from Synthea)</h2>
            <p>
              <strong>ID:</strong> {id ?? '—'}
            </p>
            <p>
              <strong>Name:</strong> {name ?? '—'}
            </p>
            <p>
              <strong>Gender:</strong> {gender ?? '—'}
            </p>
            <p>
              <strong>Birth date:</strong> {birthDate ?? '—'}
            </p>
          </div>
        )
      })()}
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
