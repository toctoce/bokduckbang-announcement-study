import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../design-system/components/Button'
import { compareOfficialComplex, parseOfficialList, type CoverageResult, type OfficialComplexList } from './complexCoverage'
import { downloadText } from './documentReview'
import { SourceUrl } from '../shared/SourceUrl'
import styles from './DocumentReview.module.css'

const example = JSON.stringify({ sourceUrl: 'https://공식기관의-단지목록-주소', asOf: '2026-10-12', agencyCode: 'LH',
  complexes: [{ name: '공식 단지명', roadAddress: '공식 도로명주소' }] }, null, 2)
const statusLabels = { MATCHED: '등록 확인', MISSING: '미등록 후보', REVIEW: '동일성 검토', DELETED: '휴지통 후보', ERROR: '조회 실패' }

export function ComplexCoveragePage() {
  const [input, setInput] = useState(''); const [list, setList] = useState<OfficialComplexList | null>(null)
  const [results, setResults] = useState<CoverageResult[]>([]); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  function change(value: string) { setInput(value); setList(null); setResults([]); setError(''); setNotice('') }
  async function compare() {
    if (busy) return
    let source: OfficialComplexList
    try { source = parseOfficialList(input) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '목록을 확인해 주세요.'); return }
    const controller = new AbortController(); request.current = controller
    setList(source); setResults([]); setError(''); setNotice(''); setBusy(true)
    try {
      for (const entry of source.complexes) {
        const result = await compareOfficialComplex(source, entry, controller.signal)
        if (controller.signal.aborted) return
        setResults(current => [...current, result])
      }
      setNotice('대조를 마쳤습니다. 후보의 동일성과 공개 화면 노출을 직접 확인하세요.')
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '대조하지 못했습니다.')
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  async function readFile(file: File) {
    if (file.size > 1000000) { setError('공식 목록 JSON은 1MB 이하여야 합니다.'); return }
    const controller = new AbortController(); request.current = controller
    setBusy(true)
    try { const text = await file.text(); if (!controller.signal.aborted) change(text) }
    catch { if (!controller.signal.aborted) setError('목록 파일을 읽지 못했습니다.') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <section className={`${styles.panel} ph-no-capture`}>
    <header><h1>단지 누락 대조</h1><p>공식 단지 목록을 서비스 등록 목록과 대조해 미등록·휴지통·동일성 확인 후보를 찾습니다.</p></header>
    <p className={styles.hint}>API·공식 홈페이지·PDF에서 확보한 목록을 같은 형식으로 가져올 수 있습니다. 이름 유사도로 자동 등록하지 않습니다.</p>
    <fieldset className={styles.inputs} disabled={busy}><legend>공식 단지 목록</legend>
      <label>공식 단지 목록 JSON 파일<input type="file" accept=".json,application/json" onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void readFile(file)
      }} /></label>
      <label>공식 단지 목록 JSON<textarea rows={10} value={input} spellCheck={false} placeholder={example} onChange={event => change(event.target.value)} /></label>
      <details><summary>입력 형식 보기</summary><pre className={styles.text}>{example}</pre><p className={styles.hint}>sourceIdentifier는 서비스와 같은 원천 식별자일 때만 선택적으로 입력하세요. 한 번에 최대 50개입니다.</p></details>
      <Button data-design-system disabled={!input.trim()} onClick={() => void compare()}>공식 목록과 대조</Button>
    </fieldset>
    {busy ? <div role="status"><p>대조 중… {results.length}/{list?.complexes.length ?? 0}</p><button type="button" onClick={() => {
      request.current?.abort(); setBusy(false); setNotice('대조를 중지했습니다. 완료된 항목만 표시합니다.')
    }}>대조 중지</button></div> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {list ? <section className={styles.step} aria-label="단지 대조 결과"><h2>대조 결과</h2><p>공식 기준일: {list.asOf} · 기관: {list.agencyCode} · {results.length}/{list.complexes.length}개 확인</p>
      <SourceUrl url={list.sourceUrl} />
      <p>{Object.entries(statusLabels).map(([key, label]) => `${label} ${results.filter(result => result.status === key).length}개`).join(' · ')}</p>
      {results.map((result, index) => <article key={index} className={styles.proposal}><h3>{result.entry.name} · {statusLabels[result.status]}</h3>
        <p>{result.entry.roadAddress}</p><p>{result.reason}</p>
        {result.candidates.map(candidate => <p key={candidate.id}><Link to={`/admin/complexes/${candidate.id}`}>{candidate.name} · {candidate.subtitle} · 상세 확인</Link>
          {!candidate.deleted ? <> · <Link to={`/explore?complexId=${candidate.id}`} target="_blank">공개 화면 확인</Link></> : null}</p>)}
        <Link to={`/admin/complexes?${new URLSearchParams({ keyword: result.entry.name })}`}>관리자에서 다시 검색</Link>
        {result.status === 'MISSING' ? <Link to="/admin/complexes/new">미등록 확인 후 단지 추가</Link> : null}
      </article>)}
      {!busy && results.length ? <button type="button" onClick={() => downloadText(JSON.stringify({ source: list, checkedAt: new Date().toISOString(), results }, null, 2), 'complex-coverage-result.json')}>대조 결과 다운로드</button> : null}
    </section> : null}
  </section>
}
