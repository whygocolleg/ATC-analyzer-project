/**
 * Phase 3 — Rule-based ATC 이벤트 감지 엔진
 * API 키 없음, 100% 로컬 실행
 */

const RULES = [
  // ── 비상 ────────────────────────────────────────────────
  {
    id: 'MAYDAY',
    pattern: /\bmayday\b/i,
    severity: 'HIGH',
    label: '비상 선언 (MAYDAY)',
    color: '#e53935',
  },
  {
    id: 'PAN_PAN',
    pattern: /\bpan[\s-]pan\b/i,
    severity: 'HIGH',
    label: '긴급 상황 (PAN-PAN)',
    color: '#e53935',
  },
  {
    id: 'EMERGENCY',
    pattern: /\bdeclaring\s+(?:an\s+)?emergency\b|\bemergency\b/i,
    severity: 'HIGH',
    label: '비상 상황',
    color: '#e53935',
  },
  // ── 복행 / 중단 ─────────────────────────────────────────
  {
    id: 'GO_AROUND',
    pattern: /\bgo[\s-]around\b/i,
    severity: 'MEDIUM',
    label: '복행 (Go-Around)',
    color: '#f59e0b',
  },
  {
    id: 'ABORT',
    pattern: /\babort(?:ed|ing)?\b|\bstop\s+immediately\b/i,
    severity: 'MEDIUM',
    label: '이륙 중단',
    color: '#f59e0b',
  },
  // ── 활주로 관련 ──────────────────────────────────────────
  {
    id: 'RUNWAY_INCURSION',
    pattern: /\bstop\b.*\brunway\b|\brunway\b.*\bincursion\b|\bholdshort\b|\bhold\s+short\b/i,
    severity: 'HIGH',
    label: '활주로 침범 경고',
    color: '#e53935',
  },
  {
    id: 'CLEARED_LAND',
    pattern: /\bcleared\s+to\s+land\b/i,
    severity: 'LOW',
    label: '착륙 허가',
    color: '#22c55e',
  },
  {
    id: 'CLEARED_TAKEOFF',
    pattern: /\bcleared\s+for\s+takeoff\b/i,
    severity: 'LOW',
    label: '이륙 허가',
    color: '#22c55e',
  },
  // ── 기상 ────────────────────────────────────────────────
  {
    id: 'WIND_SHEAR',
    pattern: /\bwind\s*shear\b/i,
    severity: 'HIGH',
    label: '윈드 시어',
    color: '#e53935',
  },
  {
    id: 'LOW_VISIBILITY',
    pattern: /\blow\s+visibility\b|\bzero[\s-]zero\b/i,
    severity: 'MEDIUM',
    label: '저시정',
    color: '#f59e0b',
  },
  // ── 교신 오류 ────────────────────────────────────────────
  {
    id: 'WRONG_FREQ',
    pattern: /\bwrong\s+frequency\b|\bsay\s+again\b.*\btimes\b/i,
    severity: 'MEDIUM',
    label: '교신 오류',
    color: '#f59e0b',
  },
  {
    id: 'READBACK_ERROR',
    pattern: /\bnegative\s+readback\b|\bincorrect\s+readback\b/i,
    severity: 'MEDIUM',
    label: '리드백 오류',
    color: '#f59e0b',
  },
  // ── 연료 ────────────────────────────────────────────────
  {
    id: 'FUEL',
    pattern: /\bfuel\s+(?:imbalance|emergency|low|critical|leak)\b/i,
    severity: 'HIGH',
    label: '연료 이상',
    color: '#e53935',
  },
];

/**
 * 세그먼트 배열을 분석하여 이벤트를 감지합니다.
 * @param {Array<{start, end, text}>} segments
 * @returns {Array<{...segment, events: Array}>}
 */
export function analyzeSegments(segments) {
  return segments.map(seg => {
    const matched = RULES.filter(rule => rule.pattern.test(seg.text));
    return {
      ...seg,
      events: matched,
      hasIncident: matched.some(e => e.severity === 'HIGH'),
      hasWarning: matched.some(e => e.severity === 'MEDIUM'),
    };
  });
}

/**
 * 분석된 세그먼트에서 HIGH/MEDIUM 이벤트만 추출합니다.
 */
export function extractIncidents(analyzed) {
  return analyzed.filter(s => s.hasIncident || s.hasWarning);
}
