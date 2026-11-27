import { describe, expect, it } from 'vitest';
import {
  createPaymentCategorySchema,
  createPaymentDisbursementSchema,
  createPaymentSchema,
  paymentStatusActionSchema,
} from '@/modules/payments/payments.schema';
import { validatePaymentAttachmentFile } from '@/modules/payments/payments-collab.service';

describe('Payments Module Validation & Security Guards', () => {
  it('validates vendor payment schema and enforces linkedAdvanceId on ADVANCE_SETTLEMENT', () => {
    const validVendor = createPaymentSchema.parse({
      paymentType: 'VENDOR_PAYMENT',
      categoryId: 2,
      title: 'Thanh toán hóa đơn Cloud Q4',
      description: 'Thanh toán dịch vụ hạ tầng theo hợp đồng 2026.',
      paymentMethod: 'BANK_TRANSFER',
      beneficiaryType: 'VENDOR',
      beneficiaryName: 'Công ty TNHH Cloud Việt',
      beneficiaryTaxCode: '0314567890',
      bankName: 'Techcombank',
      bankAccountNo: '19034567890011',
      items: [
        {
          description: 'Cụm Kubernetes',
          invoiceNo: 'VAT-2026-999',
          invoiceDate: '2026-11-26',
          quantity: 1,
          unitPrice: 20_000_000,
          taxRate: 10,
        },
      ],
    });
    expect(validVendor.items).toHaveLength(1);

    const missingAdvance = createPaymentSchema.safeParse({
      paymentType: 'ADVANCE_SETTLEMENT',
      categoryId: 1,
      title: 'Quyết toán tạm ứng sự kiện',
      description: 'Quyết toán chi phí hội nghị khách hàng.',
      paymentMethod: 'BANK_TRANSFER',
      beneficiaryType: 'EMPLOYEE',
      beneficiaryName: 'Nguyễn Văn A',
      items: [{ description: 'In ấn', quantity: 1, unitPrice: 1_000_000, taxRate: 0 }],
    });
    expect(missingAdvance.success).toBe(false);
  });

  it('requires bankTransactionRef for BANK_TRANSFER disbursements and note for REQUEST_REVISION', () => {
    const missingRef = createPaymentDisbursementSchema.safeParse({
      disbursementDate: '2026-11-26',
      amount: 5_000_000,
      paymentMethod: 'BANK_TRANSFER',
    });
    expect(missingRef.success).toBe(false);

    const validCash = createPaymentDisbursementSchema.safeParse({
      disbursementDate: '2026-11-26',
      amount: 2_000_000,
      paymentMethod: 'CASH',
    });
    expect(validCash.success).toBe(true);

    const missingRevisionNote = paymentStatusActionSchema.safeParse({
      action: 'REQUEST_REVISION',
      note: '',
    });
    expect(missingRevisionNote.success).toBe(false);

    const validCat = createPaymentCategorySchema.parse({
      code: 'travel_ops',
      name: 'Công tác phí',
      nameEn: 'Travel Expenses',
      defaultPaymentType: 'REIMBURSEMENT',
    });
    expect(validCat.code).toBe('TRAVEL_OPS');
  });

  it('blocks oversized or disallowed attachment MIME types', () => {
    expect(
      validatePaymentAttachmentFile({
        name: 'hoa-don-vat.pdf',
        type: 'application/pdf',
        size: 120_000,
      }).safeExt,
    ).toBe('.pdf');

    expect(() =>
      validatePaymentAttachmentFile({
        name: 'malware.exe',
        type: 'application/x-msdownload',
        size: 1024,
      }),
    ).toThrow();

    expect(() =>
      validatePaymentAttachmentFile({
        name: 'huge.pdf',
        type: 'application/pdf',
        size: 15 * 1024 * 1024,
      }),
    ).toThrow();
  });
});
