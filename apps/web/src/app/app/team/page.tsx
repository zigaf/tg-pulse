import { Suspense } from 'react';
import { TeamView } from '@/components/dashboard/team/TeamView';

export const metadata = {
  title: 'Team · TGPulse',
};

/** TeamView reads ?ws=, so it needs a Suspense boundary to stay statically renderable. */
export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <TeamView />
    </Suspense>
  );
}
