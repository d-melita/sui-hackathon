import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";

// Replace with your actual package ID after deployment
const GROUPS_PACKAGE_ID =
  "0x1cb284f40afe2f5ca6fd5c7a2f07c027763c861d16e91fd3d149b20d33094f39";

export const useGroups = () => {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  // Create a new group (open or gated)
  const createGroup = useCallback(
    async (gated: boolean) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::create_group`,
        arguments: [tx.pure.bool(gated)],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Join a group (for open groups only)
  const joinGroup = useCallback(
    async (groupId: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::join`,
        arguments: [tx.object(groupId)],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Add a member to a group (admin only)
  const addMember = useCallback(
    async (groupId: string, adminCapId: string, userAddress: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::add_member`,
        arguments: [
          tx.object(groupId),
          tx.object(adminCapId),
          tx.pure.address(userAddress),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Leave a group
  const leaveGroup = useCallback(
    async (groupId: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::leave`,
        arguments: [tx.object(groupId)],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Initialize treasury
  const initTreasury = useCallback(
    async (groupId: string, adminCapId: string, initialAmount: number) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();

      // Split coins for initial treasury amount
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(initialAmount)]);

      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::init_treasury`,
        arguments: [tx.object(groupId), tx.object(adminCapId), coin],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Deposit to treasury
  const depositToTreasury = useCallback(
    async (groupId: string, amount: number) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();

      // Split coins for deposit
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);

      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::deposit_to_treasury`,
        arguments: [tx.object(groupId), coin],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Withdraw from treasury
  const withdrawFromTreasury = useCallback(
    async (groupId: string, amount: number) => {
      console.log("🔍 WITHDRAW DEBUG - Function called with:");
      console.log("🔍 - groupId:", groupId);
      console.log("🔍 - amount:", amount);
      console.log("🔍 - amount type:", typeof amount);

      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();

      console.log("🔍 WITHDRAW DEBUG - Building transaction:");
      console.log(
        "🔍 - Target:",
        `${GROUPS_PACKAGE_ID}::group::withdraw_from_treasury`,
      );
      console.log("🔍 - Arguments count:", 2);
      console.log("🔍 - Argument 1 (groupId):", groupId);
      console.log("🔍 - Argument 2 (amount):", amount);

      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::withdraw_from_treasury`,
        arguments: [tx.object(groupId), tx.pure.u64(amount)],
      });

      console.log("🔍 WITHDRAW DEBUG - Transaction built, executing...");
      const result = await signAndExecute({
        transaction: tx,
      });

      console.log("🔍 WITHDRAW DEBUG - Transaction result:", result);
      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Create a signal
  const createSignal = useCallback(
    async (
      groupId: string,
      adminCapId: string,
      tokenAddress: string,
      bullish: boolean,
      confidence: number,
    ) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::create_signal`,
        arguments: [
          tx.object(groupId),
          tx.object(adminCapId),
          tx.pure.vector(
            "u8",
            Array.from(new TextEncoder().encode(tokenAddress)),
          ),
          tx.pure.bool(bullish),
          tx.pure.u8(confidence),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Upvote a signal
  const upvoteSignal = useCallback(
    async (groupId: string, signalId: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::upvote_signal`,
        arguments: [tx.object(groupId), tx.pure.id(signalId)],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Downvote a signal
  const downvoteSignal = useCallback(
    async (groupId: string, signalId: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::downvote_signal`,
        arguments: [tx.object(groupId), tx.pure.id(signalId)],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Create a vote
  const createVote = useCallback(
    async (
      groupId: string,
      adminCapId: string,
      title: string,
      description: string,
      voters: string[],
      options: number,
      keyServers: string[],
      publicKeys: string[][],
      threshold: number,
    ) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::create_vote`,
        arguments: [
          tx.object(groupId),
          tx.object(adminCapId),
          tx.pure.string(title),
          tx.pure.string(description),
          tx.pure.vector("address", voters),
          tx.pure.u8(options),
          tx.pure.vector("address", keyServers),
          tx.pure.vector(
            "vector<u8>",
            publicKeys.map((pk) => pk.map(Number)),
          ),
          tx.pure.u8(threshold),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Cast a vote
  const castVote = useCallback(
    async (groupId: string, voteId: string, encryptedBallot: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::cast_vote`,
        arguments: [
          tx.object(groupId),
          tx.pure.id(voteId),
          tx.pure.vector(
            "u8",
            Array.from(new TextEncoder().encode(encryptedBallot)),
          ),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Promote member to admin (owner only)
  const promoteMemberToAdmin = useCallback(
    async (groupId: string, ownerCapId: string, userAddress: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::promote_member_to_admin`,
        arguments: [
          tx.object(groupId),
          tx.object(ownerCapId),
          tx.pure.address(userAddress),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Demote admin to member (owner only)
  const demoteAdminToMember = useCallback(
    async (groupId: string, ownerCapId: string, userAddress: string) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::demote_admin_to_member`,
        arguments: [
          tx.object(groupId),
          tx.object(ownerCapId),
          tx.pure.address(userAddress),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Get user's admin capabilities for a group
  const getAdminCapabilities = useCallback(
    async (groupId: string) => {
      if (!currentAccount) throw new Error("No account connected");

      try {
        console.log("🔍 Fetching admin capabilities for group:", groupId);

        // Query for admin capabilities owned by the current user
        // First try with the specific struct type
        let response = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          filter: {
            StructType: `${GROUPS_PACKAGE_ID}::admin_cap::AdminCap`,
          },
          options: {
            showContent: true,
            showOwner: true,
          },
        });

        // If no results, try without filter to get all objects and filter manually
        if (response.data.length === 0) {
          console.log(
            "🔍 No results with struct filter, trying without filter...",
          );
          response = await suiClient.getOwnedObjects({
            owner: currentAccount.address,
            options: {
              showContent: true,
              showOwner: true,
            },
          });

          // Debug: Log all object types found
          console.log("📋 All owned object types:");
          response.data.forEach((obj, index) => {
            console.log(`📋 Object ${index}:`, {
              objectId: obj.data?.objectId,
              type: obj.data?.type,
              hasContent: !!obj.data?.content,
            });
          });

          // Filter for AdminCap objects manually
          const adminCapObjects = response.data.filter((obj) => {
            const type = obj.data?.type;
            return type?.includes("AdminCap") || type?.includes("admin_cap");
          });

          console.log("📋 Found AdminCap objects:", adminCapObjects.length);
          response.data = adminCapObjects;
        }

        console.log("📋 Admin capabilities found:", response.data.length);

        // Debug: Log all admin capabilities
        response.data.forEach((obj, index) => {
          const content = obj.data?.content;
          if (content && "fields" in content) {
            const fields = content.fields as any;
            console.log(`📋 AdminCap ${index}:`, {
              objectId: obj.data?.objectId,
              fields: fields,
              group_id: fields.group_id,
            });
          }
        });

        // Filter for capabilities that match this group
        const groupAdminCaps = response.data.filter((obj) => {
          const content = obj.data?.content;
          if (content && "fields" in content) {
            const fields = content.fields as any;
            console.log("🔍 AdminCap fields:", fields);
            console.log("🔍 Looking for group ID:", groupId);
            // Check if this AdminCap is for the specific group
            return fields.group_id === groupId;
          }
          return false;
        });

        console.log(
          "📋 Group-specific admin capabilities:",
          groupAdminCaps.length,
        );

        if (groupAdminCaps.length > 0) {
          const adminCapId = groupAdminCaps[0].data?.objectId;
          console.log("✅ Found admin capability:", adminCapId);
          return adminCapId;
        } else {
          console.log("❌ No admin capabilities found for this group");
          console.log(
            "📋 Available admin capabilities:",
            response.data.map((obj) => ({
              objectId: obj.data?.objectId,
              groupId:
                obj.data?.content && "fields" in obj.data.content
                  ? (obj.data.content as any).fields.group_id
                  : "unknown",
            })),
          );
          return null;
        }
      } catch (error) {
        console.error("❌ Error fetching admin capabilities:", error);
        return null;
      }
    },
    [suiClient, currentAccount],
  );

  return {
    createGroup,
    joinGroup,
    addMember,
    leaveGroup,
    initTreasury,
    depositToTreasury,
    withdrawFromTreasury,
    createSignal,
    upvoteSignal,
    downvoteSignal,
    createVote,
    castVote,
    promoteMemberToAdmin,
    demoteAdminToMember,
    getAdminCapabilities,
  };
};
