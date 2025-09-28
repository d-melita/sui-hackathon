import { ConnectButton } from "@mysten/dapp-kit";

interface AppHeaderProps {
  onCreateGroup?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function AppHeader({ onCreateGroup, onToggleSidebar, sidebarOpen }: AppHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-2 hover:bg-muted rounded-md transition-colors"
              >
                {sidebarOpen ? "←" : "→"}
              </button>
            )}
            <h1 className="text-xl font-bold">Sui Groups</h1>
          </div>
          <div className="flex items-center gap-3">
            {onCreateGroup && (
              <button
                onClick={onCreateGroup}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                + New Group
              </button>
            )}
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
