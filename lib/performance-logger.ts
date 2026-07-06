import fs from 'fs/promises';
import path from 'path';

export type MetricCategory = 'rendering-metrics' | 'api-latency' | 'db-latency' | 'openfoodfacts-latency';

export interface PerformanceData {
  name: string;
  durationMs: number;
  status: 'success' | 'error';
  timestamp?: string;
  payloadSize?: number;
  additionalInfo?: string;
}

const DATA_DIR = path.join(process.cwd(), 'performance-data');

export async function appendPerformanceData(category: MetricCategory, data: PerformanceData) {
  // Rimosso il blocco production per permettere i test sulle performance

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    const filePath = path.join(DATA_DIR, `${category}.csv`);
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    
    const ts = data.timestamp || new Date().toISOString();
    const size = data.payloadSize !== undefined ? data.payloadSize : '';
    const info = data.additionalInfo ? data.additionalInfo.replace(/,/g, ';') : '';
    const row = `${ts},${data.name},${data.durationMs.toFixed(2)},${data.status},${size},${info}\n`;
    
    if (!fileExists) {
      const header = `Timestamp,Name,Duration(ms),Status,PayloadSize,AdditionalInfo\n`;
      await fs.writeFile(filePath, header + row, 'utf-8');
    } else {
      await fs.appendFile(filePath, row, 'utf-8');
    }
  } catch (err) {
    console.error('Error writing performance data', err);
  }
}

// Wrapper to be used in Server Actions or Route Handlers
export async function withServerPerformanceTracking<T>(
  category: MetricCategory,
  name: string,
  fn: () => Promise<T>,
  getPayloadSize?: (result: T) => number
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    const size = getPayloadSize ? getPayloadSize(result) : undefined;
    
    await appendPerformanceData(category, {
      name,
      durationMs,
      status: 'success',
      payloadSize: size,
    });
    
    return result;
  } catch (error: any) {
    const durationMs = Date.now() - start;
    await appendPerformanceData(category, {
      name,
      durationMs,
      status: 'error',
      additionalInfo: error?.message || 'Unknown error'
    });
    throw error;
  }
}
