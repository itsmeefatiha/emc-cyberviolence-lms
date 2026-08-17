// @ts-check
import { execSync } from 'node:child_process'
import { backendDir, djangoPython } from './django-python.js'

/**
 * Seed deterministic users + published course before any spec runs.
 * Talks to Django/Postgres directly (does not need runserver).
 */
export default function globalSetup() {
  const python = djangoPython()

  execSync(`"${python}" manage.py seed_e2e`, {
    cwd: backendDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DJANGO_SETTINGS_MODULE: 'config.settings',
    },
  })
}
