import dotenv from "dotenv";
import { ethers } from "ethers";
import TronWeb from "tronweb";
import { Telegraf } from "telegraf";
import bip39 from "bip39";
import { HDNodeWallet } from "ethers";
import fetch from "node-fetch";

dotenv.config();

// === Load config ===
const seed = process.env.SEED_PHRASE;
const ethForwardTo = process.env.ETH_FORWARD_TO;
const trxForwardTo = process.env.TRX_FORWARD_TO;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

// === Telegram Bot ===
const bot = new Telegraf(telegramToken);
const sendAlert = async (msg) => {
  if (telegramToken && telegramChatId) {
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramChatId, text: msg })
    });
  }
};

// === Ethereum Setup ===
const provider = new ethers.InfuraProvider("mainnet");
const hdNode = HDNodeWallet.fromPhrase(seed);
const ethWallet = hdNode.connect(provider);

// === Tron Setup ===
const tronNode = "https://api.trongrid.io";
const tronWeb = new TronWeb({
  fullHost: tronNode,
  privateKey: TronWeb.fromMnemonic(seed)[0].privateKey
});

// === Monitor Loop ===
async function monitor() {
  try {
    // Ethereum
    const ethBalance = await provider.getBalance(ethWallet.address);
    if (ethBalance.gt(0)) {
      const tx = await ethWallet.sendTransaction({
        to: ethForwardTo,
        value: ethBalance.sub(21000n * (await provider.getFeeData()).gasPrice) // leave enough gas
      });
      await sendAlert(`⚡ ETH Forwarded: ${ethers.formatEther(ethBalance)} ETH\nTx: https://etherscan.io/tx/${tx.hash}`);
    }

    // Tron
    const trxBalance = await tronWeb.trx.getBalance();
    if (trxBalance > 0) {
      const txid = await tronWeb.trx.sendTransaction(trxForwardTo, trxBalance - 100000); // leave 0.1 TRX for bandwidth
      await sendAlert(`⚡ TRX Forwarded: ${trxBalance / 1e6} TRX\nTx: https://tronscan.org/#/transaction/${txid.txid}`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

setInterval(monitor, 3000);
console.log("🔁 Gas drain bot is running...");
