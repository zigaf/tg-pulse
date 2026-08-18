/**
 * Typed fetch client for the TGPulse dashboard API.
 * Contract: docs/PHASE1-BUILD.md — every endpoint answers { ok: true, data } | { ok: false, error }.
 * The failure branch carries the HTTP status so the UI can distinguish 401 (show login).
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export interface ApiUser {
  id: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
}

export interface ApiChannel {
  id: string;
  title: string;
  username: string | null;
  botStatus: string;
  subscriberCount: number;
}

export interface ApiWorkspace {
  id: string;
  name: string;
  plan: string;
  channels: ApiChannel[];
}

export interface MeData {
  user: ApiUser;
  workspaces: ApiWorkspace[];
}

export interface OverviewTotals {
  joins: number;
  leaves: number;
  net: number;
  /** Percent value, e.g. 3.2 means 3.2% */
  unsubRate: number;
}

export interface OverviewPoint {
  date: string;
  joins: number;
  leaves: number;
}

export interface OverviewSource {
  /** null = organic (non-attributed) traffic */
  linkId: string | null;
  label: string;
  creative: string | null;
  clicks: number;
  joins: number;
  leaves: number;
  unsubRate: number;
}

export interface OverviewData {
  channel: ApiChannel;
  totals: OverviewTotals;
  series: OverviewPoint[];
  sources: OverviewSource[];
}

export interface TrackedLink {
  id: string;
  slug: string;
  url: string;
  label: string;
  creative: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  inviteLink: string;
  isRevoked: boolean;
  clicks: number;
  joins: number;
  leaves: number;
  createdAt: string;
}

export interface CreateLinkInput {
  label: string;
  creative?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface SubscriberRow {
  tgUserId: string;
  username: string | null;
  firstName: string | null;
  isPremium: boolean;
  joinedAt: string;
  leftAt: string | null;
  source: { label: string } | null;
}

export interface SubscribersPage {
  items: SubscriberRow[];
  nextCursor: string | null;
}

/** Fields posted by the Telegram Login Widget. */
export interface TelegramAuthPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was rejected. Check the form and try again.',
  401: 'You are not signed in.',
  403: 'You do not have access to this channel.',
  404: 'Not found.',
  500: 'Something went wrong on our side. Try again in a minute.',
};

function messageForStatus(status: number): string {
  return STATUS_MESSAGES[status] ?? `Request failed (HTTP ${status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    return { ok: false, error: 'Network error. Check your connection and retry.' };
  }

  const body = (await response.json().catch(() => null)) as ApiResult<T> | null;

  if (body && typeof body === 'object' && 'ok' in body) {
    if (body.ok) return { ok: true, data: body.data };
    return { ok: false, error: body.error || messageForStatus(response.status), status: response.status };
  }
  return { ok: false, error: messageForStatus(response.status), status: response.status };
}

function post<T>(path: string, payload?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

export function getMe(): Promise<ApiResult<MeData>> {
  return request<MeData>('/api/me');
}

export function getOverview(channelId: string, days: 7 | 30): Promise<ApiResult<OverviewData>> {
  return request<OverviewData>(`/api/channels/${channelId}/overview?days=${days}`);
}

export function getLinks(channelId: string): Promise<ApiResult<TrackedLink[]>> {
  return request<TrackedLink[]>(`/api/channels/${channelId}/links`);
}

export function createLink(channelId: string, input: CreateLinkInput): Promise<ApiResult<TrackedLink>> {
  return post<TrackedLink>(`/api/channels/${channelId}/links`, input);
}

export function revokeLink(id: string): Promise<ApiResult<TrackedLink>> {
  return post<TrackedLink>(`/api/links/${id}/revoke`);
}

export function getSubscribers(
  channelId: string,
  options: { cursor?: string | null; q?: string } = {},
): Promise<ApiResult<SubscribersPage>> {
  const search = new URLSearchParams();
  if (options.cursor) search.set('cursor', options.cursor);
  if (options.q) search.set('q', options.q);
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return request<SubscribersPage>(`/api/channels/${channelId}/subscribers${suffix}`);
}

export function authTelegram(payload: TelegramAuthPayload): Promise<ApiResult<{ user: ApiUser }>> {
  return post<{ user: ApiUser }>('/api/auth/telegram', payload);
}

export function logout(): Promise<ApiResult<null>> {
  return post<null>('/api/auth/logout');
}
