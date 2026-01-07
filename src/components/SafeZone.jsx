import { useFrame } from "@react-three/fiber";
import { isHost, useMultiplayerState } from "playroomkit";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Safe zone phases configuration
// Phase: { duration: time in seconds, targetRadius: percentage of initial radius }
const ZONE_PHASES = [
  { duration: 60, targetRadius: 1.0, shrinking: false },    // 1 min - no shrink
  { duration: 30, targetRadius: 0.75, shrinking: true },    // shrink to 75%
  { duration: 40, targetRadius: 0.75, shrinking: false },   // 40s - no shrink
  { duration: 20, targetRadius: 0.40, shrinking: true },    // shrink to 40%
  { duration: 40, targetRadius: 0.40, shrinking: false },   // 40s - no shrink
  { duration: 30, targetRadius: 0.0, shrinking: true },     // shrink to 0 (final)
];

const INITIAL_RADIUS = 50; // Starting radius of the safe zone
const DAMAGE_PER_SECOND = 5; // Damage dealt per second outside zone
const ZONE_CENTER = { x: 0, z: 0 }; // Center of the safe zone

export const SafeZone = ({ players, onPlayerDamage }) => {
  const cylinderRef = useRef();
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phaseStartTime, setPhaseStartTime] = useState(Date.now());
  const [currentRadius, setCurrentRadius] = useState(INITIAL_RADIUS);
  const [previousRadius, setPreviousRadius] = useState(INITIAL_RADIUS);
  
  // Sync zone state across players
  const [networkZoneState, setNetworkZoneState] = useMultiplayerState("zoneState", {
    phase: 0,
    radius: INITIAL_RADIUS,
    phaseStartTime: Date.now(),
  });

  // Initialize phase start time
  useEffect(() => {
    if (isHost()) {
      setNetworkZoneState({
        phase: 0,
        radius: INITIAL_RADIUS,
        phaseStartTime: Date.now(),
      });
    }
  }, []);

  useFrame((_, delta) => {
    if (!isHost()) {
      // Non-host players sync from network state
      setCurrentRadius(networkZoneState.radius);
      setCurrentPhase(networkZoneState.phase);
      return;
    }

    const now = Date.now();
    const phase = ZONE_PHASES[currentPhase];
    
    if (!phase) {
      // All phases complete - zone is at 0
      return;
    }

    const phaseElapsed = (now - phaseStartTime) / 1000; // in seconds
    const phaseProgress = Math.min(phaseElapsed / phase.duration, 1);

    if (phase.shrinking) {
      // Calculate current radius during shrinking
      const startRadius = previousRadius;
      const endRadius = phase.targetRadius * INITIAL_RADIUS;
      const newRadius = THREE.MathUtils.lerp(startRadius, endRadius, phaseProgress);
      setCurrentRadius(newRadius);
      
      // Update network state
      setNetworkZoneState({
        phase: currentPhase,
        radius: newRadius,
        phaseStartTime: phaseStartTime,
      });
    }

    // Check if phase is complete
    if (phaseProgress >= 1) {
      const nextPhase = currentPhase + 1;
      if (nextPhase < ZONE_PHASES.length) {
        setPreviousRadius(phase.targetRadius * INITIAL_RADIUS);
        setCurrentPhase(nextPhase);
        setPhaseStartTime(now);
        
        setNetworkZoneState({
          phase: nextPhase,
          radius: phase.targetRadius * INITIAL_RADIUS,
          phaseStartTime: now,
        });
      }
    }

    // Apply damage to players outside the zone
    players.forEach((player) => {
      if (player.state.state.dead) return;
      
      const pos = player.state.getState("pos");
      if (!pos) return;

      const distanceFromCenter = Math.sqrt(
        Math.pow(pos.x - ZONE_CENTER.x, 2) + Math.pow(pos.z - ZONE_CENTER.z, 2)
      );

      if (distanceFromCenter > currentRadius) {
        // Player is outside safe zone - deal damage
        const damage = DAMAGE_PER_SECOND * delta;
        onPlayerDamage(player.state, damage);
      }
    });
  });

  // Update cylinder mesh
  useEffect(() => {
    if (cylinderRef.current) {
      cylinderRef.current.scale.set(currentRadius, 1, currentRadius);
    }
  }, [currentRadius]);

  const phase = ZONE_PHASES[currentPhase];
  const isZoneShrinking = phase?.shrinking || false;

  return (
    <group>
      {/* Safe zone visual - cylinder wall */}
      <mesh
        ref={cylinderRef}
        position={[ZONE_CENTER.x, 25, ZONE_CENTER.z]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[1, 1, 50, 64, 1, true]} />
        <meshBasicMaterial
          color={isZoneShrinking ? "#ff4444" : "#4488ff"}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Zone edge ring on ground */}
      <mesh
        position={[ZONE_CENTER.x, 0.1, ZONE_CENTER.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[currentRadius, currentRadius, 1]}
      >
        <ringGeometry args={[0.95, 1, 64]} />
        <meshBasicMaterial
          color={isZoneShrinking ? "#ff4444" : "#4488ff"}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Danger zone outside (red tint) */}
      <mesh
        position={[ZONE_CENTER.x, 0.05, ZONE_CENTER.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[currentRadius, 200, 64]} />
        <meshBasicMaterial
          color="#ff0000"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// Get phase info for UI
export const getPhaseInfo = (phase) => {
  if (phase >= ZONE_PHASES.length) {
    return { name: "Final Zone", timeLeft: 0 };
  }
  return ZONE_PHASES[phase];
};

export const ZONE_PHASES_CONFIG = ZONE_PHASES;
export const INITIAL_ZONE_RADIUS = INITIAL_RADIUS;
