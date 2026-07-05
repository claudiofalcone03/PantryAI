'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { logClientPerformance } from '@/lib/performance-logger.client';

export function WebVitalTracker() {
  useReportWebVitals((metric) => {
    logClientPerformance('rendering-metrics', {
      name: metric.name,
      durationMs: metric.value,
      status: 'success',
      additionalInfo: `Rating: ${metric.rating} | ID: ${metric.id}`
    });
  });

  return null;
}
