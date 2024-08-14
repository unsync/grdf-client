import * as fs from 'node:fs'
import { getLogger } from '@unsync/nodejs-tools'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { Browser, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import type { GrdfConfig } from './models/grdfConfig.js'
import type { GRDFDataPoint } from './models/GRDFDataPoint.js'

export class GRDFClient {
  public config: GrdfConfig
  private logger = getLogger({ service: 'EnergyClient' })

  constructor(config: GrdfConfig) {
    this.config = config
  }

  private parseData(_: { firstDay?: Dayjs, dataPoints: GRDFDataPoint[] }): GRDFDataPoint[] {
    try {
      return _.dataPoints.filter((r: GRDFDataPoint) => {
        return _.firstDay ? dayjs(r.journeeGaziere).isAfter(_.firstDay, 'day') : true
      }).map((r) => {
        return {
          dateDebutReleve: r.dateDebutReleve,
          dateFinReleve: r.dateFinReleve,
          journeeGaziere: r.journeeGaziere,
          indexDebut: r.indexDebut,
          indexFin: r.indexFin,
          volumeBrutConsomme: r.volumeBrutConsomme,
          energieConsomme: r.energieConsomme,
          pcs: r.pcs,
          volumeConverti: r.volumeConverti,
          pta: r.pta,
          natureReleve: r.natureReleve,
          qualificationReleve: r.qualificationReleve,
          status: r.status,
          coeffConversion: r.coeffConversion,
          frequenceReleve: r.frequenceReleve,
          temperature: r.temperature,
        }
      })
    } catch (e) {
      this.logger.error(`GRDFClient > parseData > error: ${JSON.stringify(e)}`, e)
      return []
    }
  }

  public async getEnergyData(firstDay?: Dayjs): Promise<GRDFDataPoint[]> {
    this.logger.info(`GRDFClient > fetch data from ${firstDay ? firstDay.toISOString() : 'history'}`)

    try {
      const cachedFile = await fs.promises.readFile(`./.data/grdf.json`, 'utf8')
      const cachedData = JSON.parse(cachedFile)[this.config.pdl].releves
      this.logger.info('GRDFClient > using cached data')
      return this.parseData({ firstDay, dataPoints: cachedData })
    } catch (e) {
      this.logger.info('GRDFClient > no cached data')
    }

    // Launch the browser and open a new blank page
    this.logger.info('GRDFClient > launch browser')

    // Attempt to open Chrome browser 5 times maximum.
    let browser: Browser | null = null
    let page: Page | null = null
    const browserStartAttempts = 5
    // https://github.com/puppeteer/puppeteer/issues/10144
    for (let i = 0; i < browserStartAttempts; i++) {
      try {
        this.logger.info(`GRDFClient > start browser > attempt ${i + 1}/${browserStartAttempts}`)
        browser = await puppeteer.default.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
          timeout: 10_000, // 10 seconds
          protocolTimeout: 20_000, // 20 seconds
        })
        await sleep(1000)
        this.logger.info('GRDFClient > start browser > started')

        this.logger.info('GRDFClient > start browser > open page')
        page = await browser.newPage()
        break
      } catch (err: any) {
        this.logger.error('GRDFClient > start browser > error', { message: err.message })
        if (browser?.connected) {
          this.logger.info('GRDFClient > start browser > closing browser')
          await browser.close()
        }
        await sleep(1000)
        browser = null
        page = null
        this.logger.info('GRDFClient > start browser > trying again')
      }
    }

    if (!browser || !page) {
      this.logger.error('GRDFClient > Could not start Chrome browser.')
      return []
    }

    this.logger.info('GRDFClient > request home page')

    // Navigate the page to a URL
    await page.goto(`https://monespace.grdf.fr/client/particulier/accueil`)

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 })

    const parsedHtml = ''
    const html = ''
    try {
      this.logger.info('GRDFClient > waiting for email page')
      await page.waitForSelector('input[name=\'identifier\']')

      await page.type('input[name=\'identifier\']', this.config.mail)
      await page.click('input[type=submit]')

      this.logger.info('GRDFClient > waiting for password page')
      await page.waitForSelector('input[type=\'password\']')
      await page.type('input[type=\'password\']', this.config.password)

      this.logger.info('GRDFClient > submit login')
      await page.click('input[type=submit]')

      this.logger.info('GRDFClient > wait for login')
      await page.waitForSelector('.conso-home')

      const cookies = await page.cookies()
      this.logger.info('GRDFClient > cookies', { cookies: cookies.map(c => `${c.name}=${c.value}`).join('; ') })

      const dateEnd = dayjs().format('YYYY-MM-DD')
      const dateStart = dayjs('2021-09-01').format('YYYY-MM-DD')
      const dataUrl = `https://monespace.grdf.fr/api/e-conso/pce/consommation/informatives?dateDebut=${dateStart}&dateFin=${dateEnd}&pceList[]=${this.config.pdl}`
      this.logger.info('GRDFClient > fetch data', { dataUrl })

      const res = await fetch(dataUrl, {
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'accept-language': 'fr-FR,fr;q=0.5',
          'sec-ch-ua': '"Not)A;Brand";v="99", "Brave";v="127", "Chromium";v="127"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'sec-gpc': '1',
          'upgrade-insecure-requests': '1',
          'cookie': cookies.map(c => `${c.name}=${c.value}`).join('; '),
        },
      })

      if (!res.ok) {
        const text = await res.text()
        this.logger.error('GRDFClient > fetch data failed', { status: res.status, statusText: res.statusText, text })
        await browser.close()
        return []
      }

      const data = await res.json()
      this.logger.info('GRDFClient > fetched data', { count: data[this.config.pdl].releves.length })

      await browser.close()
      return this.parseData({ firstDay, dataPoints: data[this.config.pdl].releves })
    } catch (e: any) {
      this.logger.error(`GRDFClient > error: ${JSON.stringify(e)}`, {
        message: e.message,
        stack: e.stack,
        parsedHtml,
        html,
      })
      await page.screenshot({ path: 'screenshot.png' })
      await browser.close()
      return []
    }
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
