const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const jsonPath = path.resolve(__dirname, '../test-cases/master-testcases.json');
const xlsxPath = path.resolve(__dirname, '../test-cases/master-testcases.xlsx');

async function main() {
  if (!fs.existsSync(jsonPath)) {
    console.error('Không tìm thấy file:', jsonPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const cases = Array.isArray(data.cases) ? data.cases : [];
  const runs = Array.isArray(data.runs) ? data.runs : [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Operon Hub QA Tester';
  workbook.created = new Date();

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  const headerFont = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  // =========================================================================
  // Sheet 1: Master_Cases
  // =========================================================================
  const wsMaster = workbook.addWorksheet('Master_Cases', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsMaster.columns = [
    { header: 'TC_ID', key: 'TC_ID', width: 15 },
    { header: 'Module', key: 'Module', width: 12 },
    { header: 'Feature', key: 'Feature', width: 38 },
    { header: 'Spec_Ref', key: 'Spec_Ref', width: 22 },
    { header: 'Target_Files', key: 'Target_Files', width: 36 },
    { header: 'Type', key: 'Type', width: 14 },
    { header: 'Preconditions', key: 'Preconditions', width: 26 },
    { header: 'Steps', key: 'Steps', width: 44 },
    { header: 'Expected_Result', key: 'Expected_Result', width: 34 },
    { header: 'Actual_Result', key: 'Actual_Result', width: 34 },
    { header: 'Status', key: 'Status', width: 12 },
    { header: 'Last_Task_ID', key: 'Last_Task_ID', width: 19 },
    { header: 'Last_Tested_At', key: 'Last_Tested_At', width: 15 },
  ];

  for (const tc of cases) {
    const row = wsMaster.addRow({
      TC_ID: tc.tc_id ?? '',
      Module: tc.module ?? '',
      Feature: tc.feature ?? '',
      Spec_Ref: tc.spec_ref ?? '',
      Target_Files: Array.isArray(tc.target_files)
        ? tc.target_files.join('\n')
        : (tc.target_files ?? ''),
      Type: tc.type ?? '',
      Preconditions: tc.preconditions ?? '',
      Steps: Array.isArray(tc.steps)
        ? tc.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
        : (tc.steps ?? ''),
      Expected_Result: tc.expected_result ?? '',
      Actual_Result: tc.actual_result ?? '',
      Status: tc.status ?? '',
      Last_Task_ID: tc.last_task_id ?? '',
      Last_Tested_At: tc.last_tested_at ?? '',
    });

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = {
        vertical: 'top',
        horizontal: colNumber === 1 || colNumber === 2 || colNumber === 6 || colNumber === 11 || colNumber === 12 || colNumber === 13 ? 'center' : 'left',
        wrapText: true,
      };
      cell.border = thinBorder;

      if (colNumber === 11) {
        const statusVal = String(cell.value ?? '').toUpperCase();
        if (statusVal === 'PASS') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
        } else if (statusVal === 'FAIL') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        }
      }
    });
  }

  const masterHeaderRow = wsMaster.getRow(1);
  masterHeaderRow.height = 26;
  masterHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });
  wsMaster.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, cases.length + 1), column: 13 },
  };

  // =========================================================================
  // Sheet 2: Test_Runs
  // =========================================================================
  const wsRuns = workbook.addWorksheet('Test_Runs', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsRuns.columns = [
    { header: 'Run_Date', key: 'Run_Date', width: 14 },
    { header: 'Task_ID', key: 'Task_ID', width: 22 },
    { header: 'Total_Executed', key: 'Total_Executed', width: 16 },
    { header: 'Passed', key: 'Passed', width: 12 },
    { header: 'Failed', key: 'Failed', width: 12 },
    { header: 'Pass_Rate', key: 'Pass_Rate', width: 12 },
    { header: 'Regression_Matched', key: 'Regression_Matched', width: 38 },
    { header: 'Test_Log_File', key: 'Test_Log_File', width: 46 },
  ];

  for (const r of runs) {
    const total = Number(r.total_executed ?? 0);
    const passed = Number(r.passed ?? 0);
    const rate = total > 0 ? `${Math.round((passed / total) * 100)}%` : '0%';
    const row = wsRuns.addRow({
      Run_Date: r.run_date ?? '',
      Task_ID: r.task_id ?? '',
      Total_Executed: total,
      Passed: passed,
      Failed: Number(r.failed ?? 0),
      Pass_Rate: rate,
      Regression_Matched: Array.isArray(r.regression_matched)
        ? r.regression_matched.join(', ')
        : '',
      Test_Log_File: r.test_log_file ?? '',
    });

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = {
        vertical: 'top',
        horizontal: colNumber >= 3 && colNumber <= 6 ? 'center' : 'left',
        wrapText: true,
      };
      cell.border = thinBorder;

      if (colNumber === 6 && rate === '100%') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
      }
    });
  }

  const runsHeaderRow = wsRuns.getRow(1);
  runsHeaderRow.height = 26;
  runsHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });
  wsRuns.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, runs.length + 1), column: 8 },
  };

  // =========================================================================
  // Sheet 3: Phase1_Summary
  // =========================================================================
  const wsSummary = workbook.addWorksheet('Phase1_Summary');
  wsSummary.columns = [
    { header: 'Hạng mục thống kê', key: 'category', width: 32 },
    { header: 'Phân loại', key: 'label', width: 22 },
    { header: 'Tổng số TC', key: 'total', width: 14 },
    { header: 'PASS', key: 'passed', width: 12 },
    { header: 'FAIL', key: 'failed', width: 12 },
    { header: 'Tỷ lệ đạt', key: 'rate', width: 14 },
  ];

  const totalPass = cases.filter((c) => c.status === 'PASS').length;
  const totalFail = cases.filter((c) => c.status === 'FAIL').length;

  const summaryRows = [
    {
      category: 'Tổng hợp Giai đoạn 1 (Phase 1)',
      label: 'Tất cả Test Cases',
      total: cases.length,
      passed: totalPass,
      failed: totalFail,
      rate: cases.length > 0 ? `${Math.round((totalPass / cases.length) * 100)}%` : '0%',
    },
  ];

  const moduleMap = new Map();
  const typeMap = new Map();
  for (const tc of cases) {
    const mod = String(tc.module ?? 'other').toUpperCase();
    const modStat = moduleMap.get(mod) ?? { total: 0, passed: 0, failed: 0 };
    modStat.total += 1;
    if (tc.status === 'PASS') modStat.passed += 1;
    if (tc.status === 'FAIL') modStat.failed += 1;
    moduleMap.set(mod, modStat);

    const rawType = String(tc.type ?? 'OTHER').toUpperCase();
    const normType = rawType === 'DB' ? 'DATABASE' : rawType;
    const typeStat = typeMap.get(normType) ?? { total: 0, passed: 0, failed: 0 };
    typeStat.total += 1;
    if (tc.status === 'PASS') typeStat.passed += 1;
    if (tc.status === 'FAIL') typeStat.failed += 1;
    typeMap.set(normType, typeStat);
  }

  for (const [mod, stat] of moduleMap.entries()) {
    summaryRows.push({
      category: 'Theo Phân hệ (Module)',
      label: mod,
      total: stat.total,
      passed: stat.passed,
      failed: stat.failed,
      rate: stat.total > 0 ? `${Math.round((stat.passed / stat.total) * 100)}%` : '0%',
    });
  }

  for (const [tp, stat] of typeMap.entries()) {
    summaryRows.push({
      category: 'Theo Loại kiểm thử (Type)',
      label: tp,
      total: stat.total,
      passed: stat.passed,
      failed: stat.failed,
      rate: stat.total > 0 ? `${Math.round((stat.passed / stat.total) * 100)}%` : '0%',
    });
  }

  for (const item of summaryRows) {
    const row = wsSummary.addRow(item);
    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: item.label === 'Tất cả Test Cases',
        color: { argb: 'FF0F172A' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber >= 3 ? 'center' : 'left',
      };
      cell.border = thinBorder;
      if (item.label === 'Tất cả Test Cases') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      }
    });
  }

  const summaryHeaderRow = wsSummary.getRow(1);
  summaryHeaderRow.height = 26;
  summaryHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  await workbook.xlsx.writeFile(xlsxPath);
  console.log(
    `[OK] Đã đồng bộ ${cases.length} test cases và ${runs.length} lượt chạy sang ${xlsxPath} (exceljs MIT)`,
  );
}

main().catch((err) => {
  console.error('[ERROR] Đồng bộ Excel thất bại:', err);
  process.exit(1);
});
