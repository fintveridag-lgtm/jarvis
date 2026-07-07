import { cached } from './cache.js';

// Ålesund, Norge
const LAT = 62.4722;
const LNG = 6.1495;

// WMO weather codes → norsk beskrivelse + ikon
const WEATHER_CODES = {
  0: ['Klarvær', '☀️'],
  1: ['Stort sett klart', '🌤️'],
  2: ['Delvis skyet', '⛅'],
  3: ['Overskyet', '☁️'],
  45: ['Tåke', '🌫️'],
  48: ['Rimtåke', '🌫️'],
  51: ['Lett yr', '🌦️'],
  53: ['Yr', '🌦️'],
  55: ['Kraftig yr', '🌧️'],
  61: ['Lett regn', '🌧️'],
  63: ['Regn', '🌧️'],
  65: ['Kraftig regn', '🌧️'],
  66: ['Underkjølt regn', '🌧️'],
  67: ['Kraftig underkjølt regn', '🌧️'],
  71: ['Lett snø', '🌨️'],
  73: ['Snø', '🌨️'],
  75: ['Kraftig snø', '❄️'],
  77: ['Snøkorn', '❄️'],
  80: ['Lette regnbyger', '🌦️'],
  81: ['Regnbyger', '🌧️'],
  82: ['Kraftige regnbyger', '⛈️'],
  85: ['Snøbyger', '🌨️'],
  86: ['Kraftige snøbyger', '❄️'],
  95: ['Tordenvær', '⛈️'],
  96: ['Torden med hagl', '⛈️'],
  99: ['Kraftig torden med hagl', '⛈️'],
};

function describe(code) {
  return WEATHER_CODES[code] || ['Ukjent', '🌡️'];
}

export async function getWeather() {
  return cached('weather-alesund', 10 * 60 * 1000, async () => {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', LAT);
    url.searchParams.set('longitude', LNG);
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation');
    url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability');
    url.searchParams.set('forecast_hours', '12');
    url.searchParams.set('timezone', 'Europe/Oslo');
    url.searchParams.set('wind_speed_unit', 'ms');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo svarte ${res.status}`);
    const raw = await res.json();

    const cur = raw.current;
    const [condition, icon] = describe(cur.weather_code);

    const hours = (raw.hourly?.time || []).map((time, i) => {
      const [c, ic] = describe(raw.hourly.weather_code[i]);
      return {
        time: time.slice(11, 16),
        temp: Math.round(raw.hourly.temperature_2m[i]),
        condition: c,
        icon: ic,
        precipProbability: raw.hourly.precipitation_probability?.[i] ?? null,
      };
    });

    return {
      place: 'Ålesund',
      temp: Math.round(cur.temperature_2m),
      feelsLike: Math.round(cur.apparent_temperature),
      condition,
      icon,
      windMs: Math.round(cur.wind_speed_10m),
      gustMs: Math.round(cur.wind_gusts_10m),
      precipitation: cur.precipitation,
      hours: hours.filter((_, i) => i % 3 === 0).slice(0, 4),
      updated: cur.time,
    };
  });
}
