/**
 * AI 小易 · 会话状态机（前端侧智能体模块）
 *
 * 职责：维护聊天消息与开场白，携带最近几轮历史调用 POST /miniapp/ai/ask
 * （请求仍走 api.js 的 askAi，本文件不做第二套请求封装），并把后端返回的
 * answer / notice 追加进会话。后端按同目录 BACKEND-SPEC.md 升级为
 * Function Calling 工具智能体后，本文件无需改动即获得多轮追问能力。
 */
import { askAi } from "../api.js";

// 随请求携带的最大历史轮数；后端契约为 10 条（见 BACKEND-SPEC.md §2），超出截断
const HISTORY_LIMIT = 10;

const GREETING =
  "你好，我是 AI 小易，你的积分助手。可以问我积分变动、扣分原因，或「我现在能兑换什么奖品」这类问题。";

export function createAiAgent() {
  const messages = [{ role: "assistant", content: GREETING }];
  let busy = false;

  /**
   * 发送一轮问答。
   * @param {string} question 用户问题
   * @param {{ onHistoryChange?: (next: Array<{role: string, content: string}>) => void }} options
   *   onHistoryChange 在消息列表变化时回调（发出问题后、收到回答后各一次），传入快照
   */
  async function ask(question, { onHistoryChange } = {}) {
    const text = String(question || "").trim();
    if (!text || busy) return messages;
    busy = true;
    messages.push({ role: "user", content: text });
    onHistoryChange?.([...messages]);
    try {
      // 历史只回传真实对话：去掉开场白（首条）与本轮刚发出的问题（末条）
      const history = messages.slice(1, -1).slice(-HISTORY_LIMIT);
      const result = await askAi(text, history);
      if (result?.notice) {
        messages.push({ role: "assistant", content: result.notice });
      }
      messages.push({
        role: "assistant",
        content: result?.answer || "暂时无法回答，请稍后再试。"
      });
    } catch (error) {
      messages.push({
        role: "assistant",
        content: error?.message || "请求失败，请确认已登录且后端服务正常。"
      });
    } finally {
      busy = false;
      onHistoryChange?.([...messages]);
    }
    return messages;
  }

  return {
    greeting: GREETING,
    getMessages: () => [...messages],
    getBusy: () => busy,
    ask
  };
}
