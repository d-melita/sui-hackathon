import { useCallback, useState, useEffect } from "react";
import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";

// Seal key server object IDs for testnet
const SEAL_SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

export const useSeal = (existingSessionKey?: SessionKey) => {
  const [sealClient, setSealClient] = useState<SealClient | null>(null);

  // Auto-initialize Seal when session key is available
  useEffect(() => {
    if (existingSessionKey && !sealClient) {
      const initializeSeal = async () => {
        try {
          // Create a new SuiClient with proper configuration for Seal
          const sealSuiClient = new SuiClient({
            url: "https://fullnode.testnet.sui.io:443",
            mvr: {
              overrides: {
                packages: {
                  "@local-pkg/sui-stack-messaging":
                    "0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d",
                },
              },
            },
          });

          // Create SealClient with key servers
          const client = new SealClient({
            suiClient: sealSuiClient,
            serverConfigs: SEAL_SERVER_OBJECT_IDS.map((id) => ({
              objectId: id,
              weight: 1,
            })),
            verifyKeyServers: false, // Set to true for production
          });

          setSealClient(client);
        } catch (error) {
          console.error("Failed to auto-initialize Seal:", error);
        }
      };

      initializeSeal();
    }
  }, [existingSessionKey, sealClient]);

  const encryptTokenAddress = useCallback(
    async (tokenAddress: string, groupId: string, packageId: string) => {
      if (!sealClient || !existingSessionKey) {
        throw new Error("Seal not initialized or session key not available");
      }

      try {
        // Ensure all inputs are strings and properly formatted
        const cleanTokenAddress = String(tokenAddress).startsWith("0x")
          ? String(tokenAddress)
          : `0x${String(tokenAddress)}`;
        const cleanGroupId = String(groupId).startsWith("0x")
          ? String(groupId)
          : `0x${String(groupId)}`;
        const cleanPackageId = String(packageId).startsWith("0x")
          ? String(packageId)
          : `0x${String(packageId)}`;

        console.log("🔍 Seal Debug - Input validation:");
        console.log(
          "🔍 - cleanTokenAddress:",
          cleanTokenAddress,
          typeof cleanTokenAddress,
        );
        console.log("🔍 - cleanGroupId:", cleanGroupId, typeof cleanGroupId);
        console.log(
          "🔍 - cleanPackageId:",
          cleanPackageId,
          typeof cleanPackageId,
        );

        // Convert to bytes
        const tokenAddressBytes = fromHex(cleanTokenAddress);
        const groupIdBytes = fromHex(cleanGroupId);
        const packageIdBytes = fromHex(cleanPackageId);

        console.log("🔍 Seal Debug - Bytes conversion:");
        console.log("🔍 - tokenAddressBytes:", tokenAddressBytes);
        console.log("🔍 - groupIdBytes:", groupIdBytes);
        console.log("🔍 - packageIdBytes:", packageIdBytes);

        // Encrypt the token address
        const { encryptedObject: encryptedBytes, key: backupKey } =
          await sealClient.encrypt({
            threshold: 2, // Require 2 key servers to decrypt
            packageId: cleanPackageId, // Pass string, not bytes
            id: cleanGroupId, // Pass string, not bytes
            data: tokenAddressBytes, // Only data should be bytes
          });

        return {
          encryptedBytes: Array.from(encryptedBytes),
          backupKey: Array.from(backupKey),
          originalTokenAddress: cleanTokenAddress,
          encryptedTokenAddress: Array.from(encryptedBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
        };
      } catch (error) {
        console.error("Failed to encrypt token address:", error);
        throw error;
      }
    },
    [sealClient, existingSessionKey],
  );

  const decryptTokenAddress = useCallback(
    async (encryptedBytes: Uint8Array, groupId: string, packageId: string) => {
      if (!sealClient || !existingSessionKey) {
        throw new Error("Seal not initialized or session key not available");
      }

      try {
        // Create a new SuiClient for the transaction
        const txSuiClient = new SuiClient({
          url: "https://fullnode.testnet.sui.io:443",
        });

        const cleanGroupId = groupId.startsWith("0x")
          ? groupId
          : `0x${groupId}`;

        // Create transaction for seal_approve function
        const tx = new Transaction();
        tx.moveCall({
          target: `${packageId}::group::seal_approve`,
          arguments: [
            tx.pure.vector("u8", fromHex(cleanGroupId)),
            tx.object(groupId), // Group object
          ],
        });

        const txBytes = await tx.build({
          client: txSuiClient,
          onlyTransactionKind: true,
        });

        // Decrypt the token address
        const decryptedBytes = await sealClient.decrypt({
          data: new Uint8Array(encryptedBytes),
          sessionKey: existingSessionKey,
          txBytes,
        });

        // Convert back to hex string
        const decryptedTokenAddress = Array.from(decryptedBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return decryptedTokenAddress;
      } catch (error) {
        console.error("Failed to decrypt token address:", error);
        throw error;
      }
    },
    [sealClient, existingSessionKey],
  );

  const decryptEncryptedTokenAddress = useCallback(
    async (encryptedBytes: any, groupId: string, packageId: string) => {
      if (!sealClient || !existingSessionKey) {
        throw new Error("Seal not initialized or session key not available");
      }

      try {
        console.log("🔍 Decrypt Debug - Input encryptedBytes:", encryptedBytes);
        console.log("🔍 Decrypt Debug - Type:", typeof encryptedBytes);
        console.log(
          "🔍 Decrypt Debug - Is Array:",
          Array.isArray(encryptedBytes),
        );

        // Convert encryptedBytes to proper Uint8Array
        let encryptedData: Uint8Array;

        if (Array.isArray(encryptedBytes)) {
          // If it's already an array of numbers
          encryptedData = new Uint8Array(encryptedBytes);
        } else if (typeof encryptedBytes === "string") {
          // If it's a hex string, convert it
          const cleanHex = encryptedBytes.startsWith("0x")
            ? encryptedBytes.slice(2)
            : encryptedBytes;
          encryptedData = fromHex(cleanHex);
        } else if (encryptedBytes instanceof Uint8Array) {
          // If it's already a Uint8Array
          encryptedData = encryptedBytes;
        } else {
          throw new Error(
            `Unsupported encrypted bytes format: ${typeof encryptedBytes}`,
          );
        }

        console.log(
          "🔍 Decrypt Debug - Converted encryptedData:",
          encryptedData,
        );

        // Create a new SuiClient for the transaction
        const txSuiClient = new SuiClient({
          url: "https://fullnode.testnet.sui.io:443",
        });

        const cleanGroupId = groupId.startsWith("0x")
          ? groupId
          : `0x${groupId}`;

        // Create transaction for seal_approve function
        const tx = new Transaction();
        tx.moveCall({
          target: `${packageId}::group::seal_approve`,
          arguments: [
            tx.pure.vector("u8", fromHex(cleanGroupId)),
            tx.object(groupId), // Group object
          ],
        });

        const txBytes = await tx.build({
          client: txSuiClient,
          onlyTransactionKind: true,
        });

        // Decrypt the token address
        const decryptedBytes = await sealClient.decrypt({
          data: encryptedData,
          sessionKey: existingSessionKey,
          txBytes,
        });

        // Convert back to hex string
        const decryptedTokenAddress = Array.from(decryptedBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return decryptedTokenAddress;
      } catch (error) {
        console.error("Failed to decrypt token address:", error);
        throw error;
      }
    },
    [sealClient, existingSessionKey],
  );

  return {
    sealClient,
    sessionKey: existingSessionKey,
    encryptTokenAddress,
    decryptTokenAddress,
    decryptEncryptedTokenAddress,
    isSealReady: !!sealClient && !!existingSessionKey,
  };
};
