import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

/**
 * Thin wrapper around the wallet-adapter multi-button.
 * Accepts an optional `className` for positioning.
 */
export const WalletConnect = ({ className = "" }) => (
  <WalletMultiButton className={className} />
);
