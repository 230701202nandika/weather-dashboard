/**
 * Weather Dashboard Application Logic (ES6 JavaScript)
 * Interacts with Open-Meteo APIs and builds interactive Chart.js line charts.
 */

// ==========================================================================
// 1. CONSTANTS & WEATHER MAPPING CODE
// ==========================================================================

const WEATHER_CODES = {
  0: { text: "Clear Sky", emoji: "☀️", bgClass: "bg-sunny" },
  1: { text: "Mainly Clear", emoji: "🌤️", bgClass: "bg-sunny" },
  2: { text: "Partly Cloudy", emoji: "🌤️", bgClass: "bg-sunny" },
  3: { text: "Overcast", emoji: "☁️", bgClass: "bg-cloudy" },
  45: { text: "Fog", emoji: "🌫️", bgClass: "bg-cloudy" },
  48: { text: "Depositing Rime Fog", emoji: "🌫️", bgClass: "bg-cloudy" },
  51: { text: "Light Drizzle", emoji: "🌧️", bgClass: "bg-rainy" },
  53: { text: "Moderate Drizzle", emoji: "🌧️", bgClass: "bg-rainy" },
  55: { text: "Dense Drizzle", emoji: "🌧️", bgClass: "bg-rainy" },
  61: { text: "Slight Rain", emoji: "🌧️", bgClass: "bg-rainy" },
  63: { text: "Moderate Rain", emoji: "🌧️", bgClass: "bg-rainy" },
  65: { text: "Heavy Rain", emoji: "🌧️", bgClass: "bg-rainy" },
  71: { text: "Slight Snow", emoji: "❄️", bgClass: "bg-cloudy" },
  73: { text: "Moderate Snow", emoji: "❄️", bgClass: "bg-cloudy" },
  75: { text: "Heavy Snow", emoji: "❄️", bgClass: "bg-cloudy" },
  80: { text: "Rain Showers", emoji: "🌧️", bgClass: "bg-rainy" },
  81: { text: "Rain Showers", emoji: "🌧️", bgClass: "bg-rainy" },
  82: { text: "Rain Showers", emoji: "🌧️", bgClass: "bg-rainy" },
  95: { text: "Thunderstorm", emoji: "⛈️", bgClass: "bg-thunderstorm" },
  96: { text: "Thunderstorm with Hail", emoji: "⛈️", bgClass: "bg-thunderstorm" },
  99: { text: "Thunderstorm with Hail", emoji: "⛈️", bgClass: "bg-thunderstorm" }
};

const DEFAULT_CITY = "Chennai";

// ==========================================================================
// 2. STATE CONFIGURATION
// ==========================================================================

let state = {
  currentUnit: localStorage.getItem('weather_unit') || 'C',
  weatherData: null,
  cityInfo: {
    name: '',
    countryCode: ''
  },
  isLoading: false
};

let chartInstance = null;

// ==========================================================================
// 3. DOM ELEMENTS
// ==========================================================================

const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const geoBtn = document.getElementById('geo-btn');
const unitCBtn = document.getElementById('unit-c');
const unitFBtn = document.getElementById('unit-f');

const errorAlert = document.getElementById('error-alert');
const errorMessage = document.getElementById('error-message');
const closeErrorBtn = document.getElementById('close-error-btn');

const loadingState = document.getElementById('loading-state');
const weatherContent = document.getElementById('weather-content');

// Current weather elements
const elCityCountry = document.getElementById('current-city-country');
const elLocalTime = document.getElementById('current-local-time');
const elTemp = document.getElementById('current-temp');
const elTempUnitSymbol = document.getElementById('temp-unit-symbol');
const elWeatherIcon = document.getElementById('current-weather-icon');
const elConditionText = document.getElementById('current-condition-text');
const elFeelsLike = document.getElementById('current-feels-like');
const elHumidity = document.getElementById('current-humidity');
const elWindspeed = document.getElementById('current-windspeed');
const elVisibility = document.getElementById('current-visibility');

// Forecast & Chart elements
const forecastContainer = document.getElementById('forecast-container');
const hourlyChartCtx = document.getElementById('hourly-chart').getContext('2d');

// ==========================================================================
// 4. EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', initializeApp);

searchForm.addEventListener('submit', handleSearchSubmit);
geoBtn.addEventListener('click', handleGeolocationRequest);
unitCBtn.addEventListener('click', () => setTemperatureUnit('C'));
unitFBtn.addEventListener('click', () => setTemperatureUnit('F'));
closeErrorBtn.addEventListener('click', hideError);

// ==========================================================================
// 5. INITIALIZATION & STORAGE
// ==========================================================================

function initializeApp() {
  // Setup unit button visual active states
  updateUnitToggleUI();
  
  // Check localStorage for last searched city
  const savedCity = localStorage.getItem('last_searched_city');
  
  if (savedCity) {
    fetchWeatherByCity(savedCity);
  } else {
    // If no saved city, try Geolocation automatically, fallback to default city on fail
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoordinates(latitude, longitude);
      },
      (error) => {
        console.warn("Geolocation prompt skipped or rejected. Loading default city.");
        fetchWeatherByCity(DEFAULT_CITY);
      },
      { timeout: 5000 }
    );
  }
}

// ==========================================================================
// 6. API REQUESTS & BUSINESS LOGIC
// ==========================================================================

async function fetchWeatherByCity(cityName) {
  if (state.isLoading) return;
  setLoading(true);
  hideError();
  
  try {
    // 1. Call Geocoding API to resolve city to latitude/longitude
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geocodeUrl);
    
    if (!geoResponse.ok) {
      throw new Error("API_ERROR");
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      showError("City not found. Please try again.");
      setLoading(false);
      return;
    }
    
    const result = geoData.results[0];
    state.cityInfo = {
      name: result.name,
      countryCode: result.country_code || ''
    };
    
    // Save to local storage
    localStorage.setItem('last_searched_city', result.name);
    
    // 2. Fetch Weather details
    await fetchWeatherData(result.latitude, result.longitude);
    
  } catch (error) {
    console.error(error);
    showError("Something went wrong. Check your connection.");
  } finally {
    setLoading(false);
  }
}

async function fetchWeatherByCoordinates(latitude, longitude) {
  if (state.isLoading) return;
  setLoading(true);
  hideError();
  
  try {
    // 1. Call a free, keyless client-side reverse geocoding API to get City/Country Name
    const reverseGeocodeUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const geoResponse = await fetch(reverseGeocodeUrl);
    let cityName = "Current Location";
    let countryCode = "";
    
    if (geoResponse.ok) {
      const geoData = await geoResponse.json();
      cityName = geoData.city || geoData.locality || "Current Location";
      countryCode = geoData.countryCode || "";
    }
    
    state.cityInfo = {
      name: cityName,
      countryCode: countryCode
    };
    
    if (cityName !== "Current Location") {
      localStorage.setItem('last_searched_city', cityName);
    }
    
    // 2. Fetch Weather details
    await fetchWeatherData(latitude, longitude);
    
  } catch (error) {
    console.error(error);
    showError("Something went wrong. Check your connection.");
  } finally {
    setLoading(false);
  }
}

async function fetchWeatherData(lat, lon) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,weathercode,apparent_temperature,visibility,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
  
  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error("WEATHER_API_FAILURE");
  }
  
  const data = await response.json();
  state.weatherData = data;
  
  // Render details
  renderWeatherDashboard();
}

// ==========================================================================
// 7. RENDERING & VIEW MANIPULATION
// ==========================================================================

function renderWeatherDashboard() {
  if (!state.weatherData) return;
  
  const data = state.weatherData;
  const current = data.current_weather;
  
  // Find current hour index inside the hourly metrics
  const currentHourStr = current.time; // Format: "2026-06-11T08:00"
  const hourlyTimeIndex = data.hourly.time.indexOf(currentHourStr);
  const index = hourlyTimeIndex !== -1 ? hourlyTimeIndex : 0;
  
  // Dynamic Background and Theme updates based on weather code
  updateDynamicBackground(current.weathercode);
  
  // City and Country
  const countryDisplay = state.cityInfo.countryCode ? `, ${state.cityInfo.countryCode}` : '';
  elCityCountry.textContent = `${state.cityInfo.name}${countryDisplay}`;
  
  // Local time calculation using timezone offset
  const localDate = getLocalTime(data.utc_offset_seconds);
  const timeOptions = { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: true };
  elLocalTime.textContent = localDate.toLocaleDateString('en-US', timeOptions);
  
  // Current Temperature values
  elTemp.textContent = Math.round(convertTemp(current.temperature));
  elTempUnitSymbol.textContent = `°${state.currentUnit}`;
  
  // Feels Like Temperature
  const feelsLikeCelsius = data.hourly.apparent_temperature[index];
  const feelsLikeFormatted = Math.round(convertTemp(feelsLikeCelsius));
  elFeelsLike.textContent = `Feels like ${feelsLikeFormatted}°${state.currentUnit}`;
  
  // Weather Condition mapping
  const weatherMapping = WEATHER_CODES[current.weathercode] || { text: "Unknown", emoji: "❓" };
  elConditionText.textContent = weatherMapping.text;
  elWeatherIcon.textContent = weatherMapping.emoji;
  
  // Humidity, Wind Speed, Visibility (converting visibility to km)
  const humidity = data.hourly.relative_humidity_2m[index];
  elHumidity.textContent = `${humidity}%`;
  
  const windSpeed = current.windspeed;
  elWindspeed.textContent = `${windSpeed} km/h`;
  
  const visibilityMeters = data.hourly.visibility[index];
  const visibilityKm = (visibilityMeters / 1000).toFixed(0);
  elVisibility.textContent = `${visibilityKm} km`;
  
  // Render 5-Day Forecast
  renderForecast(data.daily);
  
  // Render Hourly Line Chart
  renderHourlyChart(data.hourly, index);
  
  // Reveal layout
  weatherContent.classList.remove('hidden');
}

function renderForecast(dailyData) {
  forecastContainer.innerHTML = '';
  
  // Render exactly 5 forecast cards starting from index 0
  for (let i = 0; i < 5; i++) {
    const dateStr = dailyData.time[i];
    const maxTemp = dailyData.temperature_2m_max[i];
    const minTemp = dailyData.temperature_2m_min[i];
    const code = dailyData.weathercode[i];
    
    // Parse Day Name (avoid timezone shift)
    const dateParts = dateStr.split('-');
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    
    const weatherInfo = WEATHER_CODES[code] || { emoji: "❓" };
    
    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <span class="forecast-day">${dayName}</span>
      <span class="forecast-icon" aria-hidden="true">${weatherInfo.emoji}</span>
      <div class="forecast-temp-range">
        <span class="forecast-temp-max">${Math.round(convertTemp(maxTemp))}°</span>
        <span class="forecast-temp-min">${Math.round(convertTemp(minTemp))}°</span>
      </div>
    `;
    forecastContainer.appendChild(card);
  }
}

function renderHourlyChart(hourlyData, startIndex) {
  // Prepare next 24 hours arrays
  const hours24 = hourlyData.time.slice(startIndex, startIndex + 24);
  const temps24Celsius = hourlyData.temperature_2m.slice(startIndex, startIndex + 24);
  
  // Convert times to legible labels (e.g. "8:00 AM")
  const labels = hours24.map(timeStr => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  });
  
  // Convert temperatures based on current unit
  const dataPoints = temps24Celsius.map(t => Math.round(convertTemp(t)));
  
  // Establish chart text/grid colors dynamically based on background theme variables
  const isDark = document.body.classList.contains('bg-rainy') || document.body.classList.contains('bg-thunderstorm');
  const tickColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
  const accentColor = isDark ? '#38bdf8' : '#0284c7';
  
  // Configure custom highlighting arrays (Highlight index 0 as Current Hour)
  const pointRadii = Array(24).fill(3.5);
  pointRadii[0] = 7; // Main current hour highlighted point
  
  const pointHoverRadii = Array(24).fill(5.5);
  pointHoverRadii[0] = 9;
  
  const pointBgColors = Array(24).fill(accentColor);
  pointBgColors[0] = '#ef4444'; // Red point highlight for current hour
  
  const pointBorderColors = Array(24).fill('#ffffff');
  pointBorderColors[0] = '#ffffff';

  const pointBorderWidths = Array(24).fill(1.5);
  pointBorderWidths[0] = 3.5;

  if (chartInstance) {
    chartInstance.destroy();
  }
  
  chartInstance = new Chart(hourlyChartCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `Temperature (°${state.currentUnit})`,
        data: dataPoints,
        borderColor: accentColor,
        borderWidth: 2.5,
        backgroundColor: 'rgba(2, 132, 199, 0.1)',
        fill: false, // Clean line appearance
        tension: 0.35, // Smooth curves
        pointRadius: pointRadii,
        pointHoverRadius: pointHoverRadii,
        pointBackgroundColor: pointBgColors,
        pointBorderColor: pointBorderColors,
        pointBorderWidth: pointBorderWidths
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Minimize chart clutter
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#ffffff' : '#1e293b',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              const suffix = context.dataIndex === 0 ? " (Current Hour)" : "";
              return `${val}°${state.currentUnit}${suffix}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false // Clean look without vertical grids
          },
          ticks: {
            color: tickColor,
            font: {
              family: 'Inter',
              size: 11
            },
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: tickColor,
            font: {
              family: 'Inter',
              size: 11
            },
            callback: function(value) {
              return value + '°';
            }
          }
        }
      }
    }
  });
}

// ==========================================================================
// 8. HELPERS & UTILITIES
// ==========================================================================

function handleSearchSubmit(event) {
  event.preventDefault();
  const query = cityInput.value.trim();
  if (query) {
    fetchWeatherByCity(query);
  }
}

function handleGeolocationRequest() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoordinates(latitude, longitude);
      },
      (error) => {
        console.error(error);
        showError("Geolocation access denied or unavailable.");
      }
    );
  } else {
    showError("Geolocation is not supported by your browser.");
  }
}

function updateDynamicBackground(weatherCode) {
  const mapping = WEATHER_CODES[weatherCode] || { bgClass: "bg-sunny" };
  const targetClass = mapping.bgClass;
  
  // Clear other background themes
  document.body.classList.remove('bg-sunny', 'bg-cloudy', 'bg-rainy', 'bg-thunderstorm');
  
  // Apply targeted background class
  document.body.classList.add(targetClass);
}

function getLocalTime(utcOffsetSeconds) {
  const utcDate = new Date();
  const utcTime = utcDate.getTime() + (utcDate.getTimezoneOffset() * 60000);
  const localTime = new Date(utcTime + (utcOffsetSeconds * 1000));
  return localTime;
}

function convertTemp(tempCelsius) {
  if (state.currentUnit === 'F') {
    return (tempCelsius * 9/5) + 32;
  }
  return tempCelsius;
}

function setTemperatureUnit(unit) {
  if (state.currentUnit === unit) return;
  
  state.currentUnit = unit;
  localStorage.setItem('weather_unit', unit);
  
  updateUnitToggleUI();
  
  // Re-render UI elements using the modified temperature scale
  if (state.weatherData) {
    renderWeatherDashboard();
  }
}

function updateUnitToggleUI() {
  if (state.currentUnit === 'C') {
    unitCBtn.classList.add('active');
    unitCBtn.setAttribute('aria-pressed', 'true');
    unitFBtn.classList.remove('active');
    unitFBtn.setAttribute('aria-pressed', 'false');
  } else {
    unitFBtn.classList.add('active');
    unitFBtn.setAttribute('aria-pressed', 'true');
    unitCBtn.classList.remove('active');
    unitCBtn.setAttribute('aria-pressed', 'false');
  }
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  
  // Disable / Enable Inputs and Buttons during loading transition
  cityInput.disabled = isLoading;
  searchBtn.disabled = isLoading;
  geoBtn.disabled = isLoading;
  
  if (isLoading) {
    loadingState.classList.remove('hidden');
    weatherContent.classList.add('hidden');
  } else {
    loadingState.classList.add('hidden');
  }
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorAlert.classList.remove('hidden');
  
  // Smooth scroll to alert on error occurrence
  errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  errorAlert.classList.add('hidden');
}
