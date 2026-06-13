import { getSupabaseAdmin } from '@/src/lib/supabase/admin';

export async function createOrGetPaymentLink(invoiceId: string) {
  const db = getSupabaseAdmin();

  const { data: existing } = await db
    .from('payment_links')
    .select('id, public_token, status')
    .eq('invoice_id', invoiceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.public_token) return existing;

  const { data: token, error } = await db.rpc('create_payment_link_for_invoice', { target_invoice: invoiceId });
  if (error) throw new Error(error.message);

  const { data: created, error: createdError } = await db
    .from('payment_links')
    .select('id, public_token, status')
    .eq('public_token', token)
    .single();

  if (createdError || !created) throw new Error('Payment link missing after creation');
  return created;
}
