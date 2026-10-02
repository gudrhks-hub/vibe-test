const API_BASE = 'https://api.openweathermap.org';
const DEFAULT_LOCATION = { name: '서울', country: 'KR', lat: 37.5665, lon: 126.978 };
const MAX_FAVORITES = 5;
const POP_HIGH = 0.3;
const HOURLY_COUNT = 8;
const DAILY_COUNT = 5;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WIND_DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
const THEME_COLORS = { day: '#CFE8FA', night: '#14213D', cloudy: '#C7CCD3', snow: '#E3E8EE' };
const STORAGE_KEYS = {
  last: 'weather.lastLocation',
  unit: 'weather.unit',
  favorites: 'weather.favorites',
};
const AQI_LEVELS = {
  1: { label: '좋음', cls: 'text-bg-success' },
  2: { label: '양호', cls: 'text-bg-info' },
  3: { label: '보통', cls: 'text-bg-warning' },
  4: { label: '나쁨', cls: 'text-bg-danger' },
  5: { label: '매우 나쁨', cls: 'text-bg-dark' },
};
const MESSAGES = {
  noKey: 'js/config.js에 API 키를 넣어 주세요',
  badKey: 'API 키가 올바르지 않아요. 새로 만든 키는 활성화까지 최대 2시간 걸릴 수 있어요',
  tooMany: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요',
  network: '날씨 정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요',
  failed: '날씨 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요',
  notFound: '도시를 찾지 못했어요. 영문 이름으로도 검색해 보세요',
  emptyQuery: '도시 이름을 입력해 주세요',
};

const state = {
  location: null,
  current: null,
  forecast: null,
  air: null,
  unit: 'C',
  favorites: [],
  candidates: [],   // 검색 후보
  pending: null,    // 다시 시도할 위치
};

let toast;

document.addEventListener('DOMContentLoaded', init);

/* ================= 초기화 ================= */

function init() {
  toast = new bootstrap.Toast(document.getElementById('appToast'), { delay: 2500 });

  const saved = loadStorage();
  state.unit = saved.unit;
  state.favorites = saved.favorites;

  renderUnitButton();
  renderFavorites();
  bindEvents();

  if (!hasApiKey()) {
    showError(MESSAGES.noKey, false);
    return;
  }
  fetchWeather(saved.last || DEFAULT_LOCATION);
}

function bindEvents() {
  const searchInput = document.getElementById('searchInput');

  document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(searchInput.value.trim());
  });

  searchInput.addEventListener('input', () => setSearchError(''));

  document.getElementById('searchResults').addEventListener('click', (e) => {
    const item = e.target.closest('[data-index]');
    if (!item) return;
    const location = state.candidates[Number(item.dataset.index)];
    closeSearchResults();
    searchInput.value = '';
    fetchWeather(location);
  });

  // 검색 후보: 바깥 클릭 / Esc 로 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchForm')) closeSearchResults();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearchResults();
  });

  document.getElementById('locationBtn').addEventListener('click', useMyLocation);

  document.getElementById('unitBtn').addEventListener('click', () => {
    state.unit = state.unit === 'C' ? 'F' : 'C';
    saveStorage();
    renderUnitButton();
    if (state.current) renderAll();
  });

  document.getElementById('favoriteList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-index]');
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (btn.classList.contains('fav-remove')) {
      state.favorites.splice(index, 1);
      saveStorage();
      renderFavorites();
    } else {
      fetchWeather(state.favorites[index]);
    }
  });

  document.getElementById('currentCard').addEventListener('click', (e) => {
    if (e.target.closest('#favoriteToggle')) toggleFavorite();
    if (e.target.closest('[data-action="retry"]') && state.pending) fetchWeather(state.pending);
  });
}

/* ================= API ================= */

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hasApiKey() {
  return typeof CONFIG !== 'undefined'
    && Boolean(CONFIG.OWM_API_KEY)
    && CONFIG.OWM_API_KEY !== 'YOUR_API_KEY_HERE';
}

async function apiGet(path, params) {
  const url = new URL(path, API_BASE);
  url.search = new URLSearchParams({ ...params, appid: CONFIG.OWM_API_KEY }).toString();

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new ApiError(0, MESSAGES.network);
  }

  if (res.status === 401) throw new ApiError(401, MESSAGES.badKey);
  if (res.status === 429) throw new ApiError(429, MESSAGES.tooMany);
  if (!res.ok) throw new ApiError(res.status, MESSAGES.failed);
  return res.json();
}

async function searchCity(query) {
  const list = await apiGet('/geo/1.0/direct', { q: query, limit: 5 });
  return list.map(toLocation);
}

async function reverseGeocode(lat, lon) {
  const list = await apiGet('/geo/1.0/reverse', { lat, lon, limit: 1 });
  return list.length ? toLocation(list[0]) : null;
}

function toLocation(geo) {
  return {
    name: (geo.local_names && geo.local_names.ko) || geo.name,
    country: geo.country,
    state: geo.state || '',
    lat: geo.lat,
    lon: geo.lon,
  };
}

async function fetchWeather(location) {
  if (!hasApiKey()) {
    showError(MESSAGES.noKey, false);
    return;
  }

  state.pending = location;
  showLoading();

  const coords = { lat: location.lat, lon: location.lon };
  const weatherParams = { ...coords, units: 'metric', lang: 'kr' };

  try {
    const [current, forecast, air] = await Promise.all([
      apiGet('/data/2.5/weather', weatherParams),
      apiGet('/data/2.5/forecast', weatherParams),
      apiGet('/data/2.5/air_pollution', coords).catch(() => null), // 대기질만 실패해도 계속
    ]);

    state.location = {
      name: location.name || current.name,
      country: location.country || current.sys.country,
      lat: location.lat,
      lon: location.lon,
    };
    state.current = current;
    state.forecast = forecast;
    state.air = air;
    state.pending = null;

    saveStorage();
    renderAll();
  } catch (err) {
    showError(err.message || MESSAGES.failed, err.status !== 401); // 키 오류는 다시 시도해도 같음
  }
}

/* ================= 검색 / 위치 ================= */

async function handleSearch(query) {
  closeSearchResults();
  setSearchError('');

  if (!query) {
    setSearchError(MESSAGES.emptyQuery);
    return;
  }
  if (!hasApiKey()) {
    showError(MESSAGES.noKey, false);
    return;
  }

  const btn = document.getElementById('searchBtn');
  setButtonLoading(btn, true);
  try {
    const list = await searchCity(query);
    if (list.length === 0) {
      setSearchError(MESSAGES.notFound);
    } else if (list.length === 1) {
      document.getElementById('searchInput').value = '';
      fetchWeather(list[0]);
    } else {
      state.candidates = list;
      renderSearchResults(list);
    }
  } catch (err) {
    setSearchError(err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    showToast('이 브라우저는 위치 기능을 지원하지 않아요');
    return;
  }
  if (!hasApiKey()) {
    showError(MESSAGES.noKey, false);
    return;
  }

  const btn = document.getElementById('locationBtn');
  setButtonLoading(btn, true);

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      let location = null;
      try {
        location = await reverseGeocode(lat, lon);
      } catch (err) {
        // 도시명을 못 찾아도 좌표로 조회는 진행
      }
      setButtonLoading(btn, false);
      fetchWeather(location || { name: '', country: '', lat, lon });
    },
    (err) => {
      setButtonLoading(btn, false);
      if (err.code === err.PERMISSION_DENIED) {
        showToast('위치 권한이 꺼져 있어요. 도시를 검색해 주세요');
      } else {
        showToast('위치를 확인하지 못했어요. 도시를 검색해 주세요');
      }
    },
    { timeout: 10000, maximumAge: 600000 }
  );
}

function setButtonLoading(btn, loading) {
  if (loading) {
    btn.dataset.html = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>';
    btn.disabled = true;
  } else if (btn.dataset.html) {
    btn.innerHTML = btn.dataset.html;
    btn.disabled = false;
  }
}

function setSearchError(message) {
  const el = document.getElementById('searchError');
  el.textContent = message;
  el.classList.toggle('d-none', !message);
}

function renderSearchResults(list) {
  const box = document.getElementById('searchResults');
  box.innerHTML = list.map((loc, i) => {
    const sub = [loc.state, loc.country].filter(Boolean).join(', ');
    return `<button type="button" class="list-group-item list-group-item-action" data-index="${i}">
      ${escapeHtml(loc.name)} <span class="text-sub small">${escapeHtml(sub)}</span>
    </button>`;
  }).join('');
  box.classList.remove('d-none');
}

function closeSearchResults() {
  document.getElementById('searchResults').classList.add('d-none');
}

/* ================= 렌더링 ================= */

function renderAll() {
  renderCurrent();
  renderHourly();
  renderDaily();
  renderDetails();
  renderFavorites();
  applyTheme(getTheme(state.current));
}

function renderCurrent() {
  const { current, forecast, location } = state;
  const weather = current.weather[0];
  const { min, max } = getTodayRange();
  const pop = forecast.list[0] ? forecast.list[0].pop : 0;
  const fav = isFavorite(location);
  const title = [location.name, location.country].filter(Boolean).join(', ');

  document.getElementById('currentCard').innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-3">
      <i class="bi ${getIconClass(weather)} current-icon" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="fw-semibold">
          ${escapeHtml(title)}
          <button type="button" id="favoriteToggle" class="fav-toggle"
            aria-label="${fav ? '즐겨찾기에서 삭제' : '즐겨찾기에 추가'}" aria-pressed="${fav}">
            <i class="bi ${fav ? 'bi-star-fill' : 'bi-star'}" aria-hidden="true"></i>
          </button>
        </div>
        <div class="current-temp">${formatTemp(current.main.temp)}</div>
        <div class="text-sub">
          ${escapeHtml(weather.description)} · 체감 ${formatTemp(current.main.feels_like)}
          · 최고 ${formatTemp(max)} / 최저 ${formatTemp(min)}
        </div>
        <div class="mt-2">
          <span class="pop-badge ${popClass(pop)}">
            <i class="bi bi-umbrella" aria-hidden="true"></i> 강수확률 ${formatPop(pop)}
          </span>
        </div>
      </div>
      <div class="small text-sub align-self-start">${formatTime(current.dt, current.timezone)} 업데이트</div>
    </div>`;
}

function renderHourly() {
  const { current, forecast } = state;
  const tz = forecast.city.timezone;

  // 첫 칸은 현재 날씨, 이후는 3시간 예보
  const items = [{
    label: '지금',
    weather: current.weather[0],
    temp: current.main.temp,
    pop: forecast.list[0] ? forecast.list[0].pop : 0,
  }];
  forecast.list.slice(0, HOURLY_COUNT - 1).forEach((item) => {
    items.push({
      label: `${pad(toLocalDate(item.dt, tz).getUTCHours())}시`,
      weather: item.weather[0],
      temp: item.main.temp,
      pop: item.pop,
    });
  });

  document.getElementById('hourlyList').innerHTML = items.map((h) => `
    <div class="hour-item">
      <div class="text-sub">${h.label}</div>
      <i class="bi wx-icon ${getIconClass(h.weather)}" aria-hidden="true"></i>
      <div class="hour-temp">${formatTemp(h.temp)}</div>
      <div class="hour-pop ${popClass(h.pop)}">
        <i class="bi bi-droplet" aria-hidden="true"></i> ${formatPop(h.pop)}
      </div>
    </div>`).join('');
}

function renderDaily() {
  const { current, forecast } = state;
  const tz = forecast.city.timezone;
  const todayKey = dateKey(current.dt, current.timezone);
  const days = groupDaily(forecast.list, tz).slice(0, DAILY_COUNT);

  // 오늘 줄에는 현재 기온도 반영
  if (days[0] && days[0].key === todayKey) {
    days[0].min = Math.min(days[0].min, current.main.temp);
    days[0].max = Math.max(days[0].max, current.main.temp);
  }

  const allMin = Math.min(...days.map((d) => d.min));
  const allMax = Math.max(...days.map((d) => d.max));
  const range = allMax - allMin || 1;

  document.getElementById('dailyList').innerHTML = days.map((d) => {
    const label = d.key === todayKey ? '오늘' : DAYS[d.date.getUTCDay()];
    const left = ((d.min - allMin) / range) * 100;
    const width = Math.max(((d.max - d.min) / range) * 100, 4);
    return `
      <div class="day-row">
        <span class="fw-semibold">${label}</span>
        <i class="bi wx-icon ${getIconClass(d.weather)}" aria-hidden="true"></i>
        <span class="day-pop ${popClass(d.pop)}"><i class="bi bi-droplet" aria-hidden="true"></i> ${formatPop(d.pop)}</span>
        <span class="day-min">${formatTemp(d.min)}</span>
        <div class="temp-bar" aria-hidden="true"><span style="left:${left}%;width:${width}%"></span></div>
        <span class="fw-semibold">${formatTemp(d.max)}</span>
      </div>`;
  }).join('');
}

function renderDetails() {
  const { current, forecast, air } = state;
  const next = forecast.list[0] || {};
  const nextPop = next.pop || 0;
  const amount = (next.rain && next.rain['3h']) || (next.snow && next.snow['3h']) || 0;
  const todayPop = getTodayPop();

  let airTile;
  if (air && air.list && air.list[0]) {
    const a = air.list[0];
    const level = AQI_LEVELS[a.main.aqi] || { label: '-', cls: 'text-bg-secondary' };
    airTile = `
      <div class="d-flex flex-wrap align-items-center gap-2">
        <div class="me-auto">
          <div class="tile-label"><i class="bi bi-lungs" aria-hidden="true"></i> 대기질</div>
          <div class="tile-value">${level.label}</div>
        </div>
        <span class="tile-note">PM10 ${Math.round(a.components.pm10)} · PM2.5 ${Math.round(a.components.pm2_5)} ㎍/㎥</span>
        <span class="badge ${level.cls}">AQI ${a.main.aqi}</span>
      </div>`;
  } else {
    airTile = `
      <div class="tile-label"><i class="bi bi-lungs" aria-hidden="true"></i> 대기질</div>
      <div class="tile-value">정보 없음</div>`;
  }

  document.getElementById('detailGrid').innerHTML = `
    <div class="tile">
      <div class="tile-label"><i class="bi bi-moisture" aria-hidden="true"></i> 습도</div>
      <div class="tile-value">${current.main.humidity}%</div>
    </div>
    <div class="tile">
      <div class="tile-label"><i class="bi bi-wind" aria-hidden="true"></i> 바람</div>
      <div class="tile-value">${current.wind.speed.toFixed(1)} m/s</div>
      <div class="tile-note">${windDirection(current.wind.deg)}풍</div>
    </div>
    <div class="tile">
      <div class="tile-label"><i class="bi bi-umbrella" aria-hidden="true"></i> 강수확률 (3시간)</div>
      <div class="tile-value ${popClass(nextPop)}">${formatPop(nextPop)}</div>
      <div class="tile-note">예상 강수량 ${Math.round(amount * 10) / 10} mm</div>
    </div>
    <div class="tile">
      <div class="tile-label"><i class="bi bi-cloud-drizzle" aria-hidden="true"></i> 오늘 강수확률</div>
      <div class="tile-value ${popClass(todayPop)}">${formatPop(todayPop)}</div>
    </div>
    <div class="tile">
      <div class="tile-label"><i class="bi bi-sunrise" aria-hidden="true"></i> 일출 / 일몰</div>
      <div class="tile-value">${formatTime(current.sys.sunrise, current.timezone)} / ${formatTime(current.sys.sunset, current.timezone)}</div>
    </div>
    <div class="tile">
      <div class="tile-label"><i class="bi bi-speedometer2" aria-hidden="true"></i> 기압</div>
      <div class="tile-value">${current.main.pressure} hPa</div>
    </div>
    <div class="tile tile-wide">${airTile}</div>`;
}

function renderFavorites() {
  const box = document.getElementById('favoriteList');
  if (state.favorites.length === 0) {
    box.innerHTML = '<span class="text-sub">☆를 눌러 자주 보는 도시를 저장해 보세요</span>';
  } else {
    box.innerHTML = '<span class="text-sub">즐겨찾기</span>' + state.favorites.map((f, i) => `
      <span class="fav-chip">
        <button type="button" data-index="${i}">${escapeHtml(f.name)}</button>
        <button type="button" class="fav-remove" data-index="${i}" aria-label="${escapeHtml(f.name)} 즐겨찾기 삭제">
          <i class="bi bi-x" aria-hidden="true"></i>
        </button>
      </span>`).join('');
  }
}

function renderUnitButton() {
  const c = state.unit === 'C' ? 'unit-on' : 'unit-off';
  const f = state.unit === 'F' ? 'unit-on' : 'unit-off';
  document.getElementById('unitBtn').innerHTML =
    `<span class="${c}">°C</span> / <span class="${f}">°F</span>`;
}

function showLoading() {
  const line = (w) => `<span class="placeholder col-${w} rounded"></span>`;
  document.getElementById('currentCard').innerHTML = `
    <div class="placeholder-glow">
      <div>${line(3)}</div>
      <div class="my-2" style="font-size:3rem">${line(2)}</div>
      <div>${line(6)}</div>
    </div>`;
  document.getElementById('hourlyList').innerHTML =
    `<div class="placeholder-glow w-100">${line(12)}</div>`;
  document.getElementById('dailyList').innerHTML =
    `<div class="placeholder-glow">${line(12)}${line(10)}${line(11)}</div>`;
  document.getElementById('detailGrid').innerHTML =
    `<div class="placeholder-glow tile-wide">${line(12)}${line(9)}</div>`;
}

function showError(message, canRetry) {
  document.getElementById('currentCard').innerHTML = `
    <div class="error-box">
      <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
      <p class="my-2">${escapeHtml(message)}</p>
      ${canRetry ? '<button type="button" class="btn btn-glass btn-sm" data-action="retry">다시 시도</button>' : ''}
    </div>`;
  const empty = '<p class="text-sub small mb-0">-</p>';
  document.getElementById('hourlyList').innerHTML = empty;
  document.getElementById('dailyList').innerHTML = empty;
  document.getElementById('detailGrid').innerHTML = empty;
}

/* ================= 즐겨찾기 ================= */

function sameLocation(a, b) {
  return a && b
    && a.lat.toFixed(2) === b.lat.toFixed(2)
    && a.lon.toFixed(2) === b.lon.toFixed(2);
}

function isFavorite(location) {
  return state.favorites.some((f) => sameLocation(f, location));
}

function toggleFavorite() {
  const loc = state.location;
  if (!loc) return;

  const index = state.favorites.findIndex((f) => sameLocation(f, loc));
  if (index >= 0) {
    state.favorites.splice(index, 1);
  } else {
    if (state.favorites.length >= MAX_FAVORITES) {
      showToast(`즐겨찾기는 ${MAX_FAVORITES}개까지 저장할 수 있어요`);
      return;
    }
    state.favorites.push({
      name: loc.name || '내 위치',
      country: loc.country,
      lat: loc.lat,
      lon: loc.lon,
    });
  }
  saveStorage();
  renderCurrent();
  renderFavorites();
}

/* ================= 테마 ================= */

function getTheme(current) {
  const { dt, sys } = current;
  const id = current.weather[0].id;

  if (sys.sunrise && sys.sunset && (dt < sys.sunrise || dt >= sys.sunset)) return 'night';
  if (id >= 600 && id < 700) return 'snow';
  if (id >= 800 && id <= 802) return 'day';
  return 'cloudy';
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.getElementById('themeColor').setAttribute('content', THEME_COLORS[theme]);
}

/* ================= 유틸 ================= */

function getIconClass(weather) {
  const id = weather.id;
  const night = weather.icon && weather.icon.endsWith('n');

  if (id >= 200 && id < 300) return 'bi-cloud-lightning-rain';
  if (id >= 300 && id < 400) return 'bi-cloud-drizzle';
  if (id >= 500 && id < 600) return 'bi-cloud-rain';
  if (id >= 600 && id < 700) return 'bi-cloud-snow';
  if (id >= 700 && id < 800) return 'bi-cloud-fog2';
  if (id === 800) return night ? 'bi-moon-stars' : 'bi-sun';
  if (id === 801 || id === 802) return night ? 'bi-cloud-moon' : 'bi-cloud-sun';
  return 'bi-clouds';
}

function formatTemp(celsius) {
  const value = state.unit === 'F' ? celsius * 9 / 5 + 32 : celsius;
  return `${Math.round(value)}°`;
}

function formatPop(pop) {
  return `${Math.round((pop || 0) * 100)}%`;
}

function popClass(pop) {
  return (pop || 0) >= POP_HIGH ? 'pop-high' : 'pop-low';
}

// dt(UTC 초) + timezone(초) → 현지 시각. getUTC* 로 읽는다
function toLocalDate(dt, timezone) {
  return new Date((dt + timezone) * 1000);
}

function formatTime(dt, timezone) {
  const d = toLocalDate(dt, timezone);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function dateKey(dt, timezone) {
  return toLocalDate(dt, timezone).toISOString().slice(0, 10);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function windDirection(deg) {
  return WIND_DIRS[Math.round((deg || 0) / 45) % 8];
}

function groupDaily(list, timezone) {
  const groups = new Map();
  list.forEach((item) => {
    const key = dateKey(item.dt, timezone);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.entries()].map(([key, items]) => {
    // 대표 날씨: 현지 12시에 가장 가까운 항목
    const rep = items.reduce((best, item) => {
      const diff = Math.abs(toLocalDate(item.dt, timezone).getUTCHours() - 12);
      const bestDiff = Math.abs(toLocalDate(best.dt, timezone).getUTCHours() - 12);
      return diff < bestDiff ? item : best;
    });
    return {
      key,
      date: toLocalDate(items[0].dt, timezone),
      min: Math.min(...items.map((i) => i.main.temp_min)),
      max: Math.max(...items.map((i) => i.main.temp_max)),
      pop: Math.max(...items.map((i) => i.pop || 0)),
      weather: rep.weather[0],
    };
  });
}

function getTodayItems() {
  const { current, forecast } = state;
  const todayKey = dateKey(current.dt, current.timezone);
  return forecast.list.filter((i) => dateKey(i.dt, forecast.city.timezone) === todayKey);
}

function getTodayRange() {
  const temps = [state.current.main.temp];
  getTodayItems().forEach((i) => temps.push(i.main.temp_min, i.main.temp_max));
  return { min: Math.min(...temps), max: Math.max(...temps) };
}

function getTodayPop() {
  const items = getTodayItems();
  if (items.length === 0) return state.forecast.list[0] ? state.forecast.list[0].pop : 0;
  return Math.max(...items.map((i) => i.pop || 0));
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/* ================= 저장 ================= */

function loadStorage() {
  const result = { last: null, unit: 'C', favorites: [] };
  try {
    const last = JSON.parse(localStorage.getItem(STORAGE_KEYS.last));
    if (last && typeof last.lat === 'number') result.last = last;
    if (localStorage.getItem(STORAGE_KEYS.unit) === 'F') result.unit = 'F';
    const favs = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites));
    if (Array.isArray(favs)) result.favorites = favs.slice(0, MAX_FAVORITES);
  } catch (err) {
    // 저장소를 못 쓰는 환경이면 기본값 사용
  }
  return result;
}

function saveStorage() {
  try {
    if (state.location) localStorage.setItem(STORAGE_KEYS.last, JSON.stringify(state.location));
    localStorage.setItem(STORAGE_KEYS.unit, state.unit);
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
  } catch (err) {
    // 저장 실패는 무시
  }
}

function showToast(message) {
  document.getElementById('appToastBody').textContent = message;
  toast.show();
}
