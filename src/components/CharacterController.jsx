import { Billboard, CameraControls, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { isHost } from "playroomkit";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CharacterSoldier } from "./CharacterSoldier";
const MOVEMENT_SPEED = 202;
const FIRE_RATE = 380;
export const WEAPON_OFFSET = {
  x: -0.2,
  y: 1.4,
  z: 0.8,
};

export const CharacterController = ({
  state,
  joystick,
  userPlayer,
  onKilled,
  onFire,
  downgradedPerformance,
  ...props
}) => {
  const group = useRef();
  const character = useRef();
  const rigidbody = useRef();
  const [animation, setAnimation] = useState("Idle");
  const [weapon, setWeapon] = useState("AK");
  const lastShoot = useRef(0);
  const cameraRotation = useRef(0); // Track camera azimuth angle
  const [isAiming, setIsAiming] = useState(false);

  const scene = useThree((state) => state.scene);
  const spawnRandomly = () => {
    // Find the map to get its position
    let groundY = 0;
    const map = scene.children.find(child => child.type === 'Group' || child.name === 'Scene');
    
    if (map) {
      // Find the lowest point of the map to determine ground level
      const box = new THREE.Box3().setFromObject(map);
      groundY = box.min.y;
      console.log('Ground detected at Y:', groundY);
    }
    
    // Spawn high above the ground (will fall down with gravity)
    const spawnHeight = groundY + 20;
    const randomX = (Math.random() - 0.5) * 20;
    const randomZ = (Math.random() - 0.5) * 20;
    
    rigidbody.current.setTranslation({ x: randomX, y: spawnHeight, z: randomZ });
  };

  useEffect(() => {
    if (isHost()) {
      spawnRandomly();
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

    // TPP CAMERA FOLLOW (Third Person Perspective)
    if (controls.current && userPlayer) {
      const playerWorldPos = vec3(rigidbody.current.translation());
      
      // Get camera azimuth angle from controls
      cameraRotation.current = controls.current.azimuthAngle;
      
      // Make character face camera direction when not moving
      if (!joystick.isJoystickPressed()) {
        character.current.rotation.y = cameraRotation.current + Math.PI;
      }
      
      // Camera distance settings (closer when aiming)
      const cameraDistance = isAiming ? 2 : 5;
      const cameraHeight = isAiming ? 1.5 : 2;
      const lookAtHeight = 1.5;
      
      // Calculate camera position based on camera rotation
      const cameraX = playerWorldPos.x + Math.sin(cameraRotation.current) * cameraDistance;
      const cameraY = playerWorldPos.y + cameraHeight;
      const cameraZ = playerWorldPos.z + Math.cos(cameraRotation.current) * cameraDistance;
      
      // Smooth camera movement
      controls.current.setLookAt(
        cameraX,
        cameraY,
        cameraZ,
        playerWorldPos.x,
        playerWorldPos.y + lookAtHeight,
        playerWorldPos.z,
        true
      );
    }

    // Update player position based on joystick state
    const angle = joystick.angle();
    if (joystick.isJoystickPressed() && angle) {
      setAnimation("Run");
      
      // Character faces movement direction
      character.current.rotation.y = angle;

      if (isHost()) {
        // move character in its own direction
        const impulse = {
          x: Math.sin(angle) * MOVEMENT_SPEED * delta,
          y: 0,
          z: Math.cos(angle) * MOVEMENT_SPEED * delta,
        };

        rigidbody.current.applyImpulse(impulse, true);
        state.setState("rot", angle);
      }
    } else {
      setAnimation("Idle");
    }

    // Check if fire button is pressed
    if (joystick.isPressed("fire")) {
      // Enable aiming mode
      setIsAiming(true);
      
      // fire
      setAnimation(
        joystick.isJoystickPressed() && angle ? "Run_Shoot" : "Idle_Shoot"
      );
      
      if (isHost()) {
        if (Date.now() - lastShoot.current > FIRE_RATE) {
          lastShoot.current = Date.now();
          const bulletAngle = userPlayer ? cameraRotation.current + Math.PI : angle;
          const newBullet = {
            id: state.id + "-" + +new Date(),
            position: vec3(rigidbody.current.translation()),
            angle: bulletAngle,
            player: state.id,
          };
          onFire(newBullet);
        }
      }
    } else {
      setIsAiming(false);
    }

    if (isHost()) {
      state.setState("pos", rigidbody.current.translation());
    } else {
      const pos = state.getState("pos");
      if (pos) {
        rigidbody.current.setNextKinematicTranslation(pos);
      }
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
      // Configure camera controls for TPP
      controls.current.minDistance = 2;
      controls.current.maxDistance = 8;
      controls.current.minPolarAngle = Math.PI / 6; // 30 degrees
      controls.current.maxPolarAngle = Math.PI / 2.2; // ~82 degrees
      controls.current.dampingFactor = 0.05; // Smooth camera movement
      controls.current.draggingDampingFactor = 0.05;
    }
  }, [controls.current, userPlayer]);

  return (
    <group {...props} ref={group}>
      {userPlayer && (
        <CameraControls 
          ref={controls}
          mouseButtons={{
            left: 1,  // Rotate
            middle: 0, // None
            right: 0,  // None
            wheel: 16, // Zoom (dolly)
          }}
          touches={{
            one: 32,  // Touch rotate
            two: 512, // Touch zoom (dolly)
            three: 0, // None
          }}
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
            state.state.health > 0
          ) {
            const newHealth =
              state.state.health - other.rigidBody.userData.damage;
            if (newHealth <= 0) {
              state.setState("deaths", state.state.deaths + 1);
              state.setState("dead", true);
              state.setState("health", 0);
              rigidbody.current.setEnabled(false);
              setTimeout(() => {
                spawnRandomly();
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
          // Finally I moved the light to follow the player
          // This way we won't need to calculate ALL the shadows but only the ones
          // that are in the camera view
          <directionalLight
            ref={directionalLight}
            position={[25, 18, -25]}
            intensity={0.3}
            castShadow={!downgradedPerformance} // Disable shadows on low-end devices
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
  const name = state.profile.name;
  return (
    <Billboard position-y={2.5}>
      <Text position-y={0.36} fontSize={0.4}>
        {name}
        <meshBasicMaterial color={state.profile.color} />
      </Text>
      <mesh position-z={-0.1}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="black" transparent opacity={0.5} />
      </mesh>
      <mesh scale-x={health / 100} position-x={-0.5 * (1 - health / 100)}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="red" />
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
