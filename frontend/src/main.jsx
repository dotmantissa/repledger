import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { ThemeProvider } from "./context/ThemeContext";
import App from "./App";
import "./index.css";

const PRIVY_APP_ID = "cmub4fcoc01t70clbas67s5td";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          accentColor: "#1ec677",
          logo: "/logo.svg",
          showWalletLoginFirst: false,
        },
      }}
    >
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PrivyProvider>
  </React.StrictMode>
);
