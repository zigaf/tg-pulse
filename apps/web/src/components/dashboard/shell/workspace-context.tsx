'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ApiWorkspace, WorkspaceRole } from '@/lib/api';
import { isFeatureLocked, type GatedFeature } from '@/lib/billing';

/**
 * The shell already resolves the workspace of the open channel through /api/me,
 * so sections read plan entitlements from context instead of firing their own request.
 * This is a rendering hint only: the API stays the authority and answers 402 on a gate hit.
 */
interface WorkspaceContextValue {
  workspace: ApiWorkspace | null;
  /** Role of the signed-in user. null while unknown, so nothing flashes as read-only. */
  role: WorkspaceRole | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({ workspace: null, role: null });

export function WorkspaceProvider({
  workspace,
  role = null,
  children,
}: {
  workspace: ApiWorkspace | null;
  role?: WorkspaceRole | null;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ workspace, role }), [workspace, role]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** Workspace owning the open channel; null until /api/me resolves. */
export function useWorkspace(): ApiWorkspace | null {
  return useContext(WorkspaceContext).workspace;
}

/** Role of the signed-in user in that workspace; null while unknown. */
export function useWorkspaceRole(): WorkspaceRole | null {
  return useContext(WorkspaceContext).role;
}

/**
 * True only once the role is known to be VIEWER. Unknown roles keep the full UI:
 * the server enforces the rule with 403, the UI only avoids showing dead buttons.
 */
export function useIsViewer(): boolean {
  return useContext(WorkspaceContext).role === 'VIEWER';
}

/** False while entitlements are unknown, so nothing flashes as locked during load. */
export function useFeatureLocked(feature: GatedFeature): boolean {
  return isFeatureLocked(useWorkspace()?.entitlements, feature);
}
