/**
 * Typed fetch client for the TGPulse dashboard API.
 * Contract: docs/PHASE1-BUILD.md — every endpoint answers { ok: true, data } | { ok: false, error }.
 * The failure branch carries the HTTP status so the UI can distinguish 401 (show login)
 * and 402 (plan gate, see docs/BILLING.md).
 */

import type { AdProvider } from './ad-providers';

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      status?: number;
      upgrade?: boolean;
      /**
       * True when the response carried our JSON envelope, so the route exists and
       * really answered. False when the request never reached a route (network error,
       * or an endpoint that is not deployed yet) and the status is a framework default.
       */
      envelope?: boolean;
    };

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
  /** Role of the signed-in user. Absent on older server builds; the Team screen resolves it then. */
  role?: WorkspaceRole;
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
  /** Media buyer or contractor who owns this placement; null when unassigned. */
  buyer: string | null;
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
  buyer?: string;
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
  /** HTTP status of the last delivery, null when the request never completed. */
  lastStatus: number | null;
  lastError: string | null;
  lastFiredAt: string | null;
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

/* ---------- ad platform integrations (docs/AD-INTEGRATIONS.md) ---------- */

/** One native ad-platform connection. Credentials are write-only: only a masked hint comes back. */
export interface ApiIntegration {
  id: string;
  channelId: string;
  provider: AdProvider;
  isActive: boolean;
  sendJoins: boolean;
  /** Non-secret settings: pixel id, counter id, goal name. */
  config: Record<string, string>;
  /** Masked tail of the stored secret, e.g. "•••• 4f2a". null when it cannot be read. */
  credentialHint: string | null;
  /** The stored secret no longer decrypts (key rotation), so the user must reconnect. */
  needsReconnect: boolean;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveIntegrationInput {
  provider: AdProvider;
  /** Omit on an update to keep the stored secret. */
  credentials?: Record<string, string>;
  config: Record<string, string>;
  isActive?: boolean;
  sendJoins?: boolean;
}

export interface UpdateIntegrationInput {
  isActive?: boolean;
  sendJoins?: boolean;
  credentials?: Record<string, string>;
  config?: Record<string, string>;
}

/** Outbox counters over the health window. */
export interface IntegrationUploadCounters {
  pending: number;
  sent: number;
  failed: number;
}

export interface IntegrationHealthRow {
  integrationId: string;
  provider: AdProvider;
  isActive: boolean;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  uploads: IntegrationUploadCounters;
}

export interface IntegrationsHealth {
  windowDays: number;
  items: IntegrationHealthRow[];
}

/** Outcome of a real call to the platform. `ok: false` carries the platform's own wording. */
export interface IntegrationTestOutcome {
  ok: boolean;
  detail: string;
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
    return { ok: false, error: 'Network error. Check your connection and retry.', envelope: false };
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
      envelope: true,
    };
  }
  return {
    ok: false,
    error: messageForStatus(response.status),
    status: response.status,
    upgrade: isGate,
    envelope: false,
  };
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

function del<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: 'DELETE' });
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

/* ---------- ad platform integrations ---------- */

export function getIntegrations(channelId: string): Promise<ApiResult<ApiIntegration[]>> {
  return request<ApiIntegration[]>(`/api/channels/${channelId}/integrations`);
}

/** Connect or reconnect one platform. One row per (channel, provider), so this is an upsert. */
export function saveIntegration(
  channelId: string,
  input: SaveIntegrationInput,
): Promise<ApiResult<ApiIntegration>> {
  return post<ApiIntegration>(`/api/channels/${channelId}/integrations`, input);
}

/** Toggle active state, rotate credentials or replace the non-secret config. */
export function updateIntegration(
  id: string,
  input: UpdateIntegrationInput,
): Promise<ApiResult<ApiIntegration>> {
  return send<ApiIntegration>('PATCH', `/api/integrations/${id}`, input);
}

export function deleteIntegration(id: string): Promise<ApiResult<{ id: string }>> {
  return del<{ id: string }>(`/api/integrations/${id}`);
}

/**
 * Performs a real call to the platform. The request succeeds even when the platform refuses;
 * read `data.ok` for the verdict and `data.detail` for its message.
 */
export function testIntegration(id: string): Promise<ApiResult<IntegrationTestOutcome>> {
  return post<IntegrationTestOutcome>(`/api/integrations/${id}/test`);
}

/** Delivery counters and the last recorded outcome for every integration of the channel. */
export function getIntegrationsHealth(channelId: string): Promise<ApiResult<IntegrationsHealth>> {
  return request<IntegrationsHealth>(`/api/channels/${channelId}/integrations/health`);
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

/* ---------- team, invites, shared reports, exports, buyers (docs/PHASE7-BUILD.md) ---------- */

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'VIEWER';

const WORKSPACE_ROLES: readonly WorkspaceRole[] = ['OWNER', 'ADMIN', 'VIEWER'];

/** Anything the server does not recognise reads as the least privileged role. */
export function normalizeRole(value: unknown): WorkspaceRole {
  const upper = String(value ?? '').toUpperCase() as WorkspaceRole;
  return WORKSPACE_ROLES.includes(upper) ? upper : 'VIEWER';
}

/** OWNER and ADMIN may mutate; VIEWER is read-only (the API answers 403 either way). */
export function canManage(role: WorkspaceRole | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export interface WorkspaceMember {
  userId: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvite {
  id: string;
  role: WorkspaceRole;
  /** One-time token. Present right after creation; pending rows may hide it. */
  token?: string | null;
  /** Absolute accept URL when the server builds one; otherwise composed from the token. */
  url?: string | null;
  expiresAt: string;
  createdAt?: string;
}

export interface MembersData {
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  /** Member quota of the plan. null = unlimited, undefined = the server did not say. */
  limit?: number | null;
  /** Role of the signed-in user inside this workspace, when the server reports it. */
  role?: WorkspaceRole;
}

/** Payload of a one-time invite before it is accepted. */
export interface InvitePreview {
  workspaceName?: string | null;
  role?: WorkspaceRole;
  expiresAt?: string | null;
}

export interface AcceptInviteResult {
  workspaceId?: string;
  workspaceName?: string | null;
}

export type ReportWindowDays = 7 | 30 | 90;

export interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  windowDays: number;
  /** null = no expiry. */
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
  /** Absolute URL when the server builds one; otherwise composed from the token. */
  url?: string | null;
}

export interface CreateShareLinkInput {
  label?: string;
  windowDays: ReportWindowDays;
  /** Omitted = the link never expires. */
  expiresInDays?: number;
}

/** Public report source row. Deliberately carries no identity: no link id, no revenue. */
export interface PublicReportSource {
  label: string;
  clicks: number;
  joins: number;
  leaves: number;
  unsubRate: number;
}

export interface PublicReportData {
  channel: { title: string; username: string | null };
  label?: string | null;
  windowDays: number;
  generatedAt?: string | null;
  totals: OverviewTotals;
  series: OverviewPoint[];
  sources: PublicReportSource[];
}

export interface BuyerRow {
  /** null = links with no buyer assigned. */
  buyer: string | null;
  links: number;
  clicks: number;
  joins: number;
  leaves: number;
  /** Percent value, e.g. 3.2 means 3.2% */
  unsubRate: number;
  /** Present only while the revenue module is on. */
  revenue?: number | null;
  currency?: string | null;
  /** Reserved for the day buyers report spend; not calculated yet. */
  costPerJoin?: number | null;
}

export interface BuyersData {
  buyers: BuyerRow[];
  /** Dominant currency of the period, when revenue is included. */
  currency?: string | null;
}

export type ExportType = 'subscribers' | 'links' | 'events';

/* ---------- url helpers ---------- */

function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** Accept URL for a one-time workspace invite. */
export function inviteUrl(invite: Pick<WorkspaceInvite, 'token' | 'url'>): string {
  if (invite.url) return invite.url;
  return invite.token ? `${currentOrigin()}/invite/${invite.token}` : '';
}

/** Public URL of a shared report. */
export function shareReportUrl(link: Pick<ShareLink, 'token' | 'url'>): string {
  if (link.url) return link.url;
  return link.token ? `${currentOrigin()}/r/${link.token}` : '';
}

export function exportUrl(channelId: string, type: ExportType, days?: number): string {
  const search = new URLSearchParams({ type });
  if (days !== undefined) search.set('days', String(days));
  return `/api/channels/${channelId}/export?${search.toString()}`;
}

/* ---------- normalization ---------- */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Tolerates both `{ members, invites }` and a bare members array. */
function normalizeMembers(raw: unknown): MembersData {
  const source = Array.isArray(raw) ? { members: raw } : asRecord(raw);
  const members = Array.isArray(source.members) ? (source.members as WorkspaceMember[]) : [];
  const invites = Array.isArray(source.invites) ? (source.invites as WorkspaceInvite[]) : [];
  const rawLimit = source.limit;

  return {
    members: members.map((member) => ({ ...member, role: normalizeRole(member.role) })),
    invites: invites.map((invite) => ({ ...invite, role: normalizeRole(invite.role) })),
    limit: typeof rawLimit === 'number' ? rawLimit : rawLimit === null ? null : undefined,
    role: source.role === undefined ? undefined : normalizeRole(source.role),
  };
}

/** Tolerates both `{ buyers, currency }` and a bare array. */
function normalizeBuyers(raw: unknown): BuyersData {
  if (Array.isArray(raw)) return { buyers: raw as BuyerRow[] };
  const source = asRecord(raw);
  return {
    buyers: Array.isArray(source.buyers) ? (source.buyers as BuyerRow[]) : [],
    currency: typeof source.currency === 'string' ? source.currency : null,
  };
}

/* ---------- team ---------- */

/** Members with role and join date, plus pending invites. */
export async function getMembers(workspaceId: string): Promise<ApiResult<MembersData>> {
  const result = await request<unknown>(`/api/workspaces/${workspaceId}/members`);
  if (!result.ok) return result;
  return { ok: true, data: normalizeMembers(result.data) };
}

/** Creates a one-time invite link valid for 7 days. Enforces the member quota (402 on overflow). */
export function createInvite(workspaceId: string, role: WorkspaceRole): Promise<ApiResult<WorkspaceInvite>> {
  return post<WorkspaceInvite>(`/api/workspaces/${workspaceId}/invites`, { role });
}

export function revokeInvite(inviteId: string): Promise<ApiResult<{ id: string }>> {
  return del<{ id: string }>(`/api/invites/${inviteId}`);
}

/** Session required. The token is consumed, so this succeeds at most once. */
export function acceptInvite(token: string): Promise<ApiResult<AcceptInviteResult>> {
  return post<AcceptInviteResult>(`/api/invites/${encodeURIComponent(token)}/accept`);
}

/** Optional preflight so the accept screen can name the workspace. Safe to fail. */
export function getInvite(token: string): Promise<ApiResult<InvitePreview>> {
  return request<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`);
}

/** The last OWNER can never be demoted: the server answers 409. */
export function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<ApiResult<WorkspaceMember>> {
  return send<WorkspaceMember>('PATCH', `/api/workspaces/${workspaceId}/members/${userId}`, { role });
}

/** The last OWNER can never be removed: the server answers 409. */
export function removeMember(workspaceId: string, userId: string): Promise<ApiResult<{ userId: string }>> {
  return del<{ userId: string }>(`/api/workspaces/${workspaceId}/members/${userId}`);
}

/* ---------- shared reports ---------- */

export function getShareLinks(channelId: string): Promise<ApiResult<ShareLink[]>> {
  return request<ShareLink[]>(`/api/channels/${channelId}/share-links`);
}

export function createShareLink(channelId: string, input: CreateShareLinkInput): Promise<ApiResult<ShareLink>> {
  return post<ShareLink>(`/api/channels/${channelId}/share-links`, input);
}

export function revokeShareLink(id: string): Promise<ApiResult<ShareLink>> {
  return post<ShareLink>(`/api/share-links/${id}/revoke`);
}

/** Public, no session. Never returns subscriber identities, revenue, keys or members. */
export function getPublicReport(token: string): Promise<ApiResult<PublicReportData>> {
  return request<PublicReportData>(`/api/share/${encodeURIComponent(token)}`);
}

/* ---------- buyers ---------- */

export async function getBuyers(channelId: string, days: number): Promise<ApiResult<BuyersData>> {
  const result = await request<unknown>(`/api/channels/${channelId}/buyers?days=${days}`);
  if (!result.ok) return result;
  return { ok: true, data: normalizeBuyers(result.data) };
}

/* ---------- exports ---------- */

const FILENAME_PATTERN = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = FILENAME_PATTERN.exec(header);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Streams the CSV through fetch instead of navigating, so a 402 or 403 stays on the page
 * and can be shown inline. The response is turned into a blob and saved with the
 * filename the server picked.
 */
export interface ExportResult {
  filename: string;
  /** True when the plan row cap cut the file short (X-Export-Truncated). */
  truncated: boolean;
  rowCount: number | null;
}

export async function downloadExport(
  channelId: string,
  type: ExportType,
  days?: number,
): Promise<ApiResult<ExportResult>> {
  const url = exportUrl(channelId, type, days);

  let response: Response;
  try {
    response = await fetch(url, { credentials: 'same-origin' });
  } catch {
    return { ok: false, error: 'Network error. Check your connection and retry.', envelope: false };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; upgrade?: boolean } | null;
    const isGate = response.status === PAYMENT_REQUIRED;
    return {
      ok: false,
      error: body?.error || messageForStatus(response.status),
      status: response.status,
      upgrade: body?.upgrade === true || isGate,
      envelope: body !== null,
    };
  }

  const filename = filenameFromDisposition(
    response.headers.get('Content-Disposition'),
    `tgpulse-${type}.csv`,
  );
  const truncated = response.headers.get('X-Export-Truncated') === 'true';
  const rawRowCount = Number(response.headers.get('X-Export-Rows'));
  const rowCount = Number.isFinite(rawRowCount) ? rawRowCount : null;

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return { ok: true, data: { filename, truncated, rowCount } };
}
