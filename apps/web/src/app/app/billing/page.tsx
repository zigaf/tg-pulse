import { Suspense } from 'react';
import { BillingView } from '@/components/dashboard/billing/BillingView';

export const metadata = {
  title: 'Billing · TGPulse',
};

/** BillingView reads ?ws=, so it needs a Suspense boundary to stay statically renderable. */
export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingView />
    </Suspense>
  );
}
