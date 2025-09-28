import { useMessagingClient } from "../providers/MessagingClientProvider";
import { useSessionKey } from "../providers/SessionKeyProvider";
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useState, useCallback, useEffect } from "react";
import { Transaction } from "@mysten/sui/transactions";
import {
  DecryptedChannelObject,
  DecryptMessageResult,
} from "@mysten/messaging";

// Package ID for the messaging contract (unused but kept for reference)
// const PACKAGE_ID =
//   "0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d";

export const useMessaging = () => {
  const messagingClient = useMessagingClient();
  const { sessionKey, isInitializing, error } = useSessionKey();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  // Channel state
  const [channels, setChannels] = useState<DecryptedChannelObject[]>([]);
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isFetchingChannels, setIsFetchingChannels] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Current channel state
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [currentChannel, setCurrentChannel] =
    useState<DecryptedChannelObject | null>(null);
  const [messages, setMessages] = useState<DecryptMessageResult[]>([]);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messagesCursor, setMessagesCursor] = useState<bigint | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  // No caching - fetch fresh capabilities each time to avoid version conflicts

  // Create channel function
  const createChannel = useCallback(
    async (recipientAddresses: string[]) => {
      console.log("🔍 createChannel called with:", recipientAddresses);
      console.log("🔍 messagingClient:", !!messagingClient);
      console.log("🔍 currentAccount:", currentAccount?.address);
      console.log("🔍 sessionKey:", !!sessionKey);

      if (!messagingClient || !currentAccount) {
        const error =
          "[createChannel] Messaging client or account not available";
        console.error("❌", error);
        setChannelError(error);
        return null;
      }

      if (!sessionKey) {
        const error = "[createChannel] Session key not available";
        console.error("❌", error);
        setChannelError(error);
        return null;
      }

      setIsCreatingChannel(true);
      setChannelError(null);

      try {
        // Create channel flow
        const flow = messagingClient.createChannelFlow({
          creatorAddress: currentAccount.address,
          initialMemberAddresses: recipientAddresses,
        });

        // Step 1: Build and execute channel creation
        console.log("🔄 Step 1: Building channel creation transaction");
        const channelTx = flow.build();
        // Set gas budget on the transaction
        channelTx.setGasBudget(50000000); // 50M gas units for channel creation
        const { digest } = await signAndExecute({
          transaction: channelTx,
        });
        console.log("✅ Step 1: Channel creation transaction sent", digest);

        // Wait for transaction and get channel ID
        console.log("🔄 Step 2: Waiting for channel creation transaction");
        const { objectChanges } = await suiClient.waitForTransaction({
          digest,
          options: { showObjectChanges: true },
        });

        const createdChannel = objectChanges?.find(
          (change) =>
            change.type === "created" &&
            change.objectType?.endsWith("::channel::Channel"),
        );

        const channelId = (createdChannel as any)?.objectId;
        console.log("✅ Step 2: Channel created with ID", channelId);

        // Step 3: Complete the flow (SDK handles everything automatically)
        console.log("🔄 Step 3: Completing channel creation flow");
        console.log(
          "✅ Step 3: Channel creation complete - SDK handles member caps and encryption automatically",
        );

        // Refresh channels list
        await fetchChannels();

        return { channelId };
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? `[createChannel] ${err.message}`
            : "[createChannel] Failed to create channel";
        setChannelError(errorMsg);
        console.error("Error creating channel:", err);
        return null;
      } finally {
        setIsCreatingChannel(false);
      }
    },
    [messagingClient, currentAccount, signAndExecute, suiClient],
  );

  // Fetch channels function
  const fetchChannels = useCallback(async () => {
    if (!messagingClient || !currentAccount) {
      return;
    }

    setIsFetchingChannels(true);
    setChannelError(null);

    try {
      const response = await messagingClient.getChannelObjectsByAddress({
        address: currentAccount.address,
        limit: 10,
      });

      setChannels(response.channelObjects);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? `[fetchChannels] ${err.message}`
          : "[fetchChannels] Failed to fetch channels";
      setChannelError(errorMsg);
      console.error("Error fetching channels:", err);
    } finally {
      setIsFetchingChannels(false);
    }
  }, [messagingClient, currentAccount]);

  // Get channel by ID
  const getChannelById = useCallback(
    async (channelId: string) => {
      if (!messagingClient || !currentAccount) {
        return null;
      }

      setChannelError(null);

      try {
        const response = await messagingClient.getChannelObjectsByChannelIds({
          channelIds: [channelId],
          userAddress: currentAccount.address,
        });

        if (response.length > 0) {
          setCurrentChannel(response[0]);
          return response[0];
        }
        return null;
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? `[getChannelById] ${err.message}`
            : "[getChannelById] Failed to fetch channel";
        setChannelError(errorMsg);
        console.error("Error fetching channel:", err);
        return null;
      }
    },
    [messagingClient, currentAccount],
  );

  // Fetch messages for a channel
  const fetchMessages = useCallback(
    async (channelId: string, cursor: bigint | null = null) => {
      if (!messagingClient || !currentAccount) {
        return;
      }

      setIsFetchingMessages(true);
      setChannelError(null);

      try {
        console.log("🔄 Fetching messages for channel:", channelId);
        const response = await messagingClient.getChannelMessages({
          channelId,
          userAddress: currentAccount.address,
          cursor,
          limit: 20,
          direction: "backward",
        });

        console.log("📨 Raw response:", response);
        console.log("📨 Response messages:", response.messages);
        console.log("📨 Messages count:", response.messages.length);

        if (response.messages.length > 0) {
          console.log("📨 First message in response:", response.messages[0]);
          console.log("📨 First message text:", response.messages[0].text);
          console.log(
            "📨 First message keys:",
            Object.keys(response.messages[0]),
          );
        }

        if (cursor === null) {
          // First fetch, replace messages
          console.log("📨 Setting messages (first fetch)");
          setMessages(response.messages);
        } else {
          // Pagination, append older messages
          console.log("📨 Appending messages (pagination)");
          setMessages((prev) => [...response.messages, ...prev]);
        }

        setMessagesCursor(response.cursor);
        setHasMoreMessages(response.hasNextPage);
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? `[fetchMessages] ${err.message}`
            : "[fetchMessages] Failed to fetch messages";
        setChannelError(errorMsg);
        console.error("Error fetching messages:", err);
      } finally {
        setIsFetchingMessages(false);
      }
    },
    [messagingClient, currentAccount],
  );

  // Get member cap for channel (with fresh fetch to avoid version conflicts)
  const getMemberCapForChannel = useCallback(
    async (channelId: string) => {
      if (!messagingClient || !currentAccount) {
        return null;
      }

      try {
        // Always fetch fresh memberships to avoid version conflicts
        const memberships = await messagingClient.getChannelMemberships({
          address: currentAccount.address,
        });

        const membership = memberships.memberships.find(
          (m) => m.channel_id === channelId,
        );
        return membership?.member_cap_id || null;
      } catch (err) {
        console.error("Error getting member cap:", err);
        return null;
      }
    },
    [messagingClient, currentAccount],
  );

  // Get encrypted key for channel (with fresh fetch to avoid version conflicts)
  const getEncryptedKeyForChannel = useCallback(
    async (channelId: string) => {
      // Always fetch fresh channel data to avoid version conflicts
      const channel = await getChannelById(channelId);
      if (!channel) return null;

      const encryptedKeyBytes = channel.encryption_key_history.latest;
      const keyVersion = channel.encryption_key_history.latest_version;

      return {
        $kind: "Encrypted" as const,
        encryptedBytes: new Uint8Array(encryptedKeyBytes),
        version: keyVersion,
      };
    },
    [getChannelById],
  );

  // Get channel members with real addresses
  const getChannelMembers = useCallback(
    async (channelId: string) => {
      if (!messagingClient || !currentAccount) {
        return [];
      }

      try {
        console.log("🔍 Fetching members for channel:", channelId);

        // Get the channel object to access member permissions
        const channel = await getChannelById(channelId);
        if (!channel) {
          console.log("❌ Channel not found");
          return [];
        }

        console.log("📋 Channel object:", channel);
        console.log(
          "👥 Member permissions:",
          channel.auth?.member_permissions?.contents,
        );

        const memberAddresses = [];

        // Get all memberships to find the actual member addresses
        const allMemberships = await messagingClient.getChannelMemberships({
          address: currentAccount.address,
        });

        console.log("📋 All memberships:", allMemberships);

        // For each member permission, find the corresponding membership
        if (channel.auth?.member_permissions?.contents) {
          for (const memberPermission of channel.auth.member_permissions
            .contents) {
            const memberCapId = memberPermission.key;
            const permissions = memberPermission.value.contents;

            // Find the membership that matches this member cap
            const membership = allMemberships.memberships.find(
              (m) => m.member_cap_id === memberCapId,
            );

            if (membership) {
              // Determine role based on permissions
              const isOwner = permissions.some((p: any) =>
                p.name?.includes("EditPermissions"),
              );
              const isAdmin = permissions.some((p: any) =>
                p.name?.includes("EditChannel"),
              );
              const role = isOwner ? "Owner" : isAdmin ? "Admin" : "Member";

              memberAddresses.push({
                address: (membership as any).address || "Unknown",
                memberCapId: memberCapId,
                role: role,
              });
            }
          }
        }

        console.log("✅ Final member addresses:", memberAddresses);
        return memberAddresses;
      } catch (err) {
        console.error("Error getting channel members:", err);
        return [];
      }
    },
    [messagingClient, currentAccount, getChannelById],
  );

  // Send message function with retry logic
  const sendMessage = useCallback(
    async (channelId: string, message: string, retryCount = 0) => {
      if (!messagingClient || !currentAccount) {
        setChannelError(
          "[sendMessage] Messaging client or account not available",
        );
        return null;
      }

      setIsSendingMessage(true);
      setChannelError(null);

      try {
        // Use the simplified SDK approach (no manual member cap fetching)
        console.log("🔄 Sending message with simplified SDK approach");

        // Get member cap ID (with fresh fetch to avoid version conflicts)
        const memberCapId = await getMemberCapForChannel(channelId);
        if (!memberCapId) {
          throw new Error("No member cap found for channel");
        }

        // Get encrypted key (with fresh fetch to avoid version conflicts)
        const encryptedKey = await getEncryptedKeyForChannel(channelId);
        if (!encryptedKey) {
          throw new Error("No encrypted key found for channel");
        }

        // Create and execute send message transaction
        const tx = new Transaction();
        const sendMessageTxBuilder = await messagingClient.sendMessage(
          channelId,
          memberCapId,
          currentAccount.address,
          message,
          encryptedKey,
        );
        await sendMessageTxBuilder(tx);

        const { digest } = await signAndExecute({ transaction: tx });

        // Wait for transaction
        await suiClient.waitForTransaction({
          digest,
          options: { showEffects: true },
        });

        // Refresh messages to show the new one
        console.log("🔄 Refreshing messages after sending...");
        await fetchMessages(channelId);
        console.log("✅ Messages refreshed after sending");

        return { digest };
      } catch (err) {
        // Check if it's a version conflict error and retry
        const isVersionConflict =
          err instanceof Error &&
          (err.message.includes("not available for consumption") ||
            err.message.includes("Version") ||
            err.message.includes("current version") ||
            err.message.includes("Object ID") ||
            err.message.includes("Digest"));

        if (isVersionConflict && retryCount < 3) {
          console.log(
            `🔄 Version conflict detected, retrying... (attempt ${retryCount + 1}/3)`,
          );

          // Wait before retrying with exponential backoff
          const delay = 1000 + retryCount * 1000; // 1s, 2s, 3s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));

          return sendMessage(channelId, message, retryCount + 1);
        }

        const errorMsg =
          err instanceof Error
            ? `[sendMessage] ${err.message}`
            : "[sendMessage] Failed to send message";
        setChannelError(errorMsg);
        console.error("Error sending message:", err);
        return null;
      } finally {
        setIsSendingMessage(false);
      }
    },
    [
      messagingClient,
      currentAccount,
      signAndExecute,
      suiClient,
      getMemberCapForChannel,
      getEncryptedKeyForChannel,
      fetchMessages,
    ],
  );

  // Hide Channel (remove from UI only - no on-chain deletion available)
  const deleteChannel = useCallback(async (channelId: string) => {
    try {
      console.log(
        "🔄 Hiding channel from UI (on-chain deletion not available)",
      );
      console.log("📋 Channel ID:", channelId);

      // Add channel to hidden list
      setHiddenChannels((prev) => new Set([...prev, channelId]));

      console.log("✅ Channel hidden from UI");
      return { success: true };
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? `[deleteChannel] ${err.message}`
          : "[deleteChannel] Failed to hide channel";
      setChannelError(errorMsg);
      console.error("Error hiding channel:", err);
      return null;
    }
  }, []);

  // Fetch channels when client is ready
  useEffect(() => {
    if (messagingClient && currentAccount) {
      fetchChannels();
      // Set up auto-refresh every 10 seconds
      const interval = setInterval(fetchChannels, 10000);
      return () => clearInterval(interval);
    }
  }, [messagingClient, currentAccount, fetchChannels]);

  // Update current channel when selectedChannelId changes
  useEffect(() => {
    if (selectedChannelId && channels.length > 0) {
      const channel = channels.find((ch) => ch.id.id === selectedChannelId);
      setCurrentChannel(channel || null);
    } else {
      setCurrentChannel(null);
    }
  }, [selectedChannelId, channels]);

  // Filter out hidden channels
  const visibleChannels = channels.filter(
    (channel) => !hiddenChannels.has(channel.id.id),
  );

  return {
    client: messagingClient,
    sessionKey,
    isInitializing,
    error,
    isReady: !!messagingClient && !!sessionKey,

    // Channel functions and state
    channels: visibleChannels, // Use filtered channels
    createChannel,
    deleteChannel,
    fetchChannels,
    isCreatingChannel,
    isFetchingChannels,
    channelError,

    // Current channel functions and state
    selectedChannelId,
    setSelectedChannelId,
    currentChannel,
    messages,
    getChannelById,
    fetchMessages,
    sendMessage,
    getChannelMembers,
    isFetchingMessages,
    isSendingMessage,
    messagesCursor,
    hasMoreMessages,
  };
};
