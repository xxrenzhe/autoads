const environment = process.env.NODE_ENV || 'development';
const baseUrl = environment === 'production' 
  ? 'https://autoads.dev' 
  : environment === 'preview' 
    ? 'https://urlchecker.dev' 
    : 'http://localhost:3000';

module.exports = {
  ci: {
    collect: {
      url: [
        baseUrl,
        `${baseUrl}/admin`,
        `${baseUrl}/pricing`,
        `${baseUrl}/admin/users`,
        `${baseUrl}/admin/analytics`
      ],
      startServerCommand: environment === 'development' ? 'npm run dev' : 'npm start',
      startServerReadyPattern: 'ready on',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'categories:pwa': 'off'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    },
    server: {
      port: 9001,
      storage: './lighthouse-results'
    }
  }
};