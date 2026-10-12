import { describe, expect, it } from 'vitest'
import { parseReviewResult, correctionBody, reviewTarget } from './documentReview'
import type { ManagementDetailData } from '../management/managementContract'
import type { ExtractedDocument } from './pdfExtraction'

export const detail: ManagementDetailData = {
  summary: { id: 7, name: '두꺼비', subtitle: '서울', provider: 'LH', rental: 'HAPPY_HOUSING', deleted: false,
    modified: false, reviewRequired: false, updatedAt: null }, sourceIdentifier: 'TEST-7',
  data: { version: 2, name: '두꺼비', totalHouseholdCount: 10, totalParkingCount: 0 },
  housingTypes: [{ id: 8, name: '46A', exclusiveArea: 46.8, householdCount: null }],
  announcements: [], supplyRows: [], schedules: [], scheduleReviewed: false,
}
export const document: ExtractedDocument = { fileName: '공고.pdf', sha256: 'a'.repeat(64), totalPages: 3,
  pages: [{ page: 2, text: '단지 전체 세대수 120세대. 주차대수 0대.', items: [], requiresOcr: false }] }
const target = reviewTarget('complexes', detail, 'basic')
const proposal = { field: 'totalHouseholdCount', value: 120, page: 2, quote: '단지 전체 세대수 120세대.',
  unit: '세대', scope: '단지 전체', reason: '전체 세대수 보완' }
function result(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ schemaVersion: 'document-review/v1', targetKey: target.key,
    version: 2, sha256: document.sha256, proposals: [proposal], unresolved: [], ...overrides })
}

describe('PDF 근거 검토', () => {
  it('확인한 항목만 반영하고 기존 0과 선택하지 않은 값을 보존한다', () => {
    const review = parseReviewResult(result(), target, document)
    const body = correctionBody(target, review.proposals, document, 'https://example.com/a.pdf', '전체 세대수 확인')
    expect(body).toMatchObject({ version: 2, totalHouseholdCount: 120, totalParkingCount: 0,
      documentEvidence: { sha256: document.sha256, citations: [{ field: 'totalHouseholdCount', page: 2 }] } })
    expect(detail.data.totalHouseholdCount).toBe(10)
  })
  it.each([{ targetKey: 'complexes:9:basic' }, { version: 1 }, { sha256: 'b'.repeat(64) }])(
    '다른 대상·버전·파일 결과를 거부한다: %j', override => {
      expect(() => parseReviewResult(result(override), target, document)).toThrow()
    })
  it.each([
    { quote: '실제 없는 문장' }, { page: 1 }, { value: -1 }, { value: '120' }, { value: 1.5 },
    { field: 'version' }, { unit: '만원' }, { scope: '이번 모집' }, { value: null },
  ])('원문·형식·단위·범위가 맞지 않으면 거부한다: %j', override => {
    expect(() => parseReviewResult(result({ proposals: [{ ...proposal, ...override }] }), target, document)).toThrow()
  })
  it('같은 항목에 서로 다른 제안이 오면 선택 반영을 막는다', () => {
    expect(() => parseReviewResult(result({ proposals: [proposal, proposal] }), target, document)).toThrow()
  })
  it('주택형의 미확인 세대수와 0을 구분한다', () => {
    const housingType = reviewTarget('complexes', detail, 'type:8')
    expect(housingType.current.householdCount).toBeNull()
    expect(correctionBody(housingType, [{ ...proposal, field: 'householdCount', value: 0 }],
      document, 'https://example.com/a.pdf', '확인').householdCount).toBe(0)
  })
})
