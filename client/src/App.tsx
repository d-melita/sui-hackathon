import { ConnectButton } from "@mysten/dapp-kit";
import GroupsManager from "./components/GroupsManager";
import { SessionKeyProvider } from "./providers/SessionKeyProvider";
import { MessagingClientProvider } from "./providers/MessagingClientProvider";

function App() {
  return (
    <SessionKeyProvider>
      <MessagingClientProvider>
        <GroupsManager />
      </MessagingClientProvider>
    </SessionKeyProvider>
  );
}

export default App;
