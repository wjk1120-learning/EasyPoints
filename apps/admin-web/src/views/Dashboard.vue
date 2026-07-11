<script setup>
import { ref, onMounted } from "vue";
import { User, ShoppingBag, View, Document, Reading, RefreshRight, UploadFilled, Download, Stamp, Goods } from "@element-plus/icons-vue";
import { api } from "../api";

const employeesCount = ref(0);
const giftsCount = ref(0);
const pendingAppealsCount = ref(0);
const pendingOrdersCount = ref(0);
const tableData = ref([]);
const total = ref(0);
const meta = ref({
  page: 1,
  pageSize: 10,
});

function getTableData() {
  tableData.value = [
    {
      occurred_at: "2023-08-01 10:00:00",
      employee_name: "张三",
      department_name: "研发部",
      remark: "积分变动",
      points_delta: 10,
      operator_name: "系统管理员",
    },
    {
      occurred_at: "2023-08-01 10:00:00",
      employee_name: "李四",
      department_name: "销售部",
      remark: "积分变动",
      points_delta: -20,
      operator_name: "系统管理员",
    },
    {
      occurred_at: "2023-08-01 10:00:00",
      employee_name: "王五",
      department_name: "销售部",
      remark: "积分变动",
      points_delta: 5,
      operator_name: "系统管理员",
    },
  ]
  total.value = tableData.value.length;
}

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
  getTableData();
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
        <el-icon color="#0056c1" size="24"><Reading /></el-icon>
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
    <div class="main_right">
      <el-card class="system-running_statu">
        <div style="font-size: 18px;">系统运行状态</div>
        <div class="statu-info">
          <div class="statu-item">
            <div class="statu-name">人事数据同步</div>
            <div class="statu-value">正常</div>
          </div>
          <div class="statu-item">
            <div class="statu-name">商城库存对账</div>
            <div class="statu-value">正常</div>
          </div>
          <div class="statu-item" style="margin-bottom: 10px;">
            <div class="statu-name">审核链路延迟</div>
            <div class="statu-value" style="background-color: #d8e2ff; color: #004297;">&lt;1min</div>
          </div>
        </div>
        <el-button :icon="RefreshRight" color="#ebedf9" class="manual-sync-btn">手动强制同步</el-button>
      </el-card>
      <el-card class="quick-access">
        <div style="font-size: 18px;">快捷入口</div>
        <div class="quick-access-list">
          <div class="quick-access-item">
            <el-icon size="24"><UploadFilled /></el-icon>
            <div class="quick-access-name">批量录入</div>
          </div>
          <div class="quick-access-item">
            <el-icon size="24"><Download /></el-icon>
            <div class="quick-access-name">导出报表</div>
          </div>
          <div class="quick-access-item">
            <el-icon size="24"><Goods /></el-icon>
            <div class="quick-access-name">礼品上架</div>
          </div>
          <div class="quick-access-item">
            <el-icon size="24"><Stamp /></el-icon>
            <div class="quick-access-name">员工查询</div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
  <div class="recent-points-overview">
    <div class="header">
      <div style="font-size: 18px;">近期积分变动概况</div>
      <el-button text style="color: #0056c1;">查看完整明细</el-button>
    </div>
    <el-table :data="tableData" style="width: 100%;">
      <el-table-column label="操作时间" prop="occurred_at" />
      <el-table-column label="操作人" prop="operator_name"/>
      <el-table-column label="相关人员">
        <template #default="{ row }">
          {{ row.employee_name }}（{{ row.department_name }}）
        </template>
      </el-table-column>
      <el-table-column label="事由" prop="remark"/>
      <el-table-column label="积分变动" prop="points_delta">
        <template #default="{ row }" >
          <p :style="{ color: row.points_delta > 0 ? '#0056c1' : '#ba1a1a' }">{{ row.points_delta > 0 ? '+' + row.points_delta : row.points_delta }}</p>
        </template>
      </el-table-column>
    </el-table>
    <div style="display: flex; justify-content: flex-end; margin-top: 12px">
      <el-pagination
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        :page-size="meta.pageSize"
        :current-page="meta.page"
        @current-change="
          (p) => {
            meta.page = p;
          }
        "
      />
  </div>
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

  .main_right {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1.5;

    .system-running_statu {

      .statu-info {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        border-bottom: 1px solid #c1c6d6;

        .statu-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;

          .statu-value {
            padding: 0 10px;
            font-size: 13px;
            color: #15803d;
            background-color: #dbfbe6;
          }
        }
      }

      .manual-sync-btn {
        margin-top: 10px;
        width: 100%;
      }
    }

    .quick-access {
      .quick-access-list {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(2, minmax(0, 1fr));
        gap: 10px;

        .quick-access-item {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          border: 1px solid #c1c6d6;
        }
      }
    }
  }
}

.recent-points-overview {
  margin-top: 20px;
  background-color: #fff;

  .header {
    padding: 5px 15px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #c1c6d6;
  }

  :deep(.el-table__header th) {
    background-color: #f9f9ff;
    font-size: 14px;
  }

  :deep(.el-table__body) {
    font-size: 14px;
  }

  p {
    margin: 0;
  }
}
</style>
