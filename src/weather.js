import { fahrenheit } from "./units.js";
export function weatherLabel(code, isDay = true) {
  if (code === 0) return isDay ? "Clear" : "Clear night";
  if ([1,2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45,48].includes(code)) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || [85,86].includes(code)) return "Snow";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Conditions";
}

export function arrivalTime(departure, minutes) {
  return new Date(departure.getTime() + minutes * 60000);
}

export function forecastAt(hourly, departure) {
  const time = departure.getTime() / 1000;
  const index = hourly?.time?.findIndex(t => time >= t && time < t + 3600) ?? -1;
  if (index < 0) return null;
  const result = {time:hourly.time[index]};
  for (const key of ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "weather_code", "is_day"]) {
    const value = hourly[key]?.[index];
    if (!Number.isFinite(value)) return null;
    result[key] = value;
  }
  return result;
}

export function mountWeather(map, root, getDeparture = () => new Date()) {
  const toggle = root.querySelector(".weather-toggle");
  const panel = root.querySelector(".weather-panel");
  const summary = root.querySelector(".weather-summary");
  const details = root.querySelector(".weather-details");
  const symbol = root.querySelector(".weather-symbol");
  let controller, timer, revision = 0;
  const cache = new Map();
  async function refresh() {
    const version = ++revision;
    controller?.abort();
    controller = new AbortController();
    const activeController = controller;
    const center = map.getCenter();
    const key = `${center.lat.toFixed(2)},${center.lng.toFixed(2)}`;
    summary.textContent = "Loading…";
    symbol.textContent = "◌";
    details.textContent = "Checking weather for your selected departure…";
    const timeout = setTimeout(()=>activeController.abort(),12000);
    try {
      let result = cache.get(key);
      if (!result || Date.now()-result.fetched > 600000) {
        const params = new URLSearchParams({latitude:center.lat, longitude:center.lng, hourly:"temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day", forecast_days:16, past_days:1, timeformat:"unixtime"});
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {signal:activeController.signal});
        if (!response.ok) throw Error("Weather unavailable");
        const body = await response.json();
        if (!Array.isArray(body.hourly?.time)) throw Error("Incomplete forecast");
        result = {hourly:body.hourly, fetched:Date.now()};
        if (cache.size >= 30) cache.clear();
        cache.set(key,result);
      }
      if (version !== revision) return;
      const departure = getDeparture();
      const w = forecastAt(result.hourly, departure);
      if (!w) {
        symbol.textContent = "☁";
        summary.textContent = "No forecast";
        details.textContent = "Forecast unavailable for this date. Choose a time within the next 15 days.";
        return;
      }
      const label = weatherLabel(w.weather_code,w.is_day === 1);
      symbol.textContent = w.weather_code === 0 ? (w.is_day ? "☀" : "☾") : w.weather_code >= 95 ? "⛈" : w.weather_code >= 51 && w.weather_code <= 82 ? "☂" : "☁";
      summary.replaceChildren();
      const temperature = document.createElement("strong");
      temperature.textContent = `${Math.round(fahrenheit(w.temperature_2m))}°F`;
      const condition = document.createElement("span");
      condition.textContent = label;
      summary.append(temperature,condition);
      details.textContent = `${label} · ${Math.round(fahrenheit(w.temperature_2m))}°F · Feels like ${Math.round(fahrenheit(w.apparent_temperature))}°F. Humidity ${Math.round(w.relative_humidity_2m)}%. Forecast for ${departure.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} (your local time; hourly forecast).`;
    } catch {
      if (version !== revision) return;
      symbol.textContent = "☁";
      summary.textContent = "Weather";
      details.textContent = "Weather is unavailable right now. Tap Refresh to try again.";
    } finally { clearTimeout(timeout); }
  }
  toggle.onclick = () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) refresh();
  };
  root.querySelector(".weather-refresh").onclick = refresh;
  root.addEventListener("keydown", e => { if (e.key === "Escape") { panel.hidden = true; toggle.setAttribute("aria-expanded","false"); toggle.focus(); } });
  map.on("movestart",()=>{ ++revision; controller?.abort(); summary.textContent="Weather"; symbol.textContent="☁"; details.textContent="Move the map to check another location."; });
  map.on("moveend",()=>{clearTimeout(timer); timer=setTimeout(refresh,600);});
  document.addEventListener("departure-change", () => {
    clearTimeout(timer);
    ++revision;
    controller?.abort();
    summary.textContent = "Updating…";
    details.textContent = "Updating forecast for your selected departure…";
    timer = setTimeout(refresh, 180);
  });
  refresh();
}
