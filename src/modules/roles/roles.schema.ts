import { z } from 'zod';

export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.coerce.number().int().positive()),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
