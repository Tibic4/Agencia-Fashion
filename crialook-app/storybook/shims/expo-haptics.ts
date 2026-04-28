// Web shim — haptics are no-ops in the browser.
export const impactAsync = async () => {};
export const notificationAsync = async () => {};
export const selectionAsync = async () => {};
export const ImpactFeedbackStyle = { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' } as const;
export const NotificationFeedbackType = { Success: 'Success', Warning: 'Warning', Error: 'Error' } as const;
