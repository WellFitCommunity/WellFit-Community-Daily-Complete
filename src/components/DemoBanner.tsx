import { useDemoMode } from "../contexts/DemoModeContext";

export default function DemoBanner() {
  const { demoMode, demoTimeLeft, endDemo } = useDemoMode();
  if (!demoMode) return null;

  const min = Math.floor(demoTimeLeft / 60);
  const sec = demoTimeLeft % 60;

  return (
    <div className="bg-yellow-300 text-black p-2 text-center font-bold shadow">
      <span>
        DEMO MODE – {min}:{sec.toString().padStart(2, "0")} left
      </span>
      <button
        onClick={endDemo}
        className="ml-4 px-3 py-1 bg-black text-yellow-200 rounded"
      >
        End Demo
      </button>
    </div>
  );
}
