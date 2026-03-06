# fhirPlace

A React + TypeScript + Vite application for browsing and analysing synthetic FHIR R4 patient records. Designed for hospital IT evaluation, clinical workflow demos, and SMART on FHIR integration testing.

---

## Documentation

Full integration and deployment documentation lives in the [`docs/`](./docs/README.md) folder.

| Document | Description |
|----------|-------------|
| [Architecture](./docs/architecture.md) | System diagram, data flow, SMART auth sequence, security controls |
| [API Reference](./docs/api-reference.md) | All HTTP endpoints, query params, FHIR resource types, required scopes |
| [Environment Variables](./docs/environment-variables.md) | Every `VITE_*` variable with type, default, and production requirements |
| [Network Requirements](./docs/network-requirements.md) | Ports, domains to allowlist, CSP and CORS settings |
| [Sandbox Setup](./docs/sandbox-setup.md) | Local, SMART Health IT sandbox, and Docker testing guide |
| [Troubleshooting](./docs/troubleshooting.md) | FAQ for common installation, auth, and deployment issues |

---

## Quick start

```sh
npm install
npm run dev:all   # starts Vite (5173) + Express API (5001) concurrently
```

Open `http://localhost:5173`.

---

## Synthea setup

This project uses [Synthea](https://github.com/synthetichealth/synthea) to generate
synthetic FHIR patient data. The binary is not checked into source control, but you
can download and run it with the helper scripts below.

### Prerequisites

* Java 11 or newer (JDK required – the JRE alone is insufficient).

### Installing Synthea

```sh
npm run synthea:setup
```

This will create a `synthea/` directory in the repository and fetch the
`synthea-with-dependencies.jar` binary from the official release.

### Running Synthea

Once the jar is downloaded, use the `synthea:run` npm script or invoke `java`
manually:

```sh
npm run synthea:run -- -p 1000     # generate 1000 patients with default settings
# or
java -jar synthea/synthea-with-dependencies.jar --help
```

Generated files will appear in the current directory by default; you can add
`-o public/synthea/fhir` or similar to align with this project’s structure.

### Notes

- The scripts are cross-platform (Node-based). On Windows, PowerShell will
  execute the setup script via `node`.
- After you generate FHIR files, run `npm run synthea:manifest` to refresh the
  manifest used by the front end.

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server only (port 5173) |
| `npm run server` | Start Express API server only (port 5001) |
| `npm run dev:all` | Start both servers concurrently |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run test:run` | Run all tests once |
| `npm run test` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint across `src/` |
| `npm run synthea:setup` | Download the Synthea jar |
| `npm run synthea:run` | Generate synthetic patient data |
| `npm run synthea:manifest` | Rebuild `public/synthea/manifest.json` |

---

## Contributing & ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
