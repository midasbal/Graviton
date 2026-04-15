import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";

/**
 * POST /api/hooks
 *
 * Returns the current cross-contract hook wiring status.
 * Actions:
 *   - status: Check if Marketplace → Registry + DAO hooks are configured
 */

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai";

const MARKETPLACE_ADDRESS = (process.env.GRAVITON_MARKETPLACE_ADDRESS ||
  process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
  "0x91D1e023A9FAdeC831abE5d52247eC78998d471F") as `0x${string}`;

const REGISTRY_ADDRESS = (process.env.GRAVITON_REGISTRY_ADDRESS ||
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
  "0xA6D1c437CBDe470A7C317aA61E9DC6E54c114d60") as `0x${string}`;

const DAO_ADDRESS = (process.env.GRAVITON_DAO_ADDRESS ||
  process.env.NEXT_PUBLIC_DAO_ADDRESS ||
  "0xFc24dD77E47974A0747e89fe81D9a13C254238C1") as `0x${string}`;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const marketplaceAbi = parseAbi([
  "function registry() external view returns (address)",
  "function dao() external view returns (address)",
  "function totalSales() external view returns (uint256)",
  "function totalVolume() external view returns (uint256)",
]);

const registryAbi = parseAbi([
  "function hasRole(bytes32 role, address account) external view returns (bool)",
]);

const daoAbi = parseAbi([
  "function hasRole(bytes32 role, address account) external view returns (bool)",
]);

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action !== "status") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const client = createPublicClient({
      transport: http(RPC_URL),
    });

    // Read hook addresses from Marketplace
    const [registryHook, daoHook, totalSales, totalVolume] = await Promise.all([
      client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "registry",
      }),
      client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "dao",
      }),
      client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "totalSales",
      }),
      client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "totalVolume",
      }),
    ]);

    const registryWired =
      registryHook !== ZERO_ADDRESS &&
      (registryHook as string).toLowerCase() === REGISTRY_ADDRESS.toLowerCase();

    const daoWired =
      daoHook !== ZERO_ADDRESS &&
      (daoHook as string).toLowerCase() === DAO_ADDRESS.toLowerCase();

    // Check roles if wired
    let registryRoleGranted = false;
    let daoRoleGranted = false;

    // ADMIN_ROLE = keccak256("ADMIN_ROLE")
    const ADMIN_ROLE = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775";
    // OPERATOR_ROLE = keccak256("OPERATOR_ROLE")
    const OPERATOR_ROLE = "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929";

    if (registryWired) {
      registryRoleGranted = (await client.readContract({
        address: REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "hasRole",
        args: [ADMIN_ROLE as `0x${string}`, MARKETPLACE_ADDRESS],
      })) as boolean;
    }

    if (daoWired) {
      daoRoleGranted = (await client.readContract({
        address: DAO_ADDRESS,
        abi: daoAbi,
        functionName: "hasRole",
        args: [OPERATOR_ROLE as `0x${string}`, MARKETPLACE_ADDRESS],
      })) as boolean;
    }

    const fullyWired = registryWired && daoWired && registryRoleGranted && daoRoleGranted;

    return NextResponse.json({
      fullyWired,
      hooks: {
        registry: {
          address: registryHook,
          expected: REGISTRY_ADDRESS,
          wired: registryWired,
          roleGranted: registryRoleGranted,
        },
        dao: {
          address: daoHook,
          expected: DAO_ADDRESS,
          wired: daoWired,
          roleGranted: daoRoleGranted,
        },
      },
      stats: {
        totalSales: totalSales.toString(),
        totalVolume: totalVolume.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[hooks] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
