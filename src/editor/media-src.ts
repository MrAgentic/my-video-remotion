import { staticFile } from "remotion";

/**
 * Resolves a plain filename from public/ for BOTH environments:
 * - CLI render: Remotion sets window.remotion_staticBase to the bundled public
 *   dir, so staticFile() returns /bundles/<hash>/public/<file>.
 * - Standalone <Player> served by our Vite server: nothing sets
 *   remotion_staticBase, so staticFile() falls back to /<file>, which is exactly
 *   where Vite serves public/ from (web root).
 * One helper, no branching - see node_modules/remotion/dist/cjs/static-file.js.
 */
export const mediaSrc = (filename: string): string => staticFile(filename);
