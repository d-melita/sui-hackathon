import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useGroups } from "./useGroups";
import { useMessaging } from "./useMessaging";

// Replace with your actual package ID after deployment
const GROUPS_PACKAGE_ID =
  "0x1cb284f40afe2f5ca6fd5c7a2f07c027763c861d16e91fd3d149b20d33094f39";

export const useGroupsManager = () => {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { createGroup } = useGroups();
  const { createChannel } = useMessaging();

  // Group state
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isFetchingGroups, setIsFetchingGroups] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [manualGroupIds, setManualGroupIds] = useState<string[]>(() => {
    // Load from localStorage on initialization
    try {
      const saved = localStorage.getItem("manualGroupIds");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fetch groups and caps for the current user
  const fetchGroups = useCallback(async () => {
    if (!currentAccount?.address) return;

    setIsFetchingGroups(true);
    setGroupError(null);

    try {
      // Get all objects owned by the user (for caps)
      const ownedObjects = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        options: {
          showContent: true,
          showType: true,
        },
      });

      // Filter for group-related caps
      const groupCaps = ownedObjects.data.filter((obj) => {
        const type = obj.data?.type;
        return (
          type?.includes("groups::owner_cap::OwnerCap") ||
          type?.includes("groups::admin_cap::AdminCap") ||
          type?.includes("groups::member_cap::MemberCap")
        );
      });

      // Try to automatically discover groups using proper event querying
      let discoveredGroups: string[] = [];

      try {
        console.log("Querying GroupCreated events...");

        // Query for GroupCreated events using the proper event filter
        const events = await suiClient.queryEvents({
          query: {
            MoveEventModule: {
              package: GROUPS_PACKAGE_ID,
              module: "group",
            },
          },
          limit: 50,
          order: "descending",
        });

        // Extract group IDs from events
        for (const event of events.data) {
          if (event.parsedJson && typeof event.parsedJson === "object") {
            const parsed = event.parsedJson as any;
            if (parsed.group_id) {
              const groupId = parsed.group_id;

              if (groupId && !discoveredGroups.includes(groupId)) {
                discoveredGroups.push(groupId);
              }
            }
          }
        }
      } catch (eventErr) {
        console.warn("Could not query GroupCreated events:", eventErr);

        // Fallback: try transaction-based discovery
        try {
          console.log("Fallback: Querying user transactions...");
          const transactions = await suiClient.queryTransactionBlocks({
            filter: {
              FromAddress: currentAccount.address,
            },
            options: {
              showEffects: true,
              showObjectChanges: true,
            },
            limit: 20,
          });

          console.log(
            `Found ${transactions.data.length} transactions to check`,
          );

          // Look for group creation in transactions
          for (const tx of transactions.data) {
            console.log("Processing transaction:", tx.digest);

            // Check object changes for created Group objects
            if (tx.objectChanges) {
              for (const change of tx.objectChanges) {
                if (
                  change.type === "created" &&
                  change.objectType?.includes("groups::group::Group")
                ) {
                  const groupId = (change as any).objectId;
                  console.log("Found created Group object:", groupId);
                  if (groupId && !discoveredGroups.includes(groupId)) {
                    discoveredGroups.push(groupId);
                  }
                }
              }
            }
          }
        } catch (txErr) {
          console.warn("Could not fetch transactions:", txErr);
        }
      }

      const allGroups = [
        ...groupCaps,
        ...discoveredGroups.map((id) => ({
          data: {
            objectId: id,
            type: "groups::group::Group (Auto-discovered)",
            version: "1",
          },
        })),
        ...manualGroupIds.map((id) => ({
          data: {
            objectId: id,
            type: "groups::group::Group (Manual)",
            version: "1",
          },
        })),
      ];

      // Limit to last 5 groups to reduce clutter
      const limitedGroups = allGroups.slice(0, 1);

      setGroups(limitedGroups);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch groups";
      setGroupError(errorMsg);
    } finally {
      setIsFetchingGroups(false);
    }
  }, [currentAccount, suiClient, manualGroupIds]);

  // Create a new group (and silently create a corresponding channel)
  const createNewGroup = useCallback(
    async (gated: boolean = true) => {
      if (!currentAccount) {
        setGroupError("No account connected");
        return null;
      }

      setIsCreatingGroup(true);
      setGroupError(null);

      try {
        console.log("🏗️ Creating group...");
        const groupResult = await createGroup(gated);

        if (groupResult) {
          console.log("✅ Group created successfully");

          // Extract group ID from the transaction result
          let groupId = null;

          if ((groupResult as any).objectChanges) {
            for (const change of (groupResult as any).objectChanges) {
              console.log("🔍 Checking change:", change);
              if (
                change.type === "created" &&
                change.objectType?.includes("groups::group::Group")
              ) {
                groupId = (change as any).objectId;
                console.log("✅ Found group ID:", groupId);
                break;
              }
            }
          }

          if (groupId) {
            console.log("🔗 Group ID:", groupId);
            console.log("✅ Group created successfully");
          }

          // Immediate refresh after creation
          setTimeout(() => {
            fetchGroups();
          }, 2000); // Wait 2 seconds for transaction to be indexed

          return groupResult;
        }

        return null;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to create group";
        setGroupError(errorMsg);
        console.error("Error creating group:", err);
        return null;
      } finally {
        setIsCreatingGroup(false);
      }
    },
    [currentAccount, createGroup, createChannel, fetchGroups],
  );

  // Add a group ID manually (for shared objects)
  const addGroupManually = useCallback(
    (groupId: string) => {
      console.log("Adding group ID:", groupId);
      console.log("Current manualGroupIds:", manualGroupIds);
      if (!manualGroupIds.includes(groupId)) {
        setManualGroupIds((prev) => {
          const newIds = [...prev, groupId];
          console.log("New manualGroupIds:", newIds);
          return newIds;
        });
        // Call fetchGroups after a short delay to ensure state is updated
        setTimeout(() => {
          fetchGroups();
        }, 100);
      } else {
        console.log("Group ID already exists");
      }
    },
    [manualGroupIds, fetchGroups],
  );

  // Effect to save manualGroupIds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("manualGroupIds", JSON.stringify(manualGroupIds));
    } catch (err) {
      console.warn("Could not save manualGroupIds to localStorage:", err);
    }
  }, [manualGroupIds]);

  // Effect to fetch groups when account changes and set up auto-refresh
  useEffect(() => {
    if (currentAccount?.address) {
      fetchGroups();

      // Set up auto-refresh every 10 seconds (similar to messaging system)
      const interval = setInterval(fetchGroups, 10000);
      return () => clearInterval(interval);
    }
  }, [currentAccount, fetchGroups]);

  return {
    groups,
    selectedGroupId,
    setSelectedGroupId,
    createNewGroup,
    addGroupManually,
    fetchGroups,
    isCreatingGroup,
    isFetchingGroups,
    groupError,
    setGroupError,
  };
};
