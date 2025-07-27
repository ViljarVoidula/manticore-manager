import React from 'react';

interface FormActionsProps {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  onSubmit,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  isLoading = false,
  disabled = false,
  className = 'flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700'
}) => {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onCancel}
        className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm lg:text-base"
      >
        {cancelLabel}
      </button>
      <button
        type={onSubmit ? 'button' : 'submit'}
        onClick={onSubmit}
        disabled={isLoading || disabled}
        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm lg:text-base"
      >
        {isLoading ? 'Loading...' : submitLabel}
      </button>
    </div>
  );
};
