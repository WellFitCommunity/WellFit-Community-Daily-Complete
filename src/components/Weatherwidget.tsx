// File: src/components/WeatherWidget.tsx
import React, { useState, useEffect } from 'react';

const API_KEY = '86915dbfdb094fa3bd7120106251304';

const WeatherWidget = () => {
  const [weather, setWeather] = useState<{ temp_c: number; condition: string; location: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        fetch(`https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${latitude},${longitude}&aqi=no`)
          .then(res => res.json())
          .then(data => {
            setWeather({
              temp_c: data.current.temp_c,
              condition: data.current.condition.text,
              location: data.location.name
            });
          })
          .catch(() => setError('Failed to fetch weather'));
      },
      () => setError('Permission denied for geolocation')
    );
  }, []);

  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Current Weather</h2>
      {error && <p className="text-red-500">{error}</p>}
      {weather
        ? <p className="text-gray-700">{weather.location}: {weather.temp_c}°C, {weather.condition}</p>
        : !error && <p className="text-gray-700">Loading…</p>
      }
    </section>
  );
};

export default WeatherWidget;
