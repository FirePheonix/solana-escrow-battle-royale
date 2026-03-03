import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// Wallet adapter styles (connect button, modal)
import "@solana/wallet-adapter-react-ui/styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
