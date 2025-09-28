import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";

// Replace with your actual package ID after deployment
const GROUPS_PACKAGE_ID = "0xYOUR_PACKAGE_ID_HERE";

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
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Deposit to treasury
  const depositToTreasury = useCallback(
    async (groupId: string, adminCapId: string, amount: number) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();

      // Split coins for deposit
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);

      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::deposit_to_treasury`,
        arguments: [tx.object(groupId), tx.object(adminCapId), coin],
      });

      const result = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      return result;
    },
    [signAndExecute, currentAccount],
  );

  // Withdraw from treasury
  const withdrawFromTreasury = useCallback(
    async (groupId: string, adminCapId: string, amount: number) => {
      if (!currentAccount) throw new Error("No account connected");

      const tx = new Transaction();
      tx.moveCall({
        target: `${GROUPS_PACKAGE_ID}::group::withdraw_from_treasury`,
        arguments: [
          tx.object(groupId),
          tx.object(adminCapId),
          tx.pure.u64(amount),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
          tx.pure.vector("vector<u8>", publicKeys),
          tx.pure.u8(threshold),
        ],
      });

      const result = await signAndExecute({
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
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
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      return result;
    },
    [signAndExecute, currentAccount],
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
  };
};
