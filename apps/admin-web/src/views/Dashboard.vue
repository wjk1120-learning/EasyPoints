<script setup>
import { ref, onMounted } from "vue";
import { User, ShoppingBag, View, Document, Reading } from "@element-plus/icons-vue";
import { api } from "../api";

const employeesCount = ref(0);
const giftsCount = ref(0);
const pendingAppealsCount = ref(0);
const pendingOrdersCount = ref(0);

function getPendingAppealStatuses() {
  return ["pending_department_review"];
}

async function loadDashboard() {
  try {
    const [employees, appeals, orders, gifts] = await Promise.all([
      api.employees(),
      api.appeals(),
      api.orders(),
      api.mallGifts()
    ]);

    employeesCount.value = employees.length;
    giftsCount.value = gifts.filter((gift) => gift.status === "active").length;
    const pendingAppealStatuses = new Set(getPendingAppealStatuses());
    pendingAppealsCount.value = appeals.filter((appeal) => pendingAppealStatuses.has(appeal.status)).length;
    pendingOrdersCount.value = orders.filter((order) => order.status === "pending_review").length;
  } catch (error) {
    console.error("加载工作台数据失败", error);
  }
}

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <div class="dashboard">
  <div class="metric-grid">
    <div class="metric" style="background-color: #0056c1;">
      <div class="icon" style="background-color: #3377cd;">
        <el-icon color="#fff" size="26"><User /></el-icon>
      </div>
      <div class="content">
        <span class="title" style="color: #ccddf2;">在职员工</span>
        <strong class="member">{{ employeesCount }}</strong>
      </div>
    </div>
    <div class="metric" style="background-color: #4d6077;">
      <div class="icon" style="background-color: #707f92;">
        <el-icon color="#fff" size="26"><ShoppingBag /></el-icon>
      </div>
      <div class="content">
        <span class="title" style="color: #dbdfe3;">可兑换礼品</span>
        <strong class="member">{{ giftsCount }}</strong>
      </div>
    </div>
    <div class="metric" style="background-color: #9e3d00;">
      <div class="icon" style="background-color: #b16333;">
        <el-icon color="#fff" size="26"><View /></el-icon>
      </div>
      <div class="content">
        <span class="title" style="color: #ebd8cc;">待审核申诉</span>
        <strong class="member">{{ pendingAppealsCount }}</strong>
      </div>
    </div>
    <div class="metric" style="background-color: #2d2f38;">
      <div class="icon" style="background-color: #57585f;">
        <el-icon color="#fff" size="26"><Document /></el-icon>
      </div>
      <div class="content">
        <span class="title" style="color: #d5d5d7;">待处理订单</span>
        <strong class="member">{{ pendingOrdersCount }}</strong>
      </div>
    </div>
  </div>
  <div class="main">
    <el-card class="business-rules-des">
      <div class="rule-title">
        <el-icon color="#0056c1" size="24" style="transform: translateY(2px)"><Reading /></el-icon>
        <h3>关键业务规则说明</h3>
      </div>
      <div class="rules">
        <div class="rule-info">
          <div class="rule-number">01</div>
          <div>
            <div style="color: #181a23;">单笔奖惩</div>
            <p class="rule-desc">所有单笔奖惩录入操作均需完整填写备注信息，备注内容为必填项，不可留空提交；若操作时未填写备注或备注内容为空，系统后端将直接拦截该请求并拒绝提交，本条奖惩记录无法保存生效。</p>
          </div>
        </div>
        <div class="rule-info">
          <div class="rule-number">02</div>
          <div>
            <div style="color: #181a23;">月度录分</div>
            <p class="rule-desc">月度批量录分功能支持设置统一备注，填写后可一键批量应用至所有待录入的员工记录，提高批量操作效率；若同时为某位员工单独填写了专属备注，则单人备注优先级更高，系统会以单人备注为准覆盖统一备注内容。</p>
          </div>
        </div>
        <div class="rule-info">
          <div class="rule-number">03</div>
          <div>
            <div style="color: #181a23;">流水纠错</div>
            <p class="rule-desc">积分流水记录一旦生成保存，系统不支持直接修改或删除原始流水数据，确保原始记录完整留存；所有纠错操作均通过新增一笔冲正流水的方式进行处理，原始流水与冲正流水同时保留，完整记录修正轨迹。</p>
          </div>
        </div>
        <div class="rule-info">
          <div class="rule-number">04</div>
          <div>
            <div style="color: #181a23;">员工可见</div>
            <p class="rule-desc">员工端可查看本人每一条积分变动明细，每条积分变动记录都会完整展示四项核心信息：操作管理员、变动发生时间、积分变动类型，以及该条记录的完整备注内容，确保积分变动全程透明可查。</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</div>
</template>

<style scoped lang="scss">
.dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  
  .metric {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 45px;
      height: 45px;
      border-radius: 5px;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 5px;

      .title {
        font-size: 14px;
      }

      .member {
        color: #fff;
        font-size: 26px;
        font-weight: 600;
      }
    }
  }
}

.main {
  display: flex;
  gap: 20px;
  margin-top: 20px;
  width: 100%;

  .business-rules-des {
    flex: 3;
    overflow-y: auto;

    :deep(.el-card__body) {
      padding: 0;
    }

    .rule-title {
      padding: 5px 20px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      vertical-align: middle;
      height: 40px;
      border-bottom: 2px solid #c1c6d6;
      gap: 10px;

      h3 {
        margin: 0;
        font-weight: 500;
      }
    }

    .rules {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .rule-info {
        display: flex;

        .rule-number {
          margin-right: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 30px;
          font-size: 14px;
          background-color: #ebedf9;
          color: #0056c1;
        }

        .rule-desc {
          color: #414654;
          font-size: 14px;
        }
      }
    }
   }
}

</style>
