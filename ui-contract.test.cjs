const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const css = fs.readFileSync(path.join(root, 'dist/builder-workspace.css'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'dist/builder-workspace.js'), 'utf8');
const optimizerUi = fs.readFileSync(path.join(root, 'dist/optimizer-ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const appCssFiles = ['style.css', 'compact.css', 'redesign.css', 'game-ui.css', 'timing-auto.css'];
const appCss = appCssFiles.map(file => [file, fs.readFileSync(path.join(root, 'dist', file), 'utf8')]);
const data = JSON.parse(fs.readFileSync(path.join(root, 'dist/data.json'), 'utf8'));
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/effect-icons.js'), 'utf8'), context);
const effectIcons = context.window.DOSUL_EFFECT_ICONS;
const effectCatalog = fs.readFileSync(path.join(root, 'dist/effect-icons-catalog.js'), 'utf8');

check(
  /\.builder-cast-skill[\s\S]{0,500}\.builder-effect-name \.game-status-icon\{width:40px!important;height:40px!important/.test(css),
  '타임라인 스킬 아이콘과 상태 아이콘의 공통 40px 규격이 없습니다.'
);
check(
  /\.builder-effect-name>\.game-status-frame\{width:40px;height:40px;/.test(css),
  '상태 아이콘 외곽 프레임이 스킬 아이콘과 같은 40px가 아닙니다.'
);
check(effectIcons && effectIcons.unmapped.length === 0, '매핑되지 않은 강화·약화 효과 아이콘이 있습니다.');
check(/window\.DosulEffectIcons=/.test(fs.readFileSync(path.join(root, 'dist/effect-icons.js'), 'utf8')), '효과 아이콘 중앙 접근 API가 없습니다.');
check(/DosulEffectIcons\.names\(\)/.test(effectCatalog), '110개 효과 아이콘 전체 도감이 중앙 레지스트리를 사용하지 않습니다.');
for (const [name, entry] of Object.entries(effectIcons.icons)) {
  const src = typeof entry === 'string' ? entry : entry.src;
  check(src && fs.existsSync(path.join(root, 'dist', src)), `${name} 효과 아이콘 파일이 없습니다: ${src}`);
}
for (const file of ['effect-blocks.js','effect-timeline-ui.js','game-ui.js']) {
  const source=fs.readFileSync(path.join(root,'dist',file),'utf8');
  check(!/esc\(window\.DOSUL_EFFECT_ICONS\.icons/.test(source), `${file}이 아이콘 객체를 문자열 경로로 직접 사용합니다.`);
}
check(/F1[^]*F3/.test(workspace) && /length:3/.test(workspace) && /length:5/.test(workspace), '스킬 배치에 F1~F3와 1~5 영역이 모두 필요합니다.');
check(/draggable="true"/.test(workspace) && /addEventListener\('drop'/.test(workspace), '8칸 스킬 배치 드래그 교환 기능이 필요합니다.');
check(/data-order-skill/.test(workspace) && /equipmentSlotLabel/.test(workspace), '스킬 순서 카드에 실제 1~5·F1~F3 배치 위치가 표시되어야 합니다.');
check(/setLinkedSkill/.test(workspace) && /is-skill-linked/.test(css), '스킬 순서와 스킬 배치의 같은 도술을 함께 강조해야 합니다.');
check(/addEventListener\('dragend'[^]*elementFromPoint[^]*moveEquipmentSkill/.test(workspace), '스킬 순서에서 배치 슬롯으로 놓는 드래그 종료 보완 경로가 필요합니다.');
check(/data-equipment-index="\$\{index\}"/.test(workspace) && /Array\.from\(\{length:8\}/.test(workspace) && /slice\(0,5\)\.filter\(Boolean\)/.test(workspace), '빈 슬롯 드롭과 고정 8칸 위치 보존이 필요합니다.');
check(/equipment-auto-toggle/.test(workspace) && /data-auto-skill/.test(workspace) && /자동 조작 \$\{enabled\?'켜짐':'꺼짐'\}/.test(workspace), '스킬 배치 카드에는 접근 가능한 자동 조작 ON/OFF 버튼이 필요합니다.');
check(/D\.executionPolicy=policy/.test(workspace) && /D\.executionPolicy\]\)/.test(workspace), '자동 조작 정책을 엔진과 타임라인 캐시 키에 함께 반영해야 합니다.');
check(/builder-equipment-slot\.auto-off/.test(css) && /equipment-auto-toggle\.is-off/.test(css), '자동 조작 OFF 카드와 버튼은 시각적으로 구분되어야 합니다.');
check(/s\?\.ultimate\?autoControlButton\(s,'ultimate-auto-toggle'\)/.test(workspace) && /#slots \.order-node\.auto-off/.test(css), '궁극기 카드에도 같은 자동 조작 ON/OFF 제어와 OFF 시각 상태가 필요합니다.');
check(/renderAutoPolicyEditor\(id\)/.test(workspace) && /data-detail-hp-active/.test(workspace) && /data-detail-hp-range/.test(workspace) && /builderAutoSettings\.hpBelow\[id\]/.test(workspace) && /auto-policy-editor/.test(css), '장착 도술과 궁극기의 정보 창에서 체력 조건을 설정할 수 있어야 합니다.');
check(/order-node builder-equipment-slot/.test(workspace) && /order-pick equipment-pick/.test(workspace) && /skillTags\(s\)/.test(workspace), '스킬 배치는 사용 순서 카드 UI를 재사용해야 합니다.');
check(/builder-equipment-slot\{[^}]*height:106px;min-height:106px/.test(css) && /equipment-pick>small[^}]*flex-shrink:0/.test(css), '배치 카드도 사용 순서 카드 높이를 유지하고 내부 요소를 축소하면 안 됩니다.');
check(/catalogEffectSummary\(s\)/.test(workspace) && /skill-effect-summary/.test(css) && /builderEffectIcon\(item\.name,item\.scope\)/.test(workspace), '왼쪽 도술 카드의 강화·약화 효과는 인게임 효과 아이콘과 함께 표시해야 합니다.');
check(/builder-equipment-function\{display:grid;grid-template-columns:repeat\(5/.test(css), 'F1~F3와 1~5는 같은 5열 그리드에 정렬해야 합니다.');
check(/recommendModeSpecs/.test(workspace) && /id='order-recommend-dialog'/.test(workspace), '빌드 추천 메인 탭에 네 가지 추천 방식과 비교 화면이 필요합니다.');
check(/recommendOverlayCards\(current\.ids,next\.ids\)/.test(workspace) && /row\(currentIds,'현재 순서',false\)/.test(workspace) && /row\(nextIds,'추천 순서',true\)/.test(workspace) && /recommend-move/.test(workspace), '현재·추천 순서를 함께 보여주고 추천 줄에 이동한 도술의 기존→추천 위치를 표시해야 합니다.');
check(/recommendOverlayTimeline\(current,next,end\)/.test(workspace) && /current-line/.test(workspace) && /next-line/.test(workspace), '현재와 추천 결과는 하나의 시간축에 회색·색상선으로 겹쳐 비교해야 합니다.');
check(/recommend-auto-off/.test(workspace) && /recommend-skill-label \$\{off\?'auto-off'/.test(workspace) && /recommend-overlay-card\.auto-off/.test(css), '순서 추천의 현재·추천 카드와 타임라인에 자동 조작 OFF 상태를 표시해야 합니다.');
check(/recommendDecisionSummary/.test(workspace) && /180초 관찰 구간/.test(workspace) && /평타 대기 시간/.test(workspace) && /연계 성공/.test(workspace) && /총 시전 횟수/.test(workspace), '최적화 결과는 관찰 구간과 핵심 지표를 쉬운 서술형으로 설명해야 합니다.');
check(/recommend-decision-heading h4\{[^}]*font-size:18px/.test(css) && /recommend-decision>p\{[^}]*font-size:13px/.test(css), '최적화 결과 제목과 서술문은 충분한 글자 크기와 대비를 가져야 합니다.');
check(/공백을 채움/.test(workspace) && /유지 중 적중/.test(workspace) && /recommend-callout/.test(css), '추천 근거는 개선 지점의 짧은 타임라인 콜아웃으로 표시해야 합니다.');
check(/remember\(\);commit\(\[\.\.\.candidate\.ids\]/.test(workspace), '추천 적용은 되돌릴 수 있는 commit 경로를 사용해야 합니다.');
check(/timeline-zoom-controls[^]*timeline-expand/.test(workspace), '시간축 조작 뒤에 크게 보기 동작을 배치해야 합니다.');
check(/header nav \.tab\{display:flex;align-items:center;justify-content:center\}/.test(css) && !/data-tab="optimizer"[^}]*display:inline-flex!important/.test(css) && /data-tab="catalog"[^}]*font-size:14px!important/.test(css) && /data-tab="catalog"[^}]*:after\{content:none!important/.test(css), '상단 메뉴는 모든 탭의 세로 정렬을 통일하고 도감 105 중복 표기를 제거해야 합니다.');
check(/빌드 구성/.test(html) && /빌드 추천/.test(html), '메인 메뉴는 빌드 구성과 빌드 추천으로 구분해야 합니다.');
check(/orderRecommendCache=new Map/.test(workspace) && /저장된 결과/.test(workspace) && /startOrderRecommendation\(orderRecommendMode,true\)/.test(workspace), '추천 결과를 방식별로 캐시하고 다시 계산에서만 강제 갱신해야 합니다.');
check(/spanWidth=\(start,finish,min\)=>Math\.min\(100-pct\(start\)/.test(workspace), '추천 오버레이 막대가 시간축 오른쪽 경계를 넘지 않도록 폭을 제한해야 합니다.');
check(/#optimizer\.active\{padding:10px/.test(css) && /\.recommend-mode-bar\{display:grid/.test(css) && /\.recommend-mode-tabs\{display:grid;grid-template-columns:repeat\(3,112px\) 142px;width:auto/.test(css), '빌드 추천은 10px 바깥 여백과 한 줄의 컴팩트한 추천 방식 조작군을 사용해야 합니다.');
check(/tabLabel:'자유 추천 \(개발 중\)'/.test(workspace) && /x\.tabLabel\|\|x\.label/.test(workspace), '자유 추천 탭에는 개발 중 상태를 명시해야 합니다.');
check(/유지할 핵심/.test(optimizerUi) && /사냥 조건/.test(optimizerUi) && /추천 결과/.test(optimizerUi), '자유 추천은 핵심 고정, 사냥 조건, 추천 결과의 3단계 구조를 사용해야 합니다.');
check(/설정 순서/.test(optimizerUi) && /캐릭터 정보/.test(optimizerUi) && /사냥터 선택/.test(optimizerUi) && /적용 기준/.test(optimizerUi) && /체력 조건 자동 계산/.test(optimizerUi), 'STEP 02는 캐릭터 정보, 사냥터, 적용 기준의 순서와 목적을 보여줘야 합니다.');
check(/\.opt-condition-flow-heading\{display:flex/.test(css) && /\.opt-summary-result\{[^}]*background:#f1f8f3/.test(css) && /\.opt-panel-heading\{display:grid/.test(css), '사냥 조건의 입력 흐름과 상세 확인 영역은 시각적으로 구분해야 합니다.');
check(/\.opt-evaluation-advanced>\.opt-grid\{grid-template-columns:1fr/.test(css) && /opt-character-panel\{display:grid;grid-template-columns:repeat\(3/.test(css), 'STEP 02 상세 영역은 전체 폭을 사용하고 능력치 그룹을 3열로 배치해 빈 공간을 만들면 안 됩니다.');
check(/공격 보정 · 기록/.test(optimizerUi) && /방어 보정 · 기록/.test(optimizerUi) && /\.opt-stat-group:not\(\.opt-stat-required\)\{grid-template-columns:repeat\(3/.test(css), '캐릭터 능력치는 핵심·공격·방어 그룹으로 균형 있게 배치해야 합니다.');
check(/\.opt-core-build\{display:grid;grid-template-columns:repeat\(9/.test(css) && /\.opt-condition-summary\{display:grid;grid-template-columns:/.test(css) && /\.opt-direction-cards\{display:grid;grid-template-columns:repeat\(3/.test(css), '자유 추천은 9칸 핵심 카드, 3개 조건 요약, 3개 추천 방향을 한눈에 비교해야 합니다.');
check(/data-open-opt-advanced/.test(optimizerUi) && /고급 빌드 조건/.test(optimizerUi) && /세부 정보 확인·수정/.test(optimizerUi), '원시 능력치와 세부 제약은 확인·수정 영역에서만 노출해야 합니다.');
check(/최대 2개 · 미선택 시 엔진이 결정/.test(optimizerUi) && /primaryFamilies/.test(optimizerUi) && /opt-primary-family-count/.test(optimizerUi), '자유 추천의 주력 계열은 최대 2개 선택과 선택 수를 명시해야 합니다.');
check(/opt-target-picker/.test(optimizerUi) && /data-opt-target-mode="single"/.test(optimizerUi) && /data-opt-target-mode="area"/.test(optimizerUi) && /한 마리 집중 · 범위 피해 도술 제외/.test(optimizerUi), 'STEP 01에서 단일·범위 사냥 대상을 설명과 함께 직접 선택할 수 있어야 합니다.');
check(/\.opt-target-options button\[aria-pressed="true"\]/.test(css), '선택한 빌드 대상은 STEP 01에서 시각적으로 구분되어야 합니다.');
check(/인게임 정보 이미지 첨부/.test(optimizerUi) && /id="opt-stat-images"/.test(optimizerUi) && /recognizeStatImages/.test(optimizerUi) && /createWorker\('kor\+eng'/.test(optimizerUi), '공격·방어·체력 상세 화면을 한글 OCR로 읽는 이미지 첨부 입력이 필요합니다.');
check(!/이미지는 서버로 전송하지 않습니다|텍스트로 직접 입력|id="opt-stat-paste"/.test(optimizerUi), '이미지 첨부 영역에 삭제한 안내와 직접 텍스트 입력 기능이 남으면 안 됩니다.');
check(!/정확도·회피·치명·방어의 환산식은 공개 확인되지 않아 저장만|사냥터의 권장 전투력·몬스터 체력·공격력은/.test(optimizerUi), '삭제한 능력치·사냥터 안내 문구가 남으면 안 됩니다.');
check(!/id="opt-hit-interval"|id="opt-model"|>계산 조건</.test(optimizerUi) && /settings\.hitInterval=1\.5/.test(optimizerUi) && /settings\.encounter=true/.test(optimizerUi), '공격 간격과 사냥 계산 방식은 화면에서 선택하지 않고 각각 1.5초와 공간 사냥 모델로 고정해야 합니다.');
check(/id="opt-incoming"[^>]*readonly[^>]*aria-readonly="true"/.test(optimizerUi), '분당 받는 피해 값은 자동 계산되는 읽기 전용 입력이어야 합니다.');
check(/#opt-incoming\[readonly\]\{[^}]*background:#f1f4ef;[^}]*cursor:default/.test(css), '읽기 전용 분당 피해 값은 편집 입력과 시각적으로 구분해야 합니다.');
check(/\.opt-stat-group\{display:grid/.test(css) && /\.opt-stat-import\{display:grid/.test(css), '캐릭터 능력치 입력은 겹치지 않는 반응형 그룹 레이아웃을 사용해야 합니다.');
check(/빠른 사냥/.test(optimizerUi) && /안정 사냥/.test(optimizerUi) && /연계 중심/.test(optimizerUi) && /opt-result-comparison/.test(optimizerUi), '자유 추천 결과는 빠른 사냥, 안정 사냥, 연계 중심과 현재·추천 비교를 제공해야 합니다.');
check(/executionPolicy:D\.executionPolicy\|\|\{\}/.test(optimizerUi), '자유 추천은 사용자가 지정한 자동 조작과 체력 조건을 계산 입력으로 유지해야 합니다.');
check(/#catalog\.active\{display:flex;[^}]*overflow:hidden/.test(css) && /#catalog>\.table-wrap\{[^}]*flex:1;overflow:auto/.test(css), '도감은 헤더와 검색을 유지하고 표만 스크롤해야 합니다.');
check(/build-recommend-hub:has\(\.order-recommend-empty\) #recommend-refresh\{display:none\}/.test(css), '비교할 도술이 부족한 빈 상태에서 다시 계산 버튼을 노출하면 안 됩니다.');
check(/Button-content safety/.test(css) && /grid-template-rows:24px 42px 20px 16px/.test(css), '사용 순서와 스킬 배치 버튼은 번호·아이콘·이름·배지에 실제 높이의 독립 행을 제공해야 합니다.');
check(/equipment-auto-toggle,[^]*min-height:24px!important;[^]*max-height:24px!important/.test(css), '자동 조작 원형 버튼은 공통 버튼 최소 높이에 의해 커지면 안 됩니다.');
check(/opt-core-skill\{[^}]*grid-template-rows:20px 40px 19px 16px;[^}]*height:114px/.test(css) && /opt-core-skill>\.style-badge\{[^}]*height:16px;[^}]*padding:0 4px!important/.test(css), '자유 추천 핵심 카드의 스킬명과 계열 배지는 서로 겹치지 않는 행과 높이를 사용해야 합니다.');
check(/order-pick>small \.preview-label\{[^}]*max-width:42px;[^}]*font-size:8px/.test(css) && /preview-label">미리보기/.test(workspace), '좁은 사용 순서 카드의 미리보기 배지는 슬롯 번호와 함께 버튼 폭 안에 들어와야 합니다.');
check(/opt-primary-family-count[^>]*hidden/.test(optimizerUi) && /opt-support-scope[^>]*hidden/.test(optimizerUi), '자유 추천에서 선택 개수와 보조 도술 자동 탐색 설명을 노출하면 안 됩니다.');
check(/opt-picker-heading[^>]*hidden/.test(optimizerUi) && /opt-skill-picker[^>]*hidden/.test(optimizerUi), '자유 추천의 추가 고정 도술 선택 영역은 숨겨야 합니다.');
check(!/선택한 계열 중 더 나은 신식·궁극기 탐색|보조 도술 · 제외 계열 외/.test(optimizerUi), '삭제한 자유 추천 설명 문구를 생성 코드에 남기면 안 됩니다.');
check(!/계산 근거 보기|id="opt-basis"/.test(optimizerUi), '자유 추천 화면에 삭제한 계산 근거 영역을 남기면 안 됩니다.');
check(!/상세 비교와 다른 후보|class="opt-result-details"/.test(optimizerUi), '자유 추천 결과에 삭제한 상세 후보 영역을 남기면 안 됩니다.');
check(/id="opt-result-timeline"/.test(optimizerUi) && /DosulRecommendationView/.test(optimizerUi) && /data-opt-free-timeline-zoom/.test(optimizerUi), '자유 추천 결과는 선택한 빌드의 확대·축소 가능한 스킬 타임라인을 제공해야 합니다.');
check(/window\.DosulRecommendationView=\{/.test(workspace) && /overlayTimeline:recommendOverlayTimeline/.test(workspace), '자유 추천과 순서 추천은 같은 오버레이 타임라인 렌더러를 공유해야 합니다.');
check(/\.free-recommend-workspace #opt-results\{display:grid;gap:12px\}/.test(css) && /\.opt-free-timeline\{margin-top:0;/.test(css), '자유 추천 결과 카드·비교 패널·타임라인은 같은 12px 세로 간격을 사용해야 합니다.');
check(/\.opt-step-heading\{[^}]*height:auto!important;[^}]*padding:0;[^}]*border:0/.test(css), '자유 추천 단계 제목은 전역 header 스타일의 높이·패딩·테두리를 차단해야 합니다.');
check(/#opt-required-families label,[^}]*#opt-excluded-families label\{[^}]*display:inline-flex!important;[^}]*align-items:center!important;[^}]*height:30px;[^}]*padding:0 8px/.test(css), '주력·제외 계열 버튼은 동일한 높이와 좌우 여백으로 체크박스와 글자를 수직 정렬해야 합니다.');
check(/#opt-required-families input,[^}]*#opt-excluded-families input\{[^}]*width:14px;[^}]*height:14px;[^}]*margin:0/.test(css), '계열 체크박스는 기본 브라우저 여백 때문에 글자 정렬이 흔들리지 않아야 합니다.');
for (const [file, source] of appCss) {
  check(!/(^|})header\{/.test(source), `${file}의 전역 header 규칙이 내부 섹션 헤더까지 고정 높이와 구분선을 적용합니다.`);
}

const used = new Set();
const add = value => { if (typeof value === 'string' && value.trim()) used.add(value.trim()); };
for (const skill of data.skills || []) {
  (skill.buffs || []).forEach(add);
  (skill.debuffs || []).forEach(add);
  (skill.referenceDetail?.buffs || []).forEach(row => add(row.name));
  (skill.referenceDetail?.debuffs || []).forEach(row => add(row.name));
  for (const condition of skill.conditions || []) { add(condition.effect); add(condition.result); }
}
for (const name of used) {
  const entry = effectIcons.icons[name];
  check(entry, `효과 아이콘 매핑 누락: ${name}`);
  const src = typeof entry === 'string' ? entry : entry.src;
  const file = path.join(root, 'dist', src);
  check(fs.existsSync(file) && fs.statSync(file).size > 0, `효과 아이콘 파일 누락: ${name} (${src})`);
}

console.log(`UI contract: 40px timeline icon parity and ${used.size} effect mappings passed.`);
