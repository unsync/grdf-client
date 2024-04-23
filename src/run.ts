import console from 'node:console'
import process from 'node:process'
import dotenv from 'dotenv'
import { GRDFClient } from './grdf.js'

dotenv.config()

const client = new GRDFClient({
  'pdl': process.env.GRDF_PDL || '',
  'password': process.env.GRDF_PASSWORD || '',
  'mail': process.env.GRDF_EMAIL || '',
  '2captcha_key': process.env.CAPTCHA_KEY || '',
})

// all history
const allEnergyData = await client.getEnergyData(null)
console.info('allEnergyData', { allEnergyData })

// // all history from a date
// const partialEnergyData = await client.getEnergyData(dayjs('2024-01-01'))
// console.info('allEnergyData', { partialEnergyData })