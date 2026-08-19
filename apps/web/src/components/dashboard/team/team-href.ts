export const TEAM_HREF = '/app/team';

/** Team of a specific workspace; without an id the page falls back to the first one. */
export function teamHref(workspaceId?: string): string {
  return workspaceId ? `${TEAM_HREF}?ws=${encodeURIComponent(workspaceId)}` : TEAM_HREF;
}
