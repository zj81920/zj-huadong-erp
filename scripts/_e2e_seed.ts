import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // 1. 创建角色 role_测试全模块
  const role = await p.role.upsert({
    where: { code: 'role_测试全模块' },
    update: {
      name: '测试全模块',
      modulePermissions: JSON.stringify({
        business: { create: true, read: true, update: true, delete: true },
        projects: { create: true, read: true, update: true, delete: true },
        procurement: { create: true, read: true, update: true, delete: true },
        contracts: { create: true, read: true, update: true, delete: true },
        finance: { create: true, read: true, update: true, delete: true },
      }),
      isActive: true,
    },
    create: {
      code: 'role_测试全模块',
      name: '测试全模块',
      modulePermissions: JSON.stringify({
        business: { create: true, read: true, update: true, delete: true },
        projects: { create: true, read: true, update: true, delete: true },
        procurement: { create: true, read: true, update: true, delete: true },
        contracts: { create: true, read: true, update: true, delete: true },
        finance: { create: true, read: true, update: true, delete: true },
      }),
      isActive: true,
    },
  });
  console.log('✅ 角色:', role.code);

  // 2. 创建用户 e2e_tester
  const user = await p.user.upsert({
    where: { username: 'e2e_tester' },
    update: { password: '123456', realName: '测试员', isActive: true },
    create: {
      username: 'e2e_tester',
      password: '123456',
      realName: '测试员',
      isActive: true,
    },
  });
  console.log('✅ 用户:', user.username);

  // 3. 绑定角色
  await p.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  console.log('✅ 已绑定角色关系');

  await p.$disconnect();
  console.log('🎉 种子数据创建完成');
}
main();
