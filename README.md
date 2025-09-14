# 🌟 Decentralized Patronage Platform

Welcome to a revolutionary way to support creators, artists, and causes with recurring pledges on the blockchain! This Web3 project builds a trustless patronage system on the Stacks blockchain using Clarity smart contracts. It solves the real-world problem of centralized platforms (like Patreon) taking high fees, risking censorship, and lacking transparency in fund distribution. Here, patrons can set up automated monthly gifts that execute via smart contracts, ensuring direct, immutable support while rewarding loyal backers with perks.

## ✨ Features

🔄 Set up recurring pledges that auto-execute monthly based on block height triggers  
💸 Low-fee, direct transfers using STX or wrapped tokens  
📈 Transparent pledge tracking and fund allocation  
🎁 Perk rewards for patrons (e.g., exclusive NFTs or access tokens)  
🛡️ Dispute resolution for failed pledges or creator misconduct  
🏆 Governance voting for platform improvements  
🔒 Secure user profiles and verification  
🚫 Cancellation and refund mechanisms for patrons  

## 🛠 How It Works

**For Patrons**  
- Register your profile and link your wallet.  
- Browse creators and set up a pledge with amount, frequency (monthly), and duration.  
- The smart contract locks your funds in escrow and auto-transfers them monthly when triggered (e.g., via block height checks).  
- Claim perks like digital badges or access rights as rewards.  

**For Creators**  
- Create a profile with your cause or content details.  
- Set up a vault to receive pledges.  
- Define perk tiers for different pledge levels.  
- Funds are automatically distributed monthly, with transparency logs.  
- Handle disputes if patrons challenge your delivery.  

**For Everyone**  
- Use governance contracts to vote on fees or upgrades.  
- Verify any pledge or transaction instantly on-chain.  

That's it! No intermediaries—just blockchain-powered support that empowers creators and patrons alike.

## 📜 Smart Contracts

This project involves 8 Clarity smart contracts for modularity, security, and scalability. Each handles a specific aspect to ensure the system is robust and extensible.

1. **UserRegistry.clar**: Manages user registrations, profile data (e.g., usernames, bios), and basic verification (e.g., linking social proofs). Prevents spam with a small registration fee.  

2. **CreatorVault.clar**: Allows creators to set up personalized vaults for receiving funds. Stores creator metadata like descriptions, goals, and linked content hashes for immutability.  

3. **PledgeManager.clar**: Core contract for creating, modifying, and canceling pledges. Handles pledge details like amount, start block, interval (e.g., ~4,320 blocks for a month), and auto-execution logic via time-based checks.  

4. **EscrowHandler.clar**: Secures funds in escrow during pledges. Releases payments monthly upon trigger (patron or oracle call) and supports partial refunds if pledges are canceled early.  

5. **PerkDistributor.clar**: Manages reward tiers and distributions. Creators define perks (e.g., minting NFTs), and patrons claim them automatically based on pledge history.  

6. **DisputeResolution.clar**: Enables patrons to file disputes (e.g., for undelivered content) with evidence. Uses a simple arbitration mechanism with bonded votes from stakeholders.  

7. **PaymentProcessor.clar**: Integrates token transfers (STX or SIP-10 tokens). Handles batch payments, fee deductions (minimal, e.g., 0.5% for governance), and conversion if needed.  

8. **GovernanceDAO.clar**: Allows token holders (e.g., platform governance tokens) to propose and vote on changes like fee adjustments or contract upgrades. Ensures decentralized control.