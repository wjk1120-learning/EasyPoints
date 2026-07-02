async function syncContacts(store, contacts = []) {
  return store.transaction(async (tx) => {
    const synced = [];
    for (const item of contacts) {
      const employee = await tx.upsertEmployeeByWecomUserId(item);
      if (employee) synced.push(employee);
    }
    await tx.log("wecom.contacts_synced", "system", { count: synced.length });
    return synced;
  });
}

async function dispatchPendingMessages(store) {
  return store.transaction(async (tx) => {
    const maxRetries = Number(process.env.OUTBOX_MAX_RETRIES || 3);
    const batchSize = Number(process.env.OUTBOX_BATCH_SIZE || 50);
    const sent = [];
    const failed = [];

    const claimed = await tx.claimPendingMessages(batchSize);
    for (const message of claimed) {
      try {
        if (process.env.WECOM_MOCK_FAIL === "1") throw new Error("mock send failed");
        await tx.markMessageMockSent(message.id);
        sent.push(message);
      } catch (error) {
        await tx.markMessageFailed(message.id, maxRetries);
        failed.push({ id: message.id, error: error?.message || String(error) });
      }
    }

    await tx.log("wecom.messages_dispatched", "system", { sent: sent.length, failed: failed.length });
    return { sent, failed };
  });
}

module.exports = { syncContacts, dispatchPendingMessages };
