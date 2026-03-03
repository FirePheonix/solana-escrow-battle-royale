import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useRef, useState } from "react";
import { fromLamports, getBalance, getProgram, initializeRoom, joinRoom } from "../lib/solana";
import { WalletConnect } from "./WalletConnect";

/**
 * StakeModal
 *
 * Props:
 *   isHost           boolean  — is this player the PlayroomKit host?
 *   creatorWallet    string   — host's wallet pubkey (shared via PlayroomKit state)
 *   stakeSOL         number   — resolved stake amount (0 until host sets it)
 *   onReady(info)    callback — called when stake is confirmed; info = { creatorWallet, stakeSOL }
 *   onSetStake(sol)  callback — host uses this to broadcast stake amount
 */
export const StakeModal = ({ isHost, creatorWallet, stakeSOL, onReady, onSetStake }) => {
  const { connection } = useConnection();
  const { publicKey, wallet } = useWallet();

  const [inputSOL, setInputSOL] = useState("0.05");
  const [balance, setBalance] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | pending | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const txDone = useRef(false);

  // Fetch balance whenever wallet changes
  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    getBalance(connection, publicKey).then(setBalance);
  }, [publicKey]);

  const handleCreate = async () => {
    if (!publicKey || !wallet) return;
    const sol = parseFloat(inputSOL);
    if (isNaN(sol) || sol <= 0) { setErrorMsg("Enter a valid SOL amount."); return; }

    setStatus("pending");
    setErrorMsg("");
    try {
      const program = getProgram(wallet.adapter, connection);
      await initializeRoom(program, publicKey, sol);
      onSetStake(sol); // broadcast to other players via PlayroomKit
      txDone.current = true;
      setStatus("done");
      onReady({ creatorWallet: publicKey.toString(), stakeSOL: sol });
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Transaction failed.");
      setStatus("error");
    }
  };

  const handleJoin = async () => {
    if (!publicKey || !wallet || !creatorWallet) return;

    setStatus("pending");
    setErrorMsg("");
    try {
      const program = getProgram(wallet.adapter, connection);
      await joinRoom(program, publicKey, creatorWallet);
      txDone.current = true;
      setStatus("done");
      onReady({ creatorWallet, stakeSOL });
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Transaction failed.");
      setStatus("error");
    }
  };

  const connected = !!publicKey;
  const potSOL = stakeSOL ? (stakeSOL * 4).toFixed(3) : "?";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "#1a1a2e",
          border: "2px solid #4488ff",
          borderRadius: "16px",
          padding: "36px 48px",
          minWidth: "340px",
          color: "white",
          textAlign: "center",
          boxShadow: "0 0 40px rgba(68,136,255,0.3)",
        }}
      >
        {/* Title */}
        <div style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "6px" }}>
          FFA Shooter — Stake &amp; Play
        </div>
        <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "24px" }}>
          Solana Devnet · Winner takes all
        </div>

        {/* Wallet Connect */}
        <div style={{ marginBottom: "20px" }}>
          <WalletConnect />
        </div>

        {connected && balance !== null && (
          <div style={{ fontSize: "12px", color: "#88aaff", marginBottom: "16px" }}>
            Balance: {balance.toFixed(4)} SOL
          </div>
        )}

        {/* HOST: set stake */}
        {isHost && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", color: "#ccc", display: "block", marginBottom: "6px" }}>
                Stake per player (SOL)
              </label>
              <input
                type="number"
                min="0.001"
                step="0.01"
                value={inputSOL}
                onChange={(e) => setInputSOL(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #4488ff",
                  background: "#0d0d1a",
                  color: "white",
                  fontSize: "16px",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "20px" }}>
              Total pot (4 players): {(parseFloat(inputSOL) * 4 || 0).toFixed(3)} SOL
            </div>
            <button
              onClick={handleCreate}
              disabled={!connected || status === "pending" || status === "done"}
              style={{
                width: "100%",
                padding: "12px",
                background: status === "done" ? "#228833" : "#4488ff",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: connected && status === "idle" ? "pointer" : "not-allowed",
                opacity: status === "pending" ? 0.7 : 1,
              }}
            >
              {status === "pending" ? "Confirming..." : status === "done" ? "✓ Room Created!" : "Create Room & Stake"}
            </button>
          </>
        )}

        {/* JOINER: join existing room */}
        {!isHost && (
          <>
            {stakeSOL ? (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "13px", color: "#ccc", marginBottom: "4px" }}>
                    Entry stake
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: "#4488ff" }}>
                    {stakeSOL} SOL
                  </div>
                  <div style={{ fontSize: "12px", color: "#aaa", marginTop: "4px" }}>
                    Max pot (4 players): {potSOL} SOL
                  </div>
                </div>
                <button
                  onClick={handleJoin}
                  disabled={!connected || !creatorWallet || status === "pending" || status === "done"}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: status === "done" ? "#228833" : "#4488ff",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: "bold",
                    cursor: connected && status === "idle" ? "pointer" : "not-allowed",
                    opacity: status === "pending" ? 0.7 : 1,
                  }}
                >
                  {status === "pending" ? "Confirming..." : status === "done" ? "✓ Staked!" : "Join & Stake"}
                </button>
              </>
            ) : (
              <div style={{ color: "#aaa", fontSize: "14px" }}>
                Waiting for room creator to set the stake…
              </div>
            )}
          </>
        )}

        {errorMsg && (
          <div style={{ marginTop: "12px", color: "#ff6666", fontSize: "12px" }}>
            {errorMsg}
          </div>
        )}

        {status === "done" && (
          <div style={{ marginTop: "16px", color: "#66ff88", fontSize: "13px" }}>
            Starting game…
          </div>
        )}
      </div>
    </div>
  );
};
