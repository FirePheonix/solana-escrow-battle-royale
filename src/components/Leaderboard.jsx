import { usePlayersList, useMultiplayerState } from "playroomkit";
import { useEffect, useState } from "react";

// Safe zone phases configuration (must match SafeZone.jsx)
const ZONE_PHASES = [
  { duration: 60, targetRadius: 1.0, shrinking: false },
  { duration: 30, targetRadius: 0.75, shrinking: true },
  { duration: 40, targetRadius: 0.75, shrinking: false },
  { duration: 20, targetRadius: 0.40, shrinking: true },
  { duration: 40, targetRadius: 0.40, shrinking: false },
  { duration: 30, targetRadius: 0.0, shrinking: true },
];
const INITIAL_RADIUS = 50;

export const Leaderboard = () => {
  const players = usePlayersList(true);
  const [networkZoneState] = useMultiplayerState("zoneState", {
    phase: 0,
    radius: INITIAL_RADIUS,
    phaseStartTime: Date.now(),
  });
  const [winner] = useMultiplayerState("winner", "");
  const [timeLeft, setTimeLeft] = useState(0);

  // Check if game has actually started (players have health set)
  const gameStarted = players.length > 0 && players[0]?.state?.health !== undefined;

  // Calculate time left in current phase
  useEffect(() => {
    if (!gameStarted) return;
    
    const interval = setInterval(() => {
      const phase = ZONE_PHASES[networkZoneState.phase];
      if (!phase) {
        setTimeLeft(0);
        return;
      }
      
      const elapsed = (Date.now() - networkZoneState.phaseStartTime) / 1000;
      const remaining = Math.max(0, phase.duration - elapsed);
      setTimeLeft(Math.ceil(remaining));
    }, 100);

    return () => clearInterval(interval);
  }, [networkZoneState, gameStarted]);

  const phase = ZONE_PHASES[networkZoneState.phase];
  const phaseName = phase?.shrinking ? "ZONE SHRINKING!" : "Safe Phase";
  const zonePercent = Math.round((networkZoneState.radius / INITIAL_RADIUS) * 100);
  const alivePlayers = players.filter(p => p.state?.health > 0 && !p.state?.dead);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 p-4 flex z-10 gap-4 flex-wrap">
        {players.map((player) => (
          <div
            key={player.id}
            className={`bg-white bg-opacity-60 backdrop-blur-sm flex items-center rounded-lg gap-2 p-2 min-w-[140px] ${player.state?.dead ? 'opacity-50' : ''}`}
          >
            <img
              src={player.state.profile?.photo || ""}
              className="w-10 h-10 border-2 rounded-full"
              style={{
                borderColor: player.state.profile?.color,
              }}
            />
            <div className="flex-grow">
              <h2 className={`font-bold text-sm`}>
                {player.state.profile?.name}
              </h2>
              <div className="flex text-sm items-center gap-4">
                <p>🔫 {player.state.kills}</p>
                <p>💀 {player.state.deaths}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Zone Timer - below player list */}
      {gameStarted && (
        <div className="fixed top-20 left-4 z-10 flex flex-col gap-2">
          <div 
            className={`${phase?.shrinking ? 'bg-red-600' : 'bg-black'} bg-opacity-80 backdrop-blur-sm rounded-lg p-3 min-w-[140px] border-2 ${phase?.shrinking ? 'border-red-400' : 'border-blue-400'}`}
          >
            <div className="text-white text-xs opacity-80">{phaseName}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white text-2xl font-bold">{timeLeft}s</span>
              <span className="text-white text-xs opacity-70">Zone: {zonePercent}%</span>
            </div>
          </div>
          <div className="bg-black bg-opacity-80 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm">
            👤 {alivePlayers.length} / {players.length} Alive
          </div>
        </div>
      )}

      {/* Winner Announcement */}
      {winner && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-black bg-opacity-90 rounded-2xl p-10 text-center border-4 border-yellow-400 shadow-2xl">
            <div className="text-2xl text-white mb-2">🏆 WINNER 🏆</div>
            <div className="text-4xl font-bold text-yellow-400">{winner}</div>
            <div className="text-white mt-2 opacity-80">Victory Royale!</div>
          </div>
        </div>
      )}

      <button
        className="fixed top-4 right-4 z-10 text-white"
        onClick={() => {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
          />
        </svg>
      </button>
    </>
  );
};
