import { ConnectButton } from "@mysten/dapp-kit";
import ChannelManager from "./components/ChannelManager";
import { SessionKeyProvider } from "./providers/SessionKeyProvider";
import { MessagingClientProvider } from "./providers/MessagingClientProvider";

function App() {
  return (
    <SessionKeyProvider>
      <MessagingClientProvider>
        <ChannelManager />
      </MessagingClientProvider>
    </SessionKeyProvider>
  );
}

export default App;
