import { describe, expect, it } from 'vitest';
import { computeWorkloadMatrix } from '@/lib/portable/workload-calculator';

describe('portable/workload-calculator', () => {
  it('subtracts weekends, HRM holidays and approved half/full leaves and flags overload', () => {
    // 2026-11-23 (Mon) to 2026-11-27 (Fri) = 5 weekdays
    // Holiday: 2026-11-25 (Wed) -> capacity 0
    // Approved Leave AM: 2026-11-26 (Thu) -> capacity 4h
    // Remaining capacity: Mon(8) + Tue(8) + Wed(0) + Thu(4) + Fri(8) = 28h
    const result = computeWorkloadMatrix({
      startDate: '2026-11-23',
      endDate: '2026-11-27',
      employees: [
        { employeeId: 1, fullName: 'Nguyễn Văn A', employeeCode: 'NV001', dailyCapacityHours: 8 },
      ],
      tasks: [
        {
          taskId: 100,
          taskKey: 'ERP-1',
          title: 'Core API',
          assigneeEmployeeIds: [1],
          startDate: '2026-11-23',
          dueDate: '2026-11-24',
          estimatedHours: 20, // 10h/day -> overloaded (125%) on Mon & Tue
        },
      ],
      holidayDates: ['2026-11-25'],
      approvedLeaves: [
        {
          employeeId: 1,
          startDate: '2026-11-26',
          endDate: '2026-11-26',
          startSession: 'AM',
          endSession: 'AM',
        },
      ],
    });

    expect(result.dates).toHaveLength(5);
    expect(result.rows).toHaveLength(1);
    const empRow = result.rows[0];
    expect(empRow.totalCapacityHours).toBe(28);
    expect(empRow.totalAllocatedHours).toBe(20);
    expect(empRow.overloadedDays).toBe(2);
    expect(empRow.days[0].heatLevel).toBe('OVERLOADED');
    expect(empRow.days[2].isHoliday).toBe(true);
    expect(empRow.days[2].capacityHours).toBe(0);
    expect(empRow.days[3].leaveHours).toBe(4);
    expect(empRow.days[3].capacityHours).toBe(4);
    expect(result.summary.overloadedEmployeeCount).toBe(1);
  });
});
