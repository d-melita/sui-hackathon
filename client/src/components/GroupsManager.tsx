import { useState, useEffect } from "react";
import { useGroupsManager } from "../hooks/useGroupsManager";
import { useGroups } from "../hooks/useGroups";
import { useMessaging } from "../hooks/useMessaging";
import { useSessionKey } from "../providers/SessionKeyProvider";
import { useSeal } from "../hooks/useSeal";
import { useSuiClient } from "@mysten/dapp-kit";
import { fromHex } from "@mysten/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ConnectButton } from "@mysten/dapp-kit";
import {
  Plus,
  Users,
  DollarSign,
  TrendingUp,
  Vote,
  Copy,
  Check,
} from "lucide-react";

export default function GroupsManager() {
  const suiClient = useSuiClient();
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
    fetchSignals,
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

  // Get Seal functionality
  const { encryptTokenAddress, decryptEncryptedTokenAddress, isSealReady } =
    useSeal(sessionKey || undefined);

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
  const [treasuryAmount, setTreasuryAmount] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [confidence, setConfidence] = useState("");
  const [signalId, setSignalId] = useState("");
  const [encryptedTokenAddress, setEncryptedTokenAddress] = useState<
    string | null
  >(null);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Signal display state
  const [signals, setSignals] = useState<any[]>([]);
  const [copiedCiphertext, setCopiedCiphertext] = useState<string | null>(null);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);

  // Treasury state
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);

  // Chat interface state
  const [showChat, setShowChat] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Channel creation state
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [memberAddresses, setMemberAddresses] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

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
      // Load messages for the chat
      console.log("🔄 Loading messages...");
      await fetchMessages(groupChatId);
      console.log("✅ Messages loaded:", messages);
      console.log("✅ Messages length:", messages.length);
      if (messages.length > 0) {
        console.log("✅ First message details:", {
          text: messages[0].text,
          sender: messages[0].sender,
          createdAtMs: messages[0].createdAtMs,
          allKeys: Object.keys(messages[0]),
        });
      }
    } catch (error: any) {
      console.error("❌ Error loading chat:", error);
      setStatus({ kind: "err", msg: `Failed to load chat: ${error.message}` });
    }
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !groupChatId) return;

    try {
      console.log("📤 Sending message:", newMessage.trim());
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

      // Step 1: Add members to the group contract
      console.log("🔥 Step 1: Adding members to group contract...");
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        console.log(
          `🔥 Adding member ${i + 1}/${addresses.length}: ${address}`,
        );

        const addResult = await addMember(groupId, fetchedAdminCapId, address);
        console.log(`✅ Member ${i + 1} added to group:`, addResult.digest);

        setStatus({
          kind: "ok",
          msg: `Added member ${i + 1}/${addresses.length} to group. Transaction: ${addResult.digest}`,
        });

        // Add delay between member additions to prevent version conflicts
        if (i < addresses.length - 1) {
          console.log("⏳ Waiting 10 seconds before adding next member...");
          setStatus({
            kind: "ok",
            msg: `Waiting 10 seconds before adding next member... (${i + 1}/${addresses.length} completed)`,
          });
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }

      // Step 2: Create the channel with all members
      console.log("🔥 Step 2: Creating channel with members...");
      console.log("⏳ Waiting 2 seconds before creating channel...");
      setStatus({
        kind: "ok",
        msg: "All members added to group. Waiting 2 seconds before creating channel...",
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
          msg: `🎉 Group chat created successfully! Added ${addresses.length} members to group and created encrypted channel.`,
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

  // Group management functions
  const handleInitTreasury = async () => {
    if (!selectedGroupId || !treasuryAmount.trim()) {
      setStatus({
        kind: "err",
        msg: "Please select a group and fill all fields",
      });
      return;
    }

    try {
      setStatus({ kind: "idle" });

      // Get admin capability for the group
      const adminCapId = await getAdminCapabilities(selectedGroupId);

      if (!adminCapId) {
        setStatus({
          kind: "err",
          msg: "No admin capability found for this group. Make sure you have admin permissions.",
        });
        return;
      }

      const result = await initTreasury(
        selectedGroupId,
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
    if (!selectedGroupId || !treasuryAmount.trim()) {
      setStatus({
        kind: "err",
        msg: "Please select a group and fill all fields",
      });
      return;
    }

    try {
      setStatus({ kind: "idle" });

      const result = await depositToTreasury(
        selectedGroupId,
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
    if (!selectedGroupId || !treasuryAmount.trim()) {
      setStatus({
        kind: "err",
        msg: "Please select a group and fill all fields",
      });
      return;
    }

    try {
      setStatus({ kind: "idle" });

      console.log(
        "🔍 FRONTEND WITHDRAW DEBUG - Calling withdrawFromTreasury with:",
      );
      console.log("🔍 - selectedGroupId:", selectedGroupId);
      console.log("🔍 - treasuryAmount (raw):", treasuryAmount);
      console.log("🔍 - treasuryAmount (parsed):", parseInt(treasuryAmount));
      console.log("🔍 - treasuryAmount type:", typeof parseInt(treasuryAmount));

      const result = await withdrawFromTreasury(
        selectedGroupId,
        parseInt(treasuryAmount),
      );
      setStatus({
        kind: "ok",
        msg: `Withdrawn from treasury! Transaction: ${result.digest}`,
      });
    } catch (error: any) {
      console.log("🔍 FRONTEND WITHDRAW DEBUG - Error caught:", error);
      setStatus({
        kind: "err",
        msg: `Error withdrawing: ${error.message}`,
      });
    }
  };

  // Fetch treasury balance from the contract
  const handleFetchTreasuryBalance = async () => {
    if (!selectedGroupId) {
      setStatus({ kind: "err", msg: "Please select a group" });
      return;
    }

    try {
      setStatus({ kind: "idle" });

      // Get the group object to read treasury balance
      const groupObject = await suiClient.getObject({
        id: selectedGroupId,
        options: { showContent: true },
      });

      console.log("🔍 Group object:", groupObject);

      if (groupObject.data?.content && "fields" in groupObject.data.content) {
        const fields = groupObject.data.content.fields as any;
        console.log("🔍 Group fields:", fields);

        // Check if treasury exists
        if (fields.treasury && fields.treasury.fields) {
          const treasuryFields = fields.treasury.fields;
          console.log("🔍 Treasury fields:", treasuryFields);

          // Get total balance from treasury - the structure might be different
          let totalBalance = 0;
          if (treasuryFields.balance) {
            // Try different possible structures
            if (
              treasuryFields.balance.fields &&
              treasuryFields.balance.fields.value
            ) {
              totalBalance = treasuryFields.balance.fields.value;
            } else if (treasuryFields.balance.value) {
              totalBalance = treasuryFields.balance.value;
            } else if (typeof treasuryFields.balance === "string") {
              totalBalance = parseInt(treasuryFields.balance);
            }
          }

          console.log("💰 Total balance found:", totalBalance);
          // Convert MIST to SUI (1 SUI = 10^9 MIST)
          const balanceInSui = totalBalance / 1000000000;
          setTreasuryBalance(balanceInSui);

          setStatus({
            kind: "ok",
            msg: `Treasury balance: ${balanceInSui.toFixed(9)} SUI`,
          });
        } else {
          setTreasuryBalance(0);
          setStatus({
            kind: "ok",
            msg: "No treasury found for this group",
          });
        }
      } else {
        setTreasuryBalance(0);
        setStatus({
          kind: "err",
          msg: "Could not fetch group data",
        });
      }
    } catch (error: any) {
      console.error("❌ Error fetching treasury balance:", error);
      setStatus({
        kind: "err",
        msg: `Error fetching treasury balance: ${error.message}`,
      });
      setTreasuryBalance(0);
    }
  };

  // Fetch user's holdings in the treasury

  const handleEncryptTokenAddress = async () => {
    if (!selectedGroupId || !tokenAddress.trim()) {
      setStatus({
        kind: "err",
        msg: "Please select a group and enter a token address",
      });
      return;
    }

    if (!isSealReady) {
      setStatus({
        kind: "err",
        msg: "Seal not ready. Please initialize session key first.",
      });
      return;
    }

    try {
      setIsEncrypting(true);
      setStatus({ kind: "idle" });

      console.log("🔐 Encrypting token address:", tokenAddress);
      const encryptionResult = await encryptTokenAddress(
        tokenAddress,
        selectedGroupId,
        "0xd67f6b7d67152b9efe615063d7a4e5326c6f213f67e67e4e8ef582342b1db0c7", // GROUPS_PACKAGE_ID
      );

      console.log("🔐 Encryption result:", encryptionResult);
      const ciphertextHex = "0x" + encryptionResult.encryptedTokenAddress;
      setEncryptedTokenAddress(ciphertextHex);

      setStatus({
        kind: "ok",
        msg: `Token address encrypted successfully!\nCiphertext: ${ciphertextHex}`,
      });
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error encrypting token address: ${error.message}`,
      });
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleCreateSignal = async (bullish: boolean) => {
    if (!selectedGroupId || !tokenAddress.trim() || !confidence.trim()) {
      setStatus({
        kind: "err",
        msg: "Please select a group and fill all fields",
      });
      return;
    }

    if (!encryptedTokenAddress) {
      setStatus({
        kind: "err",
        msg: "Please encrypt the token address first using the 'Encrypt' button.",
      });
      return;
    }

    try {
      setStatus({ kind: "idle" });

      // Get admin capability for the group
      const adminCapId = await getAdminCapabilities(selectedGroupId);
      if (!adminCapId) {
        setStatus({
          kind: "err",
          msg: "No admin capability found for this group. Make sure you have admin permissions.",
        });
        return;
      }

      // Convert hex string back to bytes for the contract
      const ciphertextBytes = fromHex(
        encryptedTokenAddress.startsWith("0x")
          ? encryptedTokenAddress.slice(2)
          : encryptedTokenAddress,
      );

      // Create signal with encrypted token address
      const result = await createSignal(
        selectedGroupId,
        adminCapId,
        ciphertextBytes, // Pass the encrypted bytes
        bullish,
        parseInt(confidence),
      );

      const createdId = (result as any)?.signalId;

      // Add to signals list for display
      const newSignal = {
        id: createdId,
        tokenAddress: "Encrypted", // Show as encrypted
        ciphertext: fromHex(
          encryptedTokenAddress.startsWith("0x")
            ? encryptedTokenAddress.slice(2)
            : encryptedTokenAddress,
        ), // Store as Uint8Array
        bullish,
        confidence: parseInt(confidence),
        sender: "You", // Current user
        createdAt: new Date().toISOString(),
      };

      setSignals((prev) => [newSignal, ...prev]);

      setStatus({
        kind: "ok",
        msg: `${bullish ? "Bullish" : "Bearish"} signal created!\nSignal ID: ${createdId ?? "unknown"}\nCiphertext: ${encryptedTokenAddress}`,
      });

      // Clear form
      setTokenAddress("");
      setConfidence("");
      setEncryptedTokenAddress(null);
    } catch (error: any) {
      setStatus({
        kind: "err",
        msg: `Error creating signal: ${error.message}`,
      });
    }
  };

  const handleUpvoteSignal = async () => {
    if (!selectedGroupId || !signalId.trim()) {
      setStatus({
        kind: "err",
        msg: "Please select a group and fill all fields",
      });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await upvoteSignal(selectedGroupId, signalId);
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
    if (!selectedGroupId || !signalId.trim()) {
      setStatus({
        kind: "err",
        msg: "Please select a group and fill all fields",
      });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      const result = await downvoteSignal(selectedGroupId, signalId);
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

  const handleCopyCiphertext = async (ciphertext: string) => {
    try {
      await navigator.clipboard.writeText(ciphertext);
      setCopiedCiphertext(ciphertext);
      setTimeout(() => setCopiedCiphertext(null), 2000);
    } catch (error) {
      console.error("Failed to copy ciphertext:", error);
    }
  };

  const handleFetchSignals = async () => {
    if (!selectedGroupId) {
      setStatus({ kind: "err", msg: "Please select a group first" });
      return;
    }

    try {
      setStatus({ kind: "idle" });
      console.log("🔍 Fetching signals for group:", selectedGroupId);

      const fetchedSignals = await fetchSignals(selectedGroupId);
      console.log("🔍 Fetched signals:", fetchedSignals);

      // Convert fetched signals to our display format
      const displaySignals = fetchedSignals.map((signal: any) => ({
        id: signal.id,
        tokenAddress: "Encrypted", // The tokenAddress is encrypted bytes, not readable
        ciphertext: signal.tokenAddress
          ? Array.isArray(signal.tokenAddress)
            ? new Uint8Array(signal.tokenAddress)
            : signal.tokenAddress
          : null,
        bullish: signal.bullish,
        confidence: signal.confidence,
        rating: signal.rating,
        sender: signal.caller
          ? typeof signal.caller === "string"
            ? signal.caller
            : Array.isArray(signal.caller)
              ? "0x" +
                Array.from(signal.caller)
                  .map((b: any) => b.toString(16).padStart(2, "0"))
                  .join("")
              : String(signal.caller)
          : "Unknown", // caller is the creator/author of the signal
        createdAt: new Date().toISOString(),
      }));

      setSignals(displaySignals);
      setStatus({
        kind: "ok",
        msg: `Fetched ${displaySignals.length} signals`,
      });
    } catch (error: any) {
      console.error("❌ Error fetching signals:", error);
      setStatus({
        kind: "err",
        msg: `Error fetching signals: ${error.message}`,
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

                  {/* Chat Interface */}
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
                              {messages.map((message, index) => {
                                // Debug: log the message structure
                                console.log("📨 Message structure:", message);
                                console.log("📨 Message text:", message.text);
                                console.log(
                                  "📨 Message sender:",
                                  message.sender,
                                );
                                console.log(
                                  "📨 Message createdAtMs:",
                                  message.createdAtMs,
                                );
                                console.log(
                                  "📨 Message keys:",
                                  Object.keys(message),
                                );

                                return (
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
                                      {/* Debug: Show raw message if text is empty */}
                                      {!message.text && (
                                        <div className="text-xs text-black mt-1">
                                          Debug:{" "}
                                          {JSON.stringify(message, null, 2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
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
                            disabled={!newMessage.trim() || isSendingMessage}
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
                </div>
              )}

              {activeTab === "treasury" && (
                <div className="p-6">
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
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">
                          {treasuryBalance !== null
                            ? `${treasuryBalance.toFixed(9)} SUI`
                            : "N/A"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total Balance
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleFetchTreasuryBalance}
                          variant="outline"
                          className="flex-1"
                        >
                          Refresh Balance
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
                              placeholder="Token Address (e.g. 0x...)"
                              value={tokenAddress}
                              onChange={(e) => setTokenAddress(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleEncryptTokenAddress}
                              disabled={
                                !isSealReady ||
                                isEncrypting ||
                                !tokenAddress.trim()
                              }
                              variant="outline"
                              className="flex-1"
                            >
                              {isEncrypting
                                ? "Encrypting..."
                                : "🔐 Encrypt Token Address"}
                            </Button>
                          </div>
                          {encryptedTokenAddress && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                              <p className="text-sm text-green-800 font-medium">
                                ✅ Token address encrypted!
                              </p>
                              <p className="text-xs text-green-600 mt-1 break-all">
                                Ciphertext: {encryptedTokenAddress}
                              </p>
                            </div>
                          )}
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
                            disabled={!isSealReady || !encryptedTokenAddress}
                          >
                            ↑ Create Bullish Signal
                          </Button>
                          <Button
                            onClick={() => handleCreateSignal(false)}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={!isSealReady || !encryptedTokenAddress}
                          >
                            ↓ Create Bearish Signal
                          </Button>
                        </div>
                        {!isSealReady && (
                          <p className="text-sm text-yellow-600">
                            ⚠️ Seal not ready. Please initialize session key
                            first.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Display Signals */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Recent Signals</CardTitle>
                          <Button
                            onClick={handleFetchSignals}
                            variant="outline"
                            size="sm"
                          >
                            Fetch Signals
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {signals.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            No signals yet. Create one above!
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {signals.map((signal, index) => (
                              <div
                                key={signal.id || index}
                                className="border rounded-lg p-4 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        signal.bullish
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {signal.bullish
                                        ? "↑ Bullish"
                                        : "↓ Bearish"}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      Confidence: {signal.confidence}%
                                    </span>
                                    <span className="text-sm text-muted-foreground ml-2">
                                      Rating: {signal.rating || 0}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(
                                      signal.createdAt,
                                    ).toLocaleString()}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  <div>
                                    <span className="text-sm font-medium">
                                      Signal ID:
                                    </span>
                                    <span className="text-sm ml-2 font-mono">
                                      {signal.id}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-sm font-medium">
                                      Token:
                                    </span>
                                    <span className="text-sm ml-2 font-mono">
                                      {signal.tokenAddress}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-sm font-medium">
                                      Creator:
                                    </span>
                                    <span className="text-sm ml-2">
                                      {signal.sender}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-sm font-medium">
                                      Ciphertext:
                                    </span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <code className="text-xs bg-gray-100 p-2 rounded flex-1 break-all text-black">
                                        {signal.ciphertext
                                          ? typeof signal.ciphertext ===
                                            "string"
                                            ? signal.ciphertext
                                            : "0x" +
                                              Array.from(signal.ciphertext)
                                                .map((b: any) =>
                                                  b
                                                    .toString(16)
                                                    .padStart(2, "0"),
                                                )
                                                .join("")
                                          : "No ciphertext available"}
                                      </code>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleCopyCiphertext(
                                            typeof signal.ciphertext ===
                                              "string"
                                              ? signal.ciphertext
                                              : "0x" +
                                                  Array.from(signal.ciphertext)
                                                    .map((b: any) =>
                                                      b
                                                        .toString(16)
                                                        .padStart(2, "0"),
                                                    )
                                                    .join(""),
                                          )
                                        }
                                        className="shrink-0"
                                      >
                                        {copiedCiphertext ===
                                        signal.ciphertext ? (
                                          <Check className="w-4 h-4" />
                                        ) : (
                                          <Copy className="w-4 h-4" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={async () => {
                                          if (!selectedGroupId) return;
                                          try {
                                            setDecryptingId(
                                              signal.id || String(index),
                                            );
                                            const decryptedHex =
                                              await decryptEncryptedTokenAddress(
                                                signal.ciphertext,
                                                selectedGroupId,
                                                "0xd67f6b7d67152b9efe615063d7a4e5326c6f213f67e67e4e8ef582342b1db0c7",
                                              );
                                            setSignals((prev) =>
                                              prev.map((s, i) =>
                                                (s.id || String(i)) ===
                                                (signal.id || String(index))
                                                  ? {
                                                      ...s,
                                                      decrypted: decryptedHex,
                                                    }
                                                  : s,
                                              ),
                                            );
                                          } catch (error: any) {
                                            setStatus({
                                              kind: "err",
                                              msg: `Failed to decrypt: ${error.message}`,
                                            });
                                          } finally {
                                            setDecryptingId(null);
                                          }
                                        }}
                                        className="shrink-0"
                                      >
                                        {decryptingId ===
                                        (signal.id || String(index))
                                          ? "Decrypting..."
                                          : "Decrypt"}
                                      </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Copy this ciphertext to decrypt off-chain
                                      using Seal tools
                                    </p>
                                    {signal.decrypted && (
                                      <div className="mt-2 text-sm">
                                        <span className="font-medium">
                                          Decrypted token (hex):
                                        </span>
                                        <span className="ml-2 font-mono">
                                          {signal.decrypted}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
