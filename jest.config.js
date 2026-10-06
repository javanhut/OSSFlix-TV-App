module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-video))",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "App.tsx",
    "!src/types/**",
    "!**/*.d.ts",
    "!src/components/SidebarOverlay.tsx",
  ],
  coverageReporters: ["text-summary", "text", "lcov", "html"],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 78,
      lines: 80,
    },
  },
};
