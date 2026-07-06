'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { logClientPerformance } from '@/lib/performance-logger.client';
import { usePathname } from 'next/navigation';

export function WebVitalTracker() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    logClientPerformance('rendering-metrics', {
      name: metric.name,
      durationMs: metric.value,
      status: 'success',
      additionalInfo: `Page: ${pathname || window.location.pathname} | Rating: ${metric.rating} | ID: ${metric.id}`
    });
  });

  return null;
}
