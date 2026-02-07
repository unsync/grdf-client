import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'import/no-duplicates': 'off',
    'import/no-self-import': 'off',
    'import/order': 'off',
  },
})
