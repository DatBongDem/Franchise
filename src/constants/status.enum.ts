export const StatusEnum = {
    Success: "Success",
    Failed: "Failed",
    // Trạng thái đơn hàng đang tạo
    Creating: "Creating",
    // Trạng thái đơn hàng đã bấm gửi
    Pending: "Pending",
    // Đã lấy hàng đơn từ cửa hàng
    PickedUp: "PickedUp",
    // Chờ nấu tại bếp
    WaitingForCooking: "WaitingForCooking",
    // Đang nấu
    Cooking: "Cooking",
    // Đã nấu xong, chờ giao
    Cooked: "Cooked",
    // Lấy đơn hàng từ nhà bếp
    TakenFromKitchen: "TakenFrom",
    // Đơn hàng đã đến nơi giao
    Arrived: "Arrived",
    // Đơn hàng đã nhận hoàn thành
    Completed: "Completed",
    // Trạng thái đơn hàng bị hủy
    Canceled: "Canceled",

    Expired: "Expired",
    InProgress: "InProgress",
    Express: "Express",
    Fast: "Fast",
    Normal: "Normal",
    Uncooked: "Uncooked",
    Delivered: "Delivered",
    Recieved: "Recieved"
} as const;

export type OrderStatus = typeof StatusEnum[keyof typeof StatusEnum];
