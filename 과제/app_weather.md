# PRD: 날씨 사이트 (app_weather)

## 1. 개요

| 항목 | 내용 |
| --- | --- |
| 제품명 | 오늘 날씨 |
| 목적 | 도시 검색 또는 내 위치로 현재 날씨, 3시간 간격 예보, 5일 예보, 상세 정보를 보여주고, 날씨와 시간대에 따라 배경 테마가 바뀌는 웹 사이트 |
| 기술 스택 | HTML5, CSS3, Vanilla JavaScript (ES6+, `fetch` / `async-await`), Bootstrap 5 (CDN), Bootstrap Icons (CDN) |
| 데이터 | OpenWeatherMap API (무료 요금제 범위만 사용) |
| 실행 환경 | 최신 데스크톱/모바일 브라우저. 내 위치 기능 때문에 **로컬 서버(`http://localhost`)로 실행**한다 (VS Code Live Server 또는 `python -m http.server`) |
| 범위 제외 | 회원가입/로그인, 서버(백엔드), 1시간 단위 예보·7일 예보(유료 One Call API 필요), 기상 특보, 지도 |

---

## 2. 파일 구조

HTML, CSS, JS는 반드시 분리한다.

```
과제/
├── app_weather.md            # 이 문서
└── myweather/
    ├── index.html            # 마크업 (Bootstrap CDN 로드)
    ├── .gitignore            # js/config.js 제외
    ├── css/
    │   └── style.css         # 테마 변수, 카드, 예보 레이아웃
    └── js/
        ├── config.example.js # API 키 자리만 있는 예시 파일 (git에 올림)
        ├── config.js         # 실제 API 키 (git에 올리지 않음, 사용자가 직접 작성)
        └── app.js            # API 호출, 상태 관리, 렌더링, 테마 결정
```

- 스크립트 로드 순서: Bootstrap JS 번들 → `js/config.js` → `js/app.js`
- 인라인 `style`, 인라인 `onclick` 사용 금지 (이벤트는 `app.js`에서 `addEventListener`로 연결)

### CDN

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
```

### API 키 관리

`js/config.example.js` (git에 올림):
```js
// 이 파일을 config.js로 복사한 뒤 본인 키를 넣으세요
const CONFIG = {
  OWM_API_KEY: 'YOUR_API_KEY_HERE',
};
```

- `js/config.js`는 사용자가 직접 만들고 키를 넣는다. **Claude는 키 값을 묻거나 파일에 쓰지 않는다**
- `myweather/.gitignore`에 `js/config.js` 추가
- `config.js`가 없거나 키가 `YOUR_API_KEY_HERE`이면 화면에 "js/config.js에 API 키를 넣어 주세요" 안내 표시
- 주의: 프론트엔드 전용이므로 배포하면 키가 브라우저에 노출된다. 과제/로컬 실행용으로만 사용

---

## 3. 화면 구성

위에서 아래로 단일 페이지 구성. 전체 배경은 테마(5장)에 따라 바뀐다.

```
┌──────────────────────────────────────────────────────┐
│ ☁ 오늘 날씨     [ 도시 검색      ][🔍][📍][°C/°F]     │
│ 즐겨찾기: [서울 ×] [부산 ×] [제주 ×]                   │
├──────────────────────────────────────────────────────┤
│ ☀   서울, KR ☆                       14:00 업데이트   │
│     21°                                               │
│     맑음 · 체감 20° · 최고 24° / 최저 14°              │
├──────────────────────────────────────────────────────┤
│ 3시간 간격 예보                                        │
│ [지금 ☀ 21°] [17시 ☀ 19°] [20시 🌙 16°] ... (가로 스크롤)│
├───────────────────────────┬──────────────────────────┤
│ 5일 예보                   │ 상세 정보                 │
│ 오늘 ☀     14° ━━━━━  24°  │ [습도 45%] [바람 3.2m/s]  │
│ 토   🌧60% 13° ━━━    19°  │ [일출/일몰] [기압]        │
│ 일   ☁     12° ━━━━   21°  │ [대기질 좋음 · PM10/PM2.5]│
│ ...                        │                          │
└───────────────────────────┴──────────────────────────┘
```

### 3.1 헤더
- 왼쪽: 사이트 이름 "오늘 날씨" + 구름 아이콘
- 오른쪽: 도시 검색 입력창, 검색 버튼, 내 위치 버튼, 단위 전환 버튼(°C / °F)
- 모바일(576px 미만): 사이트 이름 아래 줄에 검색 영역이 전체 너비로 배치

### 3.2 즐겨찾기 바
- 헤더 바로 아래, 저장된 도시를 칩(버튼) 형태로 표시
- 칩 클릭 → 해당 도시 날씨 조회, 칩의 × 클릭 → 즐겨찾기에서 삭제
- 즐겨찾기가 없으면 "☆를 눌러 자주 보는 도시를 저장해 보세요" 안내

### 3.3 현재 날씨 카드
- 큰 날씨 아이콘 (64px)
- 도시명, 국가 코드, 즐겨찾기 토글 별(☆/★)
- 현재 기온 (큰 글씨, 정수 반올림)
- 날씨 설명(한국어) · 체감온도 · 오늘 최고/최저
- 강수확률 배지: 우산 아이콘 + "강수확률 60%" (예보 첫 항목 `list[0].pop`, 앞으로 3시간 기준)
  - 0~29%: 테마 보조 글자색, 30% 이상: 파란색 강조
- 오른쪽 위: 데이터 기준 시각 "HH:mm 업데이트" (해당 도시 현지 시각)

### 3.4 3시간 간격 예보
- 가로 스크롤 카드 목록, 앞에서부터 8개(24시간)
- 각 카드: 시각(첫 카드는 "지금"), 아이콘, 기온, 강수확률(물방울 아이콘 + %, **항상 표시**)
  - 0~29%: 보조 글자색, 30% 이상: 파란색 강조

### 3.5 5일 예보 (왼쪽) / 상세 정보 (오른쪽)
- Bootstrap 그리드 `row g-3` + `col-lg-6` 2개. 992px 미만은 위아래로 쌓임
- **5일 예보**: 날짜별 한 줄 (오늘, 요일), 대표 아이콘, 강수확률(**항상 표시**, 30% 이상 파란색), 최저기온, 기온 막대, 최고기온
  - 기온 막대: 5일 전체 최저~최고를 0~100%로 보고 그날의 최저~최고 구간만 색칠
- **상세 정보**: 2열 타일
  - 습도(%)
  - 바람(m/s, 방향 8방위 한글: 북, 북동, 동, 남동, 남, 남서, 서, 북서)
  - 일출 / 일몰 (현지 시각)
  - 기압(hPa)
  - 강수확률(%) + 예상 강수량: 앞으로 3시간 `list[0].pop`, 비/눈 양은 `list[0].rain["3h"]` 또는 `list[0].snow["3h"]`(mm, 없으면 "0 mm")
  - 오늘 강수확률: 오늘(현지 날짜) 남은 예보 항목 `pop`의 최대값
  - 대기질(전체 너비 타일): 등급 텍스트 + PM10, PM2.5 수치(㎍/㎥) + AQI 배지

### 3.6 상태 화면
- **로딩**: 각 카드 자리에 Bootstrap `placeholder-glow` 또는 가운데 `spinner-border`
- **오류**: 현재 날씨 카드 자리에 `alert` 형태로 메시지 + "다시 시도" 버튼 (6.4 참고)

---

## 4. 기능 요구사항

### F-1. 도시 검색
| ID | 요구사항 |
| --- | --- |
| F-1-1 | 입력창에 도시명을 입력하고 Enter 또는 검색 버튼을 누르면 Geocoding API로 좌표를 찾는다 |
| F-1-2 | 결과가 1개면 바로 날씨 조회, 2개 이상이면 입력창 아래 드롭다운(최대 5개)으로 "도시, 시/도, 국가"를 보여주고 선택하게 한다 |
| F-1-3 | 도시명 표시는 `local_names.ko`가 있으면 한국어, 없으면 `name` 사용 |
| F-1-4 | 결과가 없으면 "도시를 찾지 못했어요. 영문 이름으로도 검색해 보세요" 표시 |
| F-1-5 | 빈 입력으로 검색하면 입력창 아래 "도시 이름을 입력해 주세요" 표시하고 요청하지 않음 |
| F-1-6 | 검색 중에는 검색 버튼에 스피너 표시, 중복 클릭 방지 |

### F-2. 내 위치
| ID | 요구사항 |
| --- | --- |
| F-2-1 | 위치 버튼 클릭 시 `navigator.geolocation.getCurrentPosition`으로 좌표를 받아 날씨 조회 |
| F-2-2 | 도시명은 Reverse Geocoding API로 구한다 |
| F-2-3 | 권한 거부 시 "위치 권한이 꺼져 있어요. 도시를 검색해 주세요" 토스트 표시 |
| F-2-4 | 10초 안에 위치를 못 받으면 타임아웃 처리 (`timeout: 10000`) |

### F-3. 날씨 조회
| ID | 요구사항 |
| --- | --- |
| F-3-1 | 좌표(lat, lon)로 현재 날씨, 5일/3시간 예보, 대기질 3개 API를 `Promise.all`로 동시에 호출 |
| F-3-2 | 모든 요청에 `units=metric`, `lang=kr` 파라미터 사용 (대기질 제외) |
| F-3-3 | 조회 성공 시 화면 전체를 다시 그리고 테마를 갱신 |
| F-3-4 | 대기질 API만 실패하면 대기질 타일에 "정보 없음"만 표시하고 나머지는 정상 표시 |
| F-3-5 | 마지막으로 조회한 위치(lat, lon, 표시 이름)를 localStorage(`weather.lastLocation`)에 저장 |

### F-4. 첫 진입
| ID | 요구사항 |
| --- | --- |
| F-4-1 | 저장된 마지막 위치가 있으면 그 위치를 조회 |
| F-4-2 | 없으면 기본 도시 서울(lat 37.5665, lon 126.9780)을 조회 |
| F-4-3 | 첫 진입 시 위치 권한을 자동으로 요청하지 않는다 (버튼을 눌렀을 때만) |

### F-5. 단위 전환
| ID | 요구사항 |
| --- | --- |
| F-5-1 | °C / °F 버튼으로 전환. API를 다시 호출하지 않고 저장된 섭씨 값을 변환해서 다시 그린다 (`F = C × 9/5 + 32`) |
| F-5-2 | 선택한 단위는 localStorage(`weather.unit`)에 저장, 다음 방문에도 유지 |
| F-5-3 | 모든 기온은 정수로 반올림해 표시 |

### F-6. 즐겨찾기
| ID | 요구사항 |
| --- | --- |
| F-6-1 | 현재 날씨 카드의 별을 누르면 현재 도시를 즐겨찾기에 추가/삭제 (☆ ↔ ★) |
| F-6-2 | 최대 5개. 초과 시 "즐겨찾기는 5개까지 저장할 수 있어요" 토스트 |
| F-6-3 | 저장 형식: `[{ name, country, lat, lon }]`, localStorage 키 `weather.favorites` |
| F-6-4 | 같은 도시 판별은 lat/lon 소수점 2자리 비교 |

### F-7. 배경 테마 (5장 참고)
| ID | 요구사항 |
| --- | --- |
| F-7-1 | 현재 날씨 응답으로 테마를 결정해 `<body>`의 `data-theme` 속성에 넣는다 (`day`, `night`, `cloudy`, `snow`) |
| F-7-2 | 테마가 바뀔 때 배경색·글자색이 0.6초 동안 부드럽게 전환 |
| F-7-3 | 모바일 브라우저 주소창 색도 맞춘다 (`<meta name="theme-color">` 값을 테마 배경색으로 변경) |

### F-8. 알림 (토스트)
- Bootstrap `toast` 1개를 화면 하단에 두고 메시지만 바꿔서 재사용, 2.5초 표시

---

## 5. 배경 테마 명세

### 5.1 테마 결정 규칙 (우선순위 순)

| 순위 | 조건 | 테마 (`data-theme`) |
| --- | --- | --- |
| 1 | 현재 시각이 일몰 이후 또는 일출 이전 (`dt < sys.sunrise` 또는 `dt >= sys.sunset`) | `night` |
| 2 | 날씨 코드 600~622 (눈) | `snow` |
| 3 | 날씨 코드 200~531 (뇌우, 이슬비, 비), 701~781 (안개, 연무 등), 803~804 (흐림) | `cloudy` |
| 4 | 날씨 코드 800 (맑음), 801~802 (구름 조금) | `day` |

- 밤 판단은 API 응답의 `dt`, `sys.sunrise`, `sys.sunset`(모두 UTC 유닉스 시간)을 비교하므로 **검색한 도시의 현지 기준**으로 자동 처리된다
- 밤에 눈/비가 와도 밤 테마가 우선
- 날씨 코드는 `weather[0].id` 사용

### 5.2 테마 색상 (CSS 변수)

`style.css`에서 `body[data-theme="..."]`마다 변수를 정의하고, 모든 컴포넌트는 변수만 사용한다.

| 변수 | 역할 | `day` 맑은 낮 | `night` 밤 | `cloudy` 흐림/비 | `snow` 눈 |
| --- | --- | --- | --- | --- | --- |
| `--bg` | 페이지 배경 | `#CFE8FA` | `#14213D` | `#C7CCD3` | `#E3E8EE` |
| `--card` | 카드 배경 | `rgba(255,255,255,.55)` | `rgba(255,255,255,.08)` | `rgba(255,255,255,.45)` | `rgba(255,255,255,.7)` |
| `--text` | 기본 글자 | `#0C2B4A` | `#EEF2FA` | `#2B2F36` | `#25303D` |
| `--text-sub` | 보조 글자 | `#3B5B7A` | `#A9B6CF` | `#555C66` | `#5A6878` |
| `--accent` | 아이콘, 기온 막대 | `#E8920C` | `#F4D35E` | `#5F6B7A` | `#6E8FB5` |

- 카드: `background: var(--card); border: none; border-radius: 16px;` (그림자 없음)
- 입력창·버튼도 `--card` 배경, `--text` 글자색 사용 (Bootstrap 기본 흰 배경 덮어쓰기)
- 강수확률 글씨: 테마와 무관하게 파란색 계열 (`night`에서는 밝은 하늘색 `#8EC9FF`)
- 전환: `body { transition: background-color .6s, color .6s; }`
- 데이터 로드 전 기본 테마는 `day`

### 5.3 날씨 아이콘 매핑 (Bootstrap Icons)

| 날씨 코드 | 낮 아이콘 | 밤 아이콘 |
| --- | --- | --- |
| 200~232 뇌우 | `bi-cloud-lightning-rain` | 같음 |
| 300~321 이슬비 | `bi-cloud-drizzle` | 같음 |
| 500~531 비 | `bi-cloud-rain` | 같음 |
| 600~622 눈 | `bi-cloud-snow` | 같음 |
| 701~781 안개 등 | `bi-cloud-fog2` | 같음 |
| 800 맑음 | `bi-sun` | `bi-moon-stars` |
| 801~802 구름 조금 | `bi-cloud-sun` | `bi-cloud-moon` |
| 803~804 흐림 | `bi-clouds` | 같음 |

- 낮/밤 구분: OWM 아이콘 코드(`weather[0].icon`) 끝 글자가 `d`면 낮, `n`이면 밤 (예보 항목에도 동일하게 적용)

---

## 6. API 명세 (OpenWeatherMap, 무료 요금제)

기본 주소: `https://api.openweathermap.org`

| 용도 | 엔드포인트 | 주요 파라미터 |
| --- | --- | --- |
| 도시 → 좌표 | `/geo/1.0/direct` | `q`, `limit=5`, `appid` |
| 좌표 → 도시 | `/geo/1.0/reverse` | `lat`, `lon`, `limit=1`, `appid` |
| 현재 날씨 | `/data/2.5/weather` | `lat`, `lon`, `units=metric`, `lang=kr`, `appid` |
| 5일/3시간 예보 | `/data/2.5/forecast` | `lat`, `lon`, `units=metric`, `lang=kr`, `appid` (항목 40개) |
| 대기질 | `/data/2.5/air_pollution` | `lat`, `lon`, `appid` |

- 모든 URL은 `URLSearchParams`로 만들고 도시명은 자동 인코딩되게 한다
- One Call API 3.0은 유료 구독이 필요하므로 **사용하지 않는다**

### 6.1 사용하는 응답 필드

| 화면 항목 | 필드 |
| --- | --- |
| 도시명 / 국가 | `name`, `sys.country` (Geocoding의 `local_names.ko` 우선) |
| 현재 기온 / 체감 | `main.temp`, `main.feels_like` |
| 오늘 최고/최저 | 예보에서 오늘(현지 날짜) 항목의 `main.temp_min/max`와 현재 `main.temp`를 합쳐 최소/최대 |
| 설명 / 코드 / 아이콘 | `weather[0].description`, `weather[0].id`, `weather[0].icon` |
| 습도 / 기압 | `main.humidity`, `main.pressure` |
| 바람 | `wind.speed`, `wind.deg` |
| 일출 / 일몰 | `sys.sunrise`, `sys.sunset` |
| 현지 시간 보정 | `timezone` (UTC 기준 초 단위 오프셋) |
| 예보 항목 | `list[].dt`, `list[].main.temp`, `list[].weather[0]`, `list[].pop`(0~1) |
| 강수확률 | `list[].pop` × 100 반올림 → `%` (현재 날씨 API에는 강수확률이 없으므로 예보 첫 항목 사용) |
| 예상 강수량 | `list[].rain["3h"]`, `list[].snow["3h"]` (mm, 필드가 없으면 0) |
| 대기질 | `list[0].main.aqi`(1~5), `list[0].components.pm10`, `list[0].components.pm2_5` |

### 6.2 현지 시각 계산
```js
// dt(UTC 초) + timezone(초) → 현지 시각. getUTC* 메서드로 읽는다
const local = new Date((dt + timezone) * 1000);
local.getUTCHours(); local.getUTCDay(); ...
```
- 브라우저의 시간대와 관계없이 검색한 도시 기준으로 표시된다

### 6.3 5일 예보 만들기
1. `forecast.list` 40개를 현지 날짜(`YYYY-MM-DD`)로 묶는다
2. 날짜별 최저 = `temp_min` 최소값, 최고 = `temp_max` 최대값, 강수확률 = `pop` 최대값
3. 대표 아이콘 = 현지 12시에 가장 가까운 항목의 `weather[0]` (그날 항목이 밤뿐이면 첫 항목)
4. 앞에서부터 5일만 표시, 첫 날은 "오늘", 나머지는 요일(일~토)

### 6.4 대기질 등급 (OWM AQI)

| AQI | 표시 | 배지 색 (Bootstrap) |
| --- | --- | --- |
| 1 | 좋음 | `text-bg-success` |
| 2 | 양호 | `text-bg-info` |
| 3 | 보통 | `text-bg-warning` |
| 4 | 나쁨 | `text-bg-danger` |
| 5 | 매우 나쁨 | `text-bg-dark` |

### 6.5 오류 처리

| 상황 | 판별 | 표시 메시지 |
| --- | --- | --- |
| API 키 미설정 | `CONFIG` 없음 또는 기본값 | "js/config.js에 API 키를 넣어 주세요" |
| 잘못된 키 | HTTP 401 | "API 키가 올바르지 않아요. 새로 만든 키는 활성화까지 최대 2시간 걸릴 수 있어요" |
| 호출 한도 초과 | HTTP 429 | "요청이 너무 많아요. 잠시 후 다시 시도해 주세요" |
| 도시 없음 | Geocoding 결과 빈 배열 | F-1-4 메시지 |
| 네트워크 오류 | `fetch` 예외 | "날씨 정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요" + 다시 시도 버튼 |

---

## 7. JS 설계 (`js/app.js`)

### 7.1 상태
```js
const state = {
  location: null,   // { name, country, lat, lon }
  current: null,    // /weather 응답
  forecast: null,   // /forecast 응답
  air: null,        // /air_pollution 응답 (실패 시 null)
  unit: 'C',        // 'C' | 'F'
  favorites: [],    // [{ name, country, lat, lon }]
};
```

### 7.2 함수 목록

| 구분 | 함수 | 역할 |
| --- | --- | --- |
| 초기화 | `init()` | localStorage 복원, 이벤트 바인딩, 첫 조회 (`DOMContentLoaded`) |
| API | `apiGet(path, params)` | URL 조립 + `fetch` + 상태 코드별 에러 throw |
| API | `searchCity(query)` | Geocoding direct 호출 |
| API | `reverseGeocode(lat, lon)` | Geocoding reverse 호출 |
| API | `fetchWeather(location)` | 3개 API 동시 호출 후 상태 저장, `renderAll()` |
| 위치 | `useMyLocation()` | geolocation → reverse → `fetchWeather` |
| 렌더링 | `renderAll()` | 아래 render 함수 전부 + `applyTheme()` |
| 렌더링 | `renderCurrent()` | 현재 날씨 카드 |
| 렌더링 | `renderHourly()` | 3시간 예보 8개 |
| 렌더링 | `renderDaily()` | 5일 예보 + 기온 막대 |
| 렌더링 | `renderDetails()` | 습도, 바람, 일출/일몰, 기압, 대기질 |
| 렌더링 | `renderFavorites()` | 즐겨찾기 칩 + 현재 도시 별 상태 |
| 렌더링 | `renderSearchResults(list)` | 검색 후보 드롭다운 |
| 렌더링 | `showLoading()` / `showError(message)` | 로딩·오류 상태 |
| 테마 | `getTheme(current)` | 5.1 규칙으로 `'day' \| 'night' \| 'cloudy' \| 'snow'` 반환 |
| 테마 | `applyTheme(theme)` | `body.dataset.theme`, `meta[name=theme-color]` 변경 |
| 유틸 | `getIconClass(weather)` | 5.3 매핑으로 아이콘 클래스 반환 |
| 유틸 | `formatTemp(celsius)` | 단위 변환 + 반올림 + `°` |
| 유틸 | `toLocalDate(dt, timezone)` | 6.2 현지 시각 Date |
| 유틸 | `formatTime(dt, timezone)` | `HH:mm` |
| 유틸 | `windDirection(deg)` | 8방위 한글 |
| 유틸 | `formatPop(pop)` | 0~1 값을 `"60%"`로 변환, 30% 이상이면 강조 클래스(`.pop-high`) 반환 |
| 유틸 | `groupDaily(list, timezone)` | 6.3 날짜별 묶기 |
| 저장 | `loadStorage()` / `saveStorage()` | localStorage 읽기/쓰기 (try/catch로 감싸기) |
| 알림 | `showToast(message)` | Bootstrap 토스트 |

### 7.3 구현 규칙
- 이벤트는 컨테이너에 위임 (즐겨찾기 칩, 검색 드롭다운)
- API 응답 문자열(도시명 등)을 `innerHTML`에 넣을 때는 이스케이프 함수(`escapeHtml`)를 거친다
- 검색 드롭다운은 바깥 클릭이나 Esc로 닫힌다
- localStorage 접근은 모두 try/catch (시크릿 모드 대비)

---

## 8. HTML 요소 ID 규약

| 요소 | ID |
| --- | --- |
| 검색 폼 / 입력창 / 버튼 | `#searchForm`, `#searchInput`, `#searchBtn` |
| 검색 오류 문구 | `#searchError` |
| 검색 후보 드롭다운 | `#searchResults` |
| 내 위치 버튼 | `#locationBtn` |
| 단위 전환 버튼 | `#unitBtn` |
| 즐겨찾기 바 | `#favoriteList` |
| 현재 날씨 카드 | `#currentCard` |
| 즐겨찾기 별 버튼 | `#favoriteToggle` |
| 3시간 예보 목록 | `#hourlyList` |
| 5일 예보 목록 | `#dailyList` |
| 상세 정보 그리드 | `#detailGrid` |
| 토스트 / 메시지 | `#appToast`, `#appToastBody` |
| 테마 색 meta | `<meta name="theme-color" id="themeColor">` |

---

## 9. 접근성
- 아이콘만 있는 버튼에 `aria-label` (검색, 내 위치, 즐겨찾기 추가/삭제)
- 날씨 아이콘은 `aria-hidden="true"`, 옆에 텍스트 설명 제공
- 현재 날씨 카드에 `aria-live="polite"`로 조회 결과를 스크린리더에 알림
- 모든 테마에서 글자와 배경의 명암비 4.5:1 이상 (5.2 색상은 이 기준으로 고름)
- `prefers-reduced-motion: reduce`면 배경 전환 애니메이션 끔

---

## 10. 수용 기준 (테스트 체크리스트)

- [ ] `config.js`에 키가 없으면 안내 메시지가 보이고 콘솔 에러가 없다
- [ ] 첫 진입 시 서울 날씨가 보이고, 새로고침하면 마지막에 본 도시가 보인다
- [ ] "Seoul", "부산", "Tokyo", "London" 검색이 동작한다
- [ ] "Springfield"처럼 같은 이름이 여러 개면 후보 드롭다운에서 고를 수 있다
- [ ] 없는 도시를 검색하면 안내 문구가 보인다. 빈 칸 검색은 요청하지 않는다
- [ ] 내 위치 버튼으로 현재 위치 날씨가 보이고, 권한 거부 시 토스트가 뜬다
- [ ] 3시간 예보 8개, 5일 예보 5줄이 보이고 첫 줄은 "지금", "오늘"이다
- [ ] 강수확률이 현재 날씨 카드, 3시간 예보 8개, 5일 예보 5줄, 상세 정보에 모두 보이고 30% 이상은 파란색이다
- [ ] 5일 예보의 기온 막대가 날짜별 최저~최고 범위에 맞게 그려진다
- [ ] °C ↔ °F 전환 시 모든 기온이 바뀌고, 새로고침 후에도 유지된다
- [ ] 즐겨찾기 추가/삭제/클릭 조회가 동작하고, 6번째 추가 시 토스트가 뜬다
- [ ] 한국 낮 시간에 런던(현지 밤)을 검색하면 밤 테마가 나온다
- [ ] 비 오는 도시는 회색, 눈 오는 도시는 어두운 흰색, 맑은 낮 도시는 하늘색 배경이다
  - 실제 날씨로 확인이 어려우면 콘솔에서 `applyTheme('snow')` 등으로 4개 테마를 확인한다
- [ ] 일출/일몰, "HH:mm 업데이트"가 검색한 도시의 현지 시각으로 나온다
- [ ] 대기질 API만 실패해도 나머지 정보는 정상 표시된다
- [ ] 모바일 폭(375px)에서 가로 스크롤이 없고 (3시간 예보 영역 제외), 5일 예보/상세 정보가 위아래로 쌓인다
- [ ] 브라우저 콘솔에 에러가 없다

---

## 11. 향후 확장 (이번 범위 아님)
- 1시간 단위 예보, 7일 예보 (One Call API 3.0 구독 시)
- 기온 그래프 (Chart.js)
- 테마별 배경 애니메이션 (눈송이, 빗방울, 별)
- 기상 특보 표시
- 백엔드 프록시로 API 키 숨기기
