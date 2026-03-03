import { Billboard, CameraControls, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { isHost } from "playroomkit";
import { useEffect, useRef, useState } from "react";
import { CharacterSoldier } from "./CharacterSoldier";

const MOVEMENT_SPEED = 202;
const FIRE_RATE = 380;
// With linearDamping=12 always on, y=25 gives ~1.5 unit apex — feels natural
const JUMP_VELOCITY = 25;
const JUMP_COOLDOWN = 800; // ms — one jump per 0.8 s max

export const WEAPON_OFFSET = {
  x: -0.2,
  y: 1.4,
  z: 0.8,
};

// Four spread-out FFA spawn points — players drop from above onto the map
const SPAWNS = [
  { x: -12, y: 8, z: -12 },
  { x:  12, y: 8, z:  12 },
  { x: -12, y: 8, z:  12 },
  { x:  12, y: 8, z: -12 },
];

export const getSpawnForIndex = (index) => SPAWNS[index % SPAWNS.length];

export const CharacterController = ({
  state,
  joystick,
  userPlayer,
  onKilled,
  onFire,
  downgradedPerformance,
  playerIndex,
  ...props
}) => {
  const group = useRef();
  const character = useRef();
  const rigidbody = useRef();
  const [animation, setAnimation] = useState("Idle");
  const [weapon] = useState("AK");
  const lastShoot = useRef(0);
  // Camera's horizontal rotation angle (azimuth)
  const cameraRotation = useRef(0);
  const [isAiming, setIsAiming] = useState(false);

  // Jump state — cooldown-based, no velocity detection needed
  const lastJumpTime = useRef(0);
  const jumpPressed = useRef(false);

  const spawnAtStart = () => {
    const spawn = getSpawnForIndex(playerIndex ?? 0);
    rigidbody.current.setTranslation(spawn);
    rigidbody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rigidbody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  useEffect(() => {
    if (isHost()) {
      spawnAtStart();
    }
  }, []);

  useEffect(() => {
    if (state.state.dead) {
      const audio = new Audio("/audios/dead.mp3");
      audio.volume = 0.5;
      audio.play();
    }
  }, [state.state.dead]);

  useEffect(() => {
    if (state.state.health < 100) {
      const audio = new Audio("/audios/hurt.mp3");
      audio.volume = 0.4;
      audio.play();
    }
  }, [state.state.health]);

  useFrame((_, delta) => {
    if (state.state.dead) {
      setAnimation("Death");
      return;
    }

    // ── TPP CAMERA FOLLOW ──────────────────────────────────────────────────
    if (controls.current && userPlayer) {
      const playerWorldPos = vec3(rigidbody.current.translation());

      // Track camera horizontal angle
      cameraRotation.current = controls.current.azimuthAngle;

      // Idle: face the direction the camera is looking (behind character)
      if (!joystick.isJoystickPressed()) {
        character.current.rotation.y = cameraRotation.current + Math.PI;
      }

      const cameraDistance = isAiming ? 2 : 5;
      const cameraHeight   = isAiming ? 1.5 : 2;
      const lookAtHeight   = 1.5;

      const cameraX = playerWorldPos.x + Math.sin(cameraRotation.current) * cameraDistance;
      const cameraY = playerWorldPos.y + cameraHeight;
      const cameraZ = playerWorldPos.z + Math.cos(cameraRotation.current) * cameraDistance;

      controls.current.setLookAt(
        cameraX, cameraY, cameraZ,
        playerWorldPos.x, playerWorldPos.y + lookAtHeight, playerWorldPos.z,
        true
      );
    }

    // ── MOVEMENT (camera-relative, PUBG-style) ─────────────────────────────
    // joystick.angle() is 0 = "joystick up" in screen space.
    // We offset by (cameraRotation + PI) so "up" maps to the camera's forward direction.
    const joystickAngle = joystick.angle();
    if (joystick.isJoystickPressed() && joystickAngle !== null) {
      const worldAngle = joystickAngle + cameraRotation.current + Math.PI;
      setAnimation("Run");

      // Character mesh faces the direction of travel
      character.current.rotation.y = worldAngle;

      if (isHost()) {
        const impulse = {
          x: Math.sin(worldAngle) * MOVEMENT_SPEED * delta,
          y: 0,
          z: Math.cos(worldAngle) * MOVEMENT_SPEED * delta,
        };
        rigidbody.current.applyImpulse(impulse, true);
        state.setState("rot", worldAngle);
      }
    } else {
      setAnimation("Idle");
    }

    // ── JUMP ───────────────────────────────────────────────────────────────
    if (isHost()) {
      const jumpNow = joystick.isPressed("jump");
      const now = Date.now();
      // Single-press guard + cooldown = exactly one jump per press, max 1 per 0.8 s
      if (jumpNow && !jumpPressed.current && now - lastJumpTime.current > JUMP_COOLDOWN) {
        jumpPressed.current = true;
        lastJumpTime.current = now;
        const vel = rigidbody.current.linvel();
        rigidbody.current.setLinvel({ x: vel.x, y: JUMP_VELOCITY, z: vel.z }, true);
      }
      if (!jumpNow) jumpPressed.current = false;
    }

    // ── FIRE ───────────────────────────────────────────────────────────────
    if (joystick.isPressed("fire")) {
      setIsAiming(true);
      setAnimation(
        joystick.isJoystickPressed() && joystickAngle ? "Run_Shoot" : "Idle_Shoot"
      );

      if (isHost()) {
        if (Date.now() - lastShoot.current > FIRE_RATE) {
          lastShoot.current = Date.now();
          // Bullet goes in the direction the camera faces
          const bulletAngle = userPlayer
            ? cameraRotation.current + Math.PI
            : (joystickAngle ?? 0);
          onFire({
            id: state.id + "-" + +new Date(),
            position: vec3(rigidbody.current.translation()),
            angle: bulletAngle,
            player: state.id,
          });
        }
      }
    } else {
      setIsAiming(false);
    }

    // ── SYNC POSITION ──────────────────────────────────────────────────────
    if (isHost()) {
      state.setState("pos", rigidbody.current.translation());
    } else {
      const pos = state.getState("pos");
      if (pos) rigidbody.current.setNextKinematicTranslation(pos);
      const rot = state.getState("rot");
      if (rot !== undefined && character.current) {
        character.current.rotation.y = rot;
      }
    }
  });

  const controls = useRef();
  const directionalLight = useRef();

  useEffect(() => {
    if (character.current && userPlayer) {
      directionalLight.current.target = character.current;
    }
  }, [character.current]);

  useEffect(() => {
    if (controls.current && userPlayer) {
      controls.current.minDistance = 2;
      controls.current.maxDistance = 8;
      controls.current.minPolarAngle = Math.PI / 6;
      controls.current.maxPolarAngle = Math.PI / 2.2;
      controls.current.dampingFactor = 0.05;
      controls.current.draggingDampingFactor = 0.05;
    }
  }, [controls.current, userPlayer]);

  return (
    <group {...props} ref={group}>
      {userPlayer && (
        <CameraControls
          ref={controls}
          mouseButtons={{ left: 1, middle: 0, right: 0, wheel: 16 }}
          touches={{ one: 32, two: 512, three: 0 }}
        />
      )}
      <RigidBody
        ref={rigidbody}
        colliders={false}
        linearDamping={12}
        lockRotations
        gravityScale={1}
        type={isHost() ? "dynamic" : "kinematicPosition"}
        onIntersectionEnter={({ other }) => {
          if (
            isHost() &&
            other.rigidBody.userData.type === "bullet" &&
            other.rigidBody.userData.player !== state.id &&
            state.state.health > 0
          ) {
            const newHealth = state.state.health - other.rigidBody.userData.damage;
            if (newHealth <= 0) {
              state.setState("deaths", state.state.deaths + 1);
              state.setState("dead", true);
              state.setState("health", 0);
              rigidbody.current.setEnabled(false);
              setTimeout(() => {
                spawnAtStart();
                rigidbody.current.setEnabled(true);
                state.setState("health", 100);
                state.setState("dead", false);
              }, 2000);
              onKilled(state.id, other.rigidBody.userData.player);
            } else {
              state.setState("health", newHealth);
            }
          }
        }}
      >
        <PlayerInfo state={state.state} />
        <group ref={character}>
          <CharacterSoldier
            color={state.state.profile?.color}
            animation={animation}
            weapon={weapon}
          />
          {userPlayer && (
            <Crosshair
              position={[WEAPON_OFFSET.x, WEAPON_OFFSET.y, WEAPON_OFFSET.z]}
            />
          )}
        </group>
        {userPlayer && (
          <directionalLight
            ref={directionalLight}
            position={[25, 18, -25]}
            intensity={0.3}
            castShadow={!downgradedPerformance}
            shadow-camera-near={0}
            shadow-camera-far={100}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0001}
          />
        )}
        <CapsuleCollider args={[0.7, 0.6]} position={[0, 1.28, 0]} />
      </RigidBody>
    </group>
  );
};

const PlayerInfo = ({ state }) => {
  const health = state.health;
  const name   = state.profile?.name;
  const color  = state.profile?.color || "#44ff66";
  return (
    <Billboard position-y={2.5}>
      <Text position-y={0.36} fontSize={0.4}>
        {name}
        <meshBasicMaterial color={color} />
      </Text>
      <mesh position-z={-0.1}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="black" transparent opacity={0.5} />
      </mesh>
      <mesh scale-x={health / 100} position-x={-0.5 * (1 - health / 100)}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color={health > 50 ? "#44ff66" : health > 25 ? "#ffcc00" : "#ff4444"} />
      </mesh>
    </Billboard>
  );
};

const Crosshair = (props) => {
  return (
    <group {...props}>
      <mesh position-z={1}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color="black" transparent opacity={0.9} />
      </mesh>
      <mesh position-z={2}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color="black" transparent opacity={0.85} />
      </mesh>
      <mesh position-z={3}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color="black" transparent opacity={0.8} />
      </mesh>
      <mesh position-z={4.5}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color="black" opacity={0.7} transparent />
      </mesh>
      <mesh position-z={6.5}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color="black" opacity={0.6} transparent />
      </mesh>
      <mesh position-z={9}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshBasicMaterial color="black" opacity={0.2} transparent />
      </mesh>
    </group>
  );
};
