// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const e2eDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(e2eDir, '..', 'backend')

/**
 * Python that has Django installed (backend/venv, or PYTHON env override).
 * @param {string} [cwd]
 */
export function djangoPython(cwd = backendDir) {
  if (process.env.PYTHON) return process.env.PYTHON

  const isWin = process.platform === 'win32'
  const venvPython = path.join(cwd, 'venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')
  if (fs.existsSync(venvPython)) return venvPython

  return isWin ? 'python' : 'python3'
}

export { backendDir }
