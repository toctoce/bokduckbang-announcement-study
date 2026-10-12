import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { ComplexCoveragePage } from './ComplexCoveragePage'
const mocks = vi.hoisted(() => ({ compareOfficialComplex: vi.fn() }))
vi.mock('./complexCoverage', async original => ({ ...await original<typeof import('./complexCoverage')>(), ...mocks }))
const entry = { name: '공식 단지', roadAddress: '서울 중구 세종대로 110' }
const source = { sourceUrl: 'https://example.com/list', asOf: '2026-10-12', agencyCode: 'LH', complexes: [entry] }
beforeEach(() => { vi.clearAllMocks() })
function setup() {
  render(<MemoryRouter><ComplexCoveragePage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('공식 단지 목록 JSON'), { target: { value: JSON.stringify(source) } })
  fireEvent.click(screen.getByRole('button', { name: '공식 목록과 대조' }))
}
it('미등록 후보에만 수기 등록 경로를 제공하고 출처·기준일을 표시한다', async () => {
  mocks.compareOfficialComplex.mockResolvedValue({ entry, status: 'MISSING', candidates: [], reason: '공식 목록에만 존재' })
  setup()
  expect(await screen.findByRole('link', { name: '미등록 확인 후 단지 추가' })).toHaveAttribute('href', '/admin/complexes/new')
  expect(screen.getByText(/공식 기준일:/)).toHaveTextContent('2026-10-12')
  expect(screen.getByRole('link', { name: /example.com/ })).toHaveAttribute('href', source.sourceUrl)
})
it('조회 실패에 등록 버튼을 제공하지 않고 재조회할 수 있다', async () => {
  mocks.compareOfficialComplex.mockResolvedValue({ entry, status: 'ERROR', candidates: [], reason: '조회 실패' })
  setup()
  await screen.findByRole('heading', { name: '공식 단지 · 조회 실패' })
  expect(screen.queryByRole('link', { name: '미등록 확인 후 단지 추가' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '공식 목록과 대조' })).toBeEnabled()
})
it('중지하거나 화면을 닫으면 요청을 취소하고 늦게 온 결과를 반영하지 않는다', async () => {
  let resolve!: (value: unknown) => void
  mocks.compareOfficialComplex.mockImplementation(() => new Promise(done => { resolve = done }))
  setup()
  const signal = mocks.compareOfficialComplex.mock.calls[0][2] as AbortSignal
  fireEvent.click(screen.getByRole('button', { name: '대조 중지' }))
  expect(signal.aborted).toBe(true)
  resolve({ entry, status: 'MISSING', candidates: [], reason: '늦은 결과' })
  await waitFor(() => expect(screen.queryByText('늦은 결과')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: '공식 목록과 대조' })).toBeEnabled()
})
