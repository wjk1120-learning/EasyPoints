/**
 * 积分口径品牌类型：编译期区分「带符号变动」与「消耗成本」，防止成本被按变动渲染。
 * 回归背景：兑换工单详情曾把 pointsCost（恒正）传给 delta 渲染成 +N 绿色，与列表 -N 红色打架。
 */

/** 带符号积分变动（如 pointsDelta，可正可负），只能传给 delta 字段 */
export type SignedPoints = number & { readonly __brand: "signed" };
/** 积分成本（如 pointsCost，恒为正数），只能传给 cost 字段 */
export type CostPoints = number & { readonly __brand: "cost" };

export function signedPoints(value: number): SignedPoints {
  return value as SignedPoints;
}

export function costPoints(value: number): CostPoints {
  return value as CostPoints;
}
