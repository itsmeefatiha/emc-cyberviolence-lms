// @ts-check
import { execSync } from 'node:child_process'
import { backendDir, djangoPython } from '../../django-python.js'

/**
 * Create an already-active Django user with a unique email for this test.
 * @param {{
 *   role: 'APPRENANT' | 'FORMATEUR' | 'ADMIN',
 *   enrollSharedCourse?: boolean,
 *   withCourse?: boolean,
 *   withLearner?: boolean,
 * }} options
 */
export function provisionE2E(options) {
  const python = djangoPython()
  const flags = [`--role=${options.role}`]
  if (options.enrollSharedCourse) flags.push('--enroll-shared-course')
  if (options.withCourse) flags.push('--with-course')
  if (options.withLearner) flags.push('--with-learner')

  const output = execSync(`"${python}" manage.py provision_e2e ${flags.join(' ')}`, {
    cwd: backendDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      DJANGO_SETTINGS_MODULE: 'config.settings',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    },
  })

  const jsonLine = output
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.startsWith('{'))
    .pop()

  if (!jsonLine) {
    throw new Error(`provision_e2e did not print JSON.\n${output}`)
  }

  return JSON.parse(jsonLine)
}

/** Email that is guaranteed not to exist (negative auth cases). */
export function uniqueUnknownEmail() {
  return `e2e.unknown.${crypto.randomUUID()}@example.com`
}
