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
  ChannelMessagesDecryptedRequest,
} from "@mysten/messaging";

// Package ID for the messaging contract
const PACKAGE_ID =
  "0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d";

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

  // Create channel function
  const createChannel = useCallback(
    async (recipientAddresses: string[]) => {
      if (!messagingClient || !currentAccount) {
        setChannelError(
          "[createChannel] Messaging client or account not available",
        );
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

        // Step 3: Get generated caps
        console.log("🔄 Step 3: Getting generated member caps");
        const { creatorMemberCap } = await flow.getGeneratedCaps({ digest });
        console.log("✅ Step 3: Creator member cap obtained", creatorMemberCap);

        // Step 4: Generate and attach encryption key
        console.log("🔄 Step 4: Generating and attaching encryption key");
        const attachKeyTx = await flow.generateAndAttachEncryptionKey({
          creatorMemberCap,
        });

        const { digest: finalDigest } = await signAndExecute({
          transaction: attachKeyTx,
        });
        console.log("✅ Step 4: Encryption key transaction sent", finalDigest);

        // Wait for final transaction
        console.log("🔄 Step 5: Waiting for encryption key transaction");
        const { effects } = await suiClient.waitForTransaction({
          digest: finalDigest,
          options: { showEffects: true },
        });

        if (effects?.status.status !== "success") {
          throw new Error("Encryption key transaction failed");
        }
        console.log("✅ Step 5: Encryption key attached successfully");

        // Step 6: Members are automatically added by the SDK
        console.log(
          "✅ Step 6: Channel creation complete - members added automatically by SDK",
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
        const response = await messagingClient.getChannelMessages({
          channelId,
          userAddress: currentAccount.address,
          cursor,
          limit: 20,
          direction: "backward",
        });

        if (cursor === null) {
          // First fetch, replace messages
          setMessages(response.messages);
        } else {
          // Pagination, append older messages
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

  // Get member cap for channel
  const getMemberCapForChannel = useCallback(
    async (channelId: string) => {
      if (!messagingClient || !currentAccount) {
        return null;
      }

      try {
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
                address: membership.address || "Unknown",
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

  // Get encrypted key for channel
  const getEncryptedKeyForChannel = useCallback(
    async (channelId: string) => {
      if (!currentChannel || currentChannel.id.id !== channelId) {
        const channel = await getChannelById(channelId);
        if (!channel) return null;
      }

      const channel = currentChannel || (await getChannelById(channelId));
      if (!channel) return null;

      const encryptedKeyBytes = channel.encryption_key_history.latest;
      const keyVersion = channel.encryption_key_history.latest_version;

      return {
        $kind: "Encrypted" as const,
        encryptedBytes: new Uint8Array(encryptedKeyBytes),
        version: keyVersion,
      } as ChannelMessagesDecryptedRequest["encryptedKey"];
    },
    [currentChannel, getChannelById],
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
        // Get member cap ID
        const memberCapId = await getMemberCapForChannel(channelId);
        if (!memberCapId) {
          throw new Error("No member cap found for channel");
        }

        // Get encrypted key
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
        await fetchMessages(channelId);

        return { digest };
      } catch (err) {
        // Check if it's a version conflict error and retry
        const isVersionConflict =
          err instanceof Error &&
          (err.message.includes("not available for consumption") ||
            err.message.includes("Version") ||
            err.message.includes("current version"));

        if (isVersionConflict && retryCount < 3) {
          console.log(
            `🔄 Version conflict detected, retrying... (attempt ${retryCount + 1}/3)`,
          );
          // Wait a bit before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 + retryCount * 500),
          );
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
