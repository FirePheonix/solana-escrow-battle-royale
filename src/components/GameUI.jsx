import { Html } from "@react-three/drei";
import { isHost, useMultiplayerState } from "playroomkit";
import { useEffect, useState, useRef } from "react";
import { ZONE_PHASES_CONFIG, INITIAL_ZONE_RADIUS } from "./SafeZone";

export const GameUI = ({ players, gameStarted }) => {
  const [networkZoneState] = useMultiplayerState("zoneState", {
    phase: 0,
    radius: INITIAL_ZONE_RADIUS,
    phaseStartTime: Date.now(),
  });
  
  const [winner, setWinner] = useMultiplayerState("winner", "");
  const [timeLeft, setTimeLeft] = useState(0);
  const hasCheckedWinner = useRef(false);

  // Calculate time left in current phase
  useEffect(() => {
    if (!gameStarted) return;
    
    const interval = setInterval(() => {
      const phase = ZONE_PHASES_CONFIG[networkZoneState.phase];
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

  // Check for winner (only 1 alive player) - only on host
  useEffect(() => {
    if (!gameStarted || !isHost() || hasCheckedWinner.current) return;
    
    const alivePlayers = players.filter(p => p.state.state.health > 0 && !p.state.state.dead);
    
    if (players.length > 1 && alivePlayers.length === 1) {
      hasCheckedWinner.current = true;
      const winnerName = alivePlayers[0].state.state.profile?.name || "Unknown";
      setWinner(winnerName);
    }
  }, [players, gameStarted]);

  // Don't render anything until game starts
  if (!gameStarted || players.length === 0) {
    return null;
  }

  const alivePlayers = players.filter(p => p.state.state.health > 0 && !p.state.state.dead);
  const phase = ZONE_PHASES_CONFIG[networkZoneState.phase];
  const phaseName = phase?.shrinking ? "ZONE SHRINKING!" : "Safe Phase";
  const zonePercent = Math.round((networkZoneState.radius / INITIAL_ZONE_RADIUS) * 100);

  return (
    <Html fullscreen>
      {/* Zone Status - positioned top-left below player list */}
      <div style={{
        position: "absolute",
        top: "80px",
        left: "10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "8px",
        fontFamily: "Arial, sans-serif",
        pointerEvents: "none",
        userSelect: "none",
      }}>
        {/* Zone Timer */}
        <div style={{
          background: phase?.shrinking ? "rgba(255, 50, 50, 0.9)" : "rgba(0, 0, 0, 0.75)",
          padding: "10px 16px",
          borderRadius: "8px",
          color: "white",
          textAlign: "left",
          border: phase?.shrinking ? "2px solid #ff6666" : "2px solid #4488ff",
          minWidth: "120px",
        }}>
          <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "2px" }}>{phaseName}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>{timeLeft}s</span>
            <span style={{ fontSize: "11px", opacity: 0.7 }}>Zone: {zonePercent}%</span>
          </div>
        </div>

        {/* Alive Players Count */}
        <div style={{
          background: "rgba(0, 0, 0, 0.75)",
          padding: "8px 12px",
          borderRadius: "6px",
          color: "white",
          fontSize: "13px",
        }}>
          👤 {alivePlayers.length} / {players.length} Alive
        </div>
      </div>

      {/* Winner Announcement */}
      {winner && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0, 0, 0, 0.9)",
          padding: "40px 60px",
          borderRadius: "16px",
          color: "white",
          textAlign: "center",
          border: "3px solid gold",
          boxShadow: "0 0 30px rgba(255, 215, 0, 0.5)",
        }}>
          <div style={{ fontSize: "24px", marginBottom: "10px" }}>🏆 WINNER 🏆</div>
          <div style={{ fontSize: "36px", fontWeight: "bold", color: "gold" }}>{winner}</div>
          <div style={{ fontSize: "16px", marginTop: "10px", opacity: 0.8 }}>Victory Royale!</div>
        </div>
      )}
    </Html>
  );
};
