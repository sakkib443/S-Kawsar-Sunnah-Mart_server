import { z } from 'zod';
import { ALL_PERMISSIONS } from './role.constants';

export const updateUserRoleValidation = z.object({
    body: z.object({
        role: z.enum(['superadmin', 'admin', 'user']),
        permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional().default([]),
    }),
});
