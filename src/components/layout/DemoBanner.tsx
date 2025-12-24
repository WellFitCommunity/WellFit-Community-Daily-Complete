// src/components/layout/DemoBanner.tsx
import { useDemoMode } from "../../contexts/DemoModeContext";

export default function DemoBanner() {
  const ctx = useDemoMode();

  // Safety: if provider missing or demo disabled
  if (!ctx || !ctx.demoMode) return null;

  const { demoTimeLeft, endDemo } = ctx;
  const min = Math.floor(demoTimeLeft / 60);
  const sec = demoTimeLeft % 60;

  return (
    <div
      className="bg-yellow-300 text-black p-2 text-center font-bold shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <span>
        DEMO MODE – {min}:{sec.toString().padStart(2, "0")} left
      </span>
      <button
        onClick={endDemo}
        className="ml-4 px-3 py-1 bg-black text-yellow-200 rounded-sm hover:bg-gray-800 focus:outline-hidden focus:ring-2 focus:ring-yellow-500"
      >
        End Demo
      </button>
    </div>
  );
}
