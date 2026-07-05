"use client";

import type { MetricCategory, PerformanceData } from './performance-logger';

export const logClientPerformance = (category: MetricCategory, data: Omit<PerformanceData, 'timestamp'>) => {
  if (process.env.NODE_ENV === 'production') return;
  
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
  } catch (error: any) {
    const durationMs = performance.now() - start;
    logClientPerformance(category, {
      name,
      durationMs,
      status: 'error',
      additionalInfo: error?.message || 'Unknown error'
    });
    throw error;
  }
};
