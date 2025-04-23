import React, { useState, useEffect } from 'react';

const API_KEY = '86915dbfdb094fa3bd7120106251304';

interface WeatherData {
  temp_c: number;
  condition: string;
  location: string;
}

const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState(localStorage.getItem('wf_city') || '');
  const [useManual, setUseManual] = useState<boolean>(!!localStorage.getItem('wf_city'));

  useEffect(() => {
    if (useManual && city) {
      fetchWeather(city);
      return;
    }
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        fetchWeather(`${latitude},${longitude}`);
      },
      () => {
        setError('Geolocation denied');
      }
    );
  }, [useManual, city]);

  const fetchWeather = (q: string) => {
    fetch(`https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${q}&aqi=no`)
      .then(res => res.json())
      .then(data => {
        setWeather({
          temp_c: data.current.temp_c,
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

  return (
    <section className="bg-white border-2 border-wellfit-green p-4 rounded-xl shadow-md max-w-sm mx-auto">
      <h2 className="text-xl font-semibold text-wellfit-blue mb-2">Current Weather</h2>

      {error && !useManual && (
        <div className="space-y-2">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => setUseManual(true)}
            className="py-2 px-4 bg-wellfit-blue text-white rounded"
          >
            Enter city manually
          </button>
        </div>
      )}

      {useManual && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="City name or ZIP"
            value={city}
            onChange={e => setCity(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleManual}
            className="py-2 px-4 bg-wellfit-blue text-white rounded"
          >
            Get Weather
          </button>
        </div>
      )}

      {!error && !useManual && !weather && <p>Loading…</p>}

      {weather && (
        <p className="text-gray-700">
          {weather.location}: {weather.temp_c}°C, {weather.condition}
        </p>
      )}
    </section>
  );
};

export default WeatherWidget;
