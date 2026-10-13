import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { NotificationManagementPage } from './NotificationSubscriptions'
import { loadNotificationSubscriptions, type NotificationPage } from './api'

vi.mock('./api', async original => ({ ...(await original<typeof import('./api')>()), loadNotificationSubscriptions: vi.fn() }))
const page: NotificationPage = { items: [], page: 0, hasNext: false, totalElements: 0, totalPages: 0,
  summary: { activeMembers: 0, activeSubscriptions: 0, asOf: '2026-10-13T00:00:00Z' } }
beforeEach(() => { vi.mocked(loadNotificationSubscriptions).mockReset().mockResolvedValue(page) })
function Location() { const value = useLocation(); return <output aria-label="현재 경로">{value.pathname}{value.search}</output> }
function mount(path = '/admin/notification-subscriptions') {
  return render(<MemoryRouter initialEntries={[path]}><Location /><NotificationManagementPage /></MemoryRouter>)
}

it('빈 신청은 0건으로 표시하고 실패는 빈 목록으로 위장하지 않는다', async () => {
  vi.mocked(loadNotificationSubscriptions).mockRejectedValueOnce(new Error('목록 연결 실패')).mockResolvedValue(page)
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('목록 연결 실패')
  expect(screen.queryByText('표시할 알림 신청이 없습니다.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
  expect(await screen.findByText('표시할 알림 신청이 없습니다.')).toBeVisible()
  expect(screen.getByText('0명')).toBeVisible()
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
})

it('잘못된 URL 필터는 요청하지 않고 초기화할 수 있다', async () => {
  mount('/admin/notification-subscriptions?status=INVALID&page=-1')
  expect(screen.getByRole('alert')).toHaveTextContent('검색 조건을 확인해 주세요.')
  expect(loadNotificationSubscriptions).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '초기화' }))
  await screen.findByText('표시할 알림 신청이 없습니다.')
  expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/admin/notification-subscriptions')
})

it('회원 검색어를 URL에 남기지 않고 초기화한다', async () => {
  mount()
  await screen.findByText('표시할 알림 신청이 없습니다.')
  fireEvent.change(screen.getByLabelText('로그인 이메일·회원 ID'), { target: { value: 'member@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: '검색' }))
  await waitFor(() => expect(vi.mocked(loadNotificationSubscriptions).mock.lastCall?.[0].get('keyword')).toBe('member@example.test'))
  expect(screen.getByLabelText('현재 경로')).not.toHaveTextContent('member')
  fireEvent.click(screen.getByRole('button', { name: '초기화' }))
  await waitFor(() => expect(vi.mocked(loadNotificationSubscriptions).mock.lastCall?.[0].get('keyword')).toBeNull())
})

it('선행 0 대상 ID를 표시하고 실제 단지 상세 경로로 연결한다', async () => {
  vi.mocked(loadNotificationSubscriptions).mockResolvedValue({ ...page, totalElements: 1, totalPages: 1,
    items: [{ id: '1', userId: '7', email: null, provider: 'GOOGLE', targetType: 'COMPLEX', targetId: '01',
      targetName: '신청 단지', status: 'ACTIVE', requestedAt: null, expiresAt: '2027-10-13T00:00:00Z' }],
  })
  mount('/admin/notification-subscriptions?targetId=01')
  expect(await screen.findByRole('link', { name: '신청 단지' })).toHaveAttribute('href', '/admin/complexes/1')
  expect(screen.getByRole('table')).toHaveTextContent('단지 · 01')
})

it('조건 변경은 이전 요청을 취소하고 늦은 결과가 최신 목록을 덮지 못한다', async () => {
  let resolve: (value: NotificationPage) => void = () => { throw new Error('not initialized') }
  const pending = new Promise<NotificationPage>(yes => { resolve = yes })
  vi.mocked(loadNotificationSubscriptions).mockReturnValueOnce(pending).mockResolvedValue(page)
  mount()
  const signal = vi.mocked(loadNotificationSubscriptions).mock.lastCall?.[1]
  fireEvent.change(screen.getByLabelText('신청 상태'), { target: { value: 'CANCELLED' } })
  fireEvent.click(screen.getByRole('button', { name: '검색' }))
  expect(signal?.aborted).toBe(true)
  await screen.findByText('표시할 알림 신청이 없습니다.')
  await act(() => resolve({ ...page, summary: { ...page.summary, activeMembers: 99 } }))
  expect(screen.queryByText('99명')).not.toBeInTheDocument()
})
