/**
 * Guard for seed scripts that delete data.
 *
 * Refuses to run unless --yes is passed, and refuses against a non-local
 * database (e.g. production Atlas) unless --allow-remote is passed too.
 */
function confirmDestructive(action, mongoUri) {
  const args = process.argv.slice(2);
  const uri = String(mongoUri || '');
  const isLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(uri);
  const dbHost = uri.replace(/^mongodb(\+srv)?:\/\/([^@]*@)?/, '').split(/[/?]/)[0] || '(unknown)';

  if (!args.includes('--yes')) {
    console.error(`\nThis script will ${action} on ${dbHost}.`);
    console.error('Re-run with --yes to confirm.\n');
    process.exit(1);
  }
  if (!isLocal && !args.includes('--allow-remote')) {
    console.error(`\nRefusing to ${action} on a non-local database (${dbHost}).`);
    console.error('If you really mean it, re-run with --yes --allow-remote.\n');
    process.exit(1);
  }
}

module.exports = { confirmDestructive };
