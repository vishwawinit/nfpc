
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get('tableName');

  if (!tableName) {
    return NextResponse.json({ success: false, error: 'tableName parameter is required' }, { status: 400 });
  }

  try {
    const schema = await db.getTableSchema(tableName);
    if (schema.length === 0) {
      return NextResponse.json({ success: false, error: `Table "${tableName}" not found or has no columns.` }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: schema });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch table schema', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
