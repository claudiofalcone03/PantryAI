"use client";

import type { MetricCategory, PerformanceData } from './performance-logger';

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
}

export const logClientPerformance = (category: MetricCategory, data: Omit<PerformanceData, 'timestamp'>) => {
  // Rimosso il blocco production per permettere i test sulle performance

  // Rilevamento delle condizioni di rete del client (supportato su Chrome)
  let networkInfo = '';
  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & { connection?: NetworkInformation };
    if (nav.connection) {
      const conn = nav.connection;
      const effectiveType = conn.effectiveType || 'unknown';
      const downlink = conn.downlink || 0;
      networkInfo = `Network: ${effectiveType} (${downlink}Mbps)`;
    }
  }

  if (networkInfo) {
    data.additionalInfo = data.additionalInfo 
      ? `${data.additionalInfo} | ${networkInfo}` 
      : networkInfo;
  }

  // Fire and forget
  fetch('/api/log-performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, data }),
    keepalive: true,
  }).catch(() => {});
};

export const withClientPerformanceTracking = async <T>(
  category: MetricCategory,
  name: string,
  fn: () => Promise<T>,
  getPayloadSize?: (result: T) => number
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - start;
    const size = getPayloadSize ? getPayloadSize(result) : undefined;
    
    logClientPerformance(category, {
      name,
      durationMs,
      status: 'success',
      payloadSize: size,
    });
    
    return result;
  } catch (error: unknown) {
    const durationMs = performance.now() - start;
    logClientPerformance(category, {
      name,
      durationMs,
      status: 'error',
      additionalInfo: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};
