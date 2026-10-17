# 에이전트용 빌드 비교

저장소 루트에서 Node.js 20 이상으로 실행합니다. Windows/macOS/Linux에서 같은 계산 코드를 사용하며, 패키지 설치·개발 서버·브라우저·영상 원본·외부 API는 필요하지 않습니다.

```sh
node scripts/compare-builds.cjs --verify
```

또는 `npm run compare -- --verify`를 사용합니다. 기본 설정 `comparisons/single-defense.json`은 단일 대상 방어 근접 7개 구성, 영상 배치 프리셋 4개, 60/120/180초를 비교합니다. 84회 계산 후 동일 입력으로 84회를 재검증합니다. 검증을 생략하려면 `--verify`를 빼세요.

## 출력

기본 출력은 저장소의 `reports/comparison-<UTC 시각>-<프로세스 ID>/`입니다. 생성 결과는 Git에서 제외됩니다. `--out`은 현재 작업 디렉터리를 기준으로 해석하며, 기존 결과 덮어쓰기를 방지하기 위해 없거나 비어 있는 폴더만 허용합니다.

```sh
node scripts/compare-builds.cjs --out reports/my-comparison --verify
node scripts/compare-builds.cjs --profiles 185547,190057 --horizons 60,180 --traces all
```

- `comparison.json`: 해석 한계, 정규화된 입력, 빌드별 결과, 효과 실패 이유, 신식, 검증 결과, 데이터/엔진/실행기 SHA-256. Git을 사용할 수 있으면 HEAD도 기록합니다. HEAD만으로 수정 중인 소스를 식별할 수 없으므로 해시를 함께 확인하세요.
- `comparison.csv`: 빌드/환경/시간/범주/관찰 항목/지표/값 형태의 긴 표. 판정 없음은 빈 값이며 0%와 구분합니다.
- `summary.txt`: 전체 환경/시간에 걸친 각 조건 성립률 범위와 해석 한계.
- `<ID>-build.json`: 앱의 `저장·파일 → JSON 가져오기`로 여는 사용 순서와 기본 장착.
- `<ID>-<프로필>-<초>-trace.json`: 시전, 개별 적중, 조건 판정, 효과 적용 시각을 포함한 로그. `--traces max`가 기본이며 가장 긴 구간만 저장합니다. `none`은 생략, `all`은 모든 구간을 저장합니다.

모든 입력과 계산이 성공해야 결과를 쓰기 시작합니다. 잘못된 입력/궁극기 조건/필수 타이밍 정보 누락은 종료 코드 1로 반환합니다. 기존 설정을 조용히 보정하거나 잘못된 실행 시간을 엔진 한도로 잘라서 진행하지 않습니다.

## 다른 구성 비교

기본 설정을 복사해 `builds`의 `skills`와 `baseSlots`를 바꾸거나, 앱에서 내보낸 파일을 연결합니다. 예를 들어 다음 설정을 내보낸 `my-build.json` 옆에 저장하세요.

```json
{
  "schema": "dosul-comparison-v1",
  "name": "사용자 빌드 비교",
  "targetRestriction": "single",
  "profiles": ["185547", "190057"],
  "horizons": [60, 180],
  "builds": [
    {"id": "mine", "file": "my-build.json"}
  ],
  "conditionProbes": [
    {
      "id": "heal",
      "label": "찌르기 낙인 회복",
      "skillId": "s007",
      "effect": "낙인",
      "result": "체력 회복",
      "scope": "enemy"
    }
  ]
}
```

```sh
node scripts/compare-builds.cjs --config path/to/config.json --verify
```

`file` 경로는 설정 JSON이 있는 폴더 기준입니다. 설정과 명령줄 경로에 공백이 있으면 따옴표로 감싸세요. 빌드는 직접 `{ "id": "A", "name": "안 A", "skills": [...], "baseSlots": [...] }`로 넣을 수도 있습니다. 두 방식을 같은 항목에서 혼합하지 마세요.

`baseSlots`는 최대 5개의 사용 중인 일반 도술 ID를 반드시 명시합니다. 실행기가 신식을 임의로 켜거나 궁극기 조건을 맞추지 않습니다. 앱에서 내보낸 기존 v1/v2 파일도 이 필드를 명시해야 합니다. 입력은 중복/미등록 ID/한도 초과/궁극기 조건을 검사합니다. 미완성 구성도 한도와 궁극기 조건이 유효하면 비교하며 `validation.complete`로 구분합니다.

`targetRestriction: "single"`은 **모든 도술의 저장된 대상 분류가 single인 경우만** 허용합니다. 자신/지원/범위/미확인 도술은 제외합니다. 광역 구성을 비교할 때는 `"any"`로 바꾸세요. 이것은 데이터 분류 검사이지 현행 인게임 대상의 추가 검증이 아닙니다.

## 관찰 항목

도술 ID와 조건은 `dist/data.json`에서 읽습니다. 기본 설정의 세 조건은 이전 비교와 같습니다.

| 관찰 ID | 도술 | 조건 → 효과 |
|---|---|---|
| heal | s007 찌르기 | 적 낙인 → 자신 체력 회복 |
| markShield | s012 휘둘러 내려치기 | 적 낙인 → 자신 보호막 |
| guardShield | s075 도약 찌르기 | 자신 수호 → 자신 보호막 |

- `conditionProbes`: `skillId`, `effect`, `result`, `scope`를 정확히 지정합니다. 서로 다른 조건을 합산하지 않습니다. `rate = pass / checks × 100`이며 `checks`에는 실패와 미확인도 포함합니다. 조건 검사 자체가 없으면 `rate: null`입니다. `failureReasons`로 만료, 미부여, 다른 대상, 미확인 등을 구별합니다.
- `castProbes`: `{ "id": "directShield", "skillId": "s069" }`처럼 완료 시전 수만 셉니다. 지정 스킬이 없으면 `present: false`입니다. 시전 수를 실제 효과 발동 수로 해석하지 마세요.
- `opportunityGroups`: `{ "id": "shield", "conditionProbes": ["markShield", "guardShield"], "castProbes": ["directShield"] }`처럼 시점을 합쳐 최대 간격을 계산합니다. 조건은 성립한 적중 시점, 시전은 완료 시점을 사용합니다. 시전 순간 효과에는 시점 차이가 있을 수 있습니다.
- `maxEligibleHitGap`/`maxGapIncludingEdges`: 구간 시작 0초와 끝 시각을 포함한 최대 간격입니다. 사용 중인 스킬에서 기회가 전혀 없으면 전체 관찰 시간, 해당 스킬 자체가 없으면 `null`입니다. **실제 보호막이 없는 시간**이 아닙니다.

## 비교 결과를 해석하는 에이전트에게

1. 모든 빌드에 같은 환경/시간을 적용하고 `baseSlots`, `activeShinsik`, `excluded`, `issues`, 데이터 해시를 먼저 확인하세요.
2. 목적에 맞는 조건 성립률과 실패 원인, 반복 구간별 안정성, 무조건 효과의 시전 기회를 비교하세요. 미확인/누락을 0이나 성공으로 치환하지 마세요.
3. 이 모델에는 피해를 받는 과정이나 보호막 소모가 없습니다. 보호막 유지율, 오버파밍 생존율, 처치량, 실전 DPS를 만들거나 자동 우승자를 선언하지 마세요. `recommendation`은 항상 `null`이며 추천은 한계를 밝힌 별도 분석으로 작성합니다.
4. 단일 대상이어도 프리셋은 시작부터 여러 몹이 활성화됩니다. 밀쳐내기/추격으로 추가 어그로가 생기는지도 검증하지 못합니다. 이 비교를 실제 1대1 안전성 검증이라고 부르지 마세요.
5. 원본 7개 안에서는 180초 원형 프리셋 기준 A의 낙인 보호막 조건 60/90, C의 76/85가 기록되었습니다. 현재 데이터가 바뀌면 결과도 달라질 수 있습니다. 기존 수치나 C라는 이름을 우승자로 하드코딩하지 마세요.

현재 스킬 레벨별 계산이나 몬스터 스펙 옵션은 제공하지 않습니다. 새 옵션이 필요하면 엔진과 근거 자료를 먼저 확장해야 합니다.

## 검증

```sh
node compare-builds.test.cjs
node scripts/test.cjs
```

첫 명령은 비교 실행기만 검사하고, 두 번째는 앱 전체 테스트입니다. 비교 테스트는 84개 조합 결정성, 기존 결과 회귀, 입력 오류 거부, 조건별 집계, 누락/미확인 구분, 타 작업 폴더에서의 실행, 상대 파일 참조, 가져오기, 로그 생성과 출력 덮어쓰기 방지를 검사합니다. 전체 테스트에는 OS별 서버/Windows 실행기 테스트도 포함됩니다.
