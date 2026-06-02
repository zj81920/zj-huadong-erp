import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALL_MODULES = JSON.stringify(["business", "projects", "procurement", "contracts", "finance", "hr", "settings"]);

const DEFAULT_ROLES = [
  { code: "initiator", name: "经办人", description: "发起审批流程的经办人员", isProjectRole: false, accessibleModules: JSON.stringify(["business", "procurement", "finance"]), isGlobalVisible: false, sort: 1 },
  { code: "dept_head", name: "部门负责人", description: "各部门负责人，审批本部门事务", isProjectRole: false, accessibleModules: JSON.stringify(["business", "projects", "projects.list", "projects.plans", "projects.progress", "projects.outsourcing", "procurement", "contracts", "finance", "hr", "settings"]), isGlobalVisible: false, sort: 2 },
  { code: "project_manager", name: "项目经理", description: "根据项目动态解析的项目经理", isProjectRole: true, accessibleModules: JSON.stringify(["business", "projects", "projects.list", "projects.plans", "projects.progress", "projects.outsourcing", "procurement", "contracts", "finance"]), isGlobalVisible: false, sort: 3 },
  { code: "pmo", name: "项目管理部", description: "项目管理部审批人员", isProjectRole: false, accessibleModules: JSON.stringify(["projects", "projects.list", "projects.plans", "projects.progress", "projects.outsourcing", "procurement", "contracts", "finance"]), isGlobalVisible: false, sort: 4 },
  { code: "admin", name: "行政", description: "行政管理相关审批人员", isProjectRole: false, accessibleModules: JSON.stringify(["hr", "contracts", "finance"]), isGlobalVisible: false, sort: 5 },
  { code: "procurement", name: "采购部", description: "采购部门审批人员", isProjectRole: false, accessibleModules: JSON.stringify(["procurement", "contracts", "finance"]), isGlobalVisible: false, sort: 6 },
  { code: "production", name: "设计负责人/生产经理", description: "根据项目动态解析的设计负责人", isProjectRole: true, accessibleModules: JSON.stringify(["projects", "procurement", "finance"]), isGlobalVisible: false, sort: 7 },
  { code: "finance", name: "财务", description: "财务审批人员", isProjectRole: false, accessibleModules: JSON.stringify(["finance", "contracts"]), isGlobalVisible: false, sort: 8 },
  { code: "cashier", name: "出纳", description: "出纳确认付款，作为财务流程末端节点", isProjectRole: false, accessibleModules: JSON.stringify(["finance"]), isGlobalVisible: false, sort: 9 },
  { code: "vice_gm", name: "副总经理", description: "副总经理审批", isProjectRole: false, accessibleModules: ALL_MODULES, isGlobalVisible: true, sort: 10 },
  { code: "gm", name: "总经理", description: "总经理审批", isProjectRole: false, accessibleModules: ALL_MODULES, isGlobalVisible: true, sort: 11 },
  { code: "chairman", name: "董事长", description: "董事长审批", isProjectRole: false, accessibleModules: ALL_MODULES, isGlobalVisible: true, sort: 12 },
];

async function main() {
  console.log("🌱 开始初始化数据...");

  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isProjectRole: role.isProjectRole,
        accessibleModules: role.accessibleModules,
        isGlobalVisible: role.isGlobalVisible,
        sort: role.sort,
      },
      create: role,
    });
  }
  console.log(`✅ 已初始化 ${DEFAULT_ROLES.length} 个默认角色（含模块权限）`);

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: { password: "admin123" },
    create: {
      username: "admin",
      password: "admin123",
      realName: "系统管理员",
      department: "信息部",
      role: "admin",
      isActive: true,
    },
  });

  const allRoles = await prisma.role.findMany();
  for (const role of allRoles) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: adminUser.id, roleId: role.id },
      },
      update: {},
      create: { userId: adminUser.id, roleId: role.id },
    });
  }
  console.log(`✅ 已创建管理员账号 admin/admin123 并分配所有角色`);

  console.log("🎉 数据初始化完成！");
}

main()
  .catch((e) => {
    console.error("❌ 初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
