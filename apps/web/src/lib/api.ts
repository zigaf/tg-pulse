/**
 * Typed fetch client for the TGPulse dashboard API.
 * Contract: docs/PHASE1-BUILD.md — every endpoint answers { ok: true, data } | { ok: false, error }.
 * The failure branch carries the HTTP status so the UI can distinguish 401 (show login)
 * and 402 (plan gate, see docs/BILLING.md).
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; upgrade?: boolean };

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

/* ---------- billing (docs/BILLING.md) ---------- */

export type Plan = 'FREE' | 'PRO' | 'AGENCY';

/** Quota numbers. `null` means unlimited; the server may also send a negative value. */
export interface PlanLimits {
  channels: number | null;
  linksPerChannel: number | null;
  members: number | null;
}

/** Feature switches. Unknown keys are tolerated so a new server flag does not break the build. */
export interface PlanFeatures {
  postbacks: boolean;
  revenue: boolean;
  fraudFull: boolean;
  [feature: string]: boolean | undefined;
}

/** What a workspace is allowed to do on its current plan. Served inline by GET /api/me. */
export interface Entitlements {
  limits: PlanLimits;
  features: PlanFeatures;
}

export interface BillingUsage {
  channels: number;
  members: number;
  /** Active tracked links per channel id; revoked links free their slot. */
  linksByChannel: Record<string, number>;
}

export interface BillingSubscription {
  /** ACTIVE | CANCELED | EXPIRED (Prisma SubscriptionStatus). CANCELED stays valid until the period end. */
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentRecord {
  id: string;
  plan: Plan;
  /** Telegram Stars are integers; the currency field says which unit this is. */
  amount: number;
  /** "XTR" for Telegram Stars. */
  currency: string;
  createdAt: string;
}

export interface BillingData {
  plan: Plan;
  limits: PlanLimits;
  features: PlanFeatures;
  usage: BillingUsage;
  /** null while the workspace has never paid (Free plan). */
  subscription: BillingSubscription | null;
  payments: PaymentRecord[];
}

export interface ApiWorkspace {
  id: string;
  name: string;
  plan: Plan;
  /** Absent on older server builds; treat "missing" as "no gate known yet". */
  entitlements?: Entitlements;
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
  /** Pixel pageviews on landings tagged with this link's slug (all time). */
  pixelViews: number;
  /** Pixel outbound clicks (visitor clicked the go-link on the landing). */
  pixelClicks: number;
  createdAt: string;
}

export interface CreateLinkInput {
  label: string;
  creative?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface ApiPostback {
  id: string;
  channelId: string;
  name: string;
  urlTemplate: string;
  onJoin: boolean;
  onLeave: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePostbackInput {
  name: string;
  urlTemplate: string;
  onJoin: boolean;
  onLeave: boolean;
}

export interface UpdatePostbackInput {
  name?: string;
  urlTemplate?: string;
  onJoin?: boolean;
  onLeave?: boolean;
  isActive?: boolean;
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

/* ---------- revenue ---------- */

export type RevenueDays = 7 | 30 | 90;

export interface RevenueTotals {
  revenue: number;
  purchases: number;
  leads: number;
  refunds: number;
  /** Dominant currency of the period; rows in other currencies are excluded. */
  currency: string;
  /** Revenue per distinct paying buyer. */
  arpu: number;
  /** Percent of sale events resolved to a tracked link at ingest time. */
  matchedRate: number;
}

export interface RevenueSource {
  /** null = organic (non-attributed) traffic */
  linkId: string | null;
  label: string;
  joins: number;
  revenue: number;
  purchases: number;
  /** Revenue per join. */
  romiPerJoin: number;
  /** Percent of joins that produced at least one purchase. */
  conversionRate: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
}

export interface ApiRevenueReport {
  totals: RevenueTotals;
  /** True when the period contained sale events in more than one currency. */
  mixedCurrencies: boolean;
  sources: RevenueSource[];
  series: RevenuePoint[];
}

export interface ApiApiKey {
  id: string;
  channelId: string;
  /** Visible identifier, e.g. "tgp_4f19a2c8". */
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

/** POST /api-keys response: the only time the raw secret is ever returned. */
export interface CreatedApiKey extends ApiApiKey {
  key: string;
}

export interface SalesImportRowError {
  /** Physical line number in the uploaded file (header is line 1). */
  row: number;
  message: string;
}

export interface SalesImportResult {
  accepted: number;
  /** Rows whose buyer was found among the channel subscribers. */
  matched: number;
  /** Server caps this list; it is not the full error count. */
  errors: SalesImportRowError[];
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

/** Plan gate: the workspace is authenticated but its plan does not include the feature. */
export const PAYMENT_REQUIRED = 402;

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was rejected. Check the form and try again.',
  401: 'You are not signed in.',
  402: 'This is not included in your current plan.',
  403: 'You do not have access to this channel.',
  404: 'Not found.',
  500: 'Something went wrong on our side. Try again in a minute.',
};

function messageForStatus(status: number): string {
  return STATUS_MESSAGES[status] ?? `Request failed (HTTP ${status}).`;
}

/** True when the API refused because of the workspace plan, not because of an error. */
export function isUpgradeRequired(result: ApiResult<unknown>): boolean {
  return !result.ok && (result.upgrade === true || result.status === PAYMENT_REQUIRED);
}

/** Shape of the JSON envelope before it is narrowed into an ApiResult. */
type ResponseBody<T> = { ok: true; data: T } | { ok: false; error?: string; upgrade?: boolean };

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    return { ok: false, error: 'Network error. Check your connection and retry.' };
  }

  const body = (await response.json().catch(() => null)) as ResponseBody<T> | null;
  const isGate = response.status === PAYMENT_REQUIRED;

  if (body && typeof body === 'object' && 'ok' in body) {
    if (body.ok) return { ok: true, data: body.data };
    return {
      ok: false,
      error: body.error || messageForStatus(response.status),
      status: response.status,
      upgrade: body.upgrade === true || isGate,
    };
  }
  return { ok: false, error: messageForStatus(response.status), status: response.status, upgrade: isGate };
}

function send<T>(method: 'POST' | 'PATCH', path: string, payload?: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

function post<T>(path: string, payload?: unknown): Promise<ApiResult<T>> {
  return send<T>('POST', path, payload);
}

export function getMe(): Promise<ApiResult<MeData>> {
  return request<MeData>('/api/me');
}

/** Plan, quota usage and payment history for one workspace. */
export function getBilling(workspaceId: string): Promise<ApiResult<BillingData>> {
  return request<BillingData>(`/api/workspaces/${workspaceId}/billing`);
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

export function getPostbacks(channelId: string): Promise<ApiResult<ApiPostback[]>> {
  return request<ApiPostback[]>(`/api/channels/${channelId}/postbacks`);
}

export function createPostback(channelId: string, input: CreatePostbackInput): Promise<ApiResult<ApiPostback>> {
  return post<ApiPostback>(`/api/channels/${channelId}/postbacks`, input);
}

export function updatePostback(id: string, input: UpdatePostbackInput): Promise<ApiResult<ApiPostback>> {
  return send<ApiPostback>('PATCH', `/api/postbacks/${id}`, input);
}

export function deletePostback(id: string): Promise<ApiResult<{ id: string }>> {
  return request<{ id: string }>(`/api/postbacks/${id}`, { method: 'DELETE' });
}

/** Fires the postback once with test macro values; resolves the upstream HTTP status. */
export function testPostback(id: string): Promise<ApiResult<{ status: number }>> {
  return post<{ status: number }>(`/api/postbacks/${id}/test`);
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

export function getRevenue(channelId: string, days: RevenueDays): Promise<ApiResult<ApiRevenueReport>> {
  return request<ApiRevenueReport>(`/api/channels/${channelId}/revenue?days=${days}`);
}

export function getApiKeys(channelId: string): Promise<ApiResult<ApiApiKey[]>> {
  return request<ApiApiKey[]>(`/api/channels/${channelId}/api-keys`);
}

/** The raw key in the response is shown once and never retrievable again. */
export function createApiKey(channelId: string): Promise<ApiResult<CreatedApiKey>> {
  return post<CreatedApiKey>(`/api/channels/${channelId}/api-keys`);
}

/** Idempotent: revoking an already revoked key succeeds and changes nothing. */
export function revokeApiKey(id: string): Promise<ApiResult<ApiApiKey>> {
  return post<ApiApiKey>(`/api/api-keys/${id}/revoke`);
}

export function importSales(channelId: string, csv: string): Promise<ApiResult<SalesImportResult>> {
  return post<SalesImportResult>(`/api/channels/${channelId}/sales/import`, { csv });
}

export function authTelegram(payload: TelegramAuthPayload): Promise<ApiResult<{ user: ApiUser }>> {
  return post<{ user: ApiUser }>('/api/auth/telegram', payload);
}

export function logout(): Promise<ApiResult<null>> {
  return post<null>('/api/auth/logout');
}
