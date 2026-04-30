/**
 * Babel config for the CriaLook Expo app.
 *
 * Why we have this file even though babel-preset-expo would otherwise be picked
 * up automatically: the production-only `transform-remove-console` plugin strips
 * `console.*` calls from release bundles. Without it, the *arguments* of every
 * console.log are still evaluated on Hermes (only the call itself is no-op),
 * which is wasted CPU on the JS thread for what should be dead code in prod.
 *
 * The plugin keeps `console.error` so legitimate errors still reach Sentry's
 * native breadcrumb capture.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      production: {
        plugins: [
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};
