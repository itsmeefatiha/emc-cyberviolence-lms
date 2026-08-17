module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview --prefix ../frontend -- --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 60000,
      url: [
        'http://127.0.0.1:4173/login',
        'http://127.0.0.1:4173/register',
        'http://127.0.0.1:4173/forgot-password',
      ],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        onlyCategories: ['accessibility'],
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.7 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-report',
    },
  },
}
