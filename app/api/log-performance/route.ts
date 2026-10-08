import { NextResponse } from 'next/server';
import { appendPerformanceData, isMetricCategory, isServerPerformanceLoggingEnabled, PerformanceData } from '@/lib/performance-logger';

export async function POST(request: Request) {
  // Se disattivato da variabile d'ambiente, rispondi subito senza fare parsing o I/O
  if (!isServerPerformanceLoggingEnabled()) {
    return NextResponse.json({ success: true, disabled: true });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { category, data } = body as { category?: unknown; data?: unknown };

    // Validazione runtime rigorosa contro Path Traversal ed input arbitrari
    if (!category || !isMetricCategory(category)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported metric category' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Missing performance data object' }, { status: 400 });
    }

    const perfData = data as Partial<PerformanceData>;
    if (
      typeof perfData.name !== 'string' ||
      typeof perfData.durationMs !== 'number' ||
      !Number.isFinite(perfData.durationMs) ||
      perfData.durationMs < 0 ||
      (perfData.status !== 'success' && perfData.status !== 'error')
    ) {
      return NextResponse.json({ error: 'Malformed performance data attributes' }, { status: 400 });
    }

    await appendPerformanceData(category, {
      name: perfData.name.slice(0, 100), // Limitazione lunghezza stringa
      durationMs: perfData.durationMs,
      status: perfData.status,
      timestamp: typeof perfData.timestamp === 'string' ? perfData.timestamp.slice(0, 50) : undefined,
      payloadSize: typeof perfData.payloadSize === 'number' && Number.isFinite(perfData.payloadSize) ? perfData.payloadSize : undefined,
      additionalInfo: typeof perfData.additionalInfo === 'string' ? perfData.additionalInfo.slice(0, 500) : undefined,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
