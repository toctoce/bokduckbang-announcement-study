import { useEffect, useId, useRef, useState } from 'react'
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
    <p>누가 어떤 지역·단지·공고의 알림을 신청했는지 확인합니다.</p>
    <p className={styles.guide}>신청자 검색 → 대상·상태 확인 → 회원 상세에서 전체 신청 확인</p></header>
    <NotificationSubscriptions /></section>
}
export function NotificationSubscriptions({ userId }: { userId?: string }) {
  const SectionHeading = userId ? 'h3' : 'h2'
  const [params, setParams] = useSearchParams()
  const helpId = useId()
  const form = useRef<HTMLFormElement>(null)
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
  const hasFilters = Boolean(keyword || targetType || targetId || status !== (userId ? 'ALL' : 'ACTIVE'))

  function resetFilters() {
    form.current?.reset()
    setKeyword('')
    setParams(current => {
      const next = userId ? new URLSearchParams(current) : new URLSearchParams()
      next.delete(pageKey)
      next.delete(statusKey)
      return next
    })
  }

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
        <dd>{(userId ? data.summary.activeSubscriptions : data.summary.activeMembers).toLocaleString('ko-KR')}{userId ? '건' : '명'}</dd>
        <dd className={styles.summaryHelp}>{userId ? '이 회원의 현재 유효한 신청' : '유효한 신청이 있는 회원 · 중복 제외'}</dd></div>
      {!userId ? <div><dt>전체 활성 신청 건수</dt><dd>{data.summary.activeSubscriptions.toLocaleString('ko-KR')}건</dd>
        <dd className={styles.summaryHelp}>한 회원이 여러 대상을 신청하면 각각 1건</dd></div> : null}
    </dl><p className={styles.meta}>마지막 조회 기준 · {date(data.summary.asOf)} (한국 시간)</p></> : null}
    <div className={styles.filterPanel}>
    <div className={styles.filterHeading}><SectionHeading>{userId ? '신청 상태 조회' : '신청자 찾기'}</SectionHeading>
      <span>{userId ? '전체 상태로 시작합니다.' : '처음에는 활성 신청만 표시합니다.'}</span></div>
    <form ref={form} key={`${filters}#${pageValue}`} className={styles.filters} aria-label="알림 신청 검색" onSubmit={event => {
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
        defaultValue={keyword} placeholder="예: member@example.com 또는 7" /></label>
      <label>대상 종류<select name="targetType" defaultValue={targetType}><option value="">전체 대상</option>
        {Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </> : null}
      <label>신청 상태<select name="status" defaultValue={status}>{Object.entries(statusLabels).map(([value, label]) =>
        <option key={value} value={value}>{label}</option>)}</select></label>
      <div className={styles.actions}><Button data-design-system type="submit">검색</Button><button type="button" onClick={resetFilters}>초기화</button></div>
      {!userId ? <details className={styles.advanced} open={Boolean(targetId) || undefined}>
        <summary>대상 ID로 정확히 찾기</summary>
        <div><label>대상 ID<input name="targetId" defaultValue={targetId} inputMode="numeric" maxLength={19}
          pattern="[0-9]{1,19}" aria-describedby={`${helpId}-target`} placeholder="예: 11" /></label>
          <p id={`${helpId}-target`}>지역 코드나 단지·공고 ID를 알고 있을 때 입력하세요. 대상 종류도 함께 선택하면 더 정확합니다.</p></div>
      </details> : null}
    </form>
    <details className={styles.help}><summary>상태와 집계는 어떻게 읽나요?</summary>
      <ul><li><strong>활성</strong> · 현재 유효한 신청</li><li><strong>취소</strong> · 회원이 해제한 신청</li>
        <li><strong>만료</strong> · 유효기간이 지난 신청</li></ul>
      <p>{userId ? '상단 집계는 이 회원의 활성 신청을 셉니다.' : '상단 집계는 검색 조건과 관계없이 전체 활성 신청을 셉니다.'}
        {' '}목록 한 줄은 한 대상의 신청입니다. 알림 발송 결과는 포함하지 않습니다.</p>
    </details>
    </div>
    {error ? <div className={styles.error} role="alert"><p>{error}</p>{valid ? <button type="button"
      onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button> : null}</div> : null}
    <div aria-busy={pending}><div className={styles.resultHeading}>
      <div><SectionHeading aria-live="polite">{data ? `검색 결과 ${data.totalElements.toLocaleString('ko-KR')}건` : '신청 목록'}</SectionHeading>
        <p className={styles.meta}>신청일 최신순 · 모든 날짜는 한국 시간</p></div>
      <button type="button" disabled={pending || !valid} onClick={() => setAttempt(value => value + 1)}>새로고침</button></div>
      {valid ? <ul className={styles.applied} aria-label="적용된 검색 조건">
        <li>상태: {statusLabels[status]}</li>
        {!userId ? <li>대상: {isTarget(targetType) ? targetLabels[targetType] : '전체'}</li> : null}
        {keyword ? <li>신청자: {keyword}</li> : null}
        {targetId ? <li>대상 ID: {targetId}</li> : null}
      </ul> : null}
      {pending ? <p role="status">알림 신청 목록을 불러오는 중…</p> : null}
      {data?.items.length ? <div className={styles.scroll} role="region" tabIndex={0} aria-label="알림 신청 목록 스크롤">
        <table className={styles.table} aria-label={userId ? '회원 알림 신청 목록' : '알림 신청 목록'}>
          <thead><tr>{!userId ? <th scope="col">신청자</th> : null}
            <th scope="col">대상</th><th scope="col">상태</th><th scope="col">신청일</th><th scope="col">만료일</th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}>
            {!userId ? <td data-label="신청자"><Link className={styles.primary}
              aria-label={`회원 ${item.userId} 상세 보기${item.email ? ` · ${item.email}` : ''}`}
              to={`/admin/users/${item.userId}?returnTo=${encodeURIComponent(returnTo)}`}>{item.email || `회원 ${item.userId}`}</Link>
              <span className={styles.kind}>회원 ID {item.userId} · {providerLabels[item.provider]}</span>
              {!item.email ? <span className={styles.kind}>로그인 이메일 미제공</span> : null}</td> : null}
            <td data-label="대상"><span className={styles.kind}>{targetLabels[item.targetType]} · {item.targetId}</span>
              {targetLink(item) ? <Link className={styles.primary} to={targetLink(item) ?? ''}>{item.targetName}</Link>
                : <span className={styles.primary}>{item.targetName ?? '대상 확인 불가'}</span>}</td>
            <td data-label="상태"><span className={styles.badge} data-status={item.status}>{statusLabels[item.status]}</span></td>
            <td data-label="신청일">{item.requestedAt ? <time dateTime={item.requestedAt}>{date(item.requestedAt)}</time>
              : <><span>미확인</span><span className={styles.kind}>신청 시각 기록 없음</span></>}</td>
            <td data-label="만료일"><time dateTime={item.expiresAt}>{date(item.expiresAt)}</time></td>
          </tr>)}</tbody>
        </table></div> : data ? <div className={styles.empty}><h3>표시할 알림 신청이 없습니다.</h3>
          <p>{hasFilters ? '검색어 또는 대상·상태 조건을 바꾸어 다시 찾아보세요.'
            : userId ? '이 회원이 신청한 알림이 없습니다.' : '현재 활성 신청이 없습니다. 전체 상태를 선택하면 취소·만료된 신청도 확인할 수 있습니다.'}</p>
          {hasFilters ? <button type="button" onClick={resetFilters}>검색 조건 초기화</button> : null}</div> : null}
      {data ? <ListPagination page={data.page} totalPages={data.totalPages} disabled={pending} label="알림 신청 목록 페이지"
        onMove={next => setParams(current => { current.set(pageKey, String(next)); return current })} /> : null}
    </div>
  </section>
}
