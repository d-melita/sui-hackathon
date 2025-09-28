import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";

// Replace with your actual package ID after deployment
const GROUPS_PACKAGE_ID =
  "0xd67f6b7d67152b9efe615063d7a4e5326c6f213f67e67e4e8ef582342b1db0c7";

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
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
        requestType: "WaitForEffectsCert" as any,
      } as any);

      console.log("Transaction result:", result);

      // Try to extract the newly created Group object's ID from either
      // objectChanges (preferred) or effects.created fallback
      let groupId: string | null = null;

      const changes: any[] = (result as any)?.objectChanges || [];
      for (const change of changes) {
        if (
          change?.type === "created" &&
          typeof change?.objectType === "string" &&
          change.objectType.includes("groups::group::Group")
        ) {
          groupId = change.objectId;
          break;
        }
      }

      if (!groupId && (result as any)?.effects?.created?.length) {
        const created = (result as any).effects.created;
        for (const item of created) {
          // We don't have the type here, so this is best-effort fallback.
          // Caller will still fetch by events if needed.
          if (item?.reference?.objectId) {
            groupId = item.reference.objectId;
            break;
          }
        }
      }

      return {
        digest: (result as any)?.digest,
        groupId,
        raw: result,
      };
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

  // Create a signal (accepts ciphertext as hex string (0x...) or Uint8Array)
  const createSignal = useCallback(
    async (
      groupId: string,
      adminCapId: string,
      ciphertext: string | Uint8Array,
      bullish: boolean,
      confidence: number,
    ) => {
      if (!currentAccount) throw new Error("No account connected");

      // Normalize ciphertext to bytes
      let ciphertextBytes: number[];
      if (typeof ciphertext === "string") {
        const hex = ciphertext.startsWith("0x")
          ? ciphertext.slice(2)
          : ciphertext;
        if (hex.length % 2 !== 0) {
          throw new Error("Ciphertext hex must have even length");
        }
        ciphertextBytes = [];
        for (let i = 0; i < hex.length; i += 2) {
          const byte = parseInt(hex.slice(i, i + 2), 16);
          if (Number.isNaN(byte)) throw new Error("Invalid ciphertext hex");
          ciphertextBytes.push(byte);
        }
      } else {
        ciphertextBytes = Array.from(ciphertext);
      }

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::create_signal`,
        arguments: [
          tx.object(groupId),
          tx.object(adminCapId),
          tx.pure.vector("u8", ciphertextBytes),
          tx.pure.bool(bullish),
          tx.pure.u8(confidence),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
        requestType: "WaitForEffectsCert" as any,
      } as any);

      // Try to extract created Signal object id
      let signalId: string | null = null;
      const changes: any[] = (result as any)?.objectChanges || [];
      for (const change of changes) {
        if (
          change?.type === "created" &&
          typeof change?.objectType === "string" &&
          change.objectType.includes("groups::signal::Signal")
        ) {
          signalId = change.objectId;
          break;
        }
      }

      return {
        digest: (result as any)?.digest,
        signalId,
        raw: result,
      };
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
        const message = error instanceof Error ? error.message : String(error);
        console.error("❌ Error fetching admin capabilities:", message);
        return null;
      }
    },
    [suiClient, currentAccount],
  );

  const fetchSignals = useCallback(
    async (groupId: string) => {
      if (!currentAccount) throw new Error("No account connected");

      try {
        console.log("🔍 Fetching signals for group:", groupId);

        const groupObject = await suiClient.getObject({
          id: groupId,
          options: { showContent: true },
        });

        if (!groupObject.data?.content) {
          throw new Error("Group object not found");
        }

        const groupData = groupObject.data.content as any;
        console.log("🔍 Group data structure:", groupData);

        // Get signal IDs from the signal_ids vector
        const signalIds = groupData.fields.signal_ids || [];
        console.log("🔍 Signal IDs:", signalIds);

        if (signalIds.length === 0) {
          console.log("🔍 No signals found");
          return [];
        }

        // Use the get_signal_data view function to get REAL encrypted data
        const signals = [];
        for (const signalId of signalIds) {
          try {
            console.log("🔍 Getting REAL signal data for:", signalId);

            // Call the get_signal_data view function using Transaction
            const tx = new Transaction();
            tx.moveCall({
              target: `${GROUPS_PACKAGE_ID}::group::get_signal_data`,
              arguments: [
                tx.object(groupId), // &Group
                tx.pure.id(signalId), // ID
              ],
            });

            const result = await suiClient.devInspectTransactionBlock({
              sender:
                currentAccount?.address ||
                "0x0000000000000000000000000000000000000000000000000000000000000000",
              transactionBlock: tx,
            });

            console.log("🔍 REAL Signal data result:", result);

            if (result.results && result.results.length > 0) {
              const returnValues = result.results[0].returnValues;
              console.log("🔍 REAL Signal return values:", returnValues);

              if (returnValues && returnValues.length >= 5) {
                const [caller, tokenAddress, bullish, confidence, rating] =
                  returnValues;

                console.log("🔍 REAL Extracted values:");
                console.log("🔍 - caller:", caller);
                console.log("🔍 - tokenAddress:", tokenAddress);
                console.log("🔍 - bullish:", bullish);
                console.log("🔍 - confidence:", confidence);
                console.log("🔍 - rating:", rating);

                signals.push({
                  id: signalId,
                  caller: caller[0],
                  tokenAddress: tokenAddress[0], // REAL encrypted bytes
                  bullish: bullish[0],
                  confidence: confidence[0],
                  rating: rating[0],
                });
                console.log("🔍 Successfully added REAL signal data!");
              } else {
                console.warn(
                  "🔍 Insufficient return values, using placeholder",
                );
                signals.push({
                  id: signalId,
                  caller: "Unknown",
                  tokenAddress: "Encrypted",
                  bullish: true,
                  confidence: 5,
                  rating: 0,
                });
              }
            } else {
              console.warn(
                "🔍 No results from view function, using placeholder",
              );
              signals.push({
                id: signalId,
                caller: "Unknown",
                tokenAddress: "Encrypted",
                bullish: true,
                confidence: 5,
                rating: 0,
              });
            }
          } catch (error) {
            console.warn(
              "🔍 Failed to fetch REAL signal data:",
              signalId,
              error,
            );
            const message =
              error instanceof Error ? error.message : String(error);
            console.warn("🔍 Error details:", message);
            signals.push({
              id: signalId,
              caller: "Unknown",
              tokenAddress: "Encrypted",
              bullish: true,
              confidence: 5,
              rating: 0,
            });
          }
        }

        console.log("🔍 Fetched signals (IDs only):", signals);
        return signals;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error fetching signals:", message);
        return [];
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
    fetchSignals,
  };
};
