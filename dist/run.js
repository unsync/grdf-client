import console from 'node:console';
import process from 'node:process';
import dotenv from 'dotenv';
import { GRDFClient } from './grdf.js';
dotenv.config();
const client = new GRDFClient({
    pdl: process.env.GRDF_PDL || '',
    password: process.env.GRDF_PASSWORD || '',
    mail: process.env.GRDF_EMAIL || '',
});
// all history
const allEnergyData = await client.getEnergyData(undefined);
console.info('allEnergyData', { allEnergyData });
// // all history from a date
// const partialEnergyData = await client.getEnergyData(dayjs('2024-01-01'))
// console.info('allEnergyData', { partialEnergyData })
