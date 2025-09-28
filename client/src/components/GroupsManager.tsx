import { useState } from "react";
import { useGroupsManager } from "../hooks/useGroupsManager";
import { useGroups } from "../hooks/useGroups";
import { useMessaging } from "../hooks/useMessaging";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ConnectButton } from "@mysten/dapp-kit";
import { Plus, Users, DollarSign, TrendingUp, Vote } from "lucide-react";

export default function GroupsManager() {
  const {
    groups,
    selectedGroupId,
    setSelectedGroupId,
    createNewGroup,
    isCreatingGroup,
  } = useGroupsManager();

  const {
    initTreasury,
    depositToTreasury,
    withdrawFromTreasury,
    createSignal,
    upvoteSignal,
    downvoteSignal,
  } = useGroups();

  // Get messaging functionality
  const { createChannel, channels, fetchChannels } = useMessaging();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "treasury" | "signals" | "voting"
  >("overview");
  const [status, setStatus] = useState<{
    kind: "idle" | "ok" | "err";
    msg?: string;
  }>({ kind: "idle" });
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Group management state
  const [groupId, setGroupId] = useState("");
  const [adminCapId, setAdminCapId] = useState("");
  const [treasuryAmount, setTreasuryAmount] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [confidence, setConfidence] = useState("");
  const [signalId, setSignalId] = useState("");

  const selectedGroup = groups.find(
    (group) => group.data?.objectId === selectedGroupId,
  );

  const handleCreateGroup = async () => {
    setStatus({ kind: "idle" });
    try {
      const result = await createNewGroup(true); // gated group
      if (result) {
        setStatus({
          kind: "ok",
          msg: `Group created successfully! Transaction: ${result.digest}`,
        });
        setShowCreateGroup(false);
      } else {
        setStatus({ kind: "err", msg: "Failed to create group" });
      }
    } catch (error: any) {
      setStatus({ kind: "err", msg: `Error creating group: ${error.message}` });
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  // Create a channel for the current group
  const handleCreateChat = async () => {
    if (!selectedGroup?.data?.objectId) {
      setStatus({ kind: "err", msg: "No group selected" });
      return;
    }

    try {
      setStatus({ kind: "idle" });

      // For now, create a channel with just the current user
      // In the future, you could add other group members here
      const result = await createChannel([
        /* Add member addresses here */
      ]);

      if (result?.channelId) {
        setStatus({
          kind: "ok",
          msg: `Chat channel created for group! Channel ID: ${result.channelId.slice(0, 8)}...`,
        });

        // Refresh channels to show the new one
        setTimeout(() => {
          fetchChannels();
        }, 2000);
      } else {
        setStatus({ kind: "err", msg: "Failed to create chat channel" });
      }
    } catch (error: any) {
      setStatus({ kind: "err", msg: `Error creating chat: ${error.message}` });
    }
  };

  // Group management functions
  const handleInitTreasury = async () => {
    if (!groupId.trim() || !adminCapId.trim() || !treasuryAmount.trim()) {
      setStatus({ kind: "err", msg: "Please fill all fields" });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await initTreasury(
        groupId,
        adminCapId,
        parseInt(treasuryAmount),
      );
      setStatus({
        kind: "ok",
        msg: `Treasury initialized! Transaction: ${result.digest}`,
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error initializing treasury: ${error.message}`,
      });
    }
  };

  const handleDepositToTreasury = async () => {
    if (!groupId.trim() || !adminCapId.trim() || !treasuryAmount.trim()) {
      setStatus({ kind: "err", msg: "Please fill all fields" });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await depositToTreasury(
        groupId,
        adminCapId,
        parseInt(treasuryAmount),
      );
      setStatus({
        kind: "ok",
        msg: `Deposited to treasury! Transaction: ${result.digest}`,
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error depositing: ${error.message}`,
      });
    }
  };

  const handleWithdrawFromTreasury = async () => {
    if (!groupId.trim() || !adminCapId.trim() || !treasuryAmount.trim()) {
      setStatus({ kind: "err", msg: "Please fill all fields" });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await withdrawFromTreasury(
        groupId,
        adminCapId,
        parseInt(treasuryAmount),
      );
      setStatus({
        kind: "ok",
        msg: `Withdrawn from treasury! Transaction: ${result.digest}`,
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error withdrawing: ${error.message}`,
      });
    }
  };

  const handleCreateSignal = async (bullish: boolean) => {
    if (
      !groupId.trim() ||
      !adminCapId.trim() ||
      !tokenAddress.trim() ||
      !confidence.trim()
    ) {
      setStatus({ kind: "err", msg: "Please fill all fields" });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await createSignal(
        groupId,
        adminCapId,
        tokenAddress,
        bullish,
        parseInt(confidence),
      );
      setStatus({
        kind: "ok",
        msg: `${bullish ? "Bullish" : "Bearish"} signal created! Transaction: ${result.digest}`,
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error creating signal: ${error.message}`,
      });
    }
  };

  const handleUpvoteSignal = async () => {
    if (!groupId.trim() || !signalId.trim()) {
      setStatus({ kind: "err", msg: "Please fill all fields" });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await upvoteSignal(groupId, signalId);
      setStatus({
        kind: "ok",
        msg: `Signal upvoted! Transaction: ${result.digest}`,
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error upvoting signal: ${error.message}`,
      });
    }
  };

  const handleDownvoteSignal = async () => {
    if (!groupId.trim() || !signalId.trim()) {
      setStatus({ kind: "err", msg: "Please fill all fields" });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await downvoteSignal(groupId, signalId);
      setStatus({
        kind: "ok",
        msg: `Signal downvoted! Transaction: ${result.digest}`,
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error downvoting signal: ${error.message}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-muted rounded-md transition-colors"
              >
                {sidebarOpen ? "←" : "→"}
              </button>
              <h1 className="text-xl font-bold">Sui Groups</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowCreateGroup(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> New Group
              </Button>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1">
        {/* Left Sidebar - Groups List */}
        {sidebarOpen && (
          <div className="w-64 border-r bg-card flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Groups</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {groups.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No groups found. Create one!
                </p>
              ) : (
                groups.map((group) => (
                  <button
                    key={group.data?.objectId}
                    onClick={() => handleSelectGroup(group.data?.objectId)}
                    className={`block w-full text-left p-4 hover:bg-muted transition-colors ${
                      selectedGroupId === group.data?.objectId
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }`}
                  >
                    <p className="font-medium">
                      Group {group.data?.objectId?.slice(0, 6)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.data?.type?.includes("Group")
                        ? "Main Group"
                        : "Cap"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {selectedGroupId && selectedGroup ? (
          <div className="flex-1 flex flex-col">
            {/* Group Header */}
            <div className="p-4 border-b bg-card flex items-center justify-between">
              <h3 className="font-semibold">
                Group {selectedGroup.data?.objectId?.slice(0, 6)}...
              </h3>
            </div>

            {/* Tab Navigation */}
            <div className="border-b">
              <div className="flex">
                {[
                  { id: "overview", label: "Overview", icon: Users },
                  { id: "treasury", label: "Treasury", icon: DollarSign },
                  { id: "signals", label: "Signals", icon: TrendingUp },
                  { id: "voting", label: "Voting", icon: Vote },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4 inline-block mr-2" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-background">
              {activeTab === "overview" && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Group Overview</h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // TODO: Implement add member functionality
                          console.log("Add member clicked");
                        }}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        Add Member
                      </Button>
                      <Button
                        onClick={handleCreateChat}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create Chat
                      </Button>
                    </div>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Group Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p>
                          <strong>Group ID:</strong>{" "}
                          {selectedGroup.data?.objectId}
                        </p>
                        <p>
                          <strong>Type:</strong> {selectedGroup.data?.type}
                        </p>
                        <p>
                          <strong>Version:</strong>{" "}
                          {selectedGroup.data?.version}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Associated Channels */}
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle>Group Chat Channels</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {channels.length === 0 ? (
                        <p className="text-muted-foreground">
                          No chat channels created for this group yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {channels.map((channel) => (
                            <div
                              key={channel.id.id}
                              className="p-3 border rounded-lg hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    Channel {channel.id.id.slice(0, 8)}...
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {channel.auth?.member_permissions?.contents
                                      ?.length || 0}{" "}
                                    members
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // TODO: Open chat interface
                                    console.log(
                                      "Open chat for channel:",
                                      channel.id.id,
                                    );
                                  }}
                                >
                                  Open Chat
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "treasury" && (
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-4">
                    Treasury Management
                  </h3>
                  <Card>
                    <CardHeader>
                      <CardTitle>Group Treasury</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <Input
                            placeholder="Group ID"
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Admin Cap ID"
                            value={adminCapId}
                            onChange={(e) => setAdminCapId(e.target.value)}
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Amount (in MIST)"
                            value={treasuryAmount}
                            onChange={(e) => setTreasuryAmount(e.target.value)}
                            type="number"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleInitTreasury}>
                          Initialize Treasury
                        </Button>
                        <Button onClick={handleDepositToTreasury}>
                          Deposit
                        </Button>
                        <Button onClick={handleWithdrawFromTreasury}>
                          Withdraw
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "signals" && (
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Market Signals</h3>
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Create Signal</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div>
                            <Input
                              placeholder="Group ID"
                              value={groupId}
                              onChange={(e) => setGroupId(e.target.value)}
                            />
                          </div>
                          <div>
                            <Input
                              placeholder="Admin Cap ID"
                              value={adminCapId}
                              onChange={(e) => setAdminCapId(e.target.value)}
                            />
                          </div>
                          <div>
                            <Input
                              placeholder="Token Address"
                              value={tokenAddress}
                              onChange={(e) => setTokenAddress(e.target.value)}
                            />
                          </div>
                          <div>
                            <Input
                              placeholder="Confidence (0-100)"
                              value={confidence}
                              onChange={(e) => setConfidence(e.target.value)}
                              type="number"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleCreateSignal(true)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            ↑ Create Bullish Signal
                          </Button>
                          <Button
                            onClick={() => handleCreateSignal(false)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            ↓ Create Bearish Signal
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Vote on Signals</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div>
                            <Input
                              placeholder="Group ID"
                              value={groupId}
                              onChange={(e) => setGroupId(e.target.value)}
                            />
                          </div>
                          <div>
                            <Input
                              placeholder="Signal ID"
                              value={signalId}
                              onChange={(e) => setSignalId(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleUpvoteSignal}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            ↑ Upvote Signal
                          </Button>
                          <Button
                            onClick={handleDownvoteSignal}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            ↓ Downvote Signal
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === "voting" && (
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Group Voting</h3>
                  <Card>
                    <CardHeader>
                      <CardTitle>Voting System</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        Voting functionality will be available soon
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" disabled>
                          Create Poll
                        </Button>
                        <Button variant="outline" disabled>
                          View Polls
                        </Button>
                        <Button variant="outline" disabled>
                          Cast Vote
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No Group Selected */
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Welcome to Sui Groups</h2>
              <p className="text-muted-foreground">
                Select a group or create a new one to get started.
              </p>

              {status.kind === "ok" && (
                <div className="mt-4 text-green-500 text-sm">{status.msg}</div>
              )}
              {status.kind === "err" && (
                <div className="mt-4 text-red-500 text-sm">{status.msg}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Create New Group</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a new gated group with treasury and voting capabilities.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateGroup}
                  disabled={isCreatingGroup}
                  className="flex-1"
                >
                  {isCreatingGroup ? "Creating..." : "Create Group"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateGroup(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
