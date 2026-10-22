export const Roles = {
    ADMIN: "ADMIN",
    MANAGER: "MANAGER",
    STORESTAFF: "STORESTAFF",
    KITCHENSTAFF: "KITCHENSTAFF",
    SUPPLYCOORDINATOR: "SUPPLYCOORDINATOR"
} as const;

export type UserRole = typeof Roles[keyof typeof Roles];
