module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        node: true
      }
    },
    rules: {
      'no-unreachable': 'error',
      'no-else-return': 'warn',
      'no-useless-return': 'warn'
    }
  }
];
