import { useState, useEffect, useCallback } from "react";
import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther } from "viem";
import { sepolia } from "viem/chains";

const API = "http://localhost:3000";
const VAULT_ABI = [
  { name: "deposit", type: "function", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { name: "withdraw", type: "function", inputs: [{ name: "shares", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "tvl", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "sharePrice", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
];
const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS || "";

const S = {
  wrap:    { maxWidth: 1100, margin: "0 auto", padding: "32px 24px" },
  header:  { display: "flex", alignItems: "center", gap: 16, marginBottom: 40 },
  logo:    { fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg,#7c3aed,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  tag:     { fontSize: 11, background: "#1e1b4b", color: "#a78bfa", padding: "3px 10px", borderRadius: 20, fontWeight: 700 },
  grid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20, marginBottom: 32 },
  card:    { background: "#13131f", border: "1px solid #1e1b4b", borderRadius: 16, padding: 24 },
  label:   { fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  value:   { fontSize: 26, fontWeight: 700, color: "#e2e8f0" },
  sub:     { fontSize: 12, color: "#64748b", marginTop: 4 },
  panel:   { background: "#13131f", border: "1px solid #1e1b4b", borderRadius: 16, padding: 28, marginBottom: 24 },
  h2:      { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  input:   { width: "100%", background: "#0a0a0f", border: "1px solid #1e1b4b", borderRadius: 10, padding: "12px 16px", color: "#e2e8f0", fontSize: 16, outline: "none", marginBottom: 12 },
  btn:     { width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15 },
  btnP:    { background: "linear-gradient(90deg,#7c3aed,#6d28d9)", color: "#fff" },
  btnS:    { background: "#1e1b4b", color: "#a78bfa", marginTop: 8 },
  table:   { width: "100%", borderCollapse: "collapse" },
  th:      { textAlign: "left", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, padding: "8px 12px", borderBottom: "1px solid #1e1b4b" },
  td:      { padding: "10px 12px", borderBottom: "1px solid #13131f", fontSize: 13 },
  conn:    { marginLeft: "auto", padding: "10px 20px", borderRadius: 10, border: "1px solid #7c3aed", background: "transparent", color: "#a78bfa", cursor: "pointer", fontWeight: 600 },
  dot:     { display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 6 },
};

export default function App() {
  const [status, setStatus]     = useState(null);
  const [account, setAccount]   = useState(null);
  const [amount, setAmount]     = useState("");
  const [shares, setShares]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/status`);
      const d = await r.json();
      setStatus(d);
    } catch { setStatus(null); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 10000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  async function connectWallet() {
    if (!window.ethereum) return setMsg("MetaMask not found.");
    const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(addr);
    setMsg("Connected: " + addr.slice(0, 8) + "...");
  }

  async function doDeposit() {
    if (!account || !amount) return;
    setLoading(true); setMsg("");
    try {
      const walletClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
      const { request } = await createPublicClient({ chain: sepolia, transport: http() })
        .simulateContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "deposit", args: [parseEther(amount)], account });
      const hash = await walletClient.writeContract(request);
      setMsg("Deposit tx: " + hash);
      setTimeout(fetchStatus, 3000);
    } catch (e) { setMsg("Error: " + e.shortMessage || e.message); }
    setLoading(false);
  }

  async function doWithdraw() {
    if (!account || !shares) return;
    setLoading(true); setMsg("");
    try {
      const walletClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
      const { request } = await createPublicClient({ chain: sepolia, transport: http() })
        .simulateContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "withdraw", args: [parseEther(shares)], account });
      const hash = await walletClient.writeContract(request);
      setMsg("Withdraw tx: " + hash);
      setTimeout(fetchStatus, 3000);
    } catch (e) { setMsg("Error: " + e.shortMessage || e.message); }
    setLoading(false);
  }

  const online = !!status;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.logo}>AgentSwap</span>
        <span style={S.tag}>ERC-8004 · Uniswap V3</span>
        <span style={{ marginLeft: 8, fontSize: 12, color: online ? "#34d399" : "#f87171" }}>
          <span style={{ ...S.dot, background: online ? "#34d399" : "#f87171" }} />
          {online ? "Agent Online" : "Agent Offline"}
        </span>
        <button style={S.conn} onClick={connectWallet}>
          {account ? account.slice(0, 8) + "..." : "Connect Wallet"}
        </button>
      </div>

      {/* Stats */}
      <div style={S.grid}>
        {[
          { label: "Vault TVL", value: status ? parseFloat(status.tvl).toFixed(4) + " ETH" : "—", sub: "Total value locked" },
          { label: "Share Price", value: status ? parseFloat(status.sharePrice).toFixed(6) : "—", sub: "ETH per ASVT" },
          { label: "Total Supply", value: status ? parseFloat(status.totalSupply).toFixed(2) : "—", sub: "ASVT shares outstanding" },
          { label: "Recent Orders", value: status ? status.recentOrders.length : "—", sub: "Last 10 confirmed" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={S.card}>
            <div style={S.label}>{label}</div>
            <div style={S.value}>{value}</div>
            <div style={S.sub}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Deposit/Withdraw */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={S.panel}>
          <div style={S.h2}>Deposit WETH</div>
          <input style={S.input} placeholder="Amount (ETH)" value={amount}
            onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.001" />
          <button style={{ ...S.btn, ...S.btnP }} onClick={doDeposit} disabled={loading}>
            {loading ? "Processing..." : "Deposit"}
          </button>
        </div>
        <div style={S.panel}>
          <div style={S.h2}>Withdraw Shares</div>
          <input style={S.input} placeholder="Shares (ASVT)" value={shares}
            onChange={e => setShares(e.target.value)} type="number" min="0" step="0.001" />
          <button style={{ ...S.btn, ...S.btnS }} onClick={doWithdraw} disabled={loading}>
            {loading ? "Processing..." : "Withdraw"}
          </button>
        </div>
      </div>

      {msg && <div style={{ background: "#13131f", border: "1px solid #1e1b4b", borderRadius: 10, padding: "12px 16px", fontSize: 13, marginBottom: 20, color: "#a78bfa" }}>{msg}</div>}

      {/* Order History */}
      <div style={S.panel}>
        <div style={S.h2}>Recent Agent Orders</div>
        {status?.recentOrders?.length > 0 ? (
          <table style={S.table}>
            <thead>
              <tr>
                {["Time", "Token Out", "Amount In", "Min Out", "Status", "Tx"].map(h =>
                  <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {status.recentOrders.map(o => (
                <tr key={o.id}>
                  <td style={S.td}>{new Date(o.ts).toLocaleTimeString()}</td>
                  <td style={S.td}>{o.tokenOut?.slice(0, 8)}...</td>
                  <td style={S.td}>{parseFloat(formatEther(BigInt(o.amountIn || "0"))).toFixed(4)}</td>
                  <td style={S.td}>{parseFloat(formatEther(BigInt(o.minAmountOut || "0"))).toFixed(4)}</td>
                  <td style={S.td}><span style={{ color: o.status === "confirmed" ? "#34d399" : "#f87171" }}>{o.status}</span></td>
                  <td style={S.td}>{o.txHash ? <a href={`https://sepolia.etherscan.io/tx/${o.txHash}`} target="_blank" rel="noreferrer" style={{ color: "#a78bfa" }}>{o.txHash.slice(0, 10)}...</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: "#64748b", fontSize: 14 }}>No orders yet. Worker monitoring pool...</div>
        )}
      </div>

      {/* Tick Feed */}
      <div style={S.panel}>
        <div style={S.h2}>Pool Tick Feed (last 20)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {status?.recentTicks?.map((t, i) => (
            <span key={i} style={{ background: "#1e1b4b", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#a78bfa" }}>
              {t.tick}
            </span>
          )) || <span style={{ color: "#64748b", fontSize: 14 }}>No tick data yet.</span>}
        </div>
      </div>
    </div>
  );
}
