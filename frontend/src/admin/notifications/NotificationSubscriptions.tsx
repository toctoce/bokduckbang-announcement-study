import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../../design-system/components/Button'
import { ListPagination } from '../management/ListPagination'
import { providerLabels } from '../users/presentation'
import { isIdentifier, isTargetIdentifier, isStatus, isTarget, loadNotificationSubscriptions, statusLabels, targetLabels,
  type NotificationItem, type NotificationPage } from './api'
import styles from './Notifications.module.css'

const timestamp = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})
function date(value: string | null) { return value ? timestamp.format(new Date(value)) : '미확인' }
function targetLink(item: NotificationItem) {
  if (!item.targetName) return null
  const canonicalId = BigInt(item.targetId).toString()
  if (!isIdentifier(canonicalId)) return null
  if (item.targetType === 'COMPLEX') return `/admin/complexes/${canonicalId}`
  if (item.targetType === 'ANNOUNCEMENT') return `/admin/announcements/${canonicalId}`
  return null
}
export function NotificationManagementPage() {
  return <section className={styles.page}><header className={styles.heading}><h1>알림 신청 관리</h1>
    <p>회원이 신청한 지역·단지·공고를 확인합니다. 신청 설정이며 알림 발송 결과는 아닙니다.</p></header>
    <NotificationSubscriptions /></section>
}
export function NotificationSubscriptions({ userId }: { userId?: string }) {
  const [params, setParams] = useSearchParams()
  const pageKey = userId ? 'notificationPage' : 'page', statusKey = userId ? 'notificationStatus' : 'status'
  const status = params.get(statusKey) ?? (userId ? 'ALL' : 'ACTIVE')
  const pageValue = params.get(pageKey) ?? '0', page = Number(pageValue)
  const targetType = userId ? '' : params.get('targetType') ?? '', targetId = userId ? '' : params.get('targetId') ?? ''
  const [keyword, setKeyword] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; filters: string; value: NotificationPage } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const valid = isStatus(status) && (!targetType || isTarget(targetType)) && (!targetId || isTargetIdentifier(targetId))
    && (!userId || isIdentifier(userId)) && /^\d+$/.test(pageValue) && Number.isSafeInteger(page)
    && page <= 2147483647 && keyword.length <= 200
  const filters = JSON.stringify([userId, status, targetType, targetId, keyword])
  const key = JSON.stringify([filters, pageValue, attempt])
  const data = valid && loaded?.filters === filters ? loaded.value : null
  const pending = valid && loaded?.key !== key && failure?.key !== key
  const error = valid ? failure?.key === key ? failure.message : '' : '검색 조건을 확인해 주세요.'
  const routeParams = new URLSearchParams()
  for (const name of ['status', 'targetType', 'targetId', 'page']) {
    const value = params.get(name)
    if (value) routeParams.set(name, value)
  }
  const returnTo = `/admin/notification-subscriptions${routeParams.size ? `?${routeParams}` : ''}`

  useEffect(() => {
    if (!valid) return
    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page), size: '20', status })
    if (keyword) query.set('keyword', keyword)
    if (targetType) query.set('targetType', targetType)
    if (targetId) query.set('targetId', targetId)
    void loadNotificationSubscriptions(query, controller.signal, userId).then(value => {
      if (controller.signal.aborted) return
      if (value.totalPages > 0 && page >= value.totalPages) {
        setParams(current => { current.set(pageKey, String(value.totalPages - 1)); return current }, { replace: true })
        return
      }
      setLoaded({ key, filters, value })
    }).catch(cause => {
      if (!controller.signal.aborted) setFailure({ key,
        message: cause instanceof Error ? cause.message : '알림 신청 목록을 불러오지 못했습니다.' })
    })
    return () => controller.abort()
  }, [valid, key, filters, userId, page, pageKey, status, keyword, targetType, targetId, setParams])

  return <section className={styles.panel} aria-label={userId ? '회원 알림 신청' : '알림 신청 조회'}>
    {userId ? <h2>알림 신청</h2> : null}
    {data ? <><dl className={styles.summary}>
      <div><dt>{userId ? '회원 활성 신청 건수' : '전체 활성 신청 회원'}</dt>
        <dd>{(userId ? data.summary.activeSubscriptions : data.summary.activeMembers).toLocaleString('ko-KR')}{userId ? '건' : '명'}</dd></div>
      {!userId ? <div><dt>전체 활성 신청 건수</dt><dd>{data.summary.activeSubscriptions.toLocaleString('ko-KR')}건</dd></div> : null}
    </dl><p className={styles.meta}>마지막 조회 기준 · {date(data.summary.asOf)} (한국 시간)</p></> : null}
    <form key={`${filters}#${pageValue}`} className={styles.filters} aria-label="알림 신청 검색" onSubmit={event => {
      event.preventDefault()
      const values = new FormData(event.currentTarget)
      setKeyword(String(values.get('keyword') ?? '').trim())
      setParams(current => {
        const next = userId ? new URLSearchParams(current) : new URLSearchParams()
        next.delete(pageKey)
        next.set(statusKey, String(values.get('status') ?? 'ACTIVE'))
        for (const name of ['targetType', 'targetId']) {
          const value = String(values.get(name) ?? '').trim()
          if (!userId && value) next.set(name, value)
        }
        return next
      })
    }}>
      {!userId ? <><label className={styles.search}>로그인 이메일·회원 ID<input name="keyword" maxLength={200}
        defaultValue={keyword} placeholder="이메일 또는 회원 ID" /></label>
      <label>대상 종류<select name="targetType" defaultValue={targetType}><option value="">전체 대상</option>
        {Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>대상 ID<input name="targetId" defaultValue={targetId} inputMode="numeric" maxLength={19} /></label></> : null}
      <label>신청 상태<select name="status" defaultValue={status}>{Object.entries(statusLabels).map(([value, label]) =>
        <option key={value} value={value}>{label}</option>)}</select></label>
      <div className={styles.actions}><Button type="submit">검색</Button><button type="button" onClick={event => {
        event.currentTarget.form?.reset()
        setKeyword('')
        setParams(current => { const next = userId ? new URLSearchParams(current) : new URLSearchParams()
          next.delete(pageKey); next.delete(statusKey); return next })
      }}>초기화</button></div>
    </form>
    {error ? <div className={styles.error} role="alert"><p>{error}</p>{valid ? <button type="button"
      onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button> : null}</div> : null}
    <div aria-busy={pending}><div className={styles.resultHeading}>
      <p className={styles.meta}>{data ? `검색 결과 ${data.totalElements.toLocaleString('ko-KR')}건 · 신청일 최신순` : '\u00a0'}</p>
      <button type="button" disabled={pending || !valid} onClick={() => setAttempt(value => value + 1)}>새로고침</button></div>
      {pending ? <p role="status">알림 신청 목록을 불러오는 중…</p> : null}
      {data?.items.length ? <div className={styles.scroll} role="region" tabIndex={0} aria-label="알림 신청 목록 스크롤">
        <table className={styles.table} aria-label={userId ? '회원 알림 신청 목록' : '알림 신청 목록'}>
          <thead><tr>{!userId ? <><th scope="col">회원</th><th scope="col">로그인 이메일</th><th scope="col">로그인 방식</th></> : null}
            <th scope="col">대상</th><th scope="col">상태</th><th scope="col">신청일</th><th scope="col">만료일</th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}>
            {!userId ? <><td><Link aria-label={`회원 ${item.userId} 상세 보기`}
              to={`/admin/users/${item.userId}?returnTo=${encodeURIComponent(returnTo)}`}>{item.userId}</Link></td>
              <td>{item.email || '미제공'}</td><td>{providerLabels[item.provider]}</td></> : null}
            <td><span className={styles.kind}>{targetLabels[item.targetType]} · {item.targetId}</span>
              {targetLink(item) ? <Link to={targetLink(item) ?? ''}>{item.targetName}</Link> : <span>{item.targetName ?? '대상 확인 불가'}</span>}</td>
            <td><span className={styles.badge} data-status={item.status}>{statusLabels[item.status]}</span></td>
            <td>{item.requestedAt ? <time dateTime={item.requestedAt}>{date(item.requestedAt)}</time> : '미확인'}</td>
            <td><time dateTime={item.expiresAt}>{date(item.expiresAt)}</time></td>
          </tr>)}</tbody>
        </table></div> : data ? <p className={styles.empty}>표시할 알림 신청이 없습니다.</p> : null}
      {data ? <ListPagination page={data.page} totalPages={data.totalPages} disabled={pending} label="알림 신청 목록 페이지"
        onMove={next => setParams(current => { current.set(pageKey, String(next)); return current })} /> : null}
    </div>
  </section>
}
