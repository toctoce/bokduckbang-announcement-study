# 관리자 회원 알림 신청 관리

/admin/notification-subscriptions는 회원 ID·로그인 이메일로 신청을 검색하고 대상 종류·대상 ID·상태로 조회한다.
이메일 검색어는 화면 메모리에만 두며 URL과 분석 SDK에 저장하지 않는다.
회원 ID에서 회원 상세로 이동하면 해당 회원의 신청 목록을 조회한다.
지역은 기존 지역 코드의 이름을 표시하고 단지·공고는 기존 관리자 상세로 연결한다.

## 조회 API

- GET /api/admin/notification-subscriptions: keyword(최대 200자), 선택적 userId, targetType, targetId, status, page, size.
- GET /api/admin/users/{userId}/notification-subscriptions: 회원별 status, page, size. 없는 회원은 404.
- 일반 목록은 ACTIVE, 회원 상세는 ALL이 기본이다. 상태는 ALL/ACTIVE/CANCELLED/EXPIRED.
- page는 0부터, size는 기본 20·최대 100이다. 신청일 내림차순, 같은 시각은 구독 ID 내림차순, 신청일 미확인은 뒤에 표시한다.
- ADMIN 역할을 요구하며 개인정보 응답은 Cache-Control: no-store다. 새 ID 응답은 문자열로 제공한다.

응답은 기존 관리자 ApiResponse.data 아래 items/page/hasNext/totalElements/totalPages/summary를 제공한다.
summary는 activeMembers(회원 ID 중복 제거), activeSubscriptions(활성 설정 행 수), asOf(동일 DB 집계 기준시각)다.
일반 목록의 요약은 검색·대상·상태 필터와 무관한 전체 활성 신청이다.
회원별 요약은 해당 회원만 집계한다. 필터된 목록의 건수는 totalElements로 구별한다.
목록·전체건수·활성요약은 하나의 SQL 스냅샷과 기준시각으로 조회한다.

## 상태와 데이터 경계

- active=false는 CANCELLED, active=true이며 expires_at이 기준시각 이하이면 EXPIRED, 나머지는 ACTIVE다.
- 신청일은 privacy_notification_notices.requested_at만 사용한다. 없으면 미확인이고 updated_at으로 추정하지 않는다.
- 회원 이메일이나 고지 메타가 없는 신청도 조회한다. 같은 이메일의 다른 회원 ID는 합치지 않는다.
- 삭제·미확인 대상은 신청 행·대상 ID를 보존하고 링크 없이 대상 확인 불가로 표시한다.
- 조회는 설정·고지·수정 순서·업무 영수증을 변경하지 않는다. 회원용 current()의 잠금·revision 생성도 호출하지 않는다.
- 이 화면은 신청 설정 조회다. 알림 발송, 강제 해제, 회원 삭제·정지와 분석 행동 기록 연결을 제공하지 않는다.

비회원 알림 제거의 DB 마이그레이션·복구 절차는 [회원 알림 보유와 해제](../../docs/notification-retention-and-cancellation.md)를 따른다.
