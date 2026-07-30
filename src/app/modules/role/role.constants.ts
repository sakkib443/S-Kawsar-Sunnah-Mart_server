// ── Admin permission catalogue ───────────────────────────────────
// Granular permissions assignable to admin users. Superadmins bypass
// all permission checks (see authorizePermission middleware).
export const ALL_PERMISSIONS: string[] = [
    'manage_products',
    'manage_orders',
    'manage_offers',
    'manage_coupons',
    'manage_categories',
    'manage_users',
    'manage_roles',
    'view_analytics',
    'manage_reviews',
    'manage_site_content',
];
