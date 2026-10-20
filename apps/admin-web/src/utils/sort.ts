/**
 * 审核类列表通用排序：待审核（pending）工单置顶，同优先级按时间倒序。
 * 后端按接口清单《通用约定》返回同样排序；前端在页面层兜底，保证任何后端下展示一致。
 *
 * @param items       列表数据
 * @param isPending   该条是否处于待审核状态
 * @param timestamp   排序时间戳（提交/申请时间，秒或毫秒数值）
 */
export function pendingFirst<T>(items: T[], isPending: (item: T) => boolean, timestamp: (item: T) => number): T[] {
  return items.slice().sort((a, b) => {
    const pa = isPending(a) ? 0 : 1;
    const pb = isPending(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return timestamp(b) - timestamp(a);
  });
}
