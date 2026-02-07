import type { Dayjs } from 'dayjs';
import type { GrdfConfig } from './models/grdfConfig.js';
import type { GRDFDataPoint } from './models/GRDFDataPoint.js';
export declare class GRDFClient {
    config: GrdfConfig;
    private logger;
    constructor(config: GrdfConfig);
    private parseData;
    getEnergyData(firstDay?: Dayjs): Promise<GRDFDataPoint[]>;
}
