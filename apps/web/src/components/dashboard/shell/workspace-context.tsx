'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ApiWorkspace } from '@/lib/api';
import { isFeatureLocked, type GatedFeature } from '@/lib/billing';

/**
 * The shell already resolves the workspace of the open channel through /api/me,
 * so sections read plan entitlements from context instead of firing their own request.
 * This is a rendering hint only: the API stays the authority and answers 402 on a gate hit.
 */
const WorkspaceContext = createContext<ApiWorkspace | null>(null);

export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: ApiWorkspace | null;
  children: ReactNode;
}) {
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

/** Workspace owning the open channel; null until /api/me resolves. */
export function useWorkspace(): ApiWorkspace | null {
  return useContext(WorkspaceContext);
}

/** False while entitlements are unknown, so nothing flashes as locked during load. */
export function useFeatureLocked(feature: GatedFeature): boolean {
  return isFeatureLocked(useWorkspace()?.entitlements, feature);
}
