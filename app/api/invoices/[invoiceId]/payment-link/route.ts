import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

export async function POST(_request: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoiceId } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('create_payment_link_for_invoice', { target_invoice: invoiceId });
    if (error) throw error;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.json({ ok: true, token: data, paymentUrl: `${appUrl}/pay/${data}` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not create payment link' }, { status: 400 });
  }
}
