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

export { getThemeByCode };
