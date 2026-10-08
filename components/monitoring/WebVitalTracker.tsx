'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { logClientPerformance, isPerformanceLoggingEnabled } from '@/lib/performance-logger.client';
import { usePathname } from 'next/navigation';

export function WebVitalTracker() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    if (!isPerformanceLoggingEnabled()) return;

    logClientPerformance('rendering-metrics', {
      name: metric.name,
      durationMs: metric.value,
      status: 'success',
      additionalInfo: `Page: ${pathname || (typeof window !== 'undefined' ? window.location.pathname : '')} | Rating: ${metric.rating} | ID: ${metric.id}`
    });
  });

  return null;
}
