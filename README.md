# grdf-client

This project provides a client for interacting with GRDF (Gaz Réseau Distribution France) data. It allows users to fetch energy consumption data from GRDF's system.

### Core Functionality

The `GrdfClient` class is the main interface for interacting with GRDF. It provides methods to authenticate and retrieve energy data.

### Authentication

The client requires the following credentials:
- `pdl`: Your PDL (Point de Livraison) number
- `password`: Your GRDF account password
- `mail`: Your email address associated with the GRDF account
- `2captcha_key`: An API key from [2captcha.com](https://2captcha.com) for solving CAPTCHAs

### Data Retrieval

The `getEnergyData` method allows you to fetch energy consumption data. You can retrieve:
- All historical data by passing `null`
- Data from a specific date onwards by passing a date object

### Deployment

This project uses GitHub Actions for continuous integration and deployment. The workflow is defined in the `.github/workflows` directory.

### usage

> the `2captcha_key` is an api key from [https://2captcha.com](2captcha.com) that is the default provider to solve captcha.

```ts
const client = new GrdfClient({
  'pdl': 'string',
  'password': 'string',
  'mail': 'string',
  '2captcha_key': 'string'
})

// all history
const allEnergyData = await client.getEnergyData(null)

// all history from a date
const partialEnergyData = await client.getEnergyData(dayjs('2024-01-01'))
```

#### NPM Scripts

The `package.json` file includes several scripts for development and deployment:

- `npm run build`: Compiles the TypeScript code
- `npm run test`: Runs the test suite
- `npm run lint`: Lints the code using ESLint
- `npm run format`: Formats the code using Prettier
- `npm run release`: Bumps the version and creates a new release

#### GitHub Actions

The GitHub workflow automates the following processes:

1. Runs tests on pull requests and pushes to the main branch
2. Builds and publishes the package to npm when a new release is created

To create a new release:

1. Update the code and commit changes
2. Run `npm run release` locally, which will:
   - Bump the version in `package.json`
   - Create a new git tag
   - Push changes and the new tag to GitHub
3. The GitHub Action will then automatically build and publish the new version to npm

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.



