/**
 * Generate a shell script for the Claude Code SessionStart hook.
 *
 * The script:
 * 1. Checks if the whygraph server is running via health endpoint
 * 2. Warns the user if the server is not running
 * 3. Runs `whygraph prime` to output agent instructions
 */
export function generateSessionStartHook(whygraphDir: string): string {
  const lines = [
    "#!/usr/bin/env bash",
    "",
    "# whygraph SessionStart hook — auto-generated",
    `# whygraph dir: ${whygraphDir}`,
    "",
    "# Check if whygraph server is running",
    'if ! curl -s http://localhost:4777/api/health > /dev/null 2>&1; then',
    '  echo "⚠ whygraph server is not running. Start with: whygraph serve"',
    "fi",
    "",
    "# Output agent instructions",
    "whygraph prime",
    "",
  ];

  return lines.join("\n");
}
