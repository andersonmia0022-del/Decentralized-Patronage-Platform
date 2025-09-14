import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, principalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_AMOUNT = 101;
const ERR_INVALID_INTERVAL = 102;
const ERR_INVALID_DURATION = 103;
const ERR_INVALID_START_BLOCK = 104;
const ERR_PLEDGE_ALREADY_EXISTS = 105;
const ERR_PLEDGE_NOT_FOUND = 106;
const ERR_PLEDGE_INACTIVE = 107;
const ERR_INSUFFICIENT_FUNDS = 108;
const ERR_PAYMENT_NOT_DUE = 109;
const ERR_INVALID_CREATOR = 110;
const ERR_INVALID_CURRENCY = 116;
const ERR_INVALID_GRACE_PERIOD = 118;
const ERR_INVALID_PENALTY = 119;
const ERR_INVALID_PERK_THRESHOLD = 115;
const ERR_MAX_PLEDGES_EXCEEDED = 112;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_ESCROW_NOT_SET = 114;
const ERR_AUTHORITY_NOT_VERIFIED = 120;

interface Pledge {
  patron: string;
  creator: string;
  amount: number;
  interval: number;
  startBlock: number;
  duration: number;
  paymentsMade: number;
  lastPaymentBlock: number;
  active: boolean;
  currency: string;
  gracePeriod: number;
  penaltyRate: number;
  perkThreshold: number;
}

interface PledgeUpdate {
  updateAmount: number;
  updateInterval: number;
  updateDuration: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class PledgeManagerMock {
  state: {
    nextPledgeId: number;
    maxPledges: number;
    minAmount: number;
    defaultInterval: number;
    escrowContract: string | null;
    authorityContract: string | null;
    pledges: Map<number, Pledge>;
    pledgeUpdates: Map<number, PledgeUpdate>;
    pledgesByPatron: Map<string, number[]>;
    pledgesByCreator: Map<string, number[]>;
  } = {
    nextPledgeId: 0,
    maxPledges: 10000,
    minAmount: 10,
    defaultInterval: 4320,
    escrowContract: null,
    authorityContract: null,
    pledges: new Map(),
    pledgeUpdates: new Map(),
    pledgesByPatron: new Map(),
    pledgesByCreator: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1PATRON";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextPledgeId: 0,
      maxPledges: 10000,
      minAmount: 10,
      defaultInterval: 4320,
      escrowContract: null,
      authorityContract: null,
      pledges: new Map(),
      pledgeUpdates: new Map(),
      pledgesByPatron: new Map(),
      pledgesByCreator: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1PATRON";
    this.stxTransfers = [];
  }

  setEscrowContract(contractPrincipal: string): Result<boolean> {
    this.state.escrowContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMinAmount(newMin: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.minAmount = newMin;
    return { ok: true, value: true };
  }

  createPledge(
    creator: string,
    amount: number,
    interval: number,
    startBlock: number,
    duration: number,
    currency: string,
    gracePeriod: number,
    penaltyRate: number,
    perkThreshold: number
  ): Result<number> {
    if (this.state.nextPledgeId >= this.state.maxPledges) return { ok: false, value: ERR_MAX_PLEDGES_EXCEEDED };
    if (creator === this.caller) return { ok: false, value: ERR_INVALID_CREATOR };
    if (amount < this.state.minAmount) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (interval <= 0) return { ok: false, value: ERR_INVALID_INTERVAL };
    if (duration <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (startBlock < this.blockHeight) return { ok: false, value: ERR_INVALID_START_BLOCK };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (penaltyRate > 100) return { ok: false, value: ERR_INVALID_PENALTY };
    if (perkThreshold <= 0) return { ok: false, value: ERR_INVALID_PERK_THRESHOLD };
    if (!this.state.escrowContract) return { ok: false, value: ERR_ESCROW_NOT_SET };

    const id = this.state.nextPledgeId;
    const pledge: Pledge = {
      patron: this.caller,
      creator,
      amount,
      interval,
      startBlock,
      duration,
      paymentsMade: 0,
      lastPaymentBlock: startBlock,
      active: true,
      currency,
      gracePeriod,
      penaltyRate,
      perkThreshold,
    };
    this.state.pledges.set(id, pledge);
    const patronPledges = this.state.pledgesByPatron.get(this.caller) || [];
    this.state.pledgesByPatron.set(this.caller, [...patronPledges, id]);
    const creatorPledges = this.state.pledgesByCreator.get(creator) || [];
    this.state.pledgesByCreator.set(creator, [...creatorPledges, id]);
    this.state.nextPledgeId++;
    return { ok: true, value: id };
  }

  getPledge(id: number): Pledge | undefined {
    return this.state.pledges.get(id);
  }

  updatePledge(id: number, newAmount: number, newInterval: number, newDuration: number): Result<boolean> {
    const pledge = this.state.pledges.get(id);
    if (!pledge) return { ok: false, value: ERR_PLEDGE_NOT_FOUND };
    if (pledge.patron !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!pledge.active) return { ok: false, value: ERR_PLEDGE_INACTIVE };
    if (newAmount < this.state.minAmount) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (newInterval <= 0) return { ok: false, value: ERR_INVALID_INTERVAL };
    if (newDuration <= 0) return { ok: false, value: ERR_INVALID_DURATION };

    const updated: Pledge = {
      ...pledge,
      amount: newAmount,
      interval: newInterval,
      duration: newDuration,
    };
    this.state.pledges.set(id, updated);
    this.state.pledgeUpdates.set(id, {
      updateAmount: newAmount,
      updateInterval: newInterval,
      updateDuration: newDuration,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  cancelPledge(id: number): Result<boolean> {
    const pledge = this.state.pledges.get(id);
    if (!pledge) return { ok: false, value: ERR_PLEDGE_NOT_FOUND };
    if (pledge.patron !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!pledge.active) return { ok: false, value: ERR_PLEDGE_INACTIVE };

    const updated: Pledge = { ...pledge, active: false };
    this.state.pledges.set(id, updated);
    return { ok: true, value: true };
  }

  executePayment(id: number): Result<boolean> {
    const pledge = this.state.pledges.get(id);
    if (!pledge) return { ok: false, value: ERR_PLEDGE_NOT_FOUND };
    if (!pledge.active) return { ok: false, value: ERR_PLEDGE_INACTIVE };
    const nextDue = pledge.lastPaymentBlock + pledge.interval;
    if (this.blockHeight < nextDue) return { ok: false, value: ERR_PAYMENT_NOT_DUE };
    if (pledge.paymentsMade >= pledge.duration) return { ok: false, value: ERR_PAYMENT_NOT_DUE };
    if (!this.state.escrowContract) return { ok: false, value: ERR_ESCROW_NOT_SET };

    this.stxTransfers.push({ amount: pledge.amount, from: this.state.escrowContract, to: pledge.creator });

    const updated: Pledge = {
      ...pledge,
      paymentsMade: pledge.paymentsMade + 1,
      lastPaymentBlock: this.blockHeight,
    };
    this.state.pledges.set(id, updated);
    return { ok: true, value: true };
  }

  getPledgeCount(): Result<number> {
    return { ok: true, value: this.state.nextPledgeId };
  }
}

describe("PledgeManager", () => {
  let contract: PledgeManagerMock;

  beforeEach(() => {
    contract = new PledgeManagerMock();
    contract.reset();
  });

  it("creates a pledge successfully", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const pledge = contract.getPledge(0);
    expect(pledge?.patron).toBe("ST1PATRON");
    expect(pledge?.creator).toBe("STCREATOR");
    expect(pledge?.amount).toBe(100);
    expect(pledge?.interval).toBe(4320);
    expect(pledge?.startBlock).toBe(0);
    expect(pledge?.duration).toBe(12);
    expect(pledge?.paymentsMade).toBe(0);
    expect(pledge?.lastPaymentBlock).toBe(0);
    expect(pledge?.active).toBe(true);
    expect(pledge?.currency).toBe("STX");
    expect(pledge?.gracePeriod).toBe(7);
    expect(pledge?.penaltyRate).toBe(5);
    expect(pledge?.perkThreshold).toBe(50);
  });

  it("rejects pledge to self as creator", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "ST1PATRON",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CREATOR);
  });

  it("rejects pledge without escrow contract", () => {
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ESCROW_NOT_SET);
  });

  it("rejects invalid amount", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      5,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("rejects invalid interval", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      100,
      0,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_INTERVAL);
  });

  it("rejects invalid duration", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      0,
      "STX",
      7,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DURATION);
  });

  it("rejects invalid start block", () => {
    contract.setEscrowContract("STESCROW");
    contract.blockHeight = 10;
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      5,
      12,
      "STX",
      7,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_START_BLOCK);
  });

  it("rejects invalid currency", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "ETH",
      7,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CURRENCY);
  });

  it("rejects invalid grace period", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      31,
      5,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_GRACE_PERIOD);
  });

  it("rejects invalid penalty rate", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      101,
      50
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PENALTY);
  });

  it("rejects invalid perk threshold", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      0
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PERK_THRESHOLD);
  });

  it("updates a pledge successfully", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    const result = contract.updatePledge(0, 200, 8640, 24);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const pledge = contract.getPledge(0);
    expect(pledge?.amount).toBe(200);
    expect(pledge?.interval).toBe(8640);
    expect(pledge?.duration).toBe(24);
    const update = contract.state.pledgeUpdates.get(0);
    expect(update?.updateAmount).toBe(200);
    expect(update?.updateInterval).toBe(8640);
    expect(update?.updateDuration).toBe(24);
    expect(update?.updater).toBe("ST1PATRON");
  });

  it("rejects update for non-existent pledge", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.updatePledge(99, 200, 8640, 24);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLEDGE_NOT_FOUND);
  });

  it("rejects update by non-patron", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    contract.caller = "ST2FAKE";
    const result = contract.updatePledge(0, 200, 8640, 24);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects update for inactive pledge", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    contract.cancelPledge(0);
    const result = contract.updatePledge(0, 200, 8640, 24);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLEDGE_INACTIVE);
  });

  it("cancels a pledge successfully", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    const result = contract.cancelPledge(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const pledge = contract.getPledge(0);
    expect(pledge?.active).toBe(false);
  });

  it("rejects cancel for non-existent pledge", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.cancelPledge(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLEDGE_NOT_FOUND);
  });

  it("rejects cancel by non-patron", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    contract.caller = "ST2FAKE";
    const result = contract.cancelPledge(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("executes payment successfully", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    contract.blockHeight = 4320;
    const result = contract.executePayment(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const pledge = contract.getPledge(0);
    expect(pledge?.paymentsMade).toBe(1);
    expect(pledge?.lastPaymentBlock).toBe(4320);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "STESCROW", to: "STCREATOR" }]);
  });

  it("rejects payment for non-existent pledge", () => {
    contract.setEscrowContract("STESCROW");
    const result = contract.executePayment(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLEDGE_NOT_FOUND);
  });

  it("rejects payment for inactive pledge", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    contract.cancelPledge(0);
    contract.blockHeight = 4320;
    const result = contract.executePayment(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLEDGE_INACTIVE);
  });

  it("rejects payment when not due", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    contract.blockHeight = 4319;
    const result = contract.executePayment(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAYMENT_NOT_DUE);
  });

  it("rejects payment after all payments made", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      1,
      "STX",
      7,
      5,
      50
    );
    contract.blockHeight = 4320;
    contract.executePayment(0);
    contract.blockHeight = 8640;
    const result = contract.executePayment(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAYMENT_NOT_DUE);
  });

  it("sets min amount successfully", () => {
    contract.setAuthorityContract("STAUTH");
    const result = contract.setMinAmount(20);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.minAmount).toBe(20);
  });

  it("rejects min amount change without authority", () => {
    const result = contract.setMinAmount(20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("returns correct pledge count", () => {
    contract.setEscrowContract("STESCROW");
    contract.createPledge(
      "STCREATOR1",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    contract.createPledge(
      "STCREATOR2",
      200,
      8640,
      0,
      6,
      "USD",
      14,
      10,
      100
    );
    const result = contract.getPledgeCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("rejects pledge creation when max pledges exceeded", () => {
    contract.setEscrowContract("STESCROW");
    contract.state.maxPledges = 1;
    contract.createPledge(
      "STCREATOR",
      100,
      4320,
      0,
      12,
      "STX",
      7,
      5,
      50
    );
    const result = contract.createPledge(
      "STCREATOR2",
      200,
      8640,
      0,
      6,
      "USD",
      14,
      10,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PLEDGES_EXCEEDED);
  });
});