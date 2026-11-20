// Starts the mock API and the Vite dev server together: `npm run dev:mock [-- --clear]`.
// The mock listens on MOCK_PORT (default 8010) so it never collides with a real backend on 8000.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const port = process.env.MOCK_PORT || '8010'
const extra = process.argv.slice(2)

const mock = spawn(process.execPath, [path.join(here, 'mock-api.mjs'), ...extra], {
  stdio: 'inherit', env: { ...process.env, PORT: port },
})
const vite = spawn(process.execPath, [path.join(here, '..', 'node_modules', 'vite', 'bin', 'vite.js')], {
  stdio: 'inherit', env: { ...process.env, VITE_API_TARGET: `http://localhost:${port}` },
})

const stop = code => { mock.kill(); vite.kill(); process.exit(code ?? 0) }
mock.on('exit', code => stop(code))
vite.on('exit', code => stop(code))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
