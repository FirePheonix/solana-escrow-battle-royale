import { Loader, PerformanceMonitor, SoftShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Physics } from "@react-three/rapier";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { Suspense, useMemo, useState } from "react";
import { Experience } from "./components/Experience";
import { Leaderboard } from "./components/Leaderboard";

// ─── Root: Solana wallet providers wrap the whole app ────────────────────────

function App() {
  const [downgradedPerformance, setDowngradedPerformance] = useState(false);

  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Loader />
          {/* Leaderboard is a pure DOM overlay — includes StakeModal + settlement UI */}
          <Leaderboard />

          <Canvas
            shadows
            camera={{ position: [0, 5, 10], fov: 75, near: 0.1, far: 1000 }}
            dpr={[1, 1.5]}
          >
            <color attach="background" args={["#242424"]} />
            <SoftShadows size={42} />
            <PerformanceMonitor
              onDecline={() => setDowngradedPerformance(true)}
            />
            <Suspense>
              <Physics gravity={[0, -30, 0]}>
                <Experience downgradedPerformance={downgradedPerformance} />
              </Physics>
            </Suspense>
            {!downgradedPerformance && (
              <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={1} intensity={1.5} mipmapBlur />
              </EffectComposer>
            )}
          </Canvas>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
