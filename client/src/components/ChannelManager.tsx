import { useState, useMemo } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useMessaging } from "../hooks/useMessaging";
import { useSessionKey } from "../providers/SessionKeyProvider";
import { useGroups } from "../hooks/useGroups";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ConnectButton } from "@mysten/dapp-kit";
import {
  Plus,
  MessageSquare,
  Vote,
  DollarSign,
  TrendingUp,
} from "lucide-react";

export default function ChannelManager() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { sessionKey, initializeManually } = useSessionKey();
  const {
    createGroup: createGroupContract,
    initTreasury,
    depositToTreasury,
    withdrawFromTreasury,
    createSignal,
    upvoteSignal,
    downvoteSignal,
  } = useGroups();
  const {
    channels,
    selectedChannelId,
    setSelectedChannelId,
    createChannel,
    deleteChannel,
    sendMessage,
    messages,
    fetchMessages,
    isSendingMessage,
  } = useMessaging();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "chat" | "votes" | "treasury" | "signals"
  >("chat");
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState<{
    kind: "idle" | "ok" | "err";
    msg?: string;
  }>({ kind: "idle" });
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [memberAddresses, setMemberAddresses] = useState("");
  const [memberAddressesMap, setMemberAddressesMap] = useState<
    Map<string, string>
  >(new Map());

  // Group management state
  const [groupId, setGroupId] = useState("");
  const [adminCapId, setAdminCapId] = useState("");
  const [treasuryAmount, setTreasuryAmount] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [confidence, setConfidence] = useState("");
  const [signalId, setSignalId] = useState("");

  // Treasury state
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [userHoldings, setUserHoldings] = useState<number | null>(null);
  const [isLoadingTreasury, setIsLoadingTreasury] = useState(false);

  const self = currentAccount?.address ?? "";

  // Filter channels that have messages
  const channelsWithMessages = channels.filter((channel) => {
    return true; // For now, show all channels
  });

  const currentChannel = useMemo(() => {
    return channels.find((channel) => channel.id.id === selectedChannelId);
  }, [channels, selectedChannelId]);

  const fetchMemberAddresses = async (channelId: string) => {
    console.log("🚀 fetchMemberAddresses called with channelId:", channelId);
    console.log("🚀 currentChannel:", currentChannel);

    // Find the channel directly from the channels array
    const channel = channels.find((ch) => ch.id.id === channelId);
    console.log("🚀 Found channel:", channel);

    if (!channel) {
      console.log("❌ No channel found, returning early");
      return;
    }

    const addressMap = new Map<string, string>();

    // For each member permission, get the actual owner address from the member cap
    for (const member of channel.auth?.member_permissions?.contents || []) {
      const memberCapId = member.key;

      try {
        console.log(`🔍 Getting owner for member cap: ${memberCapId}`);
        // Get the member cap object to find the owner address
        const memberCapObject = await suiClient.getObject({
          id: memberCapId,
          options: { showOwner: true },
        });

        console.log(
          `🔍 Member cap object for ${memberCapId}:`,
          memberCapObject,
        );

        if (
          memberCapObject.data?.owner &&
          "AddressOwner" in memberCapObject.data.owner
        ) {
          const ownerAddress = memberCapObject.data.owner.AddressOwner;
          addressMap.set(memberCapId, ownerAddress);
          console.log(
            `✅ Found real address for cap ${memberCapId}: ${ownerAddress}`,
          );
        } else {
          console.log(`❌ No owner address found for cap ${memberCapId}`);
          console.log(`🔍 Owner structure:`, memberCapObject.data?.owner);
        }
      } catch (error) {
        console.error(`Error fetching owner for cap ${memberCapId}:`, error);
      }
    }

    setMemberAddressesMap(addressMap);
  };

  const handleSelectChannel = async (channelId: string) => {
    console.log("🎯 handleSelectChannel called with channelId:", channelId);
    setSelectedChannelId(channelId);
    fetchMessages(channelId);

    // Fetch member addresses after a short delay to ensure currentChannel is updated
    setTimeout(() => {
      console.log("⏰ Timeout reached, calling fetchMemberAddresses");
      fetchMemberAddresses(channelId);
    }, 100);
  };

  const handleCreateGroupChannel = async () => {
    if (!memberAddresses.trim()) {
      setStatus({ kind: "err", msg: "Please enter member addresses" });
      return;
    }

    const addresses = memberAddresses
      .split(",")
      .map((addr) => addr.trim())
      .filter(Boolean);

    if (addresses.length === 0) {
      setStatus({ kind: "err", msg: "Please enter valid addresses" });
      return;
    }

    setStatus({ kind: "idle" });
    try {
      // Step 1: Create the messaging channel
      const channelResult = await createChannel(addresses);

      if (channelResult?.channelId) {
        // Step 2: Create the group contract (gated group for now)
        try {
          const groupResult = await createGroupContract(true); // true = gated group

          setStatus({
            kind: "ok",
            msg: `Group created successfully! Channel: ${channelResult.channelId}, Group: ${groupResult.digest}`,
          });
          setShowCreateGroup(false);
          setMemberAddresses("");
        } catch (groupError) {
          // Channel was created but group contract failed
          setStatus({
            kind: "ok",
            msg: `Channel created but group contract failed: ${channelResult.channelId}`,
          });
          setShowCreateGroup(false);
          setMemberAddresses("");
        }
      } else {
        setStatus({ kind: "err", msg: "Failed to create group channel" });
      }
    } catch (error) {
      setStatus({ kind: "err", msg: "Error creating group channel" });
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const result = await deleteChannel(channelId);
      if (result?.success) {
        setStatus({ kind: "ok", msg: "Channel deleted successfully!" });
        if (selectedChannelId === channelId) {
          setSelectedChannelId("");
        }

        // Clear the success message after 3 seconds
        setTimeout(() => {
          setStatus({ kind: "idle" });
        }, 3000);
      } else {
        setStatus({ kind: "err", msg: "Failed to delete channel" });

        // Clear the error message after 5 seconds
        setTimeout(() => {
          setStatus({ kind: "idle" });
        }, 5000);
      }
    } catch (error) {
      setStatus({ kind: "err", msg: "Error deleting channel" });

      // Clear the error message after 5 seconds
      setTimeout(() => {
        setStatus({ kind: "idle" });
      }, 5000);
    }
  };

  // Group management functions
  const handleInitTreasury = async () => {
    if (!groupId.trim() || !treasuryAmount.trim()) {
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

  // Fetch treasury balance and user holdings
  const handleFetchTreasuryInfo = async () => {
    if (!groupId.trim()) {
      setStatus({ kind: "err", msg: "Please provide a group ID" });
      return;
    }

    try {
      setIsLoadingTreasury(true);
      setStatus({ kind: "idle" });

      // Note: This would need to be implemented as a view function in the Move contract
      // For now, we'll show a placeholder message
      setStatus({
        kind: "ok",
        msg: "Treasury info fetched! (Note: View functions need to be implemented in the contract)",
      });

      // Placeholder values - in a real implementation, these would come from the contract
      setTreasuryBalance(0);
      setUserHoldings(0);
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error fetching treasury info: ${error.message}`,
      });
    } finally {
      setIsLoadingTreasury(false);
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

  const handleSendMessage = async () => {
    if (!selectedChannelId || !newMessage.trim()) return;

    try {
      const result = await sendMessage(selectedChannelId, newMessage.trim());
      if (result?.success) {
        setNewMessage("");
        setStatus({ kind: "ok", msg: "Message sent!" });
        fetchMessages(selectedChannelId);
      } else {
        setStatus({ kind: "err", msg: "Failed to send message" });
      }
    } catch (error) {
      setStatus({ kind: "err", msg: "Error sending message" });
    }
  };

  const handleInitializeSession = async () => {
    try {
      await initializeManually();
      setStatus({ kind: "ok", msg: "Session key initialized successfully!" });
    } catch (error) {
      setStatus({ kind: "err", msg: "Failed to initialize session key" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
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
              {!sessionKey && currentAccount?.address && (
                <span className="text-sm text-muted-foreground">
                  (Initializing session...)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowCreateGroup(true)}
                disabled={!sessionKey}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Group
              </Button>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Channels */}
        {sidebarOpen && (
          <div className="w-64 border-r bg-card">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Channels</h2>
            </div>

            <div className="p-4">
              {channelsWithMessages.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No channels with messages
                </p>
              ) : (
                <div className="space-y-2">
                  {channelsWithMessages.map((channel) => (
                    <div
                      key={channel.id.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedChannelId === channel.id.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleSelectChannel(channel.id.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {channel.id.id.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {channel.id.id.slice(0, 8)}...
                            </p>
                            <p className="text-xs opacity-70">
                              {channel.auth?.member_permissions?.contents
                                ?.length || 0}{" "}
                              members
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChannel(channel.id.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {selectedChannelId && currentChannel ? (
            <>
              {/* Channel Header */}
              <div className="border-b bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {currentChannel.id.id.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {currentChannel.id.id.slice(0, 12)}...
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {currentChannel.auth?.member_permissions?.contents
                          ?.length || 0}{" "}
                        members
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b">
                <div className="flex">
                  {[
                    { id: "chat", label: "Chat", icon: MessageSquare },
                    { id: "votes", label: "Votes", icon: Vote },
                    { id: "treasury", label: "Treasury", icon: DollarSign },
                    { id: "signals", label: "Signals", icon: TrendingUp },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 flex flex-col">
                {activeTab === "chat" && (
                  <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.length > 0 ? (
                        messages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              message.sender === self
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[70%] p-3 rounded-lg ${
                                message.sender === self
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <p className="text-sm font-medium mb-1">
                                {message.sender === self
                                  ? "You"
                                  : message.sender?.slice(0, 8)}
                              </p>
                              <p className="text-sm">
                                {message.content ||
                                  message.text ||
                                  message.message ||
                                  "No content found"}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      )}
                    </div>

                    {/* Message Input */}
                    <div className="border-t bg-card p-4">
                      <div className="flex gap-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleSendMessage()
                          }
                          placeholder="Type a message..."
                          disabled={isSendingMessage}
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || isSendingMessage}
                        >
                          {isSendingMessage ? "Sending..." : "Send"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "votes" && (
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">Voting</h3>
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Normal Poll</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Create polls for group decisions
                          </p>
                          <Button disabled>Create Poll</Button>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>Policy Change Votes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            Vote on group policy changes
                          </p>
                          <Button disabled>Create Policy Vote</Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {activeTab === "treasury" && (
                  <div className="p-6 space-y-6">
                    <h3 className="text-xl font-semibold mb-4">
                      Treasury Management
                    </h3>

                    {/* Treasury Balance Display */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Treasury Balance
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">
                              {treasuryBalance !== null
                                ? `${treasuryBalance} MIST`
                                : "N/A"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total Balance
                            </div>
                          </div>
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">
                              {userHoldings !== null
                                ? `${userHoldings} MIST`
                                : "N/A"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Your Holdings
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleFetchTreasuryInfo}
                            disabled={isLoadingTreasury}
                            variant="outline"
                          >
                            {isLoadingTreasury
                              ? "Loading..."
                              : "Refresh Balance"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Treasury Operations */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Treasury Operations</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          Manage group funds, proposals, and financial decisions
                        </p>

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
                              placeholder="Amount (in MIST)"
                              value={treasuryAmount}
                              onChange={(e) =>
                                setTreasuryAmount(e.target.value)
                              }
                              type="number"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Button
                            onClick={handleInitTreasury}
                            variant="default"
                          >
                            Initialize Treasury
                          </Button>
                          <Button
                            onClick={handleDepositToTreasury}
                            variant="outline"
                          >
                            Deposit
                          </Button>
                          <Button
                            onClick={handleWithdrawFromTreasury}
                            variant="outline"
                          >
                            Withdraw
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "signals" && (
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">
                      Market Signals
                    </h3>
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
                                onChange={(e) =>
                                  setTokenAddress(e.target.value)
                                }
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
              </div>
            </>
          ) : (
            /* No Channel Selected */
            <div className="flex-1 flex items-center justify-center bg-background">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                  Welcome to Sui Groups
                </h2>
                {!sessionKey && currentAccount?.address ? (
                  <div>
                    <p className="text-muted-foreground mb-6">
                      Initialize your session key to start using the app
                    </p>
                    <Button onClick={handleInitializeSession}>
                      Initialize Session Key
                    </Button>
                  </div>
                ) : !currentAccount?.address ? (
                  <div>
                    <p className="text-muted-foreground mb-6">
                      Connect your wallet to get started
                    </p>
                    <ConnectButton />
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground mb-6">
                      Select a channel to start chatting, or create a new group
                    </p>
                    <Button onClick={() => setShowCreateGroup(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Group
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Members */}
        {selectedChannelId && currentChannel && (
          <div className="w-64 border-l bg-card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Members</h3>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {currentChannel.auth?.member_permissions?.contents?.map(
                  (member, index) => {
                    const memberCapId = member.key;
                    const permissions = member.value.contents;
                    const isOwner = permissions.some((p: any) =>
                      p.name?.includes("EditPermissions"),
                    );
                    const isAdmin = permissions.some((p: any) =>
                      p.name?.includes("EditChannel"),
                    );
                    const role = isOwner
                      ? "Owner"
                      : isAdmin
                        ? "Admin"
                        : "Member";

                    // Get the real address from our map
                    const realAddress = memberAddressesMap.get(memberCapId);
                    const displayAddress = realAddress || "Loading...";

                    return (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          {realAddress
                            ? realAddress.slice(0, 2).toUpperCase()
                            : "??"}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {displayAddress}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {role}
                          </p>
                        </div>
                      </div>
                    );
                  },
                ) || (
                  <p className="text-sm text-muted-foreground">
                    No members found
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Create New Group</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Member Addresses
                  </label>
                  <Input
                    value={memberAddresses}
                    onChange={(e) => setMemberAddresses(e.target.value)}
                    placeholder="Enter addresses separated by commas"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateGroup(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateGroupChannel} className="flex-1">
                    Create Group
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Messages */}
      {status.kind !== "idle" && (
        <div
          className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg ${
            status.kind === "ok"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <p className="text-sm">{status.msg}</p>
        </div>
      )}
    </div>
  );
}
