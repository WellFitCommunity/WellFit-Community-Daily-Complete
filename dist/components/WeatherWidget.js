"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/WeatherWidget.tsx
const react_1 = __importStar(require("react"));
const API_KEY = '86915dbfdb094fa3bd7120106251304';
const WeatherWidget = () => {
    const [weather, setWeather] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    const [city, setCity] = (0, react_1.useState)(localStorage.getItem('wf_city') || '');
    const [useManual, setUseManual] = (0, react_1.useState)(!!localStorage.getItem('wf_city'));
    (0, react_1.useEffect)(() => {
        if (useManual && city) {
            fetchWeather(city);
            return;
        }
        if (!navigator.geolocation) {
            setError('Geolocation not supported');
            return;
        }
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            fetchWeather(`${latitude},${longitude}`);
        }, () => {
            setError('Geolocation denied');
        });
    }, [useManual, city]);
    const fetchWeather = (q) => {
        fetch(`https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${q}&aqi=no`)
            .then(res => res.json())
            .then(data => {
            setWeather({
                temp_f: data.current.temp_f,
                condition: data.current.condition.text,
                location: data.location.name,
            });
            setError(null);
        })
            .catch(() => setError('Failed to fetch weather'));
    };
    const handleManual = () => {
        if (city.trim()) {
            localStorage.setItem('wf_city', city.trim());
            setUseManual(true);
            fetchWeather(city.trim());
        }
    };
    return (<section className="bg-white border-2 border-wellfitGreen p-4 rounded-xl shadow-md w-full max-w-sm text-sm text-[#003865]">
      <h2 className="text-lg font-semibold text-wellfitBlue mb-2">Current Weather</h2>

      {error && !useManual && (<div className="space-y-2">
          <p className="text-red-500">{error}</p>
          <button onClick={() => setUseManual(true)} className="py-2 px-4 bg-wellfitBlue text-white rounded">
            Enter city manually
          </button>
        </div>)}

      {useManual && (<div className="space-y-2">
          <input type="text" placeholder="City name or ZIP" value={city} onChange={e => setCity(e.target.value)} className="w-full p-2 border border-wellfitGreen rounded"/>
          <button onClick={handleManual} className="py-2 px-4 bg-wellfitGreen text-white rounded hover:bg-wellfitBlue">
            Get Weather
          </button>
        </div>)}

      {!error && !useManual && !weather && <p>Loading weather…</p>}

      {weather && (<p>
          {weather.location}: {Math.round(weather.temp_f)}°F, {weather.condition}
        </p>)}
    </section>);
};
exports.default = WeatherWidget;
