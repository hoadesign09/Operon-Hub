import { describe, expect, it } from 'vitest';
import type { ItRequestStatus } from '@/config/database';
import {
  DEFAULT_IT_REQUEST_CATEGORIES,
  IT_REQUEST_PERMISSIONS,
} from '@/modules/it-requests/it-requests.constants';
import {
  assignItRequestSchema,
  createItCategorySchema,
  createItCommentSchema,
  createItRequestSchema,
  transitionItRequestStatusSchema,
} from '@/modules/it-requests/it-requests.schema';
import {
  canCollaborateOnItRequestStatus,
  validateItAttachmentFile,
} from '@/modules/it-requests/it-requests-collab.service';

describe('IT Requests Module Validation & Business Rules', () => {
  it('defines 6 bilingual default IT categories with valid SLA bounds', () => {
    expect(DEFAULT_IT_REQUEST_CATEGORIES.length).toBe(6);
    for (const cat of DEFAULT_IT_REQUEST_CATEGORIES) {
      expect(cat.name.trim().length).toBeGreaterThan(2);
      expect(cat.nameEn.trim().length).toBeGreaterThan(2);
      expect(cat.slaResolutionHours).toBeGreaterThanOrEqual(cat.slaResponseHours);
    }
    expect(Object.values(IT_REQUEST_PERMISSIONS)).toEqual([
      'it_requests.read',
      'it_requests.create',
      'it_requests.manage',
      'it_requests.export',
    ]);
  });

  it('validates IT category SLA bounds and rejects resolution < response', () => {
    const valid = createItCategorySchema.safeParse({
      code: 'IT_PRINTER',
      name: 'Hỗ trợ Máy in',
      nameEn: 'Printer Support',
      requestKind: 'INCIDENT',
      requiresApproval: false,
      defaultPriority: 'MEDIUM',
      slaResponseHours: 2,
      slaResolutionHours: 8,
    });
    expect(valid.success).toBe(true);

    const invalid = createItCategorySchema.safeParse({
      code: 'IT_BAD_SLA',
      name: 'Lỗi SLA',
      slaResponseHours: 12,
      slaResolutionHours: 4,
    });
    expect(invalid.success).toBe(false);
  });

  it('validates create IT request payload and defaults submitImmediately to true', () => {
    const parsed = createItRequestSchema.parse({
      categoryId: 1,
      title: 'Không kết nối được Wifi tầng 5',
      description: 'Laptop kết nối Wifi công ty báo Limited Access từ 9h sáng nay.',
    });
    expect(parsed.submitImmediately).toBe(true);
    expect(parsed.estimatedCost).toBe(0);
  });

  it('enforces mandatory notes on WAIT_USER, RESOLVE, and REOPEN status transitions', () => {
    expect(
      transitionItRequestStatusSchema.safeParse({ action: 'WAIT_USER', note: '' }).success,
    ).toBe(false);
    expect(
      transitionItRequestStatusSchema.safeParse({
        action: 'WAIT_USER',
        note: 'Vui lòng gửi ảnh chụp màn hình mã lỗi VPN.',
      }).success,
    ).toBe(true);

    expect(
      transitionItRequestStatusSchema.safeParse({ action: 'RESOLVE', resolutionSummary: 'OK' })
        .success,
    ).toBe(false);
    expect(
      transitionItRequestStatusSchema.safeParse({
        action: 'RESOLVE',
        resolutionSummary: 'Đã cấp lại chứng chỉ SSL-VPN và xác nhận kết nối thành công.',
      }).success,
    ).toBe(true);

    expect(
      transitionItRequestStatusSchema.safeParse({ action: 'REOPEN', note: '' }).success,
    ).toBe(false);

    expect(
      transitionItRequestStatusSchema.safeParse({
        action: 'CLOSE',
        satisfactionRating: 5,
        satisfactionFeedback: 'Hỗ trợ rất nhanh!',
      }).success,
    ).toBe(true);
  });

  it('validates assignment and comment visibility schemas', () => {
    expect(
      assignItRequestSchema.safeParse({ assignedToUserId: 2, startImmediately: true }).success,
    ).toBe(true);
    expect(assignItRequestSchema.safeParse({ assignedToUserId: null }).success).toBe(true);

    expect(
      createItCommentSchema.parse({ content: 'Đã kiểm tra log FortiGate' }).visibility,
    ).toBe('PUBLIC');
    expect(
      createItCommentSchema.parse({
        content: 'Ghi chú nội bộ: reset LDAP token',
        visibility: 'INTERNAL_NOTE',
      }).visibility,
    ).toBe('INTERNAL_NOTE');
  });

  it('locks comments, attachments, and checklist mutations on terminal statuses only', () => {
    const activeStatuses: ItRequestStatus[] = [
      'DRAFT',
      'PENDING_APPROVAL',
      'OPEN',
      'IN_PROGRESS',
      'WAITING_USER',
      'RESOLVED',
    ];
    for (const st of activeStatuses) {
      expect(canCollaborateOnItRequestStatus(st)).toBe(true);
    }

    const lockedStatuses: ItRequestStatus[] = ['CLOSED', 'REJECTED', 'CANCELLED'];
    for (const st of lockedStatuses) {
      expect(canCollaborateOnItRequestStatus(st)).toBe(false);
    }
  });

  it('validates attachment MIME types, extensions, and 10MB size limit', () => {
    const okFile = validateItAttachmentFile({
      name: 'vpn-error-screenshot.png',
      type: 'image/png',
      size: 256_000,
    });
    expect(okFile.safeExt).toBe('.png');

    expect(() =>
      validateItAttachmentFile({
        name: 'malware.exe',
        type: 'application/x-msdownload',
        size: 1024,
      }),
    ).toThrow();

    expect(() =>
      validateItAttachmentFile({
        name: 'huge.pdf',
        type: 'application/pdf',
        size: 11 * 1024 * 1024,
      }),
    ).toThrow();
  });
});
