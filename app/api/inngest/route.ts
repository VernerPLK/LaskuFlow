import { serve } from 'inngest/next';
import { inngest } from '@/src/lib/inngest/client';
import { functions } from '@/src/lib/inngest/functions';

export const { GET, POST, PUT } = serve({ client: inngest, functions });
