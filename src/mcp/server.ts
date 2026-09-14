/**
 * MCP server exposing zcode-beautify to the ZCode agent:
 * the model can set a wallpaper / re-theme / reset on the user's behalf.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { applyColorsOnly, applyWallpaper, reapplyStored, resetAppearance } from "../core/session.js";
import { loadConfig } from "../core/launch.js";

const server = new McpServer({
  name: "zcode-beautify",
  version: "0.2.0",
});

server.registerTool(
  "set_background",
  {
    title: "Set ZCode wallpaper",
    description:
      "Set the ZCode desktop client's background wallpaper image and adapt the UI colors with Material Design 3 (Monet) dynamic color. ZCode must be running with the CDP debug port (see zcode-beautify launch).",
    inputSchema: {
      image_path: z.string().describe("Absolute path of the image to use as wallpaper"),
      blur: z.number().min(0).max(100).optional().describe("Wallpaper blur radius in px (default 0)"),
      dim: z.number().min(0).max(100).optional().describe("Wallpaper darkening 0-100 (default 25)"),
    },
  },
  async ({ image_path, blur, dim }) => {
    try {
      const { windows } = await applyWallpaper(image_path, { blur, dim });
      return { content: [{ type: "text", text: `Wallpaper applied to ${windows} window(s) with Monet-adapted colors.` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Failed: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.registerTool(
  "apply_options",
  {
    title: "Tune ZCode appearance",
    description:
      "Adjust the live ZCode appearance without changing the wallpaper: blur radius, dim level, Monet dynamic colors on/off, and wallpaper visibility (translucent vs opaque surfaces). Only the provided values change; the rest keep their current setting.",
    inputSchema: {
      blur: z.number().min(0).max(100).optional().describe("Wallpaper blur radius in px"),
      dim: z.number().min(0).max(100).optional().describe("Wallpaper darkening 0-100"),
      monet: z.boolean().optional().describe("Regenerate UI colors from the wallpaper (true) or keep ZCode's original colors (false)"),
      wallpaper_visible: z.boolean().optional().describe("Translucent surfaces showing the wallpaper (true) or opaque surfaces (false)"),
      fit: z.enum(["cover", "contain", "smart"]).optional().describe("Framing: cover fills and crops, contain letterboxes with a blurred backdrop, smart analyzes the picture locally and picks the best framing + focus point"),
    },
  },
  async ({ blur, dim, monet, wallpaper_visible, fit }) => {
    try {
      const windows = await applyColorsOnly({ blur, dim, monet, wallpaperVisible: wallpaper_visible, fit });
      return { content: [{ type: "text", text: `Appearance updated in ${windows} window(s).` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Failed: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.registerTool(
  "refresh_theme",
  {
    title: "Refresh ZCode theme",
    description: "Re-inject the stored wallpaper and Monet theme into the running ZCode client (e.g. after the app was restarted).",
    inputSchema: {},
  },
  async () => {
    try {
      const windows = await reapplyStored();
      return { content: [{ type: "text", text: `Theme re-injected into ${windows} window(s).` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Failed: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.registerTool(
  "reset_appearance",
  {
    title: "Reset ZCode appearance",
    description: "Remove the wallpaper and color overrides, restoring ZCode's default appearance.",
    inputSchema: {},
  },
  async () => {
    try {
      await resetAppearance();
      return { content: [{ type: "text", text: "Appearance restored to default." }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Failed: ${(err as Error).message}` }], isError: true };
    }
  }
);

server.registerTool(
  "beautify_status",
  {
    title: "Beautify status",
    description: "Report the stored zcode-beautify configuration.",
    inputSchema: {},
  },
  async () => {
    const cfg = loadConfig();
    return { content: [{ type: "text", text: JSON.stringify(cfg, null, 2) }] };
  }
);

await server.connect(new StdioServerTransport());
