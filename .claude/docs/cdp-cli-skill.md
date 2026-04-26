> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cdp.coinbase.com/llms.txt
> Use this file to discover all available pages before exploring further.

> Installs the CDP CLI and configures API key + wallet secret from the Coinbase Developer Portal. Verifies connectivity.

# Skill

# cdp-setup

Set up the CDP CLI: install, configure API key and wallet secret, verify.

## Steps

1. **Check Node.js**: `node --version` — must be >= 22. If missing or too old, install from [https://nodejs.org/en/download](https://nodejs.org/en/download)

   **Warning (nvm/fnm users):** If you upgrade your default Node version, globally installed tools (e.g., Claude Code) will need to be reinstalled since each Node version has its own global packages. After upgrading, open a new terminal and reinstall any global tools you had on the previous version.

2. **Linux only — install keyring support** (prevents secrets from being stored in plaintext):

   ```
   which secret-tool || sudo apt install -y libsecret-tools
   ```

3. **Check if `cdp` is installed**:

   ```
   cdp --version
   ```

   If not found:

   ```
   npm i -g @coinbase/cdp-cli
   ```

4. **Create a CDP project and API key**:

   > Go to [https://portal.cdp.coinbase.com/projects/api-keys](https://portal.cdp.coinbase.com/projects/api-keys)
   >
   > * Sign in (a project is auto-created on first sign-in).
   > * Click **Create API Key** → **Download** the JSON key file.
   > * Provide the path to the downloaded file.

   ```
   cdp env live --key-file <path>
   ```

5. **Generate a wallet secret** (required for server wallet operations):

   > Go to [https://portal.cdp.coinbase.com/products/server-wallet/accounts](https://portal.cdp.coinbase.com/products/server-wallet/accounts)
   >
   > * Click **Generate Wallet Secret** → **Download** the file.

   ```
   cdp env live --wallet-secret-file <path>
   ```

6. **Verify**:

   ```
   cdp env
   ```

   Assert: `live` appears with key ID and `(wallet)` indicator.

   ```
   cdp evm accounts list
   ```

   Assert: returns JSON (no auth error). May return `{"accounts":[]}`.

7. **Quick test — create and fund an account** (optional):

   ```
   cdp evm accounts create name=test-wallet
   ```

   Server wallet accounts are network-agnostic — the same address works on any EVM network.

   ```
   cdp evm faucet address=<address> network=base-sepolia token=eth
   ```

   Faucet tokens: `eth`, `usdc`, `eurc`, `cbbtc`. Solana: `cdp solana faucet address=<addr> token=sol`.

8. **Set up MCP server** (optional — gives your agent direct tool access to all CDP APIs):

   The CDP CLI includes an MCP server (`cdp mcp`) that exposes every API endpoint as a tool.

   **Claude Code:**

   ```
   claude mcp add --scope user --transport stdio cdp -- cdp mcp
   ```

   **Other agents** — add to your agent's MCP config (format varies by agent):

   ```json theme={null}
   { "command": "cdp", "args": ["mcp"], "transport": "stdio" }
   ```

9. **Install agent skills** (optional):

   ```
   cdp skills add
   ```

   If non-interactive, determine your agent's skills directory and pass it:

   ```
   cdp skills add --dir <skills-directory>
   ```

10. **Codex users**: If not running with `--sandbox danger-full-access` (full access mode), the default sandbox cannot access OS keychain secrets. Options:
    * Prompt Codex to run `cdp` commands with "elevated access" (safest)
    * Or use the `cdp mcp` server instead of direct CLI commands (MCP has expected keychain access in Codex)

11. **Troubleshooting**:

* "Must use a CDP Entity scoped API key" → need a v2 portal key, not legacy
* "Wallet authentication error" → wallet secret missing or incorrect
* "forbidden" → API key permissions issue
* After upgrading Node via nvm/fnm → open a new terminal, reinstall global tools that were on the old version
* Windows: `cdp` not found after `npm i -g` → add npm's global bin to PATH: `%APPDATA%\npm`
