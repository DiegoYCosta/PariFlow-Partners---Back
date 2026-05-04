module.exports = {
  apps: [
    {
      name: 'pariflow-back',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        APP_NAME: 'pariflow-back',
        HOST: '127.0.0.1',
        PORT: '3001',
        API_PREFIX: 'api/v1',
        TRUST_PROXY: 'true'
      }
    }
  ]
};
