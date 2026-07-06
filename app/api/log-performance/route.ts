import { NextResponse } from 'next/server';
import { appendPerformanceData, MetricCategory, PerformanceData } from '@/lib/performance-logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, data } = body as { category: MetricCategory; data: PerformanceData };
    
    if (!category || !data) {
      return NextResponse.json({ error: 'Missing category or data' }, { status: 400 });
    }
    
    await appendPerformanceData(category, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to log performance' }, { status: 500 });
  }
}
