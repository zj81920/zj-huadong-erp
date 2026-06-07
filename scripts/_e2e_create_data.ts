/**
 * E2E 测试数据批量创建 - 使用 fetch API
 */
const BASE = 'http://localhost:3001';

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/([^;]+)/);
  return match ? match[1] : '';
}

async function apiPost(path: string, body: Record<string, unknown>, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log('登录 e2e_tester...');
  const cookie = await login('e2e_tester', '123456');
  console.log('cookie:', cookie ? 'OK' : 'FAILED');

  if (!cookie) {
    console.error('登录失败！');
    return;
  }

  const results: string[] = [];

  // #6 supplier_change
  console.log('\n创建供应商（变更测试）...');
  try {
    const r = await apiPost('/api/suppliers', {
      name: 'E2E变更测试供应商',
      nature: '企业',
      status: '当前有效',
      contact: '变更联系人',
      phone: '13900002222',
      email: 'change@test.com',
      bankName: '变更银行',
      bankAccount: '6222000000000002',
    }, cookie);
    const sid = r.data?.id || r.data?.data?.id;
    results.push(`supplier_change: ${JSON.stringify(r.status)} id=${sid}`);
    if (sid) {
      const sr = await apiPost(`/api/suppliers/${sid}/submit-approval`, {}, cookie);
      results.push(`  submit: ${sr.status}`);
    }
  } catch(e: any) { results.push(`supplier_change ERROR: ${e.message}`); }

  // #7 supplier_reject
  console.log('\n创建供应商（驳回测试）...');
  try {
    const r = await apiPost('/api/suppliers', {
      name: 'E2E驳回测试供应商',
      nature: '企业',
      status: '当前有效',
      contact: '驳回联系人',
      phone: '13900003333',
      email: 'reject@test.com',
    }, cookie);
    const sid = r.data?.id || r.data?.data?.id;
    results.push(`supplier_reject: ${JSON.stringify(r.status)} id=${sid}`);
    if (sid) {
      await apiPost(`/api/suppliers/${sid}/submit-approval`, {}, cookie);
    }
  } catch(e: any) { results.push(`supplier_reject ERROR: ${e.message}`); }

  // #9 non_contract_expense
  console.log('\n创建其他支付...');
  try {
    const r = await apiPost('/api/non-contract-expenses', {
      payeeName: 'E2E测试收款方',
      payeeAccount: '6222000000000010',
      payeeBank: '测试银行',
      amount: 5000,
      purpose: 'E2E测试其他支付',
      paymentDate: new Date().toISOString().split('T')[0],
      bankAccountId: 1,
    }, cookie);
    const id = r.data?.id || r.data?.data?.id;
    results.push(`non_contract_expense: ${JSON.stringify(r.status)} id=${id}`);
    if (id) await apiPost(`/api/non-contract-expenses/${id}/submit-approval`, {}, cookie);
  } catch(e: any) { results.push(`non_contract_expense ERROR: ${e.message}`); }

  // #10 expense_report
  console.log('\n创建费用报销...');
  try {
    const r = await apiPost('/api/expense-reports', {
      payeeName: 'E2E报销人', payeeAccount: '6222000000000011',
      payeeBank: '报销银行', amount: 3000,
      purpose: 'E2E测试费用报销',
      paymentDate: new Date().toISOString().split('T')[0],
      bankAccountId: 1,
    }, cookie);
    const id = r.data?.id || r.data?.data?.id;
    results.push(`expense_report: ${JSON.stringify(r.status)} id=${id}`);
    if (id) await apiPost(`/api/expense-reports/${id}/submit-approval`, {}, cookie);
  } catch(e: any) { results.push(`expense_report ERROR: ${e.message}`); }

  // #11 lending_out
  console.log('\n创建借出款...');
  try {
    const r = await apiPost('/api/lending-out', {
      borrowerName: 'E2E借款人', borrowerAccount: '6222000000000012',
      borrowerBank: '借款银行', amount: 10000,
      purpose: 'E2E测试借出款',
      paymentDate: new Date().toISOString().split('T')[0],
      bankAccountId: 1,
    }, cookie);
    const id = r.data?.id || r.data?.data?.id;
    results.push(`lending_out: ${JSON.stringify(r.status)} id=${id}`);
    if (id) await apiPost(`/api/lending-out/${id}/submit-approval`, {}, cookie);
  } catch(e: any) { results.push(`lending_out ERROR: ${e.message}`); }

  // #12 purchase_request
  console.log('\n创建采购需求...');
  try {
    const r = await apiPost('/api/purchase-requests', {
      title: 'E2E测试采购需求',
      description: '测试用采购需求',
      projectId: 1,
      totalAmount: 50000,
    }, cookie);
    const id = r.data?.id || r.data?.data?.id;
    results.push(`purchase_request: ${JSON.stringify(r.status)} id=${id}`);
    if (id) await apiPost(`/api/purchase-requests/${id}/submit-approval`, {}, cookie);
  } catch(e: any) { results.push(`purchase_request ERROR: ${e.message}`); }

  // #14 expense_contract
  console.log('\n创建支出合同...');
  try {
    const r = await apiPost('/api/expense-contracts', {
      contractName: 'E2E测试支出合同',
      supplierName: 'E2E测试供应商B',
      projectId: 1, totalAmount: 50000,
      bankAccountId: 1,
      contractDate: new Date().toISOString().split('T')[0],
      paymentTerms: '货到付款',
    }, cookie);
    const id = r.data?.id || r.data?.data?.id;
    results.push(`expense_contract: ${JSON.stringify(r.status)} id=${id}`);
    if (id) await apiPost(`/api/expense-contracts/${id}/submit-approval`, {}, cookie);
  } catch(e: any) { results.push(`expense_contract ERROR: ${e.message}`); }

  // #16 income_contract
  console.log('\n创建收入合同...');
  try {
    const r = await apiPost('/api/income-contracts', {
      contractName: 'E2E测试收入合同',
      clientName: '测试客户有限公司',
      projectId: 1, totalAmount: 100000,
      bankAccountId: 1,
      contractDate: new Date().toISOString().split('T')[0],
      paymentTerms: '预付50%',
    }, cookie);
    const id = r.data?.id || r.data?.data?.id;
    results.push(`income_contract: ${JSON.stringify(r.status)} id=${id}`);
    if (id) await apiPost(`/api/income-contracts/${id}/submit-approval`, {}, cookie);
  } catch(e: any) { results.push(`income_contract ERROR: ${e.message}`); }

  console.log('\n===== 结果 =====');
  console.log(results.join('\n'));
}

main();
