import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import TronWeb from "tronweb";
import bip39 from "bip39";
import hdkey from "hdkey";
import axios from "axios";

const {
  SEED_PHRASE,
  ETH_FORWARD_TO,
  TRX_FORWARD_TO,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID
} = process.env;

const ethProvider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/eth");
const ethWallet = ethers.Wallet.fromMnemonic(SEED_PHRASE).connect(ethProvider);

const seed = await bip39.mnemonicToSeed(SEED_PHRASE);
const root = hdkey.fromMasterSeed(seed);
const tronNode = root.derive("m/44'/195'/0'/0/0");
const tronPrivateKey = tronNode.privateKey.toString("hex");

const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  privateKey: tronPrivateKey
});

const notifyTelegram = async (msg) => {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg,
    });
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
};

async function forwardEth() {
  const balance = await ethProvider.getBalance(ethWallet.address);
  if (balance.gt(ethers.utils.parseEther("0.001"))) {
    const tx = await ethWallet.sendTransaction({
      to: ETH_FORWARD_TO,
      value: balance.sub(ethers.utils.parseEther("0.0005")),
    });
    await notifyTelegram(`🟢 ETH forwarded: ${tx.hash}`);
  }
}

async function forwardTrx() {
  const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
  if (balance > 1000000) {
    const tx = await tronWeb.trx.sendTransaction(TRX_FORWARD_TO, balance - 500000);
    await notifyTelegram(`🟢 TRX forwarded: ${tx.txID}`);
  }
}

async function mainLoop() {
  console.log("🔁 Bot started...");
  while (true) {
    try {
      await forwardEth();
      await forwardTrx();
    } catch (e) {
      console.error("❌ Error:", e.message);
    }
    await new Promise(r => setTimeout(r, 30000));
  }
}

mainLoop();
