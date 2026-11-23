# Drop Zone Squad

을지로를 배경으로 네 명 중 세 명이 출전하는 2D 도트 생존 게임입니다. 현재 버전은 0.7입니다.

처음 게임을 시작하면 캐릭터 선택창에서 세 명을 누른 순서로 편성합니다. 첫 대원이 선두를 맡고, 다음 출전에는 마지막 편성을 다시 사용합니다. 시작 화면의 캐릭터 선택에서 편성을 바꿀 수 있습니다. 추가 대원 슬롯에는 ‘출시 준비중’이 표시되며 상점은 버튼만 있습니다.

선두 벌크는 방패와 권총, 레이븐은 쌍권총, 링스는 저격총, 해머는 박격포를 사용합니다. 선두 스킬은 각각 고정식 벙커의 사방 사격, 쌍기관단총 전방·회전 난사, 연속 관통 레이저, 설치식 집중 포격입니다. 후열 둘은 보조 권총으로 지원하며, 살아 있는 출전 대원을 선택하면 선두를 교대합니다.

각 스테이지의 세 웨이브는 마지막 8초에 한 방향에서 대규모 무리가 들어옵니다. 세 번째 웨이브가 끝나면 보스를 처치해야 다음 스테이지로 넘어갑니다. 대원 체력, 경험치와 증강은 이어지며 세 번째 보스를 처치하면 작전을 완료합니다.

| 스테이지 | 전투 구성 | 보스 패턴 |
|---|---|---|
| 을지로 봉쇄선 | 기본형, 빅웨이브 생성 목표 10·14·18마리 | 철갑 돌격대장이 예고한 직선을 따라 돌진 |
| 환승로 범람 | 물량 중심, 20·26·32마리와 빠른 적 비중 증가 | 공진 파쇄기에서 바깥쪽으로 원형 충격파가 퍼짐 |
| 종점 포격지대 | 보스 중심, 12·15·18마리와 중장갑 적 | 종점 포격지휘관이 선두 위치를 세 번 조준한 뒤 순차 포격 |

1·3스테이지에서는 보스 등장 전에 마지막 웨이브의 잔당이 물러납니다. 2스테이지에서는 잔당이 보스와 함께 싸웁니다. 종점 포격지휘관의 체력은 1,200입니다.

웨이브 간격, 적 조합과 보스 체력은 `game/stages.js`, 보스 공격의 예고 시간·범위·피해는 `game/bosses.js`, 무기 피해와 관통 배율은 `game/combat.js`에서 조정합니다. 스폰은 도달 가능한 위치와 스테이지의 적 수 상한을 따릅니다.

## 실행

PC에서는 `game/index.html`을 Chrome 또는 Edge에서 엽니다. WASD 또는 방향키로 이동하고 1–3으로 출전 순서에 따라 선두를 교대하며 Space로 스킬을 사용합니다. 휴대폰에서는 가로 화면에서 드래그로 이동하고 대원 버튼으로 교대하며 스킬 버튼으로 발동합니다. 지하철 출입구에서는 계단을 따라 걸어서 지상과 지하를 오갑니다.

## 구성

- `game/`에 게임 로직, Canvas 렌더러, UI, 폰트와 이미지가 있습니다.
- `android/`에 오프라인 WebView 앱과 적응형·원형·테마 아이콘이 있습니다.
- `work/`에 빌드, 에셋 가공, 브라우저 검증 스크립트가 있습니다.

## Android 빌드

Windows PowerShell에서 프로젝트 루트를 기준으로 실행합니다. 빌드 스크립트는 Unity Hub의 기본 설치 경로에 있는 Android Build Support의 OpenJDK와 Android SDK를 사용합니다. SDK Platform 36과 Build Tools 36.0.0이 필요합니다. 최소 지원 버전은 Android 8입니다.

```powershell
.\work\build.ps1
.\work\package-usb.ps1
```

APK와 USB 설치 패키지는 `dist/`에 생성됩니다. 첫 빌드에서 로컬 테스트 서명 키를 생성합니다. 이미 설치한 앱에 업데이트하려면 이전 빌드의 `work/android-build/test.jks`를 같은 위치에 보관해야 합니다. 서명 키와 빌드 결과는 Git에서 제외됩니다.

## 검증

Node.js, Playwright와 기본 경로에 설치한 Chrome을 사용합니다.

```powershell
node work/test.cjs
node work/check-lineup.cjs
node work/check-zombie-stages.cjs
node work/touch.cjs
node work/check-tag-combat.cjs
node work/check-squad-skills.cjs
node work/check-squad-skill-ui.cjs
node work/check-stair-links.cjs
node work/review-shots.cjs
```

진행·증강·승패·재시작과 터치 이동 중 선두 교대를 확인합니다. 에셋 가공 스크립트에는 Python, Pillow가 필요하며 도로 생성에는 NumPy도 사용합니다. 게임 실행과 APK 빌드에는 가공이 완료된 `game/`의 에셋을 그대로 사용합니다.

Galmuri 폰트의 라이선스는 `game/Galmuri-LICENSE.txt`에 있습니다.
