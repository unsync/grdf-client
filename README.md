# grdf-client

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
