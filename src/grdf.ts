import * as fs from 'node:fs'
import { getLogger } from '@unsync/nodejs-tools'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { convert } from 'html-to-text'
import puppeteer from 'puppeteer-extra'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { GrdfConfig } from './models/grdfConfig.js'
import type { GRDFDataPoint } from './models/GRDFDataPoint.js'

export class GRDFClient {
  public config: GrdfConfig
  private logger = getLogger({ service: 'EnergyClient' })

  constructor(config: GrdfConfig) {
    this.config = config
  }

  private parseData(firstDay: Dayjs | null, dataPoints: GRDFDataPoint[]): GRDFDataPoint[] {
    try {
      return dataPoints.filter((r: GRDFDataPoint) => {
        return firstDay ? dayjs(r.journeeGaziere).isAfter(firstDay, 'day') : true
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

  public async getEnergyData(firstDay: Dayjs | null): Promise<GRDFDataPoint[]> {
    this.logger.info(`GRDFClient > fetch data from ${firstDay ? firstDay.toISOString() : 'history'}`)

    try {
      const cachedFile = await fs.promises.readFile(`./.data/grdf.json`, 'utf8')
      const cachedData = JSON.parse(cachedFile)[this.config.pdl].releves
      this.logger.info('GRDFClient > using cached data')
      return this.parseData(firstDay, cachedData)
    } catch (e) {
      this.logger.info('GRDFClient > no cached data')
    }

    this.logger.info('GRDFClient > setup puppeteer')
    puppeteer.default.use(StealthPlugin())
    puppeteer.default.use(
      RecaptchaPlugin.default({
        provider: {
          id: '2captcha',
          token: this.config['2captcha_key'],
        },
        visualFeedback: true, // colorize reCAPTCHAs (violet = detected, green = solved)
      }),
    )

    // Launch the browser and open a new blank page
    const browser = await puppeteer.default.launch({ headless: 'new', args: ['--no-sandbox'] })
    const page = await browser.newPage()

    // Navigate the page to a URL
    await page.goto(`https://monespace.grdf.fr/client/particulier/accueil`)

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 })

    try {
      // Locate the full title with a unique string
      await page.waitForSelector('#mail')
      await page.waitForSelector('#pass')

      this.logger.info('GRDFClient > waiting for cookie banner')
      try {
        await page.waitForSelector('#btn_accept_banner', { timeout: 10_000 })
        await page.click('#btn_accept_banner')
      } catch (e) {
        this.logger.info('GRDFClient > no cookie banner')
      }

      this.logger.info('GRDFClient > solve captcha')
      await page.waitForSelector('iframe[src*="recaptcha/"]')
      const result = await page.solveRecaptchas()
      this.logger.info('GRDFClient > solve captcha finished', { solved: result.solved.length })

      await page.type('#mail', this.config.mail)
      await page.type('#pass', this.config.password)

      this.logger.info('GRDFClient > submit login')
      await page.click('input[type=submit]')

      this.logger.info('GRDFClient > wait for login')
      await page.waitForSelector('.conso-home')

      const dateEnd = dayjs().format('YYYY-MM-DD')
      const dateStart = dayjs('2021-08-02').format('YYYY-MM-DD')
      const dataUrl = `https://monespace.grdf.fr/api/e-conso/pce/consommation/informatives?dateDebut=${dateStart}&dateFin=${dateEnd}&pceList[]=${this.config.pdl}`
      this.logger.info('GRDFClient > fetch data', dataUrl)
      await page.goto(dataUrl)

      const html = await page.content()
      await browser.close()

      return this.parseData(firstDay, JSON.parse(convert(html))[this.config.pdl].releves)
    } catch (e) {
      this.logger.error(`GRDFClient > error: ${JSON.stringify(e)}`, e)
      await page.screenshot({ path: 'screenshot.png' })
      return []
    }
  }
}
