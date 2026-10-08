import fs from 'fs/promises';
import path from 'path';

export const ALLOWED_METRIC_CATEGORIES = [
  'rendering-metrics',
  'api-latency',
  'db-latency',
  'openfoodfacts-latency',
] as const;

export type MetricCategory = typeof ALLOWED_METRIC_CATEGORIES[number];

export function isMetricCategory(val: unknown): val is MetricCategory {
  return typeof val === 'string' && (ALLOWED_METRIC_CATEGORIES as readonly string[]).includes(val);
}

export interface PerformanceData {
  name: string;
  durationMs: number;
  status: 'success' | 'error';
  timestamp?: string;
  payloadSize?: number;
  additionalInfo?: string;
}

const DATA_DIR = path.join(process.cwd(), 'performance-data');

// Sanitizzazione contro CSV Injection e Directory Traversal
function sanitizeCsvValue(val: unknown): string {
  if (val === undefined || val === null) return '';
  let str = String(val).replace(/[\r\n]+/g, ' ').trim();
  // Difesa contro CSV Formula Injection (=, +, -, @, tab)
  if (/^[=+\-@\t]/.test(str)) {
    str = `'${str}`;
  }
  return str.replace(/,/g, ';');
}

export function isServerPerformanceLoggingEnabled(): boolean {
  const envVal = process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_LOGS || process.env.ENABLE_PERFORMANCE_LOGS;
  if (!envVal) return false;
  const lower = envVal.trim().toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'on';
}

export async function appendPerformanceData(category: MetricCategory, data: PerformanceData) {
  // Se disabilitato via variabile d'ambiente, esce immediatamente con zero overhead I/O
  if (!isServerPerformanceLoggingEnabled()) {
    return;
  }

  // Validazione rigorosa whitelist contro Path Traversal
  if (!isMetricCategory(category)) {
    console.warn(`[Security Warning] Invalid metric category rejected: ${String(category)}`);
    return;
  }

  // Se siamo in ambiente serverless di Vercel (read-only filesystem), logga in console e non su disco
  if (process.env.VERCEL) {
    console.info(`[Perf Metric] [${category}] ${data.name}: ${data.durationMs}ms (${data.status})`);
    return;
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Nome file rigorosamente isolato nella directory consentita
    const safeCategory = path.basename(`${category}.csv`);
    const filePath = path.join(DATA_DIR, safeCategory);

    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

    const ts = data.timestamp || new Date().toISOString();
    const cleanName = sanitizeCsvValue(data.name);
    const cleanDuration = Number.isFinite(data.durationMs) ? data.durationMs.toFixed(2) : '0.00';
    const cleanStatus = data.status === 'error' ? 'error' : 'success';
    const cleanSize = data.payloadSize !== undefined && Number.isFinite(data.payloadSize) ? data.payloadSize : '';
    const cleanInfo = sanitizeCsvValue(data.additionalInfo);

    const row = `${ts},${cleanName},${cleanDuration},${cleanStatus},${cleanSize},${cleanInfo}\n`;

    if (!fileExists) {
      const header = `Timestamp,Name,Duration(ms),Status,PayloadSize,AdditionalInfo\n`;
      await fs.writeFile(filePath, header + row, 'utf-8');
    } else {
      await fs.appendFile(filePath, row, 'utf-8');
    }
  } catch (err) {
    // Non propagare errori su filesystem in produzione
    console.error('Error writing performance data:', err);
  }
}

// Wrapper to be used in Server Actions or Route Handlers
export async function withServerPerformanceTracking<T>(
  category: MetricCategory,
  name: string,
  fn: () => Promise<T>,
  getPayloadSize?: (result: T) => number
): Promise<T> {
  if (!isServerPerformanceLoggingEnabled()) {
    return fn();
  }

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
  } catch (error: unknown) {
    const durationMs = Date.now() - start;
    await appendPerformanceData(category, {
      name,
      durationMs,
      status: 'error',
      additionalInfo: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
