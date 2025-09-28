import { useState, useEffect } from "react";
import { useGroupsManager } from "../hooks/useGroupsManager";
import { useGroups } from "../hooks/useGroups";
import { useMessaging } from "../hooks/useMessaging";
import { useSessionKey } from "../providers/SessionKeyProvider";
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
    addMember,
    getAdminCapabilities,
  } = useGroups();

  // Get messaging functionality
  const {
    createChannel,
    fetchChannels,
    sendMessage,
    fetchMessages,
    messages,
    isSendingMessage,
  } = useMessaging();

  // Get session key functionality
  const { sessionKey, isInitializing, initializeManually } = useSessionKey();

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

  // Treasury state
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [userHoldings, setUserHoldings] = useState<number | null>(null);
  const [isLoadingTreasury, setIsLoadingTreasury] = useState(false);

  // Chat interface state
  const [showChat, setShowChat] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Channel creation state
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [memberAddresses, setMemberAddresses] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // Add member state
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  const selectedGroup = groups.find(
    (group) => group.data?.objectId === selectedGroupId,
  );

  // Check if current group has a chat
  const getGroupChatId = () => {
    if (!selectedGroup?.data?.objectId) return null;
    const groupChannelMap = JSON.parse(
      localStorage.getItem("groupChannelMap") || "{}",
    );
    return groupChannelMap[selectedGroup.data.objectId] || null;
  };

  const groupChatId = getGroupChatId();

  // Debug: Log messages when they change
  useEffect(() => {
    console.log("📨 Messages updated:", messages);
    console.log("📨 Messages count:", messages.length);
    if (messages.length > 0) {
      console.log("📨 First message structure:", messages[0]);
    }
  }, [messages]);

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

  // Handle session key reinitialization
  const handleReinitializeSessionKey = async () => {
    try {
      setStatus({ kind: "idle" });
      await initializeManually();
      setStatus({
        kind: "ok",
        msg: "Session key reinitialized successfully!",
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Failed to reinitialize session key: ${error.message}`,
      });
    }
  };

  // Handle opening chat
  const handleOpenChat = async () => {
    if (!groupChatId) {
      setStatus({ kind: "err", msg: "No chat available for this group" });
      return;
    }

    try {
      console.log("💬 Opening chat for channel:", groupChatId);
      setShowChat(true);

      // Load blockchain messages
      console.log("🔄 Loading blockchain messages...");
      await fetchMessages(groupChatId);
      console.log("✅ Blockchain messages loaded:", messages.length);

      console.log("✅ Chat opened successfully");
    } catch (error: any) {
      console.error("❌ Error loading chat:", error);
      setStatus({ kind: "err", msg: `Failed to load chat: ${error.message}` });
    }
  };

  // Handle sending blockchain messages
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !groupChatId) return;

    try {
      console.log("📤 Sending blockchain message:", newMessage.trim());
      console.log("📤 To channel:", groupChatId);

      const result = await sendMessage(groupChatId, newMessage.trim());
      console.log("📤 Send result:", result);

      setNewMessage("");
      // Refresh messages after sending
      console.log("🔄 Refreshing messages...");
      await fetchMessages(groupChatId);
      console.log("✅ Messages refreshed, current messages:", messages);
    } catch (error: any) {
      console.error("❌ Error sending message:", error);
      setStatus({
        kind: "err",
        msg: `Failed to send message: ${error.message}`,
      });
    }
  };

  // Create a persistent chat for the current group
  const handleCreateChat = async () => {
    if (!selectedGroup?.data?.objectId) {
      setStatus({ kind: "err", msg: "No group selected" });
      return;
    }

    // Show the form to input member addresses
    setShowChannelForm(true);
  };

  // Handle the actual channel creation with members
  const handleCreateChannelWithMembers = async () => {
    if (!selectedGroup?.data?.objectId || !memberAddresses.trim()) {
      setStatus({ kind: "err", msg: "Please provide member addresses" });
      return;
    }

    setIsCreatingChannel(true);
    setStatus({ kind: "idle" });

    try {
      const groupId = selectedGroup.data.objectId;

      // Parse comma-separated addresses
      const addresses = memberAddresses
        .split(",")
        .map((addr) => addr.trim())
        .filter((addr) => addr.length > 0);

      console.log("🔥 Starting group channel creation flow...");
      console.log("🔥 Group ID:", groupId);
      console.log("🔥 Member addresses:", addresses);

      // Step 0: Automatically fetch admin capability
      console.log("🔥 Step 0: Fetching admin capability...");
      const fetchedAdminCapId = await getAdminCapabilities(groupId);

      if (!fetchedAdminCapId) {
        setStatus({
          kind: "err",
          msg: "No admin capability found for this group. Make sure you're the group creator or have admin permissions.",
        });
        setIsCreatingChannel(false);
        return;
      }

      console.log("✅ Found admin capability:", fetchedAdminCapId);
      setStatus({
        kind: "ok",
        msg: `Found admin capability: ${fetchedAdminCapId.slice(0, 8)}...`,
      });

      // Step 1: Skip group contract member addition due to object versioning issues
      console.log(
        "🔥 Step 1: Skipping group contract member addition due to object versioning issues...",
      );
      console.log(
        "🔥 Creating chat channel directly with provided addresses...",
      );

      setStatus({
        kind: "ok",
        msg: "Creating chat channel directly with provided addresses...",
      });

      const channelResult = await createChannel(addresses);

      if (channelResult?.channelId) {
        console.log("✅ Channel created:", channelResult.channelId);

        // Step 3: Store the group-channel relationship
        console.log("🔥 Step 3: Storing group-channel relationship...");
        const groupChannelMap = JSON.parse(
          localStorage.getItem("groupChannelMap") || "{}",
        );
        groupChannelMap[groupId] = channelResult.channelId;
        localStorage.setItem(
          "groupChannelMap",
          JSON.stringify(groupChannelMap),
        );

        setStatus({
          kind: "ok",
          msg: `🎉 Group chat created successfully! Created encrypted channel with ${addresses.length} members.`,
        });

        // Close the form and refresh
        setShowChannelForm(false);
        setMemberAddresses("");

        // Refresh channels to show the new one
        setTimeout(() => {
          fetchChannels();
        }, 2000);
      } else {
        setStatus({ kind: "err", msg: "Failed to create chat channel" });
      }
    } catch (error: any) {
      console.error("❌ Error in channel creation flow:", error);
      setStatus({ kind: "err", msg: `Error creating chat: ${error.message}` });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // Handle adding a single member to the group
  const handleAddMember = async () => {
    if (!selectedGroup?.data?.objectId || !newMemberAddress.trim()) {
      setStatus({ kind: "err", msg: "Please provide a member address" });
      return;
    }

    setIsAddingMember(true);
    setStatus({ kind: "idle" });

    try {
      const groupId = selectedGroup.data.objectId;
      const address = newMemberAddress.trim();

      console.log("🔥 Adding member to group...");
      console.log("🔥 Group ID:", groupId);
      console.log("🔥 Member address:", address);

      // Fetch admin capability
      console.log("🔥 Fetching admin capability...");
      const fetchedAdminCapId = await getAdminCapabilities(groupId);

      if (!fetchedAdminCapId) {
        setStatus({
          kind: "err",
          msg: "No admin capability found for this group. Make sure you're the group creator or have admin permissions.",
        });
        setIsAddingMember(false);
        return;
      }

      console.log("✅ Found admin capability:", fetchedAdminCapId);
      setStatus({
        kind: "ok",
        msg: `Found admin capability: ${fetchedAdminCapId.slice(0, 8)}...`,
      });

      // Add the member to the group
      console.log("🔥 Adding member to group contract...");
      const addResult = await addMember(groupId, fetchedAdminCapId, address);
      console.log("✅ Member added to group:", addResult.digest);

      setStatus({
        kind: "ok",
        msg: `✅ Member added to group successfully! Transaction: ${addResult.digest}`,
      });

      // Close the form and clear the input
      setShowAddMemberForm(false);
      setNewMemberAddress("");

      // Refresh groups to show updated member list
      setTimeout(() => {
        // You might want to add a refresh function here
        console.log("🔄 Member added, group should be refreshed");
      }, 2000);
    } catch (error: any) {
      console.error("❌ Error adding member:", error);
      setStatus({ kind: "err", msg: `Error adding member: ${error.message}` });
    } finally {
      setIsAddingMember(false);
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
                        onClick={() => setShowAddMemberForm(true)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        Add Member
                      </Button>
                      {groupChatId ? (
                        <Button
                          onClick={handleOpenChat}
                          className="flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Open Chat
                        </Button>
                      ) : (
                        <Button
                          onClick={handleCreateChat}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Create Chat
                        </Button>
                      )}
                      <Button
                        onClick={handleReinitializeSessionKey}
                        variant="outline"
                        disabled={isInitializing}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {isInitializing
                          ? "Reinitializing..."
                          : "Reinit Session Key"}
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
                          <strong>Chat Status:</strong>{" "}
                          {groupChatId ? (
                            <span className="text-green-600">
                              💬 Chat Available
                            </span>
                          ) : (
                            <span className="text-gray-500">
                              No chat created
                            </span>
                          )}
                        </p>
                        <p>
                          <strong>Session Key:</strong>{" "}
                          {sessionKey ? (
                            <span className="text-green-600">✅ Active</span>
                          ) : (
                            <span className="text-red-500">
                              ❌ Not initialized
                            </span>
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Blockchain Chat Interface */}
                  {showChat && (
                    <Card className="mt-4">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Group Chat</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowChat(false)}
                          >
                            Close Chat
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* Messages */}
                        <div className="h-64 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
                          {messages.length === 0 ? (
                            <p className="text-gray-500 text-center">
                              No messages yet. Start the conversation!
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {messages.map((message, index) => (
                                <div
                                  key={index}
                                  className="flex flex-col space-y-1"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-700 font-medium">
                                      {message.sender || "Unknown"}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      {message.createdAtMs
                                        ? new Date(
                                            parseInt(message.createdAtMs),
                                          ).toLocaleTimeString()
                                        : new Date().toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <p className="text-sm text-black">
                                      {message.text || "No content"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Message Input */}
                        <div className="flex space-x-2">
                          <Input
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                handleSendMessage();
                              }
                            }}
                            disabled={isSendingMessage}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={
                              !newMessage.trim() ||
                              isSendingMessage ||
                              !groupChatId
                            }
                          >
                            {isSendingMessage ? "Sending..." : "Send"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Channel Creation Form */}
                  {showChannelForm && (
                    <Card className="mt-4">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Create Group Chat</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowChannelForm(false);
                              setMemberAddresses("");
                            }}
                          >
                            Cancel
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Member Addresses (comma-separated)
                            </label>
                            <Input
                              placeholder="0x123..., 0x456..., 0x789..."
                              value={memberAddresses}
                              onChange={(e) =>
                                setMemberAddresses(e.target.value)
                              }
                              className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Enter Sui addresses separated by commas. Your
                              admin capability will be automatically detected,
                              then members will be added to the group contract,
                              and finally an encrypted chat channel will be
                              created.
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={handleCreateChannelWithMembers}
                              disabled={
                                !memberAddresses.trim() || isCreatingChannel
                              }
                              className="flex-1"
                            >
                              {isCreatingChannel
                                ? "Creating..."
                                : "Create Group Chat"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Add Member Form */}
                  {showAddMemberForm && (
                    <Card className="mt-4">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Add Member to Group</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAddMemberForm(false);
                              setNewMemberAddress("");
                            }}
                          >
                            Cancel
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Member Address
                            </label>
                            <Input
                              placeholder="0x123..."
                              value={newMemberAddress}
                              onChange={(e) =>
                                setNewMemberAddress(e.target.value)
                              }
                              className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Enter the Sui address of the member you want to
                              add to this group. Your admin capability will be
                              automatically detected and used to add the member.
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={handleAddMember}
                              disabled={
                                !newMemberAddress.trim() || isAddingMember
                              }
                              className="flex-1"
                            >
                              {isAddingMember
                                ? "Adding Member..."
                                : "Add Member"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
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
                          {isLoadingTreasury ? "Loading..." : "Refresh Balance"}
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
                            onChange={(e) => setTreasuryAmount(e.target.value)}
                            type="number"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button onClick={handleInitTreasury} variant="default">
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
