const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.model");

const emailService = require("../services/email.services");

/**
 * * -Create a new transaction
 * THE 10-steps Transfer flow:
 * * 1.Validate the request
 * * 2.validate idempotency key
 * * 3.check account status
 * * 4.derive sender balance from ledger
 * * 5.create transaction with pending status
 * * 6.create debit ledger entry
 * * 7.create credit ledger entry
 * * 8.mark transaction as completed
 * * 9.commit mongodb session
 * * 10.send email notification to both sender and receiver
 */

async function createTransaction(req, res) {
  /**
   * 1.validate the request
   */

  const { fromAccountId, toAccountId, amount, idempotencyKey } = req.body;

  if (!fromAccountId || !toAccountId || !amount || !idempotencyKey) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  if (amount <= 0) {
  return res.status(400).json({ message: "Amount must be greater than zero" });
}

if (fromAccountId === toAccountId) {
  return res.status(400).json({ message: "Cannot transfer to the same account" });
}

  const fromUserAccount = await accountModel.findOne({
    _id: fromAccountId,
  });

  const toUserAccount = await accountModel.findOne({
    _id: toAccountId,
  });
  if (!fromUserAccount || !toUserAccount) {
    return res.status(404).json({ message: "Account not found" });
  }

  const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey: idempotencyKey,
  });

  /**
   * 2.validate idempotency key
   */
  if (isTransactionAlreadyExists) {
    if (isTransactionAlreadyExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "Transaction already completed",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still processing",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction failed, please try again later",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction has been reversed, please try again later",
        transaction: isTransactionAlreadyExists,
      });
    }
  }

  /**
   * 3.check account status
   */

  if (
    fromUserAccount.status !== "Active" ||
    toUserAccount.status !== "Active"
  ) {
    return res.status(400).json({
      message: "Both accounts must be active to perform a transaction",
    });
  }
  /**
   * 4.derive sender balance from ledger
   */

  const balance = await fromUserAccount.getBalance();
  {
    if (balance < amount) {
      return res.status(400).json({
        message: `Insufficient balance. Current balance: ${balance}, Required: ${amount}`,
      });
    }
  }

  /**
   * 5.create transaction with pending status
   */

  const session = await transactionModel.startSession();
  try {
    session.startTransaction();

    //Idempotency key check has the same race condition
    //Two simultaneous requests with the same key can both pass this check before either document exists.
    //The unique index on idempotencyKey will reject the second insert — but since that throws inside the try,
    //it falls into the generic catch,
    //returning a misleading 500 "Transaction failed, please try again later" instead of the idempotent "already processed" response.

    const isTransactionAlreadyExists = await transactionModel
      .findOne({ idempotencyKey })
      .session(session);
      if (isTransactionAlreadyExists) {
      await session.abortTransaction();
      session.endSession();
      if (isTransactionAlreadyExists.status === "COMPLETED") {
        return res.status(200).json({
          message: "Transaction already completed",
          transaction: isTransactionAlreadyExists,
        });
      }
      if (isTransactionAlreadyExists.status === "PENDING") {
        return res.status(200).json({
          message: "Transaction is still processing",
          transaction: isTransactionAlreadyExists,
        });
      }
      if (isTransactionAlreadyExists.status === "FAILED") {
        return res.status(500).json({
          message: "Transaction failed, please try again later",
          transaction: isTransactionAlreadyExists,
        });
      }
      if (isTransactionAlreadyExists.status === "REVERSED") {
        return res.status(500).json({
          message: "Transaction has been reversed, please try again later",
          transaction: isTransactionAlreadyExists,
        });
      }
    }

    // re-check inside the transaction
    // if not
    //Race condition on balance check (double-spend risk)
    //Two concurrent requests against the same account can both read the same balance,
    //  both pass the check, and both commit — overdrawing the account

    const balanceData = await ledgerModel
      .aggregate([
        { $match: { account: fromUserAccount._id } },
        {
          $group: {
            _id: null,
            totalDebit: {
              $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0] },
            },
            totalCredit: {
              $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] },
            },
          },
        },
      ])
      .session(session);


    const currentBalance = balanceData.length
      ? balanceData[0].totalCredit - balanceData[0].totalDebit
      : 0;


    if (currentBalance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Insufficient balance. Current balance: ${currentBalance}, Required: ${amount}`,
      });
    }

    const transaction = new transactionModel(
      {
        fromAccount: fromAccountId,
        toAccount: toAccountId,
        amount: amount,
        idempotencyKey: idempotencyKey,
        status: "PENDING",
      }
    );

    await transaction.save({ session: session });
    const debitLedgerEntry = await ledgerModel.create(
      [
        {
          account: fromAccountId,
          amount: amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
      ],
      { session: session },
    );

    


    const creditLedgerEntry = await ledgerModel.create(
      [
        {
          account: toAccountId,
          amount: amount,
          transaction: transaction._id,
          type: "CREDIT",
        },
      ],
      { session: session },
    );

    transaction.status = "COMPLETED";

    await session.commitTransaction();
    session.endSession();

    /**
     * 10.send email notification to both sender and receiver
     */

    // session is done — email failures here must NOT touch session
    const toAccountUser = await userModel.findById(toUserAccount.user);
    try {
      await emailService.sendTransactionEmail(
        req.user.email,
        req.user.name,
        amount,
        "DEBIT",
      );
      if (toAccountUser) {
        await emailService.sendTransactionEmail(
          toAccountUser.email,
          toAccountUser.name,
          amount,
          "CREDIT",
        );
      }
    } catch (emailErr) {
      console.error("Failed to send transaction email:", emailErr);
      // don't fail the request — the transfer already succeeded
    }

    return res.status(201).json({
      message: "Transaction successful",
      transaction: transaction,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000) {
      const existing = await transactionModel.findOne({ idempotencyKey });
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: existing,
      });
    }

    return res.status(500).json({
      message: "Transaction failed, please try again later",
      error: err.message,
    });
  }
}

async function createInitialFundsTransaction(req, res) {
  const { toAccountId, amount, idempotencyKey } = req.body;

  if (!toAccountId || !amount || !idempotencyKey) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const toUserAccount = await accountModel.findOne({
    _id: toAccountId,
  });

  if (!toUserAccount) {
    return res.status(404).json({ message: "Account not found" });
  }

  const fromUserAccount = await accountModel.findOne({
    accountType: "SYSTEM",
    user: req.user._id,
  });
  if (!fromUserAccount) {
  return res.status(404).json({ message: "System account not found" });
}

  const session = await transactionModel.startSession();
  try {
    session.startTransaction();
    //Idempotency key check has the same race condition
    //Two simultaneous requests with the same key can both pass this check before either document exists.
    //The unique index on idempotencyKey will reject the second insert — but since that throws inside the try,
    //it falls into the generic catch,
    //returning a misleading 500 "Transaction failed, please try again later" instead of the idempotent "already processed" response.

    const isTransactionAlreadyExists = await transactionModel
      .findOne({ idempotencyKey })
      .session(session);
    if (isTransactionAlreadyExists) {
      await session.abortTransaction();
      session.endSession();
      if (isTransactionAlreadyExists.status === "COMPLETED") {
        return res.status(200).json({
          message: "Transaction already completed",
          transaction: isTransactionAlreadyExists,
        });
      }
      if (isTransactionAlreadyExists.status === "PENDING") {
        return res.status(200).json({
          message: "Transaction is still processing",
          transaction: isTransactionAlreadyExists,
        });
      }
      if (isTransactionAlreadyExists.status === "FAILED") {
        return res.status(500).json({
          message: "Transaction failed, please try again later",
          transaction: isTransactionAlreadyExists,
        });
      }
      if (isTransactionAlreadyExists.status === "REVERSED") {
        return res.status(500).json({
          message: "Transaction has been reversed, please try again later",
          transaction: isTransactionAlreadyExists,
        });
      }
    }

    if (toUserAccount.status !== "Active") {
      return res
        .status(400)
        .json({ message: "Receiving account must be active" });
    }

    const transaction = new transactionModel({
      fromAccount: fromUserAccount._id,
      toAccount: toAccountId,
      amount: amount,
      idempotencyKey: idempotencyKey,
      status: "PENDING",
    });
    await transaction.save({ session });

    const debitLedgerEntry = await ledgerModel.create(
      [
        {
          account: fromUserAccount._id,
          amount: amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
      ],
      { session: session },
    );

    const creditLedgerEntry = await ledgerModel.create(
      [
        {
          account: toAccountId,
          amount: amount,
          transaction: transaction._id,
          type: "CREDIT",
        },
      ],
      { session: session },
    );

    transaction.status = "COMPLETED";
    await transaction.save({ session: session });
    await session.commitTransaction();

    return res.status(201).json({
      message: "Initial funds transaction successful",
      transaction: transaction,
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({
      message: "Initial funds transaction failed, please try again later",
      error: err.message,
    });
  } finally {
    session.endSession();
  }
}


async function getTransactionHistory(req, res) {
    try {
        const { accountId } = req.params;

        // make sure account belongs to the logged-in user

        
        const account = await accountModel.findOne({
            _id: accountId,
            user: req.user._id,
        });

        if (!account) {
            return res.status(404).json({ message: "Account not found" });
        }

        // fetch all ledger entries for this account, populate transaction details
        const ledgerEntries = await ledgerModel
            .find({ account: accountId })
            .populate({
                path: "transaction",
                populate: [
                    { path: "fromAccount", select: "accountType currency" },
                    { path: "toAccount", select: "accountType currency" },
                ],
            })
            .sort({ createdAt: -1 }); // latest first

        const history = ledgerEntries.map((entry) => ({
            type: entry.type,                          // DEBIT or CREDIT
            amount: entry.amount,
            status: entry.transaction.status,
            date: entry.transaction.createdAt,
            transactionId: entry.transaction._id,
            from: entry.transaction.fromAccount,
            to: entry.transaction.toAccount,
        }));

        return res.status(200).json({ accountId, history });
    } catch (err) {
        return res.status(500).json({
            message: "Failed to fetch transaction history",
            error: err.message,
        });
    }
}

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
  getTransactionHistory

};
