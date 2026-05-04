/**
 * Config Jest pro lado React Native + Expo da suite.
 *
 * Mantemos Vitest em paralelo pra teste de pure logic em `lib/__tests__` e
 * `hooks/__tests__` (esses rodam em jsdom e pulam o renderer RN inteiro —
 * rápido e isolado). Jest existe pra teste de componente / tela que precisa
 * do renderer RN real + mock Reanimated + mocks de módulo Expo.
 *
 * Rodar: `npm run test:rn`.
 *
 * `transformIgnorePatterns` cobre módulos que shipam como ES cru e o preset
 * `react-native/jest-preset` não transforma por default. Atualiza quando
 * adicionar dep ESM-only que toca arquivo de teste.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-clone-referenced-element|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@shopify/.*|react-native-css|nativewind|react-native-reanimated|react-native-gesture-handler|@gorhom/.*|@clerk/.*))',
  ],
};
