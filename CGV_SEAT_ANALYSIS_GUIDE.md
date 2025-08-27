# CGV 영화좌석 활성화/비활성화 로직 분석 가이드

## 📋 분석 개요

이 도구는 CGV 영화 좌석 선택 시스템의 활성화/비활성화 로직을 실시간으로 모니터링하고 분석합니다.

## 🎯 분석 대상

### 1. DOM 변화 모니터링
- **좌석 요소의 클래스 변화**: `seat-available` → `seat-selected` → `seat-reserved`
- **데이터 속성 변화**: `data-status`, `data-seat`, `data-row` 등
- **스타일 변화**: 색상, 표시/숨김, 애니메이션 효과

### 2. JavaScript 이벤트 추적
- **클릭 이벤트**: 좌석 클릭 시 발생하는 모든 이벤트
- **상태 변경 이벤트**: 좌석 상태가 변경될 때의 커스텀 이벤트
- **유효성 검사 이벤트**: 좌석 선택 가능 여부 확인

### 3. API 호출 분석
- **좌석 정보 조회**: 초기 좌석 배치 및 상태 정보
- **좌석 선택/해제**: 실시간 좌석 상태 업데이트
- **예약 확인**: 다른 사용자의 예약 상태 확인

### 4. 상태 패턴 분석
- **좌석 상태 전환**: 가능한 모든 상태 전환 패턴 수집
- **선택 제한**: 최대 선택 가능 좌석 수 제한 로직
- **블로킹 조건**: 좌석 선택이 불가능한 조건들

## 🔧 도구 사용법

### 실행 방법
```bash
./run-analysis.sh
```
또는
```bash
node cgv-seat-analyzer.js
```

### 분석 단계
1. **초기화**: 브라우저 창이 열리고 모니터링 준비
2. **네비게이션**: CGV 사이트에서 좌석 선택 페이지까지 이동
3. **모니터링 시작**: 터미널에서 Enter 키 입력 후 좌석 상호작용 관찰
4. **보고서 생성**: 분석 완료 후 JSON 형태의 상세 보고서 생성

## 📊 수집되는 데이터

### 좌석 요소 정보
```json
{
  "tagName": "button",
  "className": "seat available row-A",
  "id": "seat-A-15",
  "dataset": {
    "seat": "A15",
    "row": "A",
    "col": "15",
    "status": "available",
    "price": "14000"
  },
  "attributes": {
    "data-seat": "A15",
    "aria-label": "A열 15번 좌석"
  }
}
```

### 상태 변경 이벤트
```json
{
  "type": "seat_state_change",
  "timestamp": 1642123456789,
  "data": {
    "element": "<button class='seat selected'>...",
    "className": "seat selected row-A",
    "id": "seat-A-15",
    "mutationType": "attributes",
    "attributeName": "class",
    "oldValue": "seat available row-A"
  }
}
```

### API 호출 정보
```json
{
  "type": "api_request",
  "timestamp": 1642123456789,
  "method": "POST",
  "url": "https://www.cgv.co.kr/seat/reserve",
  "data": "{\"seatId\":\"A15\",\"action\":\"select\"}"
}
```

## 🔍 분석할 주요 패턴

### 1. 좌석 상태 전환
- `available` → `selected` (사용자 선택)
- `selected` → `available` (선택 해제)
- `available` → `reserved` (다른 사용자 예약)
- `reserved` → `available` (예약 해제)

### 2. 선택 제한 로직
- 최대 선택 가능 좌석 수 (보통 8개)
- 연속 좌석 선택 권장
- 단체 좌석 선택 제한

### 3. 실시간 동기화
- 다중 사용자 환경에서의 좌석 상태 동기화
- WebSocket 또는 폴링을 통한 실시간 업데이트
- 충돌 해결 메커니즘

### 4. UI/UX 패턴
- 좌석 선택 시 시각적 피드백
- 애니메이션 및 트랜지션 효과
- 접근성 고려사항 (ARIA 레이블 등)

## 📈 예상 분석 결과

### 상태 전환 통계
```
available → selected: 45회
selected → available: 23회
available → reserved: 12회
reserved → available: 3회
```

### 성능 메트릭
- 클릭 응답 시간: 평균 150ms
- API 응답 시간: 평균 300ms
- DOM 업데이트 지연: 평균 50ms

### 기술적 특징
- jQuery 또는 vanilla JavaScript 사용
- RESTful API 또는 GraphQL 엔드포인트
- WebSocket 실시간 통신 여부
- 상태 관리 라이브러리 사용 (Redux, Vuex 등)

## 💡 분석 활용 방안

### 개발자 관점
- 좌석 선택 UI 구현 시 참고
- 실시간 동기화 로직 설계
- 성능 최적화 포인트 파악

### UX/UI 개선
- 사용자 상호작용 패턴 이해
- 접근성 개선 방안
- 모바일 반응형 대응

### 보안 관점
- 클라이언트-서버 통신 보안
- 좌석 점유 방지 로직
- API 호출 제한 및 검증

## 🚨 주의사항

1. **법적 고려사항**: 웹사이트의 이용약관을 준수하여 분석 진행
2. **성능 영향**: 분석 도구가 사이트 성능에 미치는 영향 최소화
3. **개인정보 보호**: 수집된 데이터에서 개인정보 제거
4. **상업적 이용 금지**: 분석 결과의 상업적 이용 제한

## 📝 분석 보고서

분석 완료 후 다음 파일들이 생성됩니다:
- `cgv-seat-analysis-[timestamp].json`: 상세 분석 데이터
- 콘솔에 실시간 분석 결과 출력
- 패턴 분석 및 통계 요약

이 도구를 통해 CGV의 좌석 선택 시스템을 깊이 있게 이해하고, 유사한 시스템 구현에 도움이 되는 인사이트를 얻으실 수 있습니다.