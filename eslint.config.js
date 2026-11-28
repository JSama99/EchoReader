// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Deno edge function entry points are checked by the Supabase CLI, not this toolchain.
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'supabase/functions/*/index.ts'],
  },
]);
