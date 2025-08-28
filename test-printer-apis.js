#!/usr/bin/env node

/**
 * 打印机管理功能测试脚本
 * 运行方式: node test-printer-apis.js
 */

const baseUrl = 'http://localhost:4001/api/print';

async function testApi(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${baseUrl}${endpoint}`, options);
    const result = await response.json();
    
    console.log(`✓ ${method} ${endpoint}:`, response.status === 200 ? '成功' : `失败 (${response.status})`);
    if (response.status !== 200) {
      console.log('  错误:', result.error);
    }
    
    return result;
  } catch (error) {
    console.log(`✗ ${method} ${endpoint}: 请求失败`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('打印机管理功能测试');
  console.log('='.repeat(50));
  
  // 1. 测试打印机状态获取
  console.log('\n1. 测试打印机状态获取');
  await testApi('/status');
  
  // 2. 测试获取打印机列表
  console.log('\n2. 测试获取打印机列表');
  const printersResult = await testApi('/manage/printers');
  
  // 3. 测试创建新打印机
  console.log('\n3. 测试创建新打印机');
  const newPrinter = {
    name: '测试热敏打印机',
    type: 'thermal',
    location: 'cashier',
    connection_type: 'wifi',
    ip_address: '192.168.1.100',
    port: 9100,
    paper_width: 80,
    print_speed: 'medium',
    encoding: 'utf8',
    auto_cut: true,
    buzzer_enabled: false,
    density: 8
  };
  
  const createResult = await testApi('/manage/printers', 'POST', newPrinter);
  let printerId = null;
  if (createResult && createResult.success) {
    printerId = createResult.printer.id;
    console.log(`  新打印机ID: ${printerId}`);
  }
  
  // 4. 测试连接测试功能
  if (printerId) {
    console.log('\n4. 测试打印机连接');
    await testApi('/test-connection', 'POST', { printerId });
    
    // 5. 测试打印机诊断
    console.log('\n5. 测试打印机诊断');
    await testApi('/diagnosis', 'POST', { printerId });
  }
  
  // 6. 测试模板管理
  console.log('\n6. 测试打印模板管理');
  await testApi('/templates');
  
  const testTemplate = {
    name: '测试收银小票模板',
    type: 'receipt',
    content: `================================
{store_name}
{store_address}
================================
订单号: {order_number}
时间: {date} {time}
================================
{items}
================================
总计: {total}
================================`,
    paper_width: 80,
    font_size: 'medium',
    is_default: false
  };
  
  const templateResult = await testApi('/templates', 'POST', testTemplate);
  let templateId = null;
  if (templateResult && templateResult.success) {
    templateId = templateResult.template.id;
    console.log(`  新模板ID: ${templateId}`);
  }
  
  // 7. 测试打印队列
  console.log('\n7. 测试打印队列管理');
  await testApi('/queue');
  
  if (printerId) {
    const testJob = {
      printer_id: parseInt(printerId),
      job_type: 'test',
      priority: 5,
      content: `================================
测试打印任务
================================
时间: ${new Date().toLocaleString('zh-CN')}
测试内容: API功能验证
================================`,
      max_retries: 2
    };
    
    const jobResult = await testApi('/queue', 'POST', testJob);
    if (jobResult && jobResult.success) {
      console.log(`  新打印任务ID: ${jobResult.job.id}`);
    }
  }
  
  // 8. 测试配置备份
  console.log('\n8. 测试配置备份');
  await testApi('/backup-config', 'POST');
  
  // 9. 测试配置导出
  console.log('\n9. 测试配置导出');
  await testApi('/export-config');
  
  console.log('\n' + '='.repeat(50));
  console.log('测试完成！');
  console.log('='.repeat(50));
  
  // 清理测试数据
  if (printerId) {
    console.log('\n清理测试数据...');
    await testApi(`/manage/printers/${printerId}`, 'DELETE');
  }
  
  if (templateId) {
    await testApi(`/templates/${templateId}`, 'DELETE');
  }
}

// 检查是否为Node.js环境且有fetch支持
if (typeof fetch === 'undefined') {
  console.log('正在安装node-fetch依赖...');
  try {
    const { fetch: nodeFetch } = require('node-fetch');
    global.fetch = nodeFetch;
  } catch (error) {
    console.log('请先安装node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

// 运行测试
runTests().catch(console.error);