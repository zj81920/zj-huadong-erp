import { PrismaClient } from "@prisma/client";
import { MODULE_CONFIG } from "../src/lib/module-config";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始初始化数据...");

  // 同步经营主体
  const orgs = [
    { code: 'HQ', name: '总公司', shortName: '总公司', type: 'PARENT', sort: 1 },
    { code: 'BRANCH', name: '安徽华东化工医药工程有限责任公司', shortName: '分公司', type: 'BRANCH', sort: 2 },
    { code: 'CONSULT', name: '咨询公司', shortName: '咨询公司', type: 'CONSULTING', sort: 3 },
    { code: 'AFFILIATED', name: '挂靠公司', shortName: '挂靠公司', type: 'AFFILIATED', sort: 4 },
  ];
  for (const org of orgs) {
    await prisma.organization.upsert({
      where: { code: org.code },
      update: { name: org.name, shortName: org.shortName, type: org.type, sort: org.sort },
      create: org,
    });
  }
  console.log(`✅ 已同步 ${orgs.length} 个经营主体`);

  // 仅创建管理员账号，角色由管理员在系统设置中自行配置
  await prisma.user.upsert({
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
  console.log("✅ 已创建管理员账号 admin/admin123");

  // 同步模块清单到 approval_module_config 表
  console.log("📋 同步模块清单...");
  for (const config of MODULE_CONFIG) {
    await prisma.approvalModuleConfig.upsert({
      where: { moduleKey: config.key },
      update: { moduleName: config.name, groupName: config.group, isActive: true },
      create: { moduleKey: config.key, moduleName: config.name, groupName: config.group },
    });
  }
  // 软删除配置中已移除的模块
  await prisma.approvalModuleConfig.updateMany({
    where: { moduleKey: { notIn: MODULE_CONFIG.map((m) => m.key) } },
    data: { isActive: false },
  });
  console.log(`✅ 已同步 ${MODULE_CONFIG.length} 个模块`);

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
