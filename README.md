# Drop Zone Squad

을지로를 배경으로 세 명의 대원을 지휘하는 2D 도트 생존 게임 프로토타입입니다. 현재 버전은 0.3입니다.

세 대원이 함께 이동하고 자동으로 사격합니다. 벌크는 방어, 레이븐은 돌격, 링스는 저격에 특화되어 있으며, 선두를 교대하면 대형과 전투 효과가 바뀝니다. 경험치를 모아 증강을 선택하고 5분 동안 생존하는 것이 목표입니다.

## 실행

PC에서는 `game/index.html`을 Chrome 또는 Edge에서 엽니다. WASD 또는 방향키로 이동하고 1–3으로 선두를 교대합니다. 휴대폰에서는 가로 화면에서 드래그로 이동하고 대원 버튼을 탭합니다.

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
node work/touch.cjs
node work/review-shots.cjs
```

진행·증강·승패·재시작과 터치 이동 중 선두 교대를 확인합니다. 에셋 가공 스크립트에는 Python, Pillow가 필요하며 도로 생성에는 NumPy도 사용합니다. 게임 실행과 APK 빌드에는 가공이 완료된 `game/`의 에셋을 그대로 사용합니다.

Galmuri 폰트의 라이선스는 `game/Galmuri-LICENSE.txt`에 있습니다.
