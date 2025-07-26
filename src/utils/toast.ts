import toast from "react-hot-toast";

export const toastMessages = {
  // Success messages
  tableDeleted: (tableName: string) => 
    toast.success(`Table "${tableName}" has been deleted successfully`),
  
  documentDeleted: () => 
    toast.success("Document has been deleted successfully"),
  
  documentCreated: () => 
    toast.success("Document has been created successfully"),
  
  documentUpdated: () => 
    toast.success("Document has been updated successfully"),
  
  tableCreated: (tableName: string) => 
    toast.success(`Table "${tableName}" has been created successfully`),
  
  // ALTER operation messages
  alterSuccess: () => 
    toast.success("Table schema has been updated successfully"),
  
  alterError: (message: string) => 
    toast.error(`Schema update failed: ${message}`),
  
  // Error messages
  error: (message: string) => 
    toast.error(message),
  
  generalError: (operation: string, error?: Error | unknown) => 
    toast.error(`Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`),
  
  // Info/Warning messages
  selectTable: () => 
    toast.error("Please select a table first"),
  
  // Simple confirmation method using window.confirm but with toast feedback
  confirmDelete: async (
    itemName: string, 
    onConfirm: () => Promise<void> | void,
    type: 'table' | 'document' = 'table'
  ) => {
    const message = type === 'table' 
      ? `Are you sure you want to delete table "${itemName}"? This action cannot be undone.`
      : `Are you sure you want to delete this document? This action cannot be undone.`;
    
    if (window.confirm(message)) {
      try {
        await onConfirm();
        if (type === 'table') {
          toastMessages.tableDeleted(itemName);
        } else {
          toastMessages.documentDeleted();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toastMessages.error(`Failed to delete ${type}: ${errorMessage}`);
      }
    }
  },
  
  // Loading states
  loading: (message: string) => toast.loading(message),
  
  dismiss: (toastId: string) => toast.dismiss(toastId),
  dismissAll: () => toast.dismiss(),
};
