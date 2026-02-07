import * as fs from 'node:fs';
import { OktaAuth } from '@okta/okta-auth-js';
import dayjs from 'dayjs';
import makeFetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
export class GRDFClient {
    config;
    logger = {
        info: (...args) => console.warn('[GRDFClient]', ...args),
        error: (...args) => console.error('[GRDFClient]', ...args),
    };
    constructor(config) {
        this.config = config;
    }
    async login(email, password) {
        const authClient = new OktaAuth({
            issuer: 'https://connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417',
            clientId: '0oa95ese18blzdg3p417',
            redirectUri: 'https://monespace.grdf.fr/_codexch',
            scopes: ['openid', 'profile', 'email'],
        });
        const transaction = await authClient.signIn({
            username: email,
            password,
        });
        // Create the redirect URL
        const redirectUrl = `${authClient.getIssuerOrigin()}/login/sessionCookieRedirect?${new URLSearchParams({
            checkAccountSetupComplete: 'true',
            token: transaction.sessionToken || '',
            redirectUrl: 'https://monespace.grdf.fr',
        }).toString()}`;
        // Create a cookie jar to store cookies between requests
        const jar = new CookieJar();
        const fetchWithCookies = makeFetchCookie(fetch, jar);
        // First request to handle the authentication redirect
        await fetchWithCookies(redirectUrl);
        // Now make a request to the target site to get all cookies
        await fetchWithCookies('https://monespace.grdf.fr');
        // Get all cookies for the domain
        const cookies = await jar.getCookies('https://monespace.grdf.fr');
        // Find the auth_token cookie
        const authCookie = cookies.find(cookie => cookie.key === 'auth_token');
        if (!authCookie)
            throw new Error('Impossible de récupérer le cookie d\'authentification.');
        return authCookie.value;
    }
    parseData(_) {
        try {
            return _.dataPoints.filter((r) => {
                return _.firstDay ? dayjs(r.journeeGaziere).isAfter(_.firstDay, 'day') : true;
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
                };
            });
        }
        catch (e) {
            this.logger.error(`GRDFClient > parseData > error: ${JSON.stringify(e)}`, e);
            return [];
        }
    }
    async getEnergyData(firstDay) {
        this.logger.info(`GRDFClient > fetch data from ${firstDay ? firstDay.toISOString() : 'history'}`);
        try {
            const cachedFile = await fs.promises.readFile(`./.data/grdf.json`, 'utf8');
            const cachedData = JSON.parse(cachedFile)[this.config.pdl].releves;
            this.logger.info('GRDFClient > using cached data');
            return this.parseData({ firstDay, dataPoints: cachedData });
        }
        catch {
            this.logger.info('GRDFClient > no cached data');
        }
        const dateDebut = firstDay ? firstDay.format('YYYY-MM-DD') : dayjs().subtract(1, 'month').format('YYYY-MM-DD');
        const dateFin = dayjs().format('YYYY-MM-DD');
        try {
            const token = await this.login(this.config.mail, this.config.password);
            this.logger.info('GRDFClient > fetching data', { dateDebut, dateFin });
            const response = await fetch(`https://monespace.grdf.fr/api/e-conso/pce/consommation/informatives?dateDebut=${dateDebut}&dateFin=${dateFin}&pceList[]=${this.config.pdl}`, {
                method: 'GET',
                headers: {
                    Cookie: `auth_token=${token}`,
                },
            });
            if (!response.ok)
                throw new Error('Failed to fetch data from GRDF API');
            const data = await response.json();
            if (!data[this.config.pdl])
                throw new Error('No data found for the given PDL');
            this.logger.info('GRDFClient > fetched data', { count: data[this.config.pdl].releves.length });
            return this.parseData({ firstDay, dataPoints: data[this.config.pdl].releves });
        }
        catch (e) {
            this.logger.error(`GRDFClient > error: ${JSON.stringify(e)}`, {
                message: e.message,
                stack: e.stack,
            });
            return [];
        }
    }
}
