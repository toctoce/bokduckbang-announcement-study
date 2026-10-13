import { requestManagementApi } from '../management/api'
import { isRecord } from '../management/managementContract'
import { isUserProvider, type UserProvider } from '../users/api'

export type NotificationStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED'
export type NotificationTarget = 'REGION' | 'COMPLEX' | 'ANNOUNCEMENT'
export type NotificationItem = {
  id: string; userId: string; email: string | null; provider: UserProvider
  targetType: NotificationTarget; targetId: string; targetName: string | null
  status: NotificationStatus; requestedAt: string | null; expiresAt: string
}
export type NotificationPage = {
  items: NotificationItem[]; page: number; hasNext: boolean; totalElements: number; totalPages: number
  summary: { activeMembers: number; activeSubscriptions: number; asOf: string }
}
export const statusLabels = { ALL: '전체 상태', ACTIVE: '활성', CANCELLED: '취소', EXPIRED: '만료' } as const
export const targetLabels = { REGION: '지역', COMPLEX: '단지', ANNOUNCEMENT: '공고' } as const
export function isStatus(value: unknown): value is keyof typeof statusLabels {
  return value === 'ALL' || value === 'ACTIVE' || value === 'CANCELLED' || value === 'EXPIRED'
}
export function isTarget(value: unknown): value is NotificationTarget {
  return value === 'REGION' || value === 'COMPLEX' || value === 'ANNOUNCEMENT'
}
export function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
}
export function isTargetIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,19}$/.test(value)
}
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function instant(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value))
}
function item(value: unknown): NotificationItem {
  if (!isRecord(value) || !isIdentifier(value.id) || !isIdentifier(value.userId)
    || (value.email !== null && typeof value.email !== 'string') || !isUserProvider(value.provider)
    || !isTarget(value.targetType) || !isTargetIdentifier(value.targetId)
    || (value.targetName !== null && typeof value.targetName !== 'string')
    || !isStatus(value.status) || value.status === 'ALL'
    || (value.requestedAt !== null && !instant(value.requestedAt)) || !instant(value.expiresAt)) {
    throw new Error('알림 신청 정보 응답이 올바르지 않습니다.')
  }
  return { id: value.id, userId: value.userId, email: value.email, provider: value.provider, targetType: value.targetType,
    targetId: value.targetId, targetName: value.targetName, status: value.status,
    requestedAt: value.requestedAt, expiresAt: value.expiresAt }
}
export async function loadNotificationSubscriptions(
  params: URLSearchParams, signal?: AbortSignal, userId?: string,
): Promise<NotificationPage> {
  if (userId !== undefined && !isIdentifier(userId)) throw new Error('회원 ID를 확인해 주세요.')
  const path = userId ? `/api/admin/users/${encodeURIComponent(userId)}/notification-subscriptions`
    : '/api/admin/notification-subscriptions'
  const value = await requestManagementApi(`${path}?${params}`, 'GET', undefined, signal)
  if (!isRecord(value) || !Array.isArray(value.items) || !count(value.page) || typeof value.hasNext !== 'boolean'
    || !count(value.totalElements) || !count(value.totalPages) || !isRecord(value.summary)
    || !count(value.summary.activeMembers) || !count(value.summary.activeSubscriptions) || !instant(value.summary.asOf)) {
    throw new Error('알림 신청 목록 응답이 올바르지 않습니다.')
  }
  return { items: value.items.map(item), page: value.page, hasNext: value.hasNext,
    totalElements: value.totalElements, totalPages: value.totalPages, summary: {
      activeMembers: value.summary.activeMembers, activeSubscriptions: value.summary.activeSubscriptions, asOf: value.summary.asOf,
    } }
}
