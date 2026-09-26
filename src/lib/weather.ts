/**
 * Open-Meteo API (no API key) + 날씨별 카드 테마
 * @see https://open-meteo.com/en/docs
 */

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

export type WeatherThemeId =
  | "clear"
  | "partlyCloudy"
  | "fog"
  | "rain"
  | "snow"
  | "showers"
  | "thunderstorm"
  | "overcast";

export type WeatherTheme = {
  id: WeatherThemeId;
  /** 이모지 아이콘 */
  icon: string;
  /** 한 줄 설명 */
  description: string;
};

/** WMO 날씨 코드 → 테마 */
function getThemeByCode(code: number): WeatherTheme {
  if (code === 0) {
    return {
      id: "clear",
      icon: "☀️",
      description: "맑고 선선한 하루, 산책하기 좋은 날씨예요.",
    };
  }
  if (code >= 1 && code <= 3) {
    return {
      id: "partlyCloudy",
      icon: "⛅",
      description: "구름이 조금 있어요. 가벼운 외출에 좋아요.",
    };
  }
  if (code === 45 || code === 48) {
    return {
      id: "fog",
      icon: "🌫️",
      description: "안개가 껴 있어요. 외출 시 주의하세요.",
    };
  }
  if (code >= 51 && code <= 67) {
    return {
      id: "rain",
      icon: "🌧️",
      description: "비가 오고 있어요. 우산 챙기세요.",
    };
  }
  if (code >= 71 && code <= 77) {
    return {
      id: "snow",
      icon: "❄️",
      description: "눈이 내려요. 따뜻하게 입으세요.",
    };
  }
  if (code >= 80 && code <= 82) {
    return {
      id: "showers",
      icon: "🌦️",
      description: "소나기가 있을 수 있어요. 우산 준비해 두세요.",
    };
  }
  if (code >= 95 && code <= 99) {
    return {
      id: "thunderstorm",
      icon: "⛈️",
      description: "천둥·번개가 있을 수 있어요. 실내에 계세요.",
    };
  }
  return {
    id: "overcast",
    icon: "☁️",
    description: "흐린 하루예요. 무난한 옷차림이 좋아요.",
  };
}

export type WeatherCurrent = {
  temp: number;
  feelsLike: number;
  humidity: number;
  weatherCode: number;
  theme: WeatherTheme;
  /** 풍속 m/s */
  windSpeed: number;
  /** 강수량 mm */
  precipitation: number;
  /** 자외선 지수 0~11+ */
  uvIndex: number;
};

const SEOUL = { lat: 37.57, lon: 126.98 };

export async function fetchCurrentWeather(
  lat: number = SEOUL.lat,
  lon: number = SEOUL.lon
): Promise<WeatherCurrent | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m,precipitation,uv_index",
    timezone: "Asia/Seoul",
  });
  try {
    const res = await fetch(`${OPEN_METEO}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        relative_humidity_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        precipitation?: number;
        uv_index?: number;
      };
    };
    const c = data.current;
    if (!c || c.temperature_2m == null || c.weather_code == null) return null;
    const weatherCode = Number(c.weather_code);
    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature ?? c.temperature_2m),
      humidity: c.relative_humidity_2m ?? 0,
      weatherCode,
      theme: getThemeByCode(weatherCode),
      windSpeed: c.wind_speed_10m ?? 0,
      precipitation: c.precipitation ?? 0,
      uvIndex: c.uv_index ?? 0,
    };
  } catch {
    return null;
  }
}

export type DailyForecast = {
  /** YYYY-MM-DD */
  date: string;
  weatherCode: number;
  icon: string;
  max: number;
  min: number;
  /** 강수확률 % (0~100) */
  rainProb: number;
};

/** 오늘부터 7일 일별 예보 */
export async function fetchWeeklyForecast(
  lat: number = SEOUL.lat,
  lon: number = SEOUL.lon
): Promise<DailyForecast[] | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "7",
    timezone: "Asia/Seoul",
  });
  try {
    const res = await fetch(`${OPEN_METEO}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: (number | null)[];
      };
    };
    const d = data.daily;
    if (!d?.time || !d.weather_code || !d.temperature_2m_max || !d.temperature_2m_min) return null;
    return d.time.map((date, i) => ({
      date,
      weatherCode: d.weather_code![i],
      icon: getThemeByCode(d.weather_code![i]).icon,
      max: Math.round(d.temperature_2m_max![i]),
      min: Math.round(d.temperature_2m_min![i]),
      rainProb: d.precipitation_probability_max?.[i] ?? 0,
    }));
  } catch {
    return null;
  }
}

/** 앞으로 몇 시간 뒤부터 비가 오는지 (0 = 지금, null = 24시간 안에 비 소식 없음). 조회 실패 시 undefined */
export async function fetchRainHoursAhead(
  lat: number = SEOUL.lat,
  lon: number = SEOUL.lon
): Promise<number | null | undefined> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "precipitation_probability,precipitation",
    forecast_days: "2",
    timezone: "Asia/Seoul",
  });
  try {
    const res = await fetch(`${OPEN_METEO}?${params}`);
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      hourly?: { time?: string[]; precipitation_probability?: (number | null)[]; precipitation?: (number | null)[] };
    };
    const h = data.hourly;
    if (!h?.time || !h.precipitation_probability || !h.precipitation) return undefined;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const nowKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
    const start = Math.max(0, h.time.findIndex((t) => t >= nowKey));
    for (let i = 0; i < 24 && start + i < h.time.length; i++) {
      const prob = h.precipitation_probability[start + i] ?? 0;
      const mm = h.precipitation[start + i] ?? 0;
      if (prob >= 50 || mm >= 0.2) return i;
    }
    return null;
  } catch {
    return undefined;
  }
}

export { getThemeByCode };
