import React from "react";
import ReactDOM from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";
import "./index.css";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import App from "./App.tsx";
import { networkConfig } from "./networkConfig.ts";
import { SuiClient } from "@mysten/sui/client";

const queryClient = new QueryClient();

// Create SuiClient with MVR configuration
const createClient = () => {
  return new SuiClient({
    url: networkConfig.testnet.url,
    mvr: {
      overrides: {
        packages: {
          "@local-pkg/sui-stack-messaging":
            "0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d",
        },
      },
    },
  });
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark">
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider
          networks={networkConfig}
          defaultNetwork="testnet"
          createClient={createClient}
        >
          <WalletProvider autoConnect>
            <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </Theme>
  </React.StrictMode>,
);
