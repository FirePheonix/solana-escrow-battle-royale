import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { usePlayersList, useMultiplayerState, isHost } from "playroomkit";
import { useEffect, useRef, useState } from "react";
import { getProgram, settleGame } from "../lib/solana";
import { StakeModal } from "./StakeModal";

// ─── Zone config (must mirror SafeZone.jsx) ──────────────────────────────────

const ZONE_PHASES = [
  { duration: 60, targetRadius: 1.0, shrinking: false },
  { duration: 30, targetRadius: 0.75, shrinking: true },
  { duration: 40, targetRadius: 0.75, shrinking: false },
  { duration: 20, targetRadius: 0.40, shrinking: true },
  { duration: 40, targetRadius: 0.40, shrinking: false },
  { duration: 30, targetRadius: 0.0, shrinking: true },
];
const INITIAL_RADIUS = 50;

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export const Leaderboard = () => {
  const players = usePlayersList(true);
  const { connection } = useConnection();
  const { publicKey, wallet } = useWallet();

  // Stake info — shared by all players via PlayroomKit
  const [stakeInfo, setStakeInfo] = useMultiplayerState("stakeInfo", {
    creatorWallet: "",
    stakeSOL: 0,
    ready: false,
  });

  const [networkZoneState] = useMultiplayerState("zoneState", {
    phase: 0,
    radius: INITIAL_RADIUS,
    phaseStartTime: Date.now(),
  });

  // winner = display name; winnerWallet = pubkey string for on-chain settlement
  const [winner,       setWinner]       = useMultiplayerState("winner",       "");
  const [winnerWallet, setWinnerWallet] = useMultiplayerState("winnerWallet", "");

  const [timeLeft,  setTimeLeft]  = useState(0);
  const [showStake, setShowStake] = useState(true);
  const [settleTx,  setSettleTx]  = useState(null);
  const hasSettled       = useRef(false);
  const hasCheckedWinner = useRef(false);

  const gameStarted =
    players.length > 0 && players[0]?.state?.health !== undefined;

  // ── Zone countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted) return;
    const id = setInterval(() => {
      const phase = ZONE_PHASES[networkZoneState.phase];
      if (!phase) { setTimeLeft(0); return; }
      const elapsed = (Date.now() - networkZoneState.phaseStartTime) / 1000;
      setTimeLeft(Math.ceil(Math.max(0, phase.duration - elapsed)));
    }, 100);
    return () => clearInterval(id);
  }, [networkZoneState, gameStarted]);

  // ── Winner detection — last player standing ─────────────────────────────────
  useEffect(() => {
    if (!gameStarted || winner || hasCheckedWinner.current) return;
    if (players.length < 2) return;

    const alive = players.filter(
      (p) => p.state?.health > 0 && !p.state?.dead
    );

    if (alive.length === 1) {
      hasCheckedWinner.current = true;
      if (isHost()) {
        const w = alive[0];
        setWinner(w.state?.profile?.name || "Player");
        setWinnerWallet(w.state?.wallet || "");
      }
    }
  }, [players, gameStarted, winner]);

  // ── On-chain settlement (host only, fires once when winner is set) ──────────
  useEffect(() => {
    if (!winner || hasSettled.current) return;
    if (!isHost()) return;
    if (!publicKey || !wallet) return;
    if (!stakeInfo.creatorWallet || stakeInfo.stakeSOL <= 0) return;
    if (!winnerWallet) return;

    hasSettled.current = true;

    const program = getProgram(wallet.adapter, connection);
    settleGame(program, stakeInfo.creatorWallet, winnerWallet)
      .then((tx) => {
        console.log("[stake] Settlement tx:", tx);
        setSettleTx(tx);
      })
      .catch((e) => console.error("[stake] Settlement failed:", e));
  }, [winner, winnerWallet]);

  // ── Stake modal handling ────────────────────────────────────────────────────
  const handleStakeReady = ({ creatorWallet, stakeSOL }) => {
    if (isHost()) {
      setStakeInfo({ creatorWallet, stakeSOL, ready: true });
    }
    setShowStake(false);
  };

  // Store wallet pubkey in PlayroomKit so the host can pay us out
  useEffect(() => {
    if (!publicKey || !gameStarted) return;
    import("playroomkit").then(({ myPlayer }) => {
      const me = myPlayer();
      if (me) me.setState("wallet", publicKey.toString());
    });
  }, [publicKey, gameStarted]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const phase        = ZONE_PHASES[networkZoneState.phase];
  const phaseName    = phase?.shrinking ? "ZONE SHRINKING!" : "Safe Phase";
  const zonePercent  = Math.round((networkZoneState.radius / INITIAL_RADIUS) * 100);
  const alivePlayers = players.filter((p) => p.state?.health > 0 && !p.state?.dead);
  const potSOL       = stakeInfo.stakeSOL > 0
    ? (stakeInfo.stakeSOL * players.length).toFixed(3)
    : null;

  // Sort by kills desc
  const sorted = [...players].sort(
    (a, b) => (b.state?.kills ?? 0) - (a.state?.kills ?? 0)
  );

  return (
    <>
      {/* ── Stake Modal ── */}
      {showStake && gameStarted && (
        <StakeModal
          isHost={isHost()}
          creatorWallet={stakeInfo.creatorWallet}
          stakeSOL={stakeInfo.stakeSOL}
          onReady={handleStakeReady}
          onSetStake={(sol) =>
            setStakeInfo({ ...stakeInfo, stakeSOL: sol })
          }
        />
      )}

      {/* ── Player list (top-left) ── */}
      <div
        className="fixed top-2 left-2 z-10 flex flex-col gap-1"
        style={{ fontFamily: "Arial, sans-serif", pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{
          background: "rgba(10,10,20,0.88)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "8px",
          padding: "6px 8px",
          minWidth: "170px",
        }}>
          <div style={{ color: "#aaa", fontWeight: "bold", fontSize: "10px", letterSpacing: "1px", marginBottom: "6px" }}>
            PLAYERS
          </div>
          {sorted.map((player) => {
            const health = player.state?.health ?? 0;
            const dead   = player.state?.dead   ?? false;
            const kills  = player.state?.kills  ?? 0;
            const deaths = player.state?.deaths ?? 0;
            const color  = player.state?.profile?.color || "#888";
            return (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "5px",
                  opacity: dead ? 0.4 : 1,
                }}
              >
                <div style={{
                  width: "26px", height: "26px",
                  borderRadius: "50%",
                  border: `2px solid ${dead ? "#555" : color}`,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#333",
                }}>
                  {player.state?.profile?.photo ? (
                    <img src={player.state.profile.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: color }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "white", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {player.state?.profile?.name || "Player"}
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: "3px", height: "4px", marginTop: "2px" }}>
                    <div style={{
                      width: `${health}%`,
                      height: "100%",
                      borderRadius: "3px",
                      transition: "width 0.15s",
                      background: health > 50 ? "#44ff66" : health > 25 ? "#ffcc00" : "#ff4444",
                    }} />
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "10px", marginTop: "1px" }}>
                    🔫 {kills}  💀 {deaths}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pot display */}
        {potSOL && (
          <div style={{
            background: "rgba(20,20,20,0.88)",
            border: "1px solid #ffcc44",
            borderRadius: "6px",
            padding: "5px 10px",
            color: "#ffcc44",
            fontSize: "12px",
            fontWeight: "bold",
          }}>
            💰 Pot: {potSOL} SOL
          </div>
        )}
      </div>

      {/* ── Zone timer ── */}
      {gameStarted && (
        <div className="fixed z-10 flex flex-col gap-2" style={{ top: "8px", left: "200px", pointerEvents: "none" }}>
          <div
            className="backdrop-blur-sm rounded-lg p-3 min-w-[130px] border-2"
            style={{
              background: phase?.shrinking ? "rgba(180,30,30,0.9)" : "rgba(10,10,20,0.88)",
              borderColor: phase?.shrinking ? "#ff6666" : "#4488ff",
            }}
          >
            <div className="text-white text-xs opacity-80">{phaseName}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white text-2xl font-bold">{timeLeft}s</span>
              <span className="text-white text-xs opacity-70">Zone {zonePercent}%</span>
            </div>
          </div>
          <div className="bg-black bg-opacity-80 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm">
            👤 {alivePlayers.length} / {players.length} Alive
          </div>
        </div>
      )}

      {/* ── Winner Banner ── */}
      {winner && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div
            className="rounded-2xl p-10 text-center border-4 shadow-2xl"
            style={{
              background: "rgba(0,0,0,0.93)",
              borderColor: "#ffcc44",
              boxShadow: "0 0 60px rgba(255,200,50,0.5)",
            }}
          >
            <div className="text-2xl text-white mb-2">🏆 WINNER 🏆</div>
            <div className="text-5xl font-bold mb-3" style={{ color: "#ffcc44" }}>
              {winner}
            </div>
            {potSOL && (
              <div style={{ color: "#44ff88", fontSize: "20px", fontWeight: "bold" }}>
                💰 +{potSOL} SOL
              </div>
            )}
            {settleTx && (
              <div style={{ marginTop: "10px", fontSize: "11px", color: "#aaa" }}>
                Settlement tx:{" "}
                <a
                  href={`https://explorer.solana.com/tx/${settleTx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#88aaff", pointerEvents: "all" }}
                >
                  {settleTx.slice(0, 12)}…
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fullscreen toggle ── */}
      <button
        className="fixed top-4 right-4 z-10 text-white"
        onClick={() => {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      </button>
    </>
  );
};
