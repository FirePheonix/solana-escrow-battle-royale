import { Environment } from "@react-three/drei";
import {
  Joystick,
  insertCoin,
  isHost,
  myPlayer,
  onPlayerJoin,
  useMultiplayerState,
} from "playroomkit";
import { useEffect, useState } from "react";
import { Bullet } from "./Bullet";
import { BulletHit } from "./BulletHit";
import { CharacterController } from "./CharacterController";
import { Map } from "./Map";
import { SafeZone } from "./SafeZone";

export const Experience = ({ downgradedPerformance = false }) => {
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);

  const start = async () => {
    await insertCoin();
    setGameStarted(true);

    let joinCount = 0;

    onPlayerJoin((state) => {
      const playerIndex = joinCount++;

      const joystick = new Joystick(state, {
        type: "angular",
        buttons: [
          { id: "fire", label: "Fire" },
          { id: "jump", label: "Jump" },
        ],
      });

      const newPlayer = { state, joystick, playerIndex };
      state.setState("health", 100);
      state.setState("deaths", 0);
      state.setState("kills", 0);

      setPlayers((prev) => [...prev, newPlayer]);
      state.onQuit(() => {
        setPlayers((prev) => prev.filter((p) => p.state.id !== state.id));
      });
    });
  };

  useEffect(() => {
    start();
  }, []);

  const [bullets, setBullets] = useState([]);
  const [hits, setHits] = useState([]);

  const [networkBullets, setNetworkBullets] = useMultiplayerState("bullets", []);
  const [networkHits, setNetworkHits] = useMultiplayerState("hits", []);

  const onFire = (bullet) => setBullets((prev) => [...prev, bullet]);

  const onHit = (bulletId, position) => {
    setBullets((prev) => prev.filter((b) => b.id !== bulletId));
    setHits((prev) => [...prev, { id: bulletId, position }]);
  };

  const onHitEnded = (hitId) =>
    setHits((prev) => prev.filter((h) => h.id !== hitId));

  useEffect(() => { setNetworkBullets(bullets); }, [bullets]);
  useEffect(() => { setNetworkHits(hits); }, [hits]);

  const onKilled = (_victim, killer) => {
    const killerState = players.find((p) => p.state.id === killer)?.state;
    if (killerState) {
      killerState.setState("kills", killerState.state.kills + 1);
    }
  };

  const onZoneDamage = (playerState, damage) => {
    if (!isHost()) return;
    if (playerState.state.dead) return;
    const newHealth = Math.max(0, playerState.state.health - damage);
    if (newHealth <= 0) {
      playerState.setState("deaths", playerState.state.deaths + 1);
      playerState.setState("dead", true);
      playerState.setState("health", 0);
    } else {
      playerState.setState("health", newHealth);
    }
  };

  return (
    <>
      <Map />
      {gameStarted && (
        <SafeZone players={players} onPlayerDamage={onZoneDamage} />
      )}
      {players.map(({ state, joystick, playerIndex }) => (
        <CharacterController
          key={state.id}
          state={state}
          userPlayer={state.id === myPlayer()?.id}
          joystick={joystick}
          onKilled={onKilled}
          onFire={onFire}
          downgradedPerformance={downgradedPerformance}
          playerIndex={playerIndex}
        />
      ))}
      {(isHost() ? bullets : networkBullets).map((bullet) => (
        <Bullet
          key={bullet.id}
          {...bullet}
          onHit={(position) => onHit(bullet.id, position)}
        />
      ))}
      {(isHost() ? hits : networkHits).map((hit) => (
        <BulletHit key={hit.id} {...hit} onEnded={() => onHitEnded(hit.id)} />
      ))}
      <Environment preset="sunset" />
    </>
  );
};
