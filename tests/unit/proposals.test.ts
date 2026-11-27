import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from 'kysely';
import type { DatabaseSchema } from '@/config/database';
import {
  calculateProposalLineTotals,
  canTransitionProposalStatus,
  formatProposalCode,
} from '@/lib/portable/proposal-calculator';
import { handleProposalApprovalCompletion } from '@/modules/proposals/proposal-approval-hook';
import {
  canCollaborateOnProposalStatus,
  validateProposalAttachmentFile,
} from '@/modules/proposals/proposals-collab.service';
import {
  createProposalCategorySchema,
  createProposalSchema,
  proposalStatusActionSchema,
} from '@/modules/proposals/proposals.schema';

describe('Portable Proposal Calculator (Zero Dependencies)', () => {
  it('calculates exact line totals and grand total without floating-point drift', () => {
    const result = calculateProposalLineTotals([
      { quantity: 3, unitPrice: 1_250_000 },
      { quantity: 2.5, unitPrice: 400_000.2 },
      { quantity: 1, unitPrice: 0 },
    ]);

    expect(result.items).toHaveLength(3);
    expect(result.items[0].lineTotal).toBe(3_750_000);
    expect(result.items[1].lineTotal).toBe(1_000_000.5);
    expect(result.items[2].lineTotal).toBe(0);
    expect(result.grandTotal).toBe(4_750_000.5);
  });

  it('guards against negative or NaN quantities and prices', () => {
    const result = calculateProposalLineTotals([
      { quantity: -5, unitPrice: 1000 },
      { quantity: Number.NaN, unitPrice: 5000 },
      { quantity: 2, unitPrice: -200 },
    ]);
    expect(result.grandTotal).toBe(0);
  });

  it('validates proposal lifecycle state transitions strictly', () => {
    expect(canTransitionProposalStatus('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionProposalStatus('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransitionProposalStatus('DRAFT', 'APPROVED')).toBe(false);
    expect(canTransitionProposalStatus('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransitionProposalStatus('PENDING_APPROVAL', 'NEEDS_REVISION')).toBe(true);
    expect(canTransitionProposalStatus('NEEDS_REVISION', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionProposalStatus('APPROVED', 'IN_EXECUTION')).toBe(true);
    expect(canTransitionProposalStatus('APPROVED', 'COMPLETED')).toBe(true);
    expect(canTransitionProposalStatus('IN_EXECUTION', 'COMPLETED')).toBe(true);
    expect(canTransitionProposalStatus('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransitionProposalStatus('REJECTED', 'APPROVED')).toBe(false);
  });

  it('formats standardized proposal codes with zero-padded sequence', () => {
    expect(formatProposalCode('PROP', 2026, 11, 1)).toBe('PROP-202611-0001');
    expect(formatProposalCode(' prop ', 2026, 5, 42)).toBe('PROP-202605-0042');
    expect(formatProposalCode('!!!', 2026, 12, 1005)).toBe('PROP-202612-1005');
  });
});

describe('Proposals Zod Validation & Attachment Guards', () => {
  it('validates proposal creation payload with itemized budget', () => {
    const parsed = createProposalSchema.parse({
      categoryId: 1,
      title: 'Đề xuất mua thiết bị phòng họp',
      content: 'Cần nâng cấp micro hội nghị và webcam 4K cho phòng họp lớn tầng 5.',
      priority: 'HIGH',
      items: [
        { itemName: 'Webcam 4K', unit: 'Chiếc', quantity: 2, unitPrice: 4_500_000 },
      ],
      submitImmediately: true,
    });
    expect(parsed.priority).toBe('HIGH');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.submitImmediately).toBe(true);
  });

  it('requires comment when requesting revision on a proposal', () => {
    const bad = proposalStatusActionSchema.safeParse({
      action: 'REQUEST_REVISION',
      comment: '  ',
    });
    expect(bad.success).toBe(false);

    const good = proposalStatusActionSchema.safeParse({
      action: 'REQUEST_REVISION',
      comment: 'Vui lòng đính kèm thêm 2 báo giá so sánh.',
    });
    expect(good.success).toBe(true);
  });

  it('validates bilingual proposal category creation', () => {
    const parsed = createProposalCategorySchema.parse({
      code: 'marketing_ops',
      name: 'Chiến dịch Marketing',
      nameEn: 'Marketing Campaigns',
      budgetThresholdHigh: 25_000_000,
      colorHex: '#7C3AED',
    });
    expect(parsed.code).toBe('MARKETING_OPS');
    expect(parsed.nameEn).toBe('Marketing Campaigns');
  });

  it('validates allowed proposal attachments and rejects oversized or unsafe MIME types', () => {
    const okPdf = validateProposalAttachmentFile({
      name: 'Bao_gia_NCC_2026.pdf',
      type: 'application/pdf',
      size: 204800,
    });
    expect(okPdf.safeExt).toBe('.pdf');

    expect(() =>
      validateProposalAttachmentFile({
        name: 'payload.exe',
        type: 'application/x-msdownload',
        size: 1024,
      }),
    ).toThrow(/Định dạng tệp/);

    expect(() =>
      validateProposalAttachmentFile({
        name: 'huge.pdf',
        type: 'application/pdf',
        size: 12 * 1024 * 1024,
      }),
    ).toThrow(/10MB/);
  });

  it('allows commenting and file upload ONLY when proposal status is PENDING_APPROVAL', () => {
    expect(canCollaborateOnProposalStatus('PENDING_APPROVAL')).toBe(true);
    expect(canCollaborateOnProposalStatus('DRAFT')).toBe(false);
    expect(canCollaborateOnProposalStatus('NEEDS_REVISION')).toBe(false);
    expect(canCollaborateOnProposalStatus('APPROVED')).toBe(false);
    expect(canCollaborateOnProposalStatus('REJECTED')).toBe(false);
    expect(canCollaborateOnProposalStatus('IN_EXECUTION')).toBe(false);
    expect(canCollaborateOnProposalStatus('COMPLETED')).toBe(false);
    expect(canCollaborateOnProposalStatus('CANCELLED')).toBe(false);
  });
});

describe('Proposal Core Approval Completion Hook', () => {
  function createMockTrx(proposalRow: { id: number; status: string; estimated_budget: number } | undefined) {
    const updates: Array<Record<string, unknown>> = [];
    const activities: Array<Record<string, unknown>> = [];

    const trx = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              forUpdate: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(proposalRow),
              }),
            }),
          }),
        }),
      }),
      updateTable: vi.fn().mockReturnValue({
        set: vi.fn((vals: Record<string, unknown>) => {
          updates.push(vals);
          return {
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn((vals: Record<string, unknown>) => {
          activities.push(vals);
          return {
            execute: vi.fn().mockResolvedValue([]),
          };
        }),
      }),
    } as unknown as Transaction<DatabaseSchema>;

    return { trx, updates, activities };
  }

  it('transitions PENDING_APPROVAL proposal to APPROVED and locks approved_budget', async () => {
    const { trx, updates, activities } = createMockTrx({
      id: 10,
      status: 'PENDING_APPROVAL',
      estimated_budget: 35_000_000,
    });

    await handleProposalApprovalCompletion(trx, {
      approvalRequestId: 99,
      moduleCode: 'proposals',
      entityType: 'proposals',
      entityId: 10,
      nextStatus: 'APPROVED',
      actorUserId: 2,
      comment: 'Đồng ý triển khai',
    });

    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('APPROVED');
    expect(updates[0].approved_budget).toBe(35_000_000);
    expect(updates[0].approved_at).toBeInstanceOf(Date);
    expect(activities).toHaveLength(1);
    expect(activities[0].action_type).toBe('APPROVED');
  });

  it('transitions PENDING_APPROVAL proposal to REJECTED and stores rejection_reason', async () => {
    const { trx, updates, activities } = createMockTrx({
      id: 11,
      status: 'PENDING_APPROVAL',
      estimated_budget: 15_000_000,
    });

    await handleProposalApprovalCompletion(trx, {
      approvalRequestId: 100,
      moduleCode: 'proposals',
      entityType: 'proposals',
      entityId: 11,
      nextStatus: 'REJECTED',
      actorUserId: 3,
      comment: 'Vượt ngân sách quý IV',
    });

    expect(updates[0].status).toBe('REJECTED');
    expect(updates[0].rejection_reason).toBe('Vượt ngân sách quý IV');
    expect(activities[0].action_type).toBe('REJECTED');
  });

  it('ignores non-PENDING_APPROVAL proposals safely (idempotent)', async () => {
    const { trx, updates } = createMockTrx({
      id: 12,
      status: 'APPROVED',
      estimated_budget: 10_000_000,
    });

    await handleProposalApprovalCompletion(trx, {
      approvalRequestId: 101,
      moduleCode: 'proposals',
      entityType: 'proposals',
      entityId: 12,
      nextStatus: 'APPROVED',
      actorUserId: 2,
      comment: null,
    });

    expect(updates).toHaveLength(0);
  });
});
