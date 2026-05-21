process.on('uncaughtException', (err) => {
  require('fs').appendFileSync('/tmp/evo-error.log', new Date() + '\n' + err.stack + '\n\n');
});
process.on('unhandledRejection', (reason) => {
  require('fs').appendFileSync('/tmp/evo-error.log', new Date() + '\n' + String(reason) + '\n\n');
});

const dbPass = encodeURIComponent('121000aA@#');
process.env.DATABASE_CONNECTION_URI = `mysql://u229800555_admin_aviva:${dbPass}@127.0.0.1:3306/u229800555_evolution`;
process.env.DATABASE_ENABLED = 'true';
process.env.DATABASE_PROVIDER = 'mysql';
process.env.AUTHENTICATION_API_KEY = 'InspireAds2026EvolutionKey';

require('./dist/main.js');
