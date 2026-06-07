import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const roles = await p.role.findMany({ select: { code: true, name: true, modulePermissions: true, isGlobalVisible: true } });
  console.log('=== ROLE PERMISSIONS ===');
  roles.forEach(r => console.log(`${r.code} | ${r.name} | isGlobal=${r.isGlobalVisible} | perms=${r.modulePermissions}`));
  await p.$disconnect();
}
main();
